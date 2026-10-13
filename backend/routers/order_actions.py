"""
FastAPI Router for Deterministic Order Action Service.
Strict authentication, rate limiting, and state machine transitions.
(NO LLM INSIDE)
"""

import time
from collections import defaultdict
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from pydantic import BaseModel, Field

from backend.app.auth.security import get_current_user
from backend.app.db.models import User
from backend.services.order_actions import (
    get_db_connection,
    get_user_order_or_404,
    check_action_eligibility,
    prepare_order_action,
    confirm_order_action,
    load_policies,
)

router = APIRouter(prefix="/api/actions", tags=["Order Actions"])

# ---------------------------------------------------------------------------
# In-Memory Rate Limiter (20 requests per minute per user)
# ---------------------------------------------------------------------------
RATE_LIMIT_MAX_REQUESTS = 20
RATE_LIMIT_WINDOW_SECONDS = 60
_user_request_timestamps = defaultdict(list)


def check_rate_limit(user_id: int):
    now = time.time()
    timestamps = _user_request_timestamps[user_id]
    # Prune timestamps older than window
    valid_timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    _user_request_timestamps[user_id] = valid_timestamps

    if len(valid_timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({RATE_LIMIT_MAX_REQUESTS} actions per minute). Please wait before trying again."
        )
    _user_request_timestamps[user_id].append(now)


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------

class PrepareActionRequest(BaseModel):
    order_id: Optional[str] = Field(None, description="Order number (e.g. ORD-2026-XXXXXX) or ID")
    action: str = Field(..., description="Action: place_order, cancel, return, exchange, or refund")
    item_id: Optional[int] = Field(None, description="Optional target item ID for return/exchange")
    replacement_item_id: Optional[int] = Field(None, description="Replacement product variant ID for exchange")
    reason: Optional[str] = Field(None, description="Reason code: damaged, wrong_item, quality_issue, changed_mind, late_delivery")
    photo_url: Optional[str] = Field(None, description="Optional photo URL for damaged or wrong item claims")
    # Additional fields for place_order
    items: Optional[List[Dict[str, Any]]] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    customer_email: Optional[str] = None
    payment_method: Optional[str] = None
    billing_address: Optional[str] = None
    buyer_gstin: Optional[str] = None
    buyer_company: Optional[str] = None
    target_budget_inr: Optional[float] = None
    budget_approved: Optional[bool] = False
    discount_inr: Optional[int] = 0


class ConfirmActionRequest(BaseModel):
    confirmation_token: str = Field(..., description="10-minute secure confirmation token")
    idempotency_key: Optional[str] = Field(None, description="Optional fallback if header is absent")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/eligibility")
