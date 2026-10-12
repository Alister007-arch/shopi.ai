import pytest
from fastapi.testclient import TestClient


def test_authenticated_user_order_isolation(client: TestClient):
    """
    Validates per-user order isolation:
    User A cannot view User B's orders when calling GET /api/orders with Bearer token.
    """
    # 1. Register User A
    resp_a = client.post("/api/auth/register", json={
        "email": "user_alpha@moss.internal",
        "password": "Password@123456",
        "full_name": "Alpha User",
    })
    token_a = resp_a.json()["access_token"]

    # 2. Register User B
    resp_b = client.post("/api/auth/register", json={
        "email": "user_beta@moss.internal",
        "password": "Password@123456",
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
