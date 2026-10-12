import pytest
from fastapi.testclient import TestClient
from backend.app.auth.router import LOGIN_ATTEMPTS


def test_login_rate_limiting_enforces_429_with_retry_after(client: TestClient):
    """
    Validates that:
    1. Repeated failed login attempts trigger HTTP 429 Too Many Requests.
    2. Response includes a standard 'Retry-After' header with remaining seconds.
    3. Error detail message informs the user of the live remaining wait time.
    """
    user_email = "ratelimit.victim@trovi.internal"
    reg_resp = client.post("/api/auth/register", json={
        "email": user_email,
        "password": "CorrectPassword@123",
        "full_name": "Rate Limit Target",
    })
    assert reg_resp.status_code == 201

    # Clear any previous attempts for this email
    LOGIN_ATTEMPTS.pop(user_email.lower(), None)

    # First 5 failed login attempts should return 401
    for attempt in range(1, 6):
        resp = client.post("/api/auth/login", json={
            "email": user_email,
            "password": "WrongPassword@999",
        })
        assert resp.status_code == 401, f"Attempt {attempt} expected 401, got {resp.status_code}"

    # 6th attempt must be blocked by rate limiter with 429
    resp_blocked = client.post("/api/auth/login", json={
        "email": user_email,
        "password": "WrongPassword@999",
    })
    assert resp_blocked.status_code == 429, f"Expected 429 Too Many Requests, got {resp_blocked.status_code}"
    
    # Verify Retry-After header
    retry_after = resp_blocked.headers.get("Retry-After")
    assert retry_after is not None, "Missing 'Retry-After' header on 429 response"
    retry_seconds = int(retry_after)
    assert 1 <= retry_seconds <= 60, f"Retry-After seconds out of expected bounds: {retry_seconds}"

    # Verify error message detail
    detail = resp_blocked.json().get("detail", "")
    assert "too many login attempts" in detail.lower()
    assert str(retry_seconds) in detail


def test_successful_login_clears_rate_limit_history(client: TestClient):
    """
    Validates that a successful login clears previous attempt timestamps,
    preventing premature lockout on subsequent valid logins.
    """
    user_email = "ratelimit.recovery@trovi.internal"
    client.post("/api/auth/register", json={
        "email": user_email,
        "password": "SecurePassword@123",
        "full_name": "Recovery User",
    })

    LOGIN_ATTEMPTS.pop(user_email.lower(), None)

    # 2 failed attempts
    for _ in range(2):
        client.post("/api/auth/login", json={
            "email": user_email,
            "password": "IncorrectPassword@000",
        })

    assert len(LOGIN_ATTEMPTS[user_email.lower()]) == 2

    # Successful login
    succ_resp = client.post("/api/auth/login", json={
        "email": user_email,
        "password": "SecurePassword@123",
    })
    assert succ_resp.status_code == 200

    # History should be cleared
    assert user_email.lower() not in LOGIN_ATTEMPTS or len(LOGIN_ATTEMPTS[user_email.lower()]) == 0
