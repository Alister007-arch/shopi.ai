"""
Pytest Test Suite for Deterministic Order Action Service and LLM Handoff Boundary.
Tests:
- LLM tool list does not contain any action/mutation tools
- Handoff tool start_order_action only creates an action_card specification
- Cancellation allowed before shipped and rejected after shipped
- Return rejected outside 7-day window
- Exchange rejected when replacement variant is out of stock
- Double-confirm with same Idempotency-Key does exactly one action
- User isolation: User A cannot access or act on User B's order (returns 404)
- Refund amount equals code-computed policy value
- Typing 'confirm' in chat executes nothing
"""

import os
import sys
import json
import uuid
import datetime
import pytest
from fastapi.testclient import TestClient

# Ensure backend is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from backend.main import app
import backend.tools as tools
from backend.services.order_actions import (
    get_db_connection,
    check_action_eligibility,
    prepare_order_action,
    confirm_order_action,
    load_policies,
)

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_test_users_and_orders():
    """Sets up two test users and test orders in test database."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Ensure tables exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            hashed_password TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            role TEXT DEFAULT 'customer',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            customer_name TEXT,
            customer_email TEXT,
            customer_address TEXT,
            items_summary TEXT,
            subtotal REAL,
            subtotal_inr INTEGER,
            delivery_fee REAL,
            delivery_fee_inr INTEGER,
            total_price REAL,
            total_price_inr INTEGER,
            currency TEXT DEFAULT 'INR',
            status TEXT DEFAULT 'placed',
            payment_method TEXT,
            billing_address TEXT,
            buyer_gstin TEXT,
            buyer_company TEXT,
            discount_inr INTEGER DEFAULT 0,
            ordered_at TEXT DEFAULT (datetime('now'))
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT,
            unit_price REAL,
            unit_price_inr INTEGER,
            quantity INTEGER DEFAULT 1,
            total_price REAL,
            total_price_inr INTEGER
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            subcategory TEXT,
            brand TEXT,
            price REAL,
            price_inr INTEGER,
            currency TEXT DEFAULT 'INR',
            description TEXT,
            is_organic INTEGER DEFAULT 0,
            image_url TEXT,
            attributes TEXT,
            specifications TEXT,
            stock INTEGER DEFAULT 10,
            stock_status TEXT,
            badge TEXT,
            is_demo INTEGER DEFAULT 0,
            supplier TEXT
        )
    """)

    # 1. Create User A and User B
    cursor.execute("DELETE FROM users WHERE email IN ('usera_action@test.com', 'userb_action@test.com')")
    from backend.app.auth.security import hash_password, create_access_token
    from backend.tests.conftest import make_random_password
    pwd_hash = hash_password(make_random_password())

    cursor.execute("""
        INSERT INTO users (email, full_name, hashed_password, is_active, role)
        VALUES ('usera_action@test.com', 'User Alpha', ?, 1, 'customer')
    """, (pwd_hash,))
    user_a_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO users (email, full_name, hashed_password, is_active, role)
        VALUES ('userb_action@test.com', 'User Beta', ?, 1, 'customer')
    """, (pwd_hash,))
    user_b_id = cursor.lastrowid

    # 2. Products (in stock vs out of stock)
    cursor.execute("DELETE FROM products WHERE name LIKE 'ActionTest%'")
    cursor.execute("""
        INSERT INTO products (name, category, price, price_inr, stock)
        VALUES ('ActionTest InStock Honey', 'groceries', 5.0, 450, 15)
    """)
    prod_in_stock_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO products (name, category, price, price_inr, stock)
        VALUES ('ActionTest OutOfStock Shoes', 'apparel', 20.0, 1800, 0)
    """)
    prod_out_of_stock_id = cursor.lastrowid

    # 3. Create Orders for testing
    ord_a_placed = f"ORD-TEST-{uuid.uuid4().hex[:6].upper()}"
    ord_a_shipped = f"ORD-TEST-{uuid.uuid4().hex[:6].upper()}"
    ord_a_delivered = f"ORD-TEST-{uuid.uuid4().hex[:6].upper()}"
    ord_a_old_delivered = f"ORD-TEST-{uuid.uuid4().hex[:6].upper()}"
    ord_b_order = f"ORD-TEST-{uuid.uuid4().hex[:6].upper()}"
    ord_high_value = f"ORD-TEST-{uuid.uuid4().hex[:6].upper()}"

    now_iso = datetime.datetime.now().isoformat()
    old_iso = (datetime.datetime.now() - datetime.timedelta(days=15)).isoformat()

    # User A - placed order (eligible for cancel)
    cursor.execute("""
        INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_address, items_summary, subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr, status, payment_method, ordered_at)
        VALUES (?, ?, 'User Alpha', 'usera_action@test.com', 'Indiranagar, Bengaluru', '1x ActionTest Honey', 5.0, 450, 0.5, 50, 5.5, 500, 'placed', 'UPI / QR', ?)
    """, (ord_a_placed, user_a_id, now_iso))

    # User A - shipped order (ineligible for cancel)
    cursor.execute("""
        INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_address, items_summary, subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr, status, payment_method, ordered_at)
        VALUES (?, ?, 'User Alpha', 'usera_action@test.com', 'Indiranagar, Bengaluru', '1x ActionTest Honey', 5.0, 450, 0.5, 50, 5.5, 500, 'shipped', 'UPI / QR', ?)
    """, (ord_a_shipped, user_a_id, now_iso))

    # User A - delivered order within window (eligible for return/exchange)
    cursor.execute("""
        INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_address, items_summary, subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr, status, payment_method, ordered_at)
        VALUES (?, ?, 'User Alpha', 'usera_action@test.com', 'Indiranagar, Bengaluru', '1x ActionTest Honey', 5.0, 450, 0.5, 50, 5.5, 500, 'delivered', 'UPI / QR', ?)
    """, (ord_a_delivered, user_a_id, now_iso))

    # User A - delivered 15 days ago (outside 7-day window)
    cursor.execute("""
        INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_address, items_summary, subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr, status, payment_method, ordered_at)
        VALUES (?, ?, 'User Alpha', 'usera_action@test.com', 'Indiranagar, Bengaluru', '1x ActionTest Honey', 5.0, 450, 0.5, 50, 5.5, 500, 'delivered', 'UPI / QR', ?)
    """, (ord_a_old_delivered, user_a_id, old_iso))

    # User B order
    cursor.execute("""
        INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_address, items_summary, subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr, status, payment_method, ordered_at)
        VALUES (?, ?, 'User Beta', 'userb_action@test.com', 'Koramangala, Bengaluru', '1x ActionTest Honey', 5.0, 450, 0.5, 50, 5.5, 500, 'placed', 'UPI / QR', ?)
    """, (ord_b_order, user_b_id, now_iso))

    # User A - high value order (>= ₹10,000)
    cursor.execute("""
        INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_address, items_summary, subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr, status, payment_method, ordered_at)
        VALUES (?, ?, 'User Alpha', 'usera_action@test.com', 'Indiranagar, Bengaluru', 'High Value Laptop', 600.0, 55000, 0.0, 0, 600.0, 55000, 'placed', 'UPI / QR', ?)
    """, (ord_high_value, user_a_id, now_iso))

    conn.commit()
    conn.close()

    # Get JWT tokens
    token_a = create_access_token({"sub": str(user_a_id), "email": "usera_action@test.com"})
    token_b = create_access_token({"sub": str(user_b_id), "email": "userb_action@test.com"})

    return {
        "user_a_id": user_a_id,
        "user_b_id": user_b_id,
        "token_a": token_a,
        "token_b": token_b,
        "ord_a_placed": ord_a_placed,
        "ord_a_shipped": ord_a_shipped,
        "ord_a_delivered": ord_a_delivered,
        "ord_a_old_delivered": ord_a_old_delivered,
        "ord_b_order": ord_b_order,
        "ord_high_value": ord_high_value,
        "prod_in_stock_id": prod_in_stock_id,
        "prod_out_of_stock_id": prod_out_of_stock_id,
    }


