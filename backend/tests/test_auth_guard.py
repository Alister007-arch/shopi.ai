import secrets
import pytest
from fastapi.testclient import TestClient
from backend.tests.conftest import make_random_password
import backend.tools as tools


def get_customer_token(client: TestClient) -> str:
    email = f"shopper_{secrets.token_hex(4)}@moss.internal"
    pw = make_random_password()
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": pw,
        "full_name": "Test Shopper",
        "phone": "9876543210",
    })
    assert resp.status_code == 201, f"Customer registration failed: {resp.text}"
    return resp.json()["access_token"]


def get_admin_token(client: TestClient) -> str:
    email = f"admin_{secrets.token_hex(4)}@moss.internal"
    pw = make_random_password()
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": pw,
        "full_name": "Test Admin",
        "phone": "9876543210",
    })
    assert resp.status_code == 201, f"Admin registration failed: {resp.text}"
    conn = tools.get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER(?)", (email,))
    conn.commit()
    conn.close()
    login_resp = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    return login_resp.json()["access_token"]


def test_api_me_anonymous_returns_401(client: TestClient):
    """Anonymous access to /api/me must return 401 Unauthorized."""
    resp = client.get("/api/me")
    assert resp.status_code == 401
    err_body = resp.json()
    assert "detail" in err_body or "message" in err_body


def test_api_me_authenticated_returns_real_db_counts(client: TestClient):
    """Authenticated user receives profile with real database counts."""
    email = f"shopper_{secrets.token_hex(4)}@moss.internal"
    pw = make_random_password()
    reg = client.post("/api/auth/register", json={
        "email": email,
        "password": pw,
        "full_name": "Dynamic Shopper",
        "phone": "9876543210",
    })
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == email
    assert "full_name" in data
    assert "role" in data
    assert "orders_count" in data
    assert isinstance(data["orders_count"], int)
    assert "addresses_count" in data
    assert isinstance(data["addresses_count"], int)
    assert "saved_addresses" in data
    assert isinstance(data["saved_addresses"], list)
    assert data["addresses_count"] == len(data["saved_addresses"])


def test_user_addresses_anonymous_returns_401(client: TestClient):
    """Anonymous access to /api/user/addresses must return 401 Unauthorized."""
    resp = client.get("/api/user/addresses")
    assert resp.status_code == 401

    resp_post = client.post("/api/user/addresses", json={"tag": "home", "title": "Home", "name": "Test", "phone": "9876543210", "flat": "101", "street": "Main", "city": "Bengaluru", "state": "Karnataka", "pin_code": "560034"})
    assert resp_post.status_code == 401


def test_user_addresses_crud_persists_to_db(client: TestClient):
    """Creating and deleting addresses persists in real database for authenticated user."""
    token = get_customer_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Add address
    create_payload = {
        "tag": "office",
        "title": "WeWork Galaxy",
        "name": "Aarav S",
        "phone": "9876543210",
        "flat": "Suite 4B",
        "street": "Residency Road",
        "landmark": "Near Brigade Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pin_code": "560025",
        "is_default": False
    }
    create_resp = client.post("/api/user/addresses", json=create_payload, headers=headers)
    assert create_resp.status_code == 200
    created_addr = create_resp.json()["address"]
    addr_id = created_addr["id"]

    # Verify in list
    list_resp = client.get("/api/user/addresses", headers=headers)
    assert list_resp.status_code == 200
    addrs = list_resp.json()["addresses"]
    assert any(a["id"] == addr_id for a in addrs)

    # Delete address
    del_resp = client.delete(f"/api/user/addresses/{addr_id}", headers=headers)
    assert del_resp.status_code == 200

    # Verify removed
    list_after = client.get("/api/user/addresses", headers=headers)
    assert not any(a["id"] == addr_id for a in list_after.json()["addresses"])


def test_admin_routes_auth_guards(client: TestClient):
    """Every /api/admin/* route requires admin JWT (401 anonymous, 403 non-admin)."""
    admin_routes = [
        "/api/admin/metrics",
        "/api/admin/catalog",
        "/api/admin/traces",
        "/api/admin/notifications",
    ]

    # Anonymous -> 401
    for route in admin_routes:
        resp = client.get(route)
        assert resp.status_code == 401, f"{route} did not return 401 for anonymous"

    # Customer -> 403
    cust_token = get_customer_token(client)
    cust_headers = {"Authorization": f"Bearer {cust_token}"}
    for route in admin_routes:
        resp = client.get(route, headers=cust_headers)
        assert resp.status_code == 403, f"{route} did not return 403 for non-admin"

    # Admin -> 200
    admin_token = get_admin_token(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    for route in admin_routes:
        resp = client.get(route, headers=admin_headers)
        assert resp.status_code == 200, f"{route} failed for admin"
