import json
import pytest
from fastapi.testclient import TestClient
from backend.tests.conftest import make_random_password


def test_anonymous_checkout_returns_401(client: TestClient):
    """Anonymous POST /api/order/checkout must return 401 Unauthorized."""
    resp = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 1}],
        "shipping_address": {
            "recipient_name": "Anonymous Guest",
            "phone": "9876543210",
            "postal_code": "560034",
            "street_address": "Indiranagar 100ft Road",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    })
    assert resp.status_code == 401, f"Expected 401 for anonymous checkout, got {resp.status_code}"


def test_user_a_cannot_read_user_b_order(client: TestClient):
    """User A cannot read User B's order (returns 404 for isolation)."""
    # 1. Register User A
    pw_a = make_random_password()
    resp_a = client.post("/api/auth/register", json={
        "email": "alice_privacy@moss.eco",
        "password": pw_a,
        "full_name": "Alice Privacy",
    })
    assert resp_a.status_code == 201
    token_a = resp_a.json()["access_token"]

    # 2. Register User B
    pw_b = make_random_password()
    resp_b = client.post("/api/auth/register", json={
        "email": "bob_privacy@moss.eco",
        "password": pw_b,
        "full_name": "Bob Privacy",
    })
    assert resp_b.status_code == 201
    token_b = resp_b.json()["access_token"]

    # 3. User B places an order
    resp_order_b = client.post("/api/order/checkout", json={
        "items": [{"product_id": 1, "quantity": 1}],
        "shipping_address": {
            "recipient_name": "Bob Privacy",
            "phone": "9876543210",
            "postal_code": "560034",
            "street_address": "Bob's Residence, 12th Main",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }, headers={"Authorization": f"Bearer {token_b}"})
    assert resp_order_b.status_code == 200
    order_b_num = resp_order_b.json()["order_number"]
    order_b_id = resp_order_b.json()["order_id"]

    # 4. User A attempts to read User B's order by order_number -> must return 404
    resp_read_num = client.get(
        f"/api/orders/{order_b_num}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp_read_num.status_code == 404, f"Expected 404 for User A reading User B's order, got {resp_read_num.status_code}"

    # 5. User A attempts to read User B's order by ID -> must return 404
    resp_read_id = client.get(
        f"/api/orders/{order_b_id}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp_read_id.status_code == 404, f"Expected 404 for User A reading User B's order id, got {resp_read_id.status_code}"

    # 6. User A lists orders -> Bob's order must NOT appear
    resp_list_a = client.get(
        "/api/orders",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp_list_a.status_code == 200
    orders_a = resp_list_a.json()["orders"]
    assert all(o["order_number"] != order_b_num for o in orders_a)

    # 7. User B can read their own order
    resp_b_read = client.get(
        f"/api/orders/{order_b_num}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert resp_b_read.status_code == 200
    assert resp_b_read.json()["order_number"] == order_b_num


def test_guest_cart_merged_after_login(client: TestClient):
    """Guest cart is merged after login with no duplicates, summed quantities, capped at stock."""
    # 1. Register a user
    pw_user = make_random_password()
    resp_user = client.post("/api/auth/register", json={
        "email": "cart_merge_tester@moss.eco",
        "password": pw_user,
        "full_name": "Merge Tester",
    })
    assert resp_user.status_code == 201
    token = resp_user.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Add item 1 (quantity 2) to user's server cart
    add_resp = client.post("/api/cart/items", json={
        "product_id": 1,
        "quantity": 2,
    }, headers=headers)
    assert add_resp.status_code == 200

    # 3. Simulate guest cart from localStorage: item 1 (qty 3) and item 2 (qty 1)
    guest_items = [
        {"product_id": 1, "quantity": 3},
        {"product_id": 2, "quantity": 1},
    ]
    merge_resp = client.post("/api/cart/merge", json={"items": guest_items}, headers=headers)
    assert merge_resp.status_code == 200
    merged = merge_resp.json()["items"]

    # Verify item 1 quantity summed (2 + 3 = 5, or capped at stock)
    item_1 = next((it for it in merged if it["id"] == 1), None)
    assert item_1 is not None
    assert item_1["quantity"] == 5 or item_1["quantity"] == item_1["stock"]

    # Verify item 2 added
    item_2 = next((it for it in merged if it["id"] == 2), None)
    assert item_2 is not None
    assert item_2["quantity"] == 1

    # 4. User can proceed straight to checkout with merged items
    checkout_resp = client.post("/api/order/checkout", json={
        "items": [{"product_id": it["id"], "quantity": it["quantity"]} for it in merged],
        "shipping_address": {
            "recipient_name": "Merge Tester",
            "phone": "9876543210",
            "postal_code": "560034",
            "street_address": "Greenfield Avenue, 402",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    }, headers=headers)
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["order_number"] is not None

    # Server cart is cleared after checkout
    cart_after = client.get("/api/cart", headers=headers).json()
    assert cart_after["count"] == 0


def test_agent_refuses_order_for_guest_and_succeeds_for_signed_in_user(client: TestClient):
    """
    AI Concierge refuses to place order for guest, requires auth,
    and succeeds for authenticated user after explicit confirmation.
    """
    guest_thread = "guest_chat_thread_101"

    # 1. Guest asks to order 1 kg oats
    guest_res = client.post("/api/chat", json={
        "message": "Order 1 kg oats",
        "thread_id": guest_thread,
    })
    assert guest_res.status_code == 200
    g_data = guest_res.json()
    # Must NOT have placed an order
    assert g_data.get("placed_order") is None
    # Must require auth and show sign in prompt
    assert g_data.get("requires_auth") is True
    assert "sign in" in g_data.get("reply", "").lower()
    # Quote bundle must still be prepared and preserved
    assert g_data.get("order_bundle") is not None

    # 2. Register / login a user
    pw_agent_shopper = make_random_password()
    user_resp = client.post("/api/auth/register", json={
        "email": "agent_shopper@moss.eco",
        "password": pw_agent_shopper,
        "full_name": "Agent Shopper",
    })
    token = user_resp.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {token}"}

    # 3. Authenticated user requests order bundle
    user_chat_1 = client.post("/api/chat", json={
        "message": "Order 1 kg oats",
        "thread_id": "auth_thread_202",
        "customer_address": "Flat 402, Green Park Avenue, Bengaluru - 560038",
    }, headers=user_headers)
    assert user_chat_1.status_code == 200
    u1_data = user_chat_1.json()
    assert u1_data.get("placed_order") is None  # Two-step: quote must be confirmed first
    assert u1_data.get("order_bundle") is not None

    # 4. Authenticated user confirms order explicitly
    user_chat_2 = client.post("/api/chat", json={
        "message": "Yes confirm order",
        "thread_id": "auth_thread_202",
        "customer_address": "Flat 402, Green Park Avenue, Bengaluru - 560038",
    }, headers=user_headers)
    assert user_chat_2.status_code == 200
    u2_data = user_chat_2.json()
    assert u2_data.get("placed_order") is not None
    assert u2_data["placed_order"].get("order_number") is not None


def test_session_security_and_refresh_flow(client: TestClient):
    """
    Validates generic login errors, refresh token exchange,
    and rate limiting on repeated failed logins.
    """
    # 1. Register user
    pw_sec = make_random_password()
    reg = client.post("/api/auth/register", json={
        "email": "sec_test_user@moss.eco",
        "password": pw_sec,
        "full_name": "Security Tester",
    })
    assert reg.status_code == 201
    refresh_token = reg.json()["refresh_token"]

    # 2. Login with incorrect password returns generic error
    bad_login = client.post("/api/auth/login", json={
        "email": "sec_test_user@moss.eco",
        "password": "WrongPassword999",
    })
    assert bad_login.status_code == 401
    assert "invalid email or password" in bad_login.json()["detail"].lower()

    # 3. Token refresh exchanges valid refresh token for fresh access token
    ref_resp = client.post("/api/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert ref_resp.status_code == 200
    new_access_token = ref_resp.json()["access_token"]
    assert new_access_token is not None

    # Verify new token works on protected /api/me
    me_resp = client.get("/api/me", headers={"Authorization": f"Bearer {new_access_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "sec_test_user@moss.eco"

    # 4. Rate limiting: test rate limit triggers on 5 rapid failed attempts
    for _ in range(5):
        client.post("/api/auth/login", json={
            "email": "brute_force_target@moss.eco",
            "password": "WrongPassword",
        })
    # 6th attempt should return 429
    blocked = client.post("/api/auth/login", json={
        "email": "brute_force_target@moss.eco",
        "password": "WrongPassword",
    })
    assert blocked.status_code == 429
    assert "too many" in blocked.json()["detail"].lower()
