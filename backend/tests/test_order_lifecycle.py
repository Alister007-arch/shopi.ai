import json
import sqlite3
import pytest
from fastapi.testclient import TestClient
import backend.tools as tools


def test_order_status_state_machine(client: TestClient, auth_headers: dict):
    # 1. Place an order
    checkout_payload = {
        "items": [{"product_id": 1, "quantity": 2}],
        "customer_name": "Lifecycle Tester",
        "customer_address": "88 Residency Road, Bengaluru 560025",
        "customer_email": "tester@moss.internal",
        "shipping_address": {
            "recipient_name": "Lifecycle Tester",
            "phone": "9876543210",
            "postal_code": "560025",
            "street_address": "88 Residency Road",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }
    resp = client.post("/api/order/checkout", json=checkout_payload, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    order_data = resp.json()
    order_number = order_data["order_number"]

    # 2. Advance to packed
    patch_resp = client.patch(f"/api/orders/{order_number}/status", json={"status": "packed"}, headers=auth_headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["current_status"] == "packed"

    # 3. Advance to shipped
    patch_resp = client.patch(f"/api/orders/{order_number}/status", json={"status": "shipped"}, headers=auth_headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["current_status"] == "shipped"

    # 4. Advance to delivered
    patch_resp = client.patch(f"/api/orders/{order_number}/status", json={"status": "delivered"}, headers=auth_headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["current_status"] == "delivered"

    # 5. Attempt illegal transition from terminal delivered to placed
    bad_resp = client.patch(f"/api/orders/{order_number}/status", json={"status": "placed"}, headers=auth_headers)
    assert bad_resp.status_code == 400
    error_msg = bad_resp.json().get("message") or bad_resp.json().get("detail", "")
    assert "illegal" in error_msg.lower()


def test_atomic_cancellation_and_stock_restoration(client: TestClient, test_db_path: str, auth_headers: dict):
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()
    cur.execute("SELECT stock FROM products WHERE id = 1")
    initial_stock = cur.fetchone()[0]
    conn.close()

    # Place order for 3 items
    checkout_payload = {
        "items": [{"product_id": 1, "quantity": 3}],
        "customer_name": "Cancel Tester",
        "customer_address": "Indiranagar 100ft Rd, Bengaluru 560038",
        "customer_email": "cancel@moss.internal",
        "shipping_address": {
            "recipient_name": "Cancel Tester",
            "phone": "9876543210",
            "postal_code": "560038",
            "street_address": "Indiranagar 100ft Rd",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }
    resp = client.post("/api/order/checkout", json=checkout_payload, headers=auth_headers)
    assert resp.status_code == 200
    order_number = resp.json()["order_number"]

    # Verify stock decremented by 3
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()
    cur.execute("SELECT stock FROM products WHERE id = 1")
    stock_after_order = cur.fetchone()[0]
    conn.close()
    assert stock_after_order == initial_stock - 3

    # Cancel order atomically
    cancel_resp = client.post(
        f"/api/orders/{order_number}/cancel",
        json={"reason": "Customer found a cheaper option elsewhere"},
        headers=auth_headers,
    )
    assert cancel_resp.status_code == 200
    cancel_data = cancel_resp.json()
    assert cancel_data["status"] == "success"
    assert cancel_data["new_status"] == "cancelled"

    # Verify stock fully restored in database
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()
    cur.execute("SELECT stock FROM products WHERE id = 1")
    restored_stock = cur.fetchone()[0]
    cur.execute("SELECT status FROM orders WHERE order_number = ?", (order_number,))
    db_order_status = cur.fetchone()[0]
    conn.close()

    assert restored_stock == initial_stock
    assert db_order_status == "cancelled"

    # Attempt second cancellation on already cancelled order
    double_cancel = client.post(f"/api/orders/{order_number}/cancel", json={}, headers=auth_headers)
    assert double_cancel.status_code == 400
    error_msg = double_cancel.json().get("message") or double_cancel.json().get("detail", "")
    assert "already" in error_msg.lower() and "cancelled" in error_msg.lower()


def test_gst_invoice_generation(client: TestClient, auth_headers: dict):
    # Place order
    checkout_payload = {
        "items": [{"product_id": 1, "quantity": 2}],
        "customer_name": "GST Auditor",
        "customer_address": "MG Road, Bengaluru 560001",
        "customer_email": "gst@moss.internal",
        "shipping_address": {
            "recipient_name": "GST Auditor",
            "phone": "9876543210",
            "postal_code": "560001",
            "street_address": "MG Road",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }
    resp = client.post("/api/order/checkout", json=checkout_payload, headers=auth_headers)
    assert resp.status_code == 200
    order_number = resp.json()["order_number"]

    # 1. Fetch JSON GST invoice
    inv_resp = client.get(f"/api/orders/{order_number}/invoice", headers=auth_headers)
    assert inv_resp.status_code == 200
    inv = inv_resp.json()
    assert "INV-2026-" in inv["invoice_number"]
    assert inv["seller"]["gstin"] == "29AABCM1234F1Z5"
    assert len(inv["items"]) == 1
    assert inv["items"][0]["hsn_code"] != ""
    assert inv["summary"]["total_gst_inr"] > 0
    assert inv["summary"]["grand_total_inr"] > 0

    # 2. Fetch HTML print-ready invoice
    html_resp = client.get(f"/api/orders/{order_number}/invoice?format=html", headers=auth_headers)
    assert html_resp.status_code == 200
    assert "text/html" in html_resp.headers["content-type"]
    assert "Trovi" in html_resp.text
    assert "Original Tax Invoice" in html_resp.text
    assert "29AABCM1234F1Z5" in html_resp.text
