import pytest
from fastapi.testclient import TestClient


def test_auth_registration_success(client: TestClient):
    """
    Validates user registration with valid email, strong password,
    full name, and Indian mobile number.
    """
    payload = {
        "email": "priya.nair@moss.internal",
        "password": "SecurePassword@123",
        "full_name": "Priya Nair",
        "phone": "9812345678",
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()

    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "Bearer"
    assert data["user"]["email"] == "priya.nair@moss.internal"
    assert data["user"]["full_name"] == "Priya Nair"
    assert data["user"]["role"] == "customer"


def test_auth_registration_duplicate_email_rejected(client: TestClient):
    """Registration with an already existing email must return 400 Bad Request."""
    payload = {
        "email": "duplicate@moss.internal",
        "password": "Password@123",
        "full_name": "Original User",
    }
    resp1 = client.post("/api/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = client.post("/api/auth/register", json=payload)
    assert resp2.status_code == 400
    err_msg = (resp2.json().get("detail") or resp2.json().get("message") or "").lower()
    assert "already exists" in err_msg


def test_auth_registration_short_password_rejected(client: TestClient):
    """Passwords shorter than 8 characters must be rejected with 422."""
    payload = {
        "email": "shortpw@moss.internal",
        "password": "short",
        "full_name": "Test User",
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 422


def test_auth_registration_invalid_indian_phone_rejected(client: TestClient):
    """Non-Indian phone numbers must be rejected with 422."""
    payload = {
        "email": "badphone@moss.internal",
        "password": "ValidPassword@123",
        "full_name": "Test User",
        "phone": "12345",  # Invalid
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 422


def test_auth_login_success_and_failure(client: TestClient):
    """Tests successful authentication and rejection on incorrect password."""
    # Register user
    client.post("/api/auth/register", json={
        "email": "login.test@moss.internal",
        "password": "CorrectPassword@123",
        "full_name": "Login Tester",
    })

    # Successful login
    resp_success = client.post("/api/auth/login", json={
        "email": "login.test@moss.internal",
        "password": "CorrectPassword@123",
    })
    assert resp_success.status_code == 200
    assert "access_token" in resp_success.json()

    # Incorrect password login
    resp_fail = client.post("/api/auth/login", json={
        "email": "login.test@moss.internal",
        "password": "WrongPassword@999",
    })
    assert resp_fail.status_code == 401
    err_msg = (resp_fail.json().get("detail") or resp_fail.json().get("message") or "").lower()
    assert "invalid email or password" in err_msg or "incorrect email or password" in err_msg


def test_auth_profile_me_endpoint(client: TestClient):
    """
    Accessing GET /api/auth/me requires valid Bearer token.
    Without token or with forged token, access is denied (401).
    """
    # 1. Unauthenticated request
    resp_unauth = client.get("/api/auth/me")
    assert resp_unauth.status_code == 401

    # 2. Forged token request
    resp_forged = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer fake_forged_token_xyz"}
    )
    assert resp_forged.status_code == 401

    # 3. Authenticated request
    reg_resp = client.post("/api/auth/register", json={
        "email": "me.test@moss.internal",
        "password": "MySecretPassword@123",
        "full_name": "Me Tester",
    })
    token = reg_resp.json()["access_token"]

    resp_auth = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp_auth.status_code == 200
    assert resp_auth.json()["email"] == "me.test@moss.internal"
    assert resp_auth.json()["full_name"] == "Me Tester"


def test_auth_token_refresh(client: TestClient):
    """Validates refreshing an access token using a valid refresh token."""
    reg_resp = client.post("/api/auth/register", json={
        "email": "refresh.test@moss.internal",
        "password": "RefreshPassword@123",
        "full_name": "Refresh Tester",
    })
    refresh_token = reg_resp.json()["refresh_token"]

    ref_resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_resp.status_code == 200
    assert "access_token" in ref_resp.json()
