import json
import pytest
from fastapi.testclient import TestClient


import secrets
from backend.tests.conftest import make_random_password
import backend.tools as tools


def get_admin_headers(client: TestClient) -> dict:
    """Helper to dynamically create an admin user and obtain authorization headers."""
    email = f"admin_{secrets.token_hex(4)}@moss.internal"
    pw = make_random_password()
    client.post("/api/auth/register", json={
        "email": email,
        "password": pw,
        "full_name": "Admin Tester",
        "phone": "9876543210",
    })
    conn = tools.get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER(?)", (email,))
    conn.commit()
    conn.close()
    login_resp = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def get_customer_headers(client: TestClient) -> dict:
    """Helper to dynamically create a customer user and obtain authorization headers."""
    email = f"cust_{secrets.token_hex(4)}@moss.internal"
    pw = make_random_password()
    reg = client.post("/api/auth/register", json={
        "email": email,
        "password": pw,
        "full_name": "Customer Tester",
        "phone": "9876543210",
    })
    assert reg.status_code == 201, f"Customer registration failed: {reg.text}"
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}



# ---------------------------------------------------------------------------
# Requirement 3: 401 for anonymous and 403 for non-admin
# ---------------------------------------------------------------------------
def test_admin_anonymous_access_returns_401(client: TestClient):
    """
    Validates that unauthenticated requests to all /api/admin/* endpoints
    are strictly rejected with HTTP 401 Unauthorized.
    """
    for endpoint in ["/api/admin/metrics", "/api/admin/catalog", "/api/admin/traces", "/api/admin/notifications"]:
        resp = client.get(endpoint)
        assert resp.status_code == 401, f"Expected 401 for anonymous access to {endpoint}, got {resp.status_code}"


def test_admin_non_admin_customer_access_returns_403(client: TestClient):
    """
    Validates that authenticated non-admin users (role='customer') attempting
    to access /api/admin/* endpoints are rejected with HTTP 403 Forbidden.
    """
    customer_headers = get_customer_headers(client)

    for endpoint in ["/api/admin/metrics", "/api/admin/catalog", "/api/admin/traces", "/api/admin/notifications"]:
        resp = client.get(endpoint, headers=customer_headers)
        assert resp.status_code == 403, f"Expected 403 for customer access to {endpoint}, got {resp.status_code}"
        err_msg = (resp.json().get("detail") or resp.json().get("message") or "").lower()
        assert "admin privileges required" in err_msg or "forbidden" in err_msg


