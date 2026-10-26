import pytest
from fastapi.testclient import TestClient
from backend.tests.conftest import make_random_password


def test_authenticated_user_order_isolation(client: TestClient):
    """
    Validates per-user order isolation:
    User A cannot view User B's orders when calling GET /api/orders with Bearer token.
    """
    # 1. Register User A
    pw_a = make_random_password()
    resp_a = client.post("/api/auth/register", json={
        "email": "user_alpha@moss.internal",
        "password": pw_a,
        "full_name": "Alpha User",
    })
    token_a = resp_a.json()["access_token"]

    # 2. Register User B
    pw_b = make_random_password()
    resp_b = client.post("/api/auth/register", json={
        "email": "user_beta@moss.internal",
        "password": pw_b,
        "full_name": "Beta User",
    })
    token_b = resp_b.json()["access_token"]

    # 3. User A places an order
    order_a_resp = client.post(
        "/api/order/checkout",
        json={
            "items": [{"product_id": 1, "quantity": 1}],
            "shipping_address": {
                "recipient_name": "Alpha User",
                "phone": "9876543210",
                "postal_code": "560034",
                "street_address": "Alpha Lane, Flat 101",
                "city": "Bengaluru",
                "state": "Karnataka",
            },
        },
        headers={
            "Authorization": f"Bearer {token_a}",
            "Idempotency-Key": "idemp-alpha-order",
        },
    )
    assert order_a_resp.status_code == 200
    order_a_num = order_a_resp.json()["order_number"]

    # 4. User B places an order
    order_b_resp = client.post(
        "/api/order/checkout",
        json={
            "items": [{"product_id": 2, "quantity": 1}],
            "shipping_address": {
                "recipient_name": "Beta User",
                "phone": "9876543210",
                "postal_code": "560034",
                "street_address": "Beta Boulevard, Flat 202",
                "city": "Bengaluru",
                "state": "Karnataka",
            },
        },
        headers={
            "Authorization": f"Bearer {token_b}",
            "Idempotency-Key": "idemp-beta-order",
        },
    )
    assert order_b_resp.status_code == 200
    order_b_num = order_b_resp.json()["order_number"]

    # 5. User A queries orders with Bearer token
    orders_a = client.get(
        "/api/orders",
        headers={"Authorization": f"Bearer {token_a}"}
    ).json()["orders"]

    # Verify User A only sees their own order
    order_nums_a = [o["order_number"] for o in orders_a]
    assert order_a_num in order_nums_a
    assert order_b_num not in order_nums_a, "Security breach: User A was able to see User B's order!"

    # 6. User B queries orders with Bearer token
    orders_b = client.get(
        "/api/orders",
        headers={"Authorization": f"Bearer {token_b}"}
    ).json()["orders"]

    order_nums_b = [o["order_number"] for o in orders_b]
    assert order_b_num in order_nums_b
    assert order_a_num not in order_nums_b, "Security breach: User B was able to see User A's order!"


def test_order_tracking_endpoint(client: TestClient):
    """
    Validates that GET /api/orders/{order_number}/track returns real-time tracking
    information with status, steps, items, and masked shipping address.
    """
    # 1. Register & Checkout
    pw_track = make_random_password()
    reg = client.post("/api/auth/register", json={
        "email": "track_user@moss.internal",
        "password": pw_track,
        "full_name": "Tracking Tester",
    })
    token = reg.json()["access_token"]

    ord_resp = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 2}],
        "shipping_address": {
            "recipient_name": "Tracking Tester",
            "phone": "9876543210",
            "postal_code": "560034",
            "street_address": "123 Indiranagar 100ft Road",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }, headers={"Authorization": f"Bearer {token}", "Idempotency-Key": "idemp-track-test"})
    assert ord_resp.status_code == 200
    ord_num = ord_resp.json()["order_number"]

    # 2. Query tracking anonymously
    track_resp = client.get(f"/api/orders/{ord_num}/track")
    assert track_resp.status_code == 200
    track_data = track_resp.json()
    assert track_data["status"] == "success"
    assert track_data["order_number"] == ord_num
    assert "current_status" in track_data
    assert "steps" in track_data
    assert "items_summary" in track_data
    assert "delivery_address_masked" in track_data
    assert "123 Indiranagar" not in track_data["delivery_address_masked"], "Sensitive street address must be masked!"

    # 3. Query tracking with invalid order number -> 404
    bad_resp = client.get("/api/orders/ORD-9999-NOTFOUND/track")
    assert bad_resp.status_code == 404


def test_ai_placed_order_appears_in_my_orders(client: TestClient):
    """
    Validates that when AI places an order via conversation, it immediately appears
    in GET /api/orders for the user.
    """
    pw = make_random_password()
    reg = client.post("/api/auth/register", json={
        "email": "ai_shopper_test@moss.internal",
        "password": pw,
        "full_name": "AI Shopper Test",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Ask AI to order
    chat_quote = client.post("/api/chat", json={
        "message": "1 kg alphonso mango order kar do",
        "thread_id": "ai_shopper_thread_1",
    }, headers=headers)
    assert chat_quote.status_code == 200
    quote_data = chat_quote.json()
    assert quote_data.get("order_bundle") is not None

    # 2. Confirm in Hindi/Hinglish in chat must NOT place order directly
    chat_confirm = client.post("/api/chat", json={
        "message": "haan kar do",
        "thread_id": "ai_shopper_thread_1",
    }, headers=headers)
    assert chat_confirm.status_code == 200
    confirm_data = chat_confirm.json()
    assert confirm_data.get("placed_order") is None, "Typing confirm in chat must NOT place an order directly"

    # 3. Order is confirmed through backend confirmation endpoint (triggered by user's Confirm button)
    bundle_items = quote_data["order_bundle"]["items"]
    items_payload = [{"product_id": it["product_id"], "quantity": it["quantity"]} for it in bundle_items]
    conf_resp = client.post("/api/order/checkout", json={
        "items": items_payload,
        "shipping_address": {
            "recipient_name": "AI Shopper",
            "phone": "9845012345",
            "street_address": "45 Lotus Boulevard",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560001",
        },
        "quote_token": quote_data["order_bundle"].get("quote_token"),
    }, headers={**headers, "Idempotency-Key": "idemp_test_user_ai_orders_1"})
    assert conf_resp.status_code == 200
    placed = conf_resp.json()
    ord_num = placed["order_number"]
    assert ord_num.startswith("ORD-")

    # 4. Query GET /api/orders - AI placed order MUST appear in My Orders!
    orders_resp = client.get("/api/orders", headers=headers)
    assert orders_resp.status_code == 200
    user_orders = orders_resp.json()["orders"]
    order_nums = [o["order_number"] for o in user_orders]
    assert ord_num in order_nums, f"Order {ord_num} not found in user's orders: {order_nums}"


