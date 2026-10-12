import json
import pytest
from fastapi.testclient import TestClient
import graph
import tools


def test_quantity_capping_and_limits(client: TestClient, auth_headers: dict):
    """
    Items with quantity > 20 or < 1 must be rejected by Pydantic validation.
    """
    valid_addr = {
        "recipient_name": "Greedy Buyer",
        "phone": "9876543210",
        "postal_code": "560034",
        "street_address": "Indiranagar 100ft Road",
        "city": "Bengaluru",
        "state": "Karnataka",
    }
    # 1. Quantity exceeds max of 20
    resp_over = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 25}],
        "shipping_address": valid_addr,
    }, headers=auth_headers)
    assert resp_over.status_code == 422, f"Expected 422 for quantity > 20, got {resp_over.status_code}"

    # 2. Quantity less than 1
    resp_zero = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 0}],
        "shipping_address": valid_addr,
    }, headers=auth_headers)
    assert resp_zero.status_code == 422, f"Expected 422 for quantity < 1, got {resp_zero.status_code}"


def test_shipping_address_indian_phone_and_pin_validation(client: TestClient, auth_headers: dict):
    """
    Validates regex rules:
    - phone: 10-digit starting with [6-9]
    - postal_code: 6-digit PIN code
    """
    # 1. Invalid phone number (starts with 1)
    resp_bad_phone = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 1}],
        "shipping_address": {
            "recipient_name": "Test User",
            "phone": "1234567890",
            "postal_code": "560034",
            "street_address": "123 Test Street",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }, headers=auth_headers)
    assert resp_bad_phone.status_code == 422

    # 2. Invalid postal code (5 digits instead of 6)
    resp_bad_pin = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 1}],
        "shipping_address": {
            "recipient_name": "Test User",
            "phone": "9876543210",
            "postal_code": "56003",
            "street_address": "123 Test Street",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }, headers=auth_headers)
    assert resp_bad_pin.status_code == 422

    # 3. Valid address succeeds
    resp_valid = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 1}],
        "shipping_address": {
            "recipient_name": "Test User",
            "phone": "9876543210",
            "postal_code": "560034",
            "street_address": "123 Test Street",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }, headers=auth_headers)
    assert resp_valid.status_code == 200


def test_budget_guardrail_refusal():
    """
    Validates that prepare_order_bundle flags budget overruns when total exceeds target budget.
    """
    # Product 1 is around ₹380-450. Setting budget to ₹100 should flag overrun
    items_json = json.dumps([{"product_id": 1, "quantity": 2}])
    raw_res = tools.prepare_order_bundle.invoke({
        "items_json": items_json,
        "target_budget_inr": 100,
        "customer_name": "Budget Conscious",
    })
    data = json.loads(raw_res)

    assert data.get("status") == "budget_exceeded"
    assert data.get("budget_overrun") is True
    assert data.get("overrun_amount_inr") > 0


def test_two_step_order_confirmation_flow():
    """
    Validates that asking to order an item does NOT place an order immediately,
    but prepares a bundle and asks for confirmation. Only after explicit confirmation
    is an order placed.
    """
    thread_id = "test_thread_two_step"

    # Step 1: Initial order request
    step1 = graph.run_offline_fallback(
        message="Order 1 kg oats",
        thread_id=thread_id,
        is_authenticated=True,
        customer_email="tester_twostep@moss.eco",
    )
    # Must NOT have placed an order yet
    assert step1.get("placed_order") is None, "Order must NOT be placed on first command without confirmation"
    # Must have an order bundle proposed or prompt confirmation
    assert step1.get("order_bundle") is not None or "confirm" in step1.get("reply", "").lower()

    # Step 2: Confirm order
    step2 = graph.run_offline_fallback(
        message="yes confirm order",
        thread_id=thread_id,
        is_authenticated=True,
        customer_email="tester_twostep@moss.eco",
    )
    assert step2.get("placed_order") is not None, "Order must be confirmed after explicit confirmation"
    assert step2["placed_order"].get("order_number") is not None
