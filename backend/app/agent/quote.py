"""
Cryptographic Quote Confirmation Tokens for MOSS E-Commerce.
Uses HMAC-SHA256 to ensure quote bundles cannot be tampered with or replayed after expiry.
Compatible with SQLAlchemy AgentQuote model and SQLite table.
"""
import os
import time
import json
import hmac
import hashlib
import uuid
import sqlite3
from typing import Dict, Any, List, Optional
import backend.tools as tools

QUOTE_SECRET = os.getenv("SECRET_KEY", "moss-production-cryptographic-quote-secret-2026").encode("utf-8")
QUOTE_EXPIRY_SECONDS = 900  # 15 minutes


def _compute_digest(quote_id: str, items_summary: str, total_inr: int, expires_at: int) -> str:
    payload = f"{quote_id}|{items_summary}|{total_inr}|{expires_at}".encode("utf-8")
    return hmac.new(QUOTE_SECRET, payload, hashlib.sha256).hexdigest()[:24]


def create_cryptographic_quote(
    items: List[Dict[str, Any]],
    total_inr: int,
    target_budget_inr: Optional[float] = None,
    customer_name: str = "Valued Customer",
) -> Dict[str, Any]:
    """
    Issues a cryptographically signed, tamper-proof quote token with 15-minute expiry.
    Persists the issued quote into the database using agent_quotes schema.
    """
    quote_id = f"QT-2026-{uuid.uuid4().hex[:8].upper()}"
    now = int(time.time())
    expires_at = now + QUOTE_EXPIRY_SECONDS

    # Create canonical items string
    canonical_items = sorted(
        [{"pid": it.get("product_id") or it.get("id"), "qty": it.get("quantity", 1), "price": it.get("unit_price_inr") or it.get("price_inr")} for it in items],
        key=lambda x: str(x["pid"])
    )
    items_summary_digest = hashlib.sha256(json.dumps(canonical_items, sort_keys=True).encode("utf-8")).hexdigest()[:16]

    signature = _compute_digest(quote_id, items_summary_digest, total_inr, expires_at)
    token = f"{quote_id}.{expires_at}.{signature}"

    conn = tools.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quote_token VARCHAR(100) UNIQUE NOT NULL,
            user_id INTEGER,
            items_json TEXT NOT NULL,
            total_inr INTEGER NOT NULL,
            target_budget_inr INTEGER,
            is_confirmed BOOLEAN DEFAULT 0,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        INSERT INTO agent_quotes (quote_token, items_json, total_inr, target_budget_inr, is_confirmed, expires_at)
        VALUES (?, ?, ?, ?, 0, ?)
    """, (token, json.dumps(items), total_inr, int(target_budget_inr) if target_budget_inr is not None else None, expires_at))
    conn.commit()
    conn.close()

    return {
        "quote_id": quote_id,
        "quote_token": token,
        "total_inr": total_inr,
        "expires_at": expires_at,
        "expires_in_minutes": 15,
        "valid": True,
    }


def verify_cryptographic_quote(token: str) -> Dict[str, Any]:
    """
    Validates token signature, expiration timestamp, and single-use status.
    Returns quote record if valid, or error dictionary if tampered or expired.
    """
    if not token or "." not in token:
        return {"valid": False, "reason": "Malformed quote token format."}

    parts = token.strip().split(".")
    if len(parts) != 3:
        return {"valid": False, "reason": "Invalid quote token segments."}

    quote_id, expires_at_str, signature = parts
    try:
        expires_at = int(expires_at_str)
    except ValueError:
        return {"valid": False, "reason": "Invalid token expiry format."}

    now = int(time.time())
    if now > expires_at:
        return {"valid": False, "reason": f"Quote token has expired ({now - expires_at}s ago). Please request a fresh quote."}

    conn = tools.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quote_token VARCHAR(100) UNIQUE NOT NULL,
            user_id INTEGER,
            items_json TEXT NOT NULL,
            total_inr INTEGER NOT NULL,
            target_budget_inr INTEGER,
            is_confirmed BOOLEAN DEFAULT 0,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("SELECT * FROM agent_quotes WHERE quote_token LIKE ?", (f"{quote_id}%",))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return {"valid": False, "reason": f"Quote {quote_id} not found in database records."}

    if row["is_confirmed"]:
        conn.close()
        return {"valid": False, "reason": f"Quote {quote_id} has already been consumed for an order."}

    # Verify signature
    items = json.loads(row["items_json"])
    canonical_items = sorted(
        [{"pid": it.get("product_id") or it.get("id"), "qty": it.get("quantity", 1), "price": it.get("unit_price_inr") or it.get("price_inr")} for it in items],
        key=lambda x: str(x["pid"])
    )
    items_summary_digest = hashlib.sha256(json.dumps(canonical_items, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    expected_sig = _compute_digest(quote_id, items_summary_digest, row["total_inr"], expires_at)

    if not hmac.compare_digest(signature, expected_sig):
        conn.close()
        return {"valid": False, "reason": "Cryptographic signature mismatch. Token has been tampered with."}

    conn.close()
    return {
        "valid": True,
        "quote_id": quote_id,
        "total_inr": row["total_inr"],
        "items": items,
        "target_budget_inr": row["target_budget_inr"],
    }


def mark_quote_as_used(quote_id: str):
    """Marks quote token as consumed to prevent replay attacks."""
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE agent_quotes SET is_confirmed = 1 WHERE quote_token LIKE ?", (f"{quote_id}%",))
    conn.commit()
    conn.close()


# Alias for backwards compatibility
verify_quote_token = verify_cryptographic_quote