# ---------------------------------------------------------------------------
# 1. LLM Tool List Does Not Contain Action Tools
# ---------------------------------------------------------------------------
def test_llm_tool_list_contains_no_action_tools():
    """Verifies that the LLM agent's tool list contains zero action/mutation tools."""
    tool_names = [t.name for t in tools.LLM_ALLOWED_TOOLS]

    # Forbidden mutation tools
    forbidden = [
        "place_order",
        "confirm_and_place_order",
        "cancel_order",
        "return_order",
        "exchange_order",
        "refund_order",
        "request_return",
        "request_exchange",
        "request_refund",
        "prepare_order_bundle",
    ]
    for f in forbidden:
        assert f not in tool_names, f"Forbidden mutation tool '{f}' found in LLM allowed tools!"

    # Allowed read-only and harmless tools must be present
    required = [
        "search_products",
        "get_product_details",
        "recommend_best",
        "compare_products",
        "analyze_reviews",
        "check_delivery",
        "list_categories",
        "get_policies",
        "view_cart",
        "add_to_cart",
        "remove_from_cart",
        "track_order",
        "list_my_orders",
        "start_order_action",
    ]
    for req in required:
        assert req in tool_names, f"Expected harmless tool '{req}' missing from LLM allowed tools!"


# ---------------------------------------------------------------------------
# 2. Handoff Tool Only Creates an Action Card
# ---------------------------------------------------------------------------
def test_handoff_tool_only_creates_action_card():
    """Verifies start_order_action only returns an action_card specification without performing any mutation."""
    raw = tools.start_order_action.invoke({
        "action": "cancel",
        "order_id": "ORD-2026-MOCK123",
        "reason": "changed_mind"
    })
    data = json.loads(raw)
    assert "action_card" in data
    assert data["action_card"]["action"] == "cancel"
    assert data["action_card"]["order_id"] == "ORD-2026-MOCK123"
    assert data["action_card"]["status"] == "ready_for_user_action"
    assert "Opened cancel card for user in UI" in data["message"]


