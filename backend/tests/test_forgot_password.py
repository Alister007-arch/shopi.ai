import datetime
from datetime import timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from backend.app.db.session import get_engine
from backend.app.db.models import PasswordResetCode, User


def get_test_db():
    return sessionmaker(bind=get_engine(), autocommit=False, autoflush=False)()


def test_forgot_password_generates_code_and_protects_security(client: TestClient):
    """
    Validates that:
    1. A registered user can request a password reset.
    2. The API NEVER leaks the OTP in the response body (dev_code is None).
    3. The OTP is stored in the database and dispatched via email notification.
    """
    user_email = "forgot.test1@trovi.internal"
    client.post("/api/auth/register", json={
        "email": user_email,
        "password": "InitialPassword@123",
        "full_name": "Reset Tester One",
    })

    resp = client.post("/api/auth/forgot-password", json={"email": user_email})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "success"
    assert "verification code" in data["message"].lower()
    # Critical security assertion: API must NOT return dev_code / OTP in response
    assert data.get("dev_code") is None

    # Verify code exists in DB for dispatch
    db = get_test_db()
    try:
        record = db.query(PasswordResetCode).filter(
            PasswordResetCode.email == user_email,
            PasswordResetCode.is_used == False,
        ).order_by(PasswordResetCode.created_at.desc()).first()
        assert record is not None
        assert len(record.code) == 6
        assert record.code.isdigit()
    finally:
        db.close()


def test_forgot_password_nonexistent_user_prevents_enumeration(client: TestClient):
    """
    Nonexistent email requests must still return 200 with an opaque success message
    to prevent user enumeration attacks, and no DB code is created.
    """
    unknown_email = "unknown.ghost@trovi.internal"
    resp = client.post("/api/auth/forgot-password", json={"email": unknown_email})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data.get("dev_code") is None

    db = get_test_db()
    try:
        record = db.query(PasswordResetCode).filter(PasswordResetCode.email == unknown_email).first()
        assert record is None
    finally:
        db.close()


def test_reset_password_full_flow(client: TestClient):
    """
    Tests complete lifecycle:
    1. Register user with old password
    2. Request reset code (OTP sent to email)
    3. Read OTP from email dispatch (DB)
    4. Reset password using valid OTP
    5. Old password rejected, new password authenticated
    """
    user_email = "lifecycle.test@trovi.internal"
    client.post("/api/auth/register", json={
        "email": user_email,
        "password": "OldPassword@123",
        "full_name": "Lifecycle Tester",
    })

    # Request code
    forgot_resp = client.post("/api/auth/forgot-password", json={"email": user_email})
    assert forgot_resp.status_code == 200
    assert forgot_resp.json().get("dev_code") is None

    # Retrieve dispatched OTP from DB (as customer reads from incoming email)
    db = get_test_db()
    try:
        rec = db.query(PasswordResetCode).filter(
            PasswordResetCode.email == user_email,
            PasswordResetCode.is_used == False,
        ).order_by(PasswordResetCode.created_at.desc()).first()
        assert rec is not None
        code = rec.code
    finally:
        db.close()

    # Reset password
    reset_resp = client.post("/api/auth/reset-password", json={
        "email": user_email,
        "code": code,
        "new_password": "NewSecretPassword@456",
    })
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "success"

    # Old password must fail
    old_login = client.post("/api/auth/login", json={
        "email": user_email,
        "password": "OldPassword@123",
    })
    assert old_login.status_code == 401

    # New password must succeed
    new_login = client.post("/api/auth/login", json={
        "email": user_email,
        "password": "NewSecretPassword@456",
    })
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()


def test_reset_password_invalid_code_rejected(client: TestClient):
    """Submitting an incorrect code must be rejected with 400 Bad Request."""
    user_email = "invalid.code@trovi.internal"
    client.post("/api/auth/register", json={
        "email": user_email,
        "password": "MyInitialPass@123",
        "full_name": "Invalid Code Tester",
    })

    client.post("/api/auth/forgot-password", json={"email": user_email})

    resp = client.post("/api/auth/reset-password", json={
        "email": user_email,
        "code": "000000",  # deliberate invalid code
        "new_password": "NewPassword@123",
    })
    assert resp.status_code == 400
    assert "invalid or expired" in resp.json()["detail"].lower()


def test_reset_password_expired_code_rejected(client: TestClient):
    """Expired codes must be rejected with 400."""
    user_email = "expired.code@trovi.internal"
    client.post("/api/auth/register", json={
        "email": user_email,
        "password": "MyInitialPass@123",
        "full_name": "Expired Code Tester",
    })

    # Insert an already-expired reset code
    db = get_test_db()
    try:
        expired_entry = PasswordResetCode(
            email=user_email,
            code="654321",
            expires_at=datetime.datetime.now(timezone.utc) - timedelta(minutes=10),
            is_used=False,
        )
        db.add(expired_entry)
        db.commit()
    finally:
        db.close()

    resp = client.post("/api/auth/reset-password", json={
        "email": user_email,
        "code": "654321",
        "new_password": "BrandNewPassword@123",
    })
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_reset_password_code_single_use(client: TestClient):
    """A reset code cannot be reused once consumed."""
    user_email = "singleuse@trovi.internal"
    client.post("/api/auth/register", json={
        "email": user_email,
        "password": "PasswordOne@123",
        "full_name": "Single Use Tester",
    })

    forgot_resp = client.post("/api/auth/forgot-password", json={"email": user_email})
    assert forgot_resp.json().get("dev_code") is None

    db = get_test_db()
    try:
        rec = db.query(PasswordResetCode).filter(
            PasswordResetCode.email == user_email,
            PasswordResetCode.is_used == False,
        ).order_by(PasswordResetCode.created_at.desc()).first()
        code = rec.code
    finally:
        db.close()

    # First reset succeeds
    resp1 = client.post("/api/auth/reset-password", json={
        "email": user_email,
        "code": code,
        "new_password": "PasswordTwo@123",
    })
    assert resp1.status_code == 200

    # Second reset with identical code fails
    resp2 = client.post("/api/auth/reset-password", json={
        "email": user_email,
        "code": code,
        "new_password": "PasswordThree@123",
    })
    assert resp2.status_code == 400
    assert "invalid or expired" in resp2.json()["detail"].lower()
