"""
Notification Queue and Multi-Channel Dispatch Service for Trovi.
Supports Email (SMTP), SMS (Twilio), and WhatsApp (Twilio) with resilient
development console logging fallback and sensitive data masking.
"""

import os
import re
import json
import time
import base64
import smtplib
import logging
import sqlite3
import urllib.request
import urllib.parse
import urllib.error
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional

import backend.tools as tools
try:
    from backend.app.config import settings
except ImportError:
    from app.config import settings

logger = logging.getLogger("trovi.notifications")


def mask_identifier(val: str, channel: str = "email") -> str:
    """
    Masks sensitive recipient identifiers (emails, phone numbers) for privacy and compliance.
    e.g. 'customer@example.com' -> 'c******r@example.com'
    e.g. '+919876543210' -> '+91******3210'
    """
    if not val:
        return "******"

    val_str = str(val).strip()
    if channel.lower() == "email" or "@" in val_str:
        parts = val_str.split("@", 1)
        if len(parts) == 2:
            user, domain = parts
            if len(user) <= 2:
                masked_user = user[0] + "*"
            else:
                masked_user = user[0] + "*" * min(6, len(user) - 2) + user[-1]
            return f"{masked_user}@{domain}"

    # Phone number masking
    digits = re.sub(r"\D", "", val_str)
    if len(digits) >= 10:
        return f"+91******{digits[-4:]}"
    elif len(val_str) > 4:
        return val_str[:2] + "******" + val_str[-2:]
    return "******"


def normalize_phone_e164(phone: str) -> str:
    """Normalizes phone numbers to standard E.164 format (+91XXXXXXXXXX)."""
    cleaned = re.sub(r"[\s\-\(\)]", "", phone.strip())
    if cleaned.startswith("+"):
        return cleaned
    if cleaned.startswith("91") and len(cleaned) == 12:
        return f"+{cleaned}"
    if len(cleaned) == 10 and cleaned.isdigit():
        return f"+91{cleaned}"
    return f"+{cleaned}"


class BaseNotificationProvider:
    def send(self, recipient: str, subject: str, content: str, event_type: str) -> Dict[str, Any]:
        raise NotImplementedError


class EmailProvider(BaseNotificationProvider):
    def send(self, recipient: str, subject: str, content: str, event_type: str) -> Dict[str, Any]:
        smtp_host = settings.SMTP_HOST
        masked = mask_identifier(recipient, "email")

        # If SMTP is configured, attempt live delivery
        if smtp_host:
            try:
                smtp_port = settings.SMTP_PORT or 587
                smtp_user = settings.SMTP_USER
                smtp_pass = settings.SMTP_PASSWORD
                smtp_from = settings.SMTP_FROM or smtp_user or "security@trovi.store"

                msg = MIMEMultipart()
                msg["From"] = smtp_from
                msg["To"] = recipient
                msg["Subject"] = subject
                msg.attach(MIMEText(content, "plain"))

                with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                    if settings.SMTP_USE_TLS:
                        server.starttls()
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    server.send_message(msg)

                logger.info(f"[Email Dispatch: LIVE] To: {masked} | Subject: {subject}")
                return {"status": "delivered", "provider": "smtp"}
            except Exception as e:
                logger.error(f"[Email Dispatch FAILED] SMTP to {masked} error: {e}")
                return {"status": "failed", "error": str(e), "provider": "smtp"}

        # Development Fallback: Console Logging
        logger.info(
            f"[Email Dispatch: SIMULATED] To: {masked} | Subject: '{subject}' | Event: {event_type}\n"
            f"--- Email Body Preview ---\n{content}\n---------------------------"
        )
        return {"status": "simulated", "provider": "console_fallback"}