# ---------------------------------------------------------------------------
# Admin Metrics & Factual Data
# ---------------------------------------------------------------------------
def test_admin_metrics_with_factual_labels(client: TestClient):
    """
    Validates that authenticated admin receives factual store metrics,
    including computed health score and real eval benchmark statistics.
    """
    admin_headers = get_admin_headers(client)
    resp = client.get("/api/admin/metrics", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    metrics = data["metrics"]

    assert "total_gmv_inr" in metrics
    assert "total_orders" in metrics
    assert "total_products" in metrics
    assert "valid_products" in metrics
    assert "health_score_pct" in metrics
    assert metrics["health_score_pct"] >= 0.0

    # Verify real eval benchmark summary is returned
    assert "eval_summary" in metrics
    eval_summary = metrics["eval_summary"]
    assert eval_summary["passed_count"] == 60
    assert eval_summary["total_count"] == 60
    assert "llm_mode" in eval_summary
    assert eval_summary["llm_mode"] == "Deterministic tool and safety suite"


# ---------------------------------------------------------------------------
# Catalog CRUD & Validation
# ---------------------------------------------------------------------------
def test_admin_catalog_crud_lifecycle_and_validation(client: TestClient):
    """
    Tests complete admin product lifecycle (create, read, update, delete)
    with validation checks.
    """
    admin_headers = get_admin_headers(client)

    # 1. Validation failure: price <= 0 rejected with 422
    bad_payload = {
        "name": "Invalid Product",
        "category": "honey",
        "price_inr": -100,
        "stock": 10,
    }
    bad_resp = client.post("/api/admin/catalog", json=bad_payload, headers=admin_headers)
    assert bad_resp.status_code == 422

    # 2. Validation failure: name < 2 chars rejected with 422
    short_name_payload = {
        "name": "X",
        "category": "honey",
        "price_inr": 499,
        "stock": 10,
    }
    short_resp = client.post("/api/admin/catalog", json=short_name_payload, headers=admin_headers)
    assert short_resp.status_code == 422

    # 3. Create valid product
    create_payload = {
        "name": "Single Origin Coorg Coffee Beans",
        "category": "groceries",
        "brand": "MOSS Estate",
        "price_inr": 699,
        "stock": 25,
        "description": "Shade-grown arabica from southern Karnataka.",
    }
    create_resp = client.post("/api/admin/catalog", json=create_payload, headers=admin_headers)
    assert create_resp.status_code == 200
    prod_id = create_resp.json()["product_id"]
    assert prod_id > 0

    # 4. Update product
    update_payload = {
        "price_inr": 749,
        "stock": 30,
    }
    update_resp = client.put(f"/api/admin/catalog/{prod_id}", json=update_payload, headers=admin_headers)
    assert update_resp.status_code == 200

    # 5. Search in admin catalog
    search_resp = client.get("/api/admin/catalog", params={"search": "Coorg Coffee"}, headers=admin_headers)
    assert search_resp.status_code == 200
    prods = search_resp.json()["products"]
    match = next((p for p in prods if p["id"] == prod_id), None)
    assert match is not None
    assert match["price_inr"] == 749
    assert match["stock"] == 30

    # 6. Delete product
    del_resp = client.delete(f"/api/admin/catalog/{prod_id}", headers=admin_headers)
    assert del_resp.status_code == 200

    # 7. Verify 404 on subsequent update
    not_found = client.put(f"/api/admin/catalog/{prod_id}", json={"stock": 5}, headers=admin_headers)
    assert not_found.status_code == 404


# ---------------------------------------------------------------------------
# Atomic Inventory Adjustments
# ---------------------------------------------------------------------------
def test_atomic_inventory_adjustment(client: TestClient):
    """
    Tests atomic stock adjustment (+10, -5, and error on over-decrement).
    """
    admin_headers = get_admin_headers(client)

    # Fetch initial stock for product 1
    cat_resp = client.get("/api/admin/catalog", params={"search": "Raw Honey", "limit": 1}, headers=admin_headers)
    initial_stock = cat_resp.json()["products"][0]["stock"]

    # Adjust stock +10
    adjust_payload = {
        "product_id": 1,
        "change_quantity": 10,
        "reason": "Test stock restock audit",
    }
    resp = client.post("/api/admin/inventory/adjust", json=adjust_payload, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["new_stock"] == initial_stock + 10

    # Revert stock -10
    revert_payload = {
        "product_id": 1,
        "change_quantity": -10,
        "reason": "Test stock revert",
    }
    rev_resp = client.post("/api/admin/inventory/adjust", json=revert_payload, headers=admin_headers)
    assert rev_resp.status_code == 200
    assert rev_resp.json()["new_stock"] == initial_stock

    # Over-decrement error check
    bad_adjust = {
        "product_id": 1,
        "change_quantity": -999999,
        "reason": "Excessive deduction",
    }
    bad_resp = client.post("/api/admin/inventory/adjust", json=bad_adjust, headers=admin_headers)
    assert bad_resp.status_code == 400


# ---------------------------------------------------------------------------
# Pagination on Catalog, Traces, and Notifications
# ---------------------------------------------------------------------------
def test_admin_pagination_catalog_traces_notifications(client: TestClient):
    """
    Validates that Catalog, Traces, and Notifications endpoints correctly
    support limit/offset pagination and return total counts.
    """
    admin_headers = get_admin_headers(client)

    # 1. Catalog pagination
    cat_page1 = client.get("/api/admin/catalog", params={"limit": 5, "offset": 0}, headers=admin_headers)
    assert cat_page1.status_code == 200
    data1 = cat_page1.json()
    assert data1["total"] >= 77
    assert data1["count"] == 5

    cat_page2 = client.get("/api/admin/catalog", params={"limit": 5, "offset": 5}, headers=admin_headers)
    assert cat_page2.status_code == 200
    data2 = cat_page2.json()
    assert data2["count"] == 5
    # IDs must be different across pages
    ids1 = [p["id"] for p in data1["products"]]
    ids2 = [p["id"] for p in data2["products"]]
    assert len(set(ids1).intersection(set(ids2))) == 0

    # 2. Traces pagination
    traces_resp = client.get("/api/admin/traces", params={"limit": 5, "offset": 0}, headers=admin_headers)
    assert traces_resp.status_code == 200
    t_data = traces_resp.json()
    assert "total" in t_data
    assert "traces" in t_data

    # 3. Notifications pagination
    notifs_resp = client.get("/api/admin/notifications", params={"limit": 5, "offset": 0}, headers=admin_headers)
    assert notifs_resp.status_code == 200
    n_data = notifs_resp.json()
    assert "total" in n_data
    assert "notifications" in n_data
