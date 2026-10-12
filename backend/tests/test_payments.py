import pytest
from fastapi.testclient import TestClient


def test_create_upi_payment_intent(client: TestClient):
    payload = {
        "order_number": "ORD-TEST-UPI-1",
        "amount_inr": 1499,
        "payment_method": "upi",
        "customer_email": "shopper@test.com",
    }
    resp = client.post("/api/payments/intent", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    intent = data["intent"]
    assert intent["provider"] == "upi"
    assert "upi://pay" in intent["upi_deep_link"]
    assert intent["amount_inr"] == 1499
    assert intent["order_number"] == "ORD-TEST-UPI-1"


def test_create_card_payment_intent(client: TestClient):
    payload = {
        "order_number": "ORD-TEST-CARD-1",
        "amount_inr": 3500,
        "payment_method": "card",
    }
    resp = client.post("/api/payments/intent", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    intent = data["intent"]
    assert intent["provider"] == "card"
    assert intent["currency"] == "INR"


def test_create_cod_payment_intent_valid(client: TestClient):
    payload = {
        "order_number": "ORD-TEST-COD-1",
        "amount_inr": 2500,
        "payment_method": "cod",
    }
    resp = client.post("/api/payments/intent", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    intent = data["intent"]
    assert intent["provider"] == "cod"
    assert intent["status"] == "authorized"


def test_create_cod_payment_intent_exceeds_cap(client: TestClient):
    payload = {
        "order_number": "ORD-TEST-COD-OVER",
        "amount_inr": 15000,
        "payment_method": "cod",
    }
    resp = client.post("/api/payments/intent", json=payload)
    assert resp.status_code == 400
    error_msg = resp.json().get("message", "")
    assert "available for orders up to" in error_msg.lower() or "10,000" in error_msg


def test_verify_payment_endpoint(client: TestClient):
    payload = {
        "payment_method": "upi",
        "intent_id": "upi_mock_txn_99999",
        "payment_reference": "BANK_REF_SUCCESS_123",
    }
    resp = client.post("/api/payments/verify", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    verification = data["verification"]
    assert verification["verified"] is True
    assert verification["status"] == "paid"
