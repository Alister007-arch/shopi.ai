import json
import sqlite3
import concurrent.futures
import pytest
from fastapi.testclient import TestClient
import tools


def test_concurrent_checkout_stock_oversell_protection(client: TestClient, test_db_path: str, auth_headers: dict):
    """
    Validates that concurrent checkout attempts cannot oversell inventory.
    When stock is 1, only 1 request must succeed, other concurrent requests
    must be rejected with insufficient stock, and final stock in DB must be 0.
    """
    # 1. Update product 1 to have exactly 1 unit in stock
    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET stock = 1 WHERE id = 1")
    cursor.execute("SELECT COUNT(*) FROM orders")
    initial_orders = cursor.fetchone()[0]
    conn.commit()
    conn.close()

    # 2. Prepare payload for buying 1 unit of product 1
    def attempt_checkout(thread_num):
        # Each thread gets its own unique idempotency key
        headers = {"Idempotency-Key": f"idemp-concurr-{thread_num}", **auth_headers}
        payload = {
            "items": [{"product_id": 1, "quantity": 1}],
            "customer_name": f"Concurrency Tester {thread_num}",
            "customer_email": f"tester{thread_num}@moss.internal",
            "shipping_address": {
                "recipient_name": f"Tester {thread_num}",
                "phone": "9876543210",
                "postal_code": "560034",
                "street_address": "123 Test Street",
                "city": "Bengaluru",
                "state": "Karnataka",
            },
        }
        resp = client.post("/api/order/checkout", json=payload, headers=headers)
        return resp.status_code, resp.json()

    # 3. Execute 5 concurrent checkout requests
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(attempt_checkout, i) for i in range(5)]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    # 4. Verify outcomes: EXACTLY 1 success (200), remaining 4 failures (400)
    successes = [r for r in results if r[0] == 200]
    failures = [r for r in results if r[0] == 400]

    assert len(successes) == 1, f"Expected exactly 1 successful checkout, got {len(successes)}"
    assert len(failures) == 4, f"Expected 4 failures due to stock exhaustion, got {len(failures)}"

    # Verify failure messages mention insufficient stock
    for status, data in failures:
        err_msg = (data.get("message") or data.get("detail") or "").lower()
        assert "insufficient stock" in err_msg

    # 5. Verify database integrity: stock is 0 and exactly 1 order was created
    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT stock FROM products WHERE id = 1")
    final_stock = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM orders")
    tester_orders_count = cursor.fetchone()[0]
    conn.close()

    assert final_stock == 0, f"Stock must be exactly 0, found {final_stock}"
    assert tester_orders_count == initial_orders + 1, f"Expected exactly 1 order from concurrent tester, found {tester_orders_count - initial_orders}"


def test_tools_atomic_confirm_and_place_order(test_db_path: str):
    """
    Directly tests tools.confirm_and_place_order atomic transaction
    and BEGIN IMMEDIATE semantics.
    """
    # Set stock to 2
    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET stock = 2 WHERE id = 2")
    conn.commit()
    conn.close()

    def call_tool(idx):
        payload = json.dumps([{"product_id": 2, "quantity": 2}])
        res_str = tools.confirm_and_place_order.invoke({
            "items_json": payload,
            "customer_name": f"Runner {idx}",
            "customer_address": "Test Address 402, Bengaluru 560034",
            "customer_email": f"runner{idx}@moss.internal",
            "idempotency_key": f"tool-atomic-{idx}",
        })
        return json.loads(res_str)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(call_tool, i) for i in range(3)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    successes = [r for r in results if r.get("status") == "success"]
    errors = [r for r in results if r.get("status") == "error"]

    assert len(successes) == 1
    assert len(errors) == 2
    for err in errors:
        assert "insufficient stock" in err.get("message", "").lower()
