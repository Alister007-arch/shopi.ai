import json
import sqlite3
import pytest
from fastapi.testclient import TestClient


def test_checkout_idempotency_via_header(client: TestClient, test_db_path: str, auth_headers: dict):
    """
    Sending the same Idempotency-Key header multiple times must return
    the original order and NOT create a duplicate order or decrement stock twice.
    """
    idemp_key = "idemp-header-test-abc-123"

    # Get initial stock of product 3
    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT stock FROM products WHERE id = 3")
    initial_stock = cursor.fetchone()[0]
    conn.close()

    payload = {
        "items": [{"product_id": 3, "quantity": 2}],
        "customer_name": "Idempotency Tester",
        "customer_email": "idemp_test@moss.internal",
        "shipping_address": {
            "recipient_name": "Idempotency Tester",
            "phone": "9876543210",
            "postal_code": "560034",
            "street_address": "404 Resilience Lane",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }

    # 1. First checkout attempt
    resp1 = client.post("/api/order/checkout", json=payload, headers={"Idempotency-Key": idemp_key, **auth_headers})
    assert resp1.status_code == 200, resp1.text
    data1 = resp1.json()
    order_id1 = data1["order_id"]
    order_num1 = data1["order_number"]

    # 2. Duplicate checkout attempt with identical key
    resp2 = client.post("/api/order/checkout", json=payload, headers={"Idempotency-Key": idemp_key, **auth_headers})
    assert resp2.status_code == 200, resp2.text
    data2 = resp2.json()

    # The replayed response should match the original order
    assert data2["order_id"] == order_id1
    assert data2["order_number"] == order_num1
    assert data2.get("is_replay") is True

    # 3. Check database: exactly 1 order placed, 1 idempotency key, stock decremented by 2 (not 4)
    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM orders WHERE user_id = (SELECT user_id FROM orders WHERE id = ?)", (order_id1,))
    order_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM idempotency_keys WHERE key = ?", (idemp_key,))
    key_count = cursor.fetchone()[0]

    cursor.execute("SELECT stock FROM products WHERE id = 3")
    final_stock = cursor.fetchone()[0]
    conn.close()

    assert order_count == 1, f"Expected exactly 1 order in DB, found {order_count}"
    assert key_count == 1, f"Expected 1 record in idempotency_keys table, found {key_count}"
    assert final_stock == initial_stock - 2, f"Stock should only decrement once: expected {initial_stock - 2}, got {final_stock}"


def test_checkout_idempotency_via_payload(client: TestClient, test_db_path: str, auth_headers: dict):
    """
    Passing idempotency_key inside the JSON request body must also trigger
    idempotent deduplication.
    """
    idemp_key = "idemp-payload-test-xyz-789"

    payload = {
        "items": [{"product_id": 4, "quantity": 1}],
        "customer_name": "Body Key Tester",
        "customer_email": "body_key@moss.internal",
        "idempotency_key": idemp_key,
        "shipping_address": {
            "recipient_name": "Body Key Tester",
            "phone": "9876543210",
            "postal_code": "560034",
            "street_address": "Flat 101, Indiranagar",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }

    resp1 = client.post("/api/order/checkout", json=payload, headers=auth_headers)
    assert resp1.status_code == 200
    data1 = resp1.json()

    resp2 = client.post("/api/order/checkout", json=payload, headers=auth_headers)
    assert resp2.status_code == 200
    data2 = resp2.json()

    assert data2["order_id"] == data1["order_id"]
    assert data2.get("is_replay") is True


def test_different_idempotency_keys_create_separate_orders(client: TestClient, test_db_path: str, auth_headers: dict):
    """
    Distinct idempotency keys must create distinct orders.
    """
    valid_address = {
        "recipient_name": "Valid Recipient",
        "phone": "9876543210",
        "postal_code": "560034",
        "street_address": "100 MG Road",
        "city": "Bengaluru",
        "state": "Karnataka",
    }
    payload1 = {
        "items": [{"product_id": 5, "quantity": 1}],
        "customer_name": "User Alpha",
        "customer_email": "alpha@moss.internal",
        "shipping_address": valid_address,
    }
    payload2 = {
        "items": [{"product_id": 5, "quantity": 1}],
        "customer_name": "User Beta",
        "customer_email": "beta@moss.internal",
        "shipping_address": valid_address,
    }

    resp1 = client.post("/api/order/checkout", json=payload1, headers={"Idempotency-Key": "key-alpha-1", **auth_headers})
    resp2 = client.post("/api/order/checkout", json=payload2, headers={"Idempotency-Key": "key-beta-2", **auth_headers})

    assert resp1.status_code == 200
    assert resp2.status_code == 200

    data1 = resp1.json()
    data2 = resp2.json()

    assert data1["order_id"] != data2["order_id"]
    assert data1["order_number"] != data2["order_number"]
