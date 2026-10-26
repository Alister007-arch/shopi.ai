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


def test_two_step_order_confirmation_flow(client: TestClient, auth_headers: dict):
    """
    Validates that asking to order an item does NOT place an order immediately,
    and typing confirmation in chat does NOT place an order either.
    Execution happens through backend confirmation with the quote token.
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

    # Step 2: Confirm in chat text must NOT place an order
    step2 = graph.run_offline_fallback(
        message="yes confirm order",
        thread_id=thread_id,
        is_authenticated=True,
        customer_email="tester_twostep@moss.eco",
    )
    assert step2.get("placed_order") is None, "Typing confirm in chat must NOT place an order"
    assert "confirm" in step2.get("reply", "").lower() or "action card" in step2.get("reply", "").lower()


def test_typing_confirm_in_chat_does_not_place_order(client: TestClient, auth_headers: dict):
    """
    Proves that typing 'confirm', 'yes', 'haan kar do', or 'proceed' in chat never places an order.
    """
    thread_id = "sess_confirm_chat_safety"
    # Initiate order intent to create pending bundle
    init_res = client.post("/api/chat", json={
        "message": "buy 1 rolled oats",
        "thread_id": thread_id,
    }, headers=auth_headers)
    assert init_res.status_code == 200
    assert init_res.json().get("placed_order") is None

    # Try different confirmation phrases in chat
    confirm_phrases = ["confirm", "yes", "haan kar do", "kar do bhai", "proceed", "auto order", "confirm order"]
    for phrase in confirm_phrases:
        res = client.post("/api/chat", json={
            "message": phrase,
            "thread_id": thread_id,
        }, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data.get("placed_order") is None, f"Typing '{phrase}' in chat unexpectedly placed an order!"
        reply = data.get("reply", "").lower()
        assert "confirm" in reply or "action card" in reply or "button" in reply or "orders cannot be executed" in reply


def test_quote_token_replayed_and_expired_rejected(client: TestClient, auth_headers: dict):
    """
    Proves that an HMAC-signed quote token that is replayed (already consumed)
    or expired is strictly rejected by the confirmation endpoint.
    """
    from backend.app.agent.quote import create_cryptographic_quote, mark_quote_as_used, verify_cryptographic_quote
    import time

    valid_addr = {
        "recipient_name": "Safety Tester",
        "phone": "9845012345",
        "postal_code": "560001",
        "street_address": "12 Brigade Road",
        "city": "Bengaluru",
        "state": "Karnataka",
    }

    # 1. Replayed / consumed token is rejected
    q1 = create_cryptographic_quote([{"product_id": 1, "quantity": 1, "unit_price_inr": 299}], total_inr=299)
    token1 = q1["quote_token"]
    mark_quote_as_used(q1["quote_id"])

    # Directly verify token rejection
    v1 = verify_cryptographic_quote(token1)
    assert v1["valid"] is False
    assert "already been consumed" in v1["reason"].lower()

    # Verify endpoint rejection
    resp_replayed = client.post("/api/order/confirm", json={
        "quote_token": token1,
        "shipping_address": valid_addr,
    }, headers={**auth_headers, "Idempotency-Key": "idemp_test_replay_token"})
    assert resp_replayed.status_code == 400
    assert "already been consumed" in resp_replayed.json().get("detail", "").lower() or "verification failed" in resp_replayed.json().get("detail", "").lower()

    # 2. Expired token is rejected
    qid = "QT-2026-EXPIRED01"
    expired_ts = int(time.time()) - 120
    expired_token = f"{qid}.{expired_ts}.invalid_or_old_signature"
    v_exp = verify_cryptographic_quote(expired_token)
    assert v_exp["valid"] is False
    assert "expired" in v_exp["reason"].lower()

    resp_expired = client.post("/api/order/confirm", json={
        "quote_token": expired_token,
        "shipping_address": valid_addr,
    }, headers={**auth_headers, "Idempotency-Key": "idemp_test_expired_token"})
    assert resp_expired.status_code == 400
    assert "expired" in resp_expired.json().get("detail", "").lower() or "verification failed" in resp_expired.json().get("detail", "").lower()


def test_guest_cannot_place_order(client: TestClient):
    """
    Proves that unauthenticated guest users cannot place orders through any endpoint.
    """
    valid_addr = {
        "recipient_name": "Anonymous Guest",
        "phone": "9845012345",
        "postal_code": "560001",
        "street_address": "MG Road",
        "city": "Bengaluru",
        "state": "Karnataka",
    }

    # 1. /api/order/confirm requires auth
    r1 = client.post("/api/order/confirm", json={
        "quote_token": "QT-2026-TEST.12345.sig",
        "shipping_address": valid_addr,
    }, headers={"Idempotency-Key": "guest_test_1"})
    assert r1.status_code == 401

    # 2. /api/order/checkout requires auth
    r2 = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 1}],
        "shipping_address": valid_addr,
    }, headers={"Idempotency-Key": "guest_test_2"})
    assert r2.status_code == 401

    # 3. /api/checkout requires auth
    r3 = client.post("/api/checkout", json={
        "product_id": 1,
        "quantity": 1,
        "shipping_address": valid_addr,
    }, headers={"Idempotency-Key": "guest_test_3"})
    assert r3.status_code == 401

    # 4. /api/actions/confirm requires auth
    r4 = client.post("/api/actions/confirm", json={
        "confirmation_token": "tok_test_guest",
    }, headers={"Idempotency-Key": "guest_test_4"})
    assert r4.status_code == 401