class SmsProvider(BaseNotificationProvider):
    def send(self, recipient: str, subject: str, content: str, event_type: str) -> Dict[str, Any]:
        e164_recipient = normalize_phone_e164(recipient)
        masked = mask_identifier(e164_recipient, "sms")

        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        from_number = settings.TWILIO_FROM_NUMBER

        # If Twilio is configured, attempt live delivery
        if sid and token and from_number:
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
                data = urllib.parse.urlencode({
                    "From": from_number,
                    "To": e164_recipient,
                    "Body": content,
                }).encode("utf-8")

                req = urllib.request.Request(url, data=data, method="POST")
                auth_str = f"{sid}:{token}"
                b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
                req.add_header("Authorization", f"Basic {b64_auth}")

                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status in (200, 201):
                        logger.info(f"[SMS Dispatch: LIVE] To: {masked} via Twilio")
                        return {"status": "delivered", "provider": "twilio_sms"}
                    else:
                        logger.warning(f"[SMS Dispatch: UNEXPECTED STATUS] HTTP {resp.status} to {masked}")
            except Exception as e:
                logger.error(f"[SMS Dispatch FAILED] Twilio to {masked} error: {e}")
                return {"status": "failed", "error": str(e), "provider": "twilio_sms"}

        # Development Fallback: Console Logging
        logger.info(
            f"[SMS Dispatch: SIMULATED] To: {masked} | Event: {event_type}\n"
            f"--- SMS Body Preview ---\n{content}\n------------------------"
        )
        return {"status": "simulated", "provider": "console_fallback"}


class WhatsAppProvider(BaseNotificationProvider):
    def send(self, recipient: str, subject: str, content: str, event_type: str) -> Dict[str, Any]:
        e164_recipient = normalize_phone_e164(recipient)
        masked = mask_identifier(e164_recipient, "whatsapp")

        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        from_number = settings.TWILIO_WHATSAPP_FROM_NUMBER or settings.TWILIO_FROM_NUMBER

        # If Twilio WhatsApp is configured, attempt live delivery
        if sid and token and from_number:
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
                wa_from = from_number if from_number.startswith("whatsapp:") else f"whatsapp:{from_number}"
                wa_to = e164_recipient if e164_recipient.startswith("whatsapp:") else f"whatsapp:{e164_recipient}"

                data = urllib.parse.urlencode({
                    "From": wa_from,
                    "To": wa_to,
                    "Body": content,
                }).encode("utf-8")

                req = urllib.request.Request(url, data=data, method="POST")
                auth_str = f"{sid}:{token}"
                b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
                req.add_header("Authorization", f"Basic {b64_auth}")

                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status in (200, 201):
                        logger.info(f"[WhatsApp Dispatch: LIVE] To: {masked} via Twilio")
                        return {"status": "delivered", "provider": "twilio_whatsapp"}
                    else:
                        logger.warning(f"[WhatsApp Dispatch: UNEXPECTED STATUS] HTTP {resp.status} to {masked}")
            except Exception as e:
                logger.error(f"[WhatsApp Dispatch FAILED] Twilio WhatsApp to {masked} error: {e}")
                return {"status": "failed", "error": str(e), "provider": "twilio_whatsapp"}

        # Development Fallback: Console Logging
        logger.info(
            f"[WhatsApp Dispatch: SIMULATED] To: {masked} | Event: {event_type}\n"
            f"--- WhatsApp Body Preview ---\n{content}\n-----------------------------"
        )
        return {"status": "simulated", "provider": "console_fallback"}


PROVIDERS: Dict[str, BaseNotificationProvider] = {
    "email": EmailProvider(),
    "sms": SmsProvider(),
    "whatsapp": WhatsAppProvider(),
}


def init_notifications_table(conn: sqlite3.Connection):
    """Ensures notifications log table exists."""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,  -- email, sms, whatsapp
            recipient TEXT NOT NULL,
            event_type TEXT NOT NULL, -- order_placed, status_update, password_reset, password_changed
            subject TEXT,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'sent', -- delivered, simulated, failed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()