# ---------------------------------------------------------------------------
# 3. Cancellation Allowed Before Shipped and Rejected After
# ---------------------------------------------------------------------------
def test_cancellation_allowed_before_shipped_and_rejected_after(setup_test_users_and_orders):
    env = setup_test_users_and_orders
    headers_a = {"Authorization": f"Bearer {env['token_a']}"}

    # Order in 'placed' state -> Eligible
    res_placed = client.get(
        f"/api/actions/eligibility?order_id={env['ord_a_placed']}&action=cancel",
        headers=headers_a,
    )
    assert res_placed.status_code == 200
    assert res_placed.json()["eligible"] is True

    # Order in 'shipped' state -> Rejected
    res_shipped = client.get(
        f"/api/actions/eligibility?order_id={env['ord_a_shipped']}&action=cancel",
        headers=headers_a,
    )
    assert res_shipped.status_code == 200
    assert res_shipped.json()["eligible"] is False
    assert "already 'shipped'" in res_shipped.json()["message"]

    # Attempting to prepare cancel on shipped order returns 400
    prep_res = client.post(
        "/api/actions/prepare",
        json={"order_id": env["ord_a_shipped"], "action": "cancel"},
        headers=headers_a,
    )
    assert prep_res.status_code == 400


# ---------------------------------------------------------------------------
# 4. Return Rejected Outside Window
# ---------------------------------------------------------------------------
def test_return_rejected_after_window(setup_test_users_and_orders):
    env = setup_test_users_and_orders
    headers_a = {"Authorization": f"Bearer {env['token_a']}"}

    # Delivered order 15 days ago -> Rejected because > 7 days
    res = client.get(
        f"/api/actions/eligibility?order_id={env['ord_a_old_delivered']}&action=return",
        headers=headers_a,
    )
    assert res.status_code == 200
    assert res.json()["eligible"] is False
    assert "window of 7 days has expired" in res.json()["message"]


# ---------------------------------------------------------------------------
# 5. Exchange Rejected When Replacement Variant is Out of Stock
# ---------------------------------------------------------------------------
def test_exchange_rejected_when_out_of_stock(setup_test_users_and_orders):
    env = setup_test_users_and_orders
    headers_a = {"Authorization": f"Bearer {env['token_a']}"}

    # Replacement variant with 0 stock -> Rejected
    res = client.get(
        f"/api/actions/eligibility?order_id={env['ord_a_delivered']}&action=exchange&item_id={env['prod_out_of_stock_id']}",
        headers=headers_a,
    )
    assert res.status_code == 200
    assert res.json()["eligible"] is False
    assert "currently out of stock" in res.json()["message"]