def get_action_eligibility(
    order_id: Optional[str] = Query(None, description="Order number or ID"),
    action: str = Query("cancel", description="Action to check: cancel, return, exchange, refund, place_order"),
    item_id: Optional[int] = Query(None),
    reason: Optional[str] = Query(None),
    items: Optional[str] = Query(None, description="Optional items JSON for place_order"),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates policy eligibility for an order action deterministically.
    Enforces authentication and user ownership of the order (or 404).
    """
    check_rate_limit(current_user.id)

    conn = get_db_connection()
    try:
        policies = load_policies()

        if action == "place_order":
            cursor = conn.cursor()
            cart_rows = []
            if items:
                try:
                    parsed_items = json.loads(items) if isinstance(items, str) else items
                    if isinstance(parsed_items, list):
                        for it in parsed_items:
                            pid = it.get("product_id")
                            qty = it.get("quantity", 1)
                            cursor.execute("SELECT id, name as product_name, stock FROM products WHERE id = ?", (pid,))
                            p_row = cursor.fetchone()
                            if p_row:
                                cart_rows.append({"product_id": pid, "quantity": qty, "product_name": p_row["product_name"], "stock": p_row["stock"]})
                except Exception:
                    pass
            if not cart_rows:
                cursor.execute("""
                    SELECT c.product_id, c.quantity, p.name as product_name, p.stock
                    FROM cart_items c
                    JOIN products p ON c.product_id = p.id
                    WHERE c.user_id = ?
                """, (current_user.id,))
                cart_rows = [dict(r) for r in cursor.fetchall()]
            return check_action_eligibility({"items": cart_rows}, action=action, policies=policies)

        if not order_id:
            raise HTTPException(status_code=400, detail="Query parameter 'order_id' is required.")

        order = get_user_order_or_404(conn, order_id, current_user.id)
        result = check_action_eligibility(
            order=order,
            action=action,
            item_id=item_id,
            reason=reason,
            policies=policies,
        )
        return result
    finally:
        conn.close()


@router.post("/prepare")
def prepare_action(
    req: PrepareActionRequest,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
):
    """
    Prepares an action, calculates exact financial breakdown, and issues
    a secure 10-minute confirmation token tied to the user and action.
    """
    check_rate_limit(current_user.id)

    res = prepare_order_action(
        order_identifier=req.order_id,
        action=req.action,
        authenticated_user_id=current_user.id,
        item_id=req.item_id,
        replacement_item_id=req.replacement_item_id,
        reason=req.reason,
        photo_url=req.photo_url,
        items=req.items,
        customer_name=req.customer_name or getattr(current_user, "full_name", None) or getattr(current_user, "name", "Valued Customer"),
        customer_address=req.customer_address,
        customer_email=req.customer_email or getattr(current_user, "email", "shopper@moss.internal"),
        payment_method=req.payment_method,
        billing_address=req.billing_address,
        buyer_gstin=req.buyer_gstin,
        buyer_company=req.buyer_company,
        target_budget_inr=req.target_budget_inr,
        budget_approved=req.budget_approved or False,
        discount_inr=req.discount_inr or 0,
    )
    return res


@router.post("/confirm")
def confirm_action(
    req: ConfirmActionRequest,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
):
    """
    Executes an action deterministically with token verification and Idempotency-Key.
    Only valid state machine transitions are permitted.
    """
    check_rate_limit(current_user.id)

    idemp_key = idempotency_key_header or req.idempotency_key
    if not idemp_key or not idemp_key.strip():
        raise HTTPException(
            status_code=400,
            detail="Idempotency-Key header is required for confirming order actions."
        )

    res = confirm_order_action(
        confirmation_token=req.confirmation_token,
        authenticated_user_id=current_user.id,
        idempotency_key=idemp_key.strip(),
    )
    return res


@router.get("/tickets")
def get_user_tickets(
    order_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Fetches support tickets flagged for human review for the authenticated user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_number TEXT UNIQUE NOT NULL,
                order_number TEXT NOT NULL,
                user_id INTEGER,
                issue_type TEXT NOT NULL,
                status TEXT DEFAULT 'needs_human_review',
                description TEXT,
                photo_url TEXT,
                refund_amount_inr INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        if order_id:
            cursor.execute("""
                SELECT * FROM support_tickets WHERE user_id = ? AND order_number = ? ORDER BY id DESC
            """, (current_user.id, order_id))
        else:
            cursor.execute("""
                SELECT * FROM support_tickets WHERE user_id = ? ORDER BY id DESC
            """, (current_user.id,))
        rows = [dict(r) for r in cursor.fetchall()]
        return {"tickets": rows, "count": len(rows)}
    finally:
        conn.close()


@router.get("/audit-logs")
def get_user_audit_logs(
    order_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Fetches immutable state change audit trail for user's orders."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER,
                order_number TEXT NOT NULL,
                user_id INTEGER,
                action TEXT NOT NULL,
                old_state TEXT,
                new_state TEXT NOT NULL,
                reason TEXT,
                performed_by TEXT DEFAULT 'customer',
                metadata_json TEXT,
                timestamp TEXT DEFAULT (datetime('now'))
            )
        """)
        if order_id:
            cursor.execute("""
                SELECT * FROM order_audit_logs WHERE user_id = ? AND order_number = ? ORDER BY id DESC
            """, (current_user.id, order_id))
        else:
            cursor.execute("""
                SELECT * FROM order_audit_logs WHERE user_id = ? ORDER BY id DESC
            """, (current_user.id,))
        rows = [dict(r) for r in cursor.fetchall()]
        return {"audit_logs": rows, "count": len(rows)}
    finally:
        conn.close()