def dispatch_notification(
    channel: str,
    recipient: str,
    event_type: str,
    subject: str,
    content: str,
) -> Dict[str, Any]:
    """
    Dispatches a transactional notification over Email, SMS, or WhatsApp.
    Persists delivery log to SQLite notifications table with delivery status.
    Never crashes caller if downstream delivery fails.
    """
    norm_channel = channel.lower().strip()
    provider = PROVIDERS.get(norm_channel, PROVIDERS["email"])

    delivery_result = provider.send(
        recipient=recipient,
        subject=subject,
        content=content,
        event_type=event_type,
    )
    delivery_status = delivery_result.get("status", "simulated")

    conn = tools.get_db_connection()
    notif_id = None
    try:
        init_notifications_table(conn)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notifications (channel, recipient, event_type, subject, content, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (norm_channel, recipient, event_type, subject, content, delivery_status))
        conn.commit()
        notif_id = cursor.lastrowid
    except Exception as e:
        logger.warning(f"Failed to record notification log in SQLite: {e}")
    finally:
        conn.close()

    return {
        "notification_id": notif_id,
        "channel": norm_channel,
        "recipient": mask_identifier(recipient, norm_channel),
        "status": delivery_status,
        "provider": delivery_result.get("provider", "console_fallback"),
        "timestamp": int(time.time()),
    }


def send_order_confirmation_notification(order_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Dispatches multi-channel confirmation across Email and WhatsApp upon order placement."""
    order_num = order_data.get("order_number", "ORD-UNKNOWN")
    email = order_data.get("customer_email") or "shopper@trovi.internal"
    phone = order_data.get("customer_phone") or "+91 98450 12345"
    total_inr = order_data.get("total_price_inr") or order_data.get("total_inr", 0)

    results = []

    # 1. Email notification
    email_content = (
        f"Hi {order_data.get('customer_name', 'Shopper')},\n\n"
        f"Your order #{order_num} has been confirmed!\n"
        f"Total Paid: ₹{total_inr:,}\n"
        f"Delivery Address: {order_data.get('customer_address', 'Your address')}\n\n"
        f"Thank you for choosing Trovi."
    )
    res_email = dispatch_notification(
        channel="email",
        recipient=email,
        event_type="order_placed",
        subject=f"Trovi Order Confirmation: #{order_num}",
        content=email_content,
    )
    results.append(res_email)

    # 2. WhatsApp notification
    whatsapp_content = (
        f"🌿 *Trovi Order Confirmed!* #{order_num}\n"
        f"Amount: ₹{total_inr:,}\n"
        f"Your package is being packed for delivery."
    )
    res_wa = dispatch_notification(
        channel="whatsapp",
        recipient=phone,
        event_type="order_placed",
        subject="Order Confirmation",
        content=whatsapp_content,
    )
    results.append(res_wa)

    return results


def send_status_update_notification(
    order_number: str,
    new_status: str,
    customer_email: Optional[str] = None,
    customer_phone: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Dispatches status change notifications to customer across Email and SMS."""
    results = []
    email = customer_email or "shopper@trovi.internal"
    phone = customer_phone or "+91 98450 12345"

    msg = f"Your Trovi order #{order_number} status has been updated to: {new_status.upper()}."

    res_email = dispatch_notification(
        channel="email",
        recipient=email,
        event_type="status_update",
        subject=f"Trovi Update: Order #{order_number} is {new_status.title()}",
        content=msg,
    )
    results.append(res_email)

    res_sms = dispatch_notification(
        channel="sms",
        recipient=phone,
        event_type="status_update",
        subject="Status Update",
        content=f"Trovi: Order #{order_number} is now {new_status}. Track in app.",
    )
    results.append(res_sms)

    return results


def list_recent_notifications(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    """Fetches recent notifications for admin monitoring."""
    conn = tools.get_db_connection()
    try:
        init_notifications_table(conn)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, channel, recipient, event_type, subject, content, status, created_at
            FROM notifications
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        """, (limit, offset))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