# ---------------------------------------------------------------------------
# 6. Double-Confirm with Same Idempotency Key Does One Action
# ---------------------------------------------------------------------------
def test_double_confirm_idempotency(setup_test_users_and_orders):
    env = setup_test_users_and_orders
    headers_a = {"Authorization": f"Bearer {env['token_a']}"}

    # Prepare cancel
    prep = client.post(
        "/api/actions/prepare",
        json={"order_id": env["ord_a_placed"], "action": "cancel", "reason": "changed_mind"},
        headers=headers_a,
    )
    assert prep.status_code == 200
    token = prep.json()["confirmation_token"]

    idemp_key = f"idemp-test-{uuid.uuid4().hex}"

    # Confirm First Time
    conf1 = client.post(
        "/api/actions/confirm",
        json={"confirmation_token": token},
        headers={**headers_a, "Idempotency-Key": idemp_key},
    )
    assert conf1.status_code == 200
    data1 = conf1.json()
    assert data1["status"] == "success"
    assert data1["new_status"] == "cancelled"

    # Confirm Second Time with identical Idempotency-Key -> Idempotent Replay
    conf2 = client.post(
        "/api/actions/confirm",
        json={"confirmation_token": token},
        headers={**headers_a, "Idempotency-Key": idemp_key},
    )
    assert conf2.status_code == 200
    data2 = conf2.json()
    assert data2.get("idempotent_replay") is True
    assert data2["order_number"] == data1["order_number"]


# ---------------------------------------------------------------------------
# 7. User A Cannot Act on User B's Order (Strict 404)
# ---------------------------------------------------------------------------
def test_user_a_cannot_act_on_user_b_order(setup_test_users_and_orders):
    env = setup_test_users_and_orders
    headers_a = {"Authorization": f"Bearer {env['token_a']}"}

    # User A tries to check eligibility on User B's order -> Returns 404
    res = client.get(
        f"/api/actions/eligibility?order_id={env['ord_b_order']}&action=cancel",
        headers=headers_a,
    )
    assert res.status_code == 404
    assert "not found" in res.json()["message"].lower()

    # User A tries to prepare action on User B's order -> Returns 404
    prep_res = client.post(
        "/api/actions/prepare",
        json={"order_id": env["ord_b_order"], "action": "cancel"},
        headers=headers_a,
    )
    assert prep_res.status_code == 404


# ---------------------------------------------------------------------------
# 8. Refund Amount Equals Code-Computed Policy Value
# ---------------------------------------------------------------------------
def test_refund_amount_equals_code_computed_value(setup_test_users_and_orders):
    env = setup_test_users_and_orders
    headers_a = {"Authorization": f"Bearer {env['token_a']}"}

    # Order has subtotal 450 + delivery 50 = total 500
    # 1. Standard return: delivery fee (₹50) is retained -> refund = ₹450
    prep_std = client.post(
        "/api/actions/prepare",
        json={"order_id": env["ord_a_delivered"], "action": "return", "reason": "changed_mind"},
        headers=headers_a,
    )
    assert prep_std.status_code == 200
    summary_std = prep_std.json()["summary"]
    assert summary_std["refund_amount_inr"] == 450
    assert summary_std["delivery_fee_retained_inr"] == 50

    # 2. Damaged item exception: full refund including delivery fee -> refund = ₹500
    prep_dmg = client.post(
        "/api/actions/prepare",
        json={"order_id": env["ord_a_delivered"], "action": "return", "reason": "damaged", "photo_url": "https://img.com/dam.jpg"},
        headers=headers_a,
    )
    assert prep_dmg.status_code == 200
    summary_dmg = prep_dmg.json()["summary"]
    assert summary_dmg["refund_amount_inr"] == 500
    assert summary_dmg["delivery_fee_retained_inr"] == 0

    # 3. High value order (> ₹10,000) flags needs_human_review
    prep_hv = client.post(
        "/api/actions/prepare",
        json={"order_id": env["ord_high_value"], "action": "cancel", "reason": "changed_mind"},
        headers=headers_a,
    )
    assert prep_hv.status_code == 200
    assert prep_hv.json()["summary"]["needs_human_review"] is True


# ---------------------------------------------------------------------------
# 9. Typing 'confirm' in Chat Executes Nothing
# ---------------------------------------------------------------------------
def test_typing_confirm_in_chat_executes_nothing():
    """Verifies natural language commands like 'confirm' or 'haan' in chat text do NOT execute mutations."""
    res = client.post("/api/chat", json={"message": "confirm"})
    assert res.status_code == 200
    data = res.json()
    assert data.get("placed_order") is None
    assert "Confirm button on the action card" in data.get("reply", "") or "action card" in data.get("reply", "")
