import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from backend.app.db.session import get_engine
from backend.app.db.models import User, PasswordResetCode
from backend.app.notifications.service import (
    dispatch_notification,
    mask_identifier,
    normalize_phone_e164,
    list_recent_notifications,
)


def get_test_db():
    return sessionmaker(bind=get_engine(), autocommit=False, autoflush=False)()


def test_mask_identifier_compliance():
    """Validates that sensitive identifiers are masked for logs and public envelopes."""
    assert mask_identifier("customer@example.com", "email") == "c******r@example.com"
    assert mask_identifier("a@b.com", "email") == "a*@b.com"
    assert mask_identifier("9876543210", "sms") == "+91******3210"
    assert mask_identifier("+919876543210", "whatsapp") == "+91******3210"


def test_normalize_phone_e164():
    """Validates normalization of Indian phone numbers to E.164."""
    assert normalize_phone_e164("9876543210") == "+919876543210"
    assert normalize_phone_e164("+91 98765 43210") == "+919876543210"
    assert normalize_phone_e164("919876543210") == "+919876543210"


def test_dispatch_notification_channels():
    """
    Validates that dispatch_notification dispatches across email, sms, and whatsapp,
    records in SQLite table, and returns expected payload without crashing.
    """
    for ch in ["email", "sms", "whatsapp"]:
        target = "test@trovi.internal" if ch == "email" else "9876543210"
        res = dispatch_notification(
            channel=ch,
            recipient=target,
            event_type="test_event",
            subject="Test Subject",
            content="Test content verification",
        )
        assert res["channel"] == ch
        assert res["status"] in ("simulated", "delivered")
        assert res["notification_id"] is not None

    recent = list_recent_notifications(limit=10)
    assert len(recent) >= 3


def test_forgot_password_multi_channel_sms_and_whatsapp(client: TestClient):
    """
    Validates that:
    1. A user can request an OTP through SMS.
    2. A user can request an OTP through WhatsApp.
    3. The OTP is NOT leaked in the API response.
    4. The user can reset password using phone identifier and received code.
    """
    user_email = "multichannel.user@trovi.internal"
    user_phone = "9876512345"

    from backend.tests.conftest import make_random_password
    init_pw = make_random_password()
    new_pw = make_random_password()
    reg_resp = client.post("/api/auth/register", json={
        "email": user_email,
        "password": init_pw,
        "full_name": "MultiChannel Tester",
        "phone": user_phone,
    })
    assert reg_resp.status_code == 201

    # Request via SMS
    sms_resp = client.post("/api/auth/forgot-password", json={
        "phone": user_phone,
        "channel": "sms",
    })
    assert sms_resp.status_code == 200
    sms_data = sms_resp.json()
    assert sms_data["status"] == "success"
    assert sms_data["channel"] == "sms"
    assert sms_data.get("dev_code") is None  # Security check: no OTP leak
    assert "+91******2345" in sms_data["message"]

    # Verify code in DB
    db = get_test_db()
    try:
        sms_code_entry = db.query(PasswordResetCode).filter(
            PasswordResetCode.email == user_email,
            PasswordResetCode.channel == "sms",
            PasswordResetCode.is_used == False,
        ).order_by(PasswordResetCode.created_at.desc()).first()
        assert sms_code_entry is not None
        sms_code = sms_code_entry.code
        assert len(sms_code) == 6
    finally:
        db.close()

    # Reset password using phone and code
    reset_resp = client.post("/api/auth/reset-password", json={
        "phone": user_phone,
        "code": sms_code,
        "new_password": new_pw,
    })
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "success"

    # Verify login with new password
    login_resp = client.post("/api/auth/login", json={
        "email": user_email,
        "password": new_pw,
    })
    assert login_resp.status_code == 200

    # Request via WhatsApp
    wa_resp = client.post("/api/auth/forgot-password", json={
        "email": user_email,
        "channel": "whatsapp",
    })
    assert wa_resp.status_code == 200
    wa_data = wa_resp.json()
    assert wa_data["status"] == "success"
    assert wa_data["channel"] == "whatsapp"
    assert wa_data.get("dev_code") is None
