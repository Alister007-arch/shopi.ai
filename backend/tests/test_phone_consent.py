import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from backend.app.db.session import get_engine
from backend.app.db.models import User


def get_test_db():
    return sessionmaker(bind=get_engine(), autocommit=False, autoflush=False)()


def test_register_with_phone_and_consent(client: TestClient):
    """
    Registration with an Indian phone number and phone_consent=True
    sets phone_consent to True and records the consent timestamp.
    """
    email = "phone.consent.user1@trovi.internal"
    phone = "9876543210"

    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": "StrongPassword@123",
        "full_name": "Consent Customer",
        "phone": phone,
        "phone_consent": True,
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["user"]["phone"] == phone
    assert data["user"]["phone_consent"] is True

    # Validate database records
    db = get_test_db()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.phone == phone
        assert user.phone_consent is True
        assert user.phone_consent_at is not None
    finally:
        db.close()


def test_register_without_phone_ignores_consent(client: TestClient):
    """
    If no phone number is provided during registration,
    phone_consent must remain False.
    """
    email = "nophone.user@trovi.internal"

    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": "StrongPassword@123",
        "full_name": "No Phone Customer",
        "phone_consent": True,
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["user"]["phone_consent"] is False

    db = get_test_db()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.phone is None
        assert user.phone_consent is False
        assert user.phone_consent_at is None
    finally:
        db.close()


def test_update_profile_phone_and_consent(client: TestClient):
    """
    Users can update their phone number and consent settings via /api/auth/profile.
    """
    email = "update.consent@trovi.internal"
    reg_resp = client.post("/api/auth/register", json={
        "email": email,
        "password": "StrongPassword@123",
        "full_name": "Updatable User",
        "phone": "9811122233",
        "phone_consent": False,
    })
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Turn on consent
    update_resp = client.put("/api/auth/profile", json={
        "full_name": "Updatable User",
        "phone": "9811122233",
        "phone_consent": True,
    }, headers=headers)
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["phone_consent"] is True

    # Verify database
    db = get_test_db()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user.phone_consent is True
        assert user.phone_consent_at is not None
    finally:
        db.close()

    # Revoke consent
    revoke_resp = client.put("/api/auth/profile", json={
        "phone_consent": False,
    }, headers=headers)
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["phone_consent"] is False


def test_api_me_returns_phone_consent(client: TestClient):
    """
    Both /api/auth/me and /api/me return phone_consent accurately.
    """
    email = "me.consent@trovi.internal"
    reg_resp = client.post("/api/auth/register", json={
        "email": email,
        "password": "StrongPassword@123",
        "full_name": "Me Endpoint User",
        "phone": "9988776655",
        "phone_consent": True,
    })
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Check /api/auth/me
    auth_me_resp = client.get("/api/auth/me", headers=headers)
    assert auth_me_resp.status_code == 200
    assert auth_me_resp.json()["phone_consent"] is True

    # Check /api/me
    api_me_resp = client.get("/api/me", headers=headers)
    assert api_me_resp.status_code == 200
    data = api_me_resp.json()
    assert data["phone_consent"] is True
    assert data["phone_consent_at"] is not None


def test_phone_validation_rejects_invalid_indian_numbers(client: TestClient):
    """
    Registration rejects invalid Indian phone numbers (must be 10 digits starting 6-9).
    """
    invalid_numbers = [
        "1234567890",    # Does not start with 6-9
        "98765",         # Too short
        "9876543210123", # Too long
        "987654321a",    # Non-digit characters
    ]

    for num in invalid_numbers:
        resp = client.post("/api/auth/register", json={
            "email": f"badphone_{num}@trovi.internal",
            "password": "StrongPassword@123",
            "full_name": "Invalid Phone User",
            "phone": num,
        })
        assert resp.status_code == 422, f"Expected 422 for phone {num}, got {resp.status_code}"
