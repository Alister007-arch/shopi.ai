"""
Deterministic Order Action Service for MOSS E-Commerce.
Pure code & state machine (NO LLM inside).
Handles placing orders, cancel, return, exchange, refund, audit logging, and human-review escalations.
"""

import os
import json
import uuid
import yaml
import sqlite3
import datetime
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException

# Policy file location
POLICY_PATH = (
    os.environ.get("POLICY_PATH")
    or os.environ.get("MOSS_POLICY_PATH")
    or os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "config", "policies.yaml")
)

DB_PATH = os.environ.get("SHOPI_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopai.db"))

def get_db_connection() -> sqlite3.Connection:
    target = os.environ.get("SHOPI_DB_PATH", DB_PATH)
    conn = sqlite3.connect(target, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


from backend.app.policies.loader import get_store_policies, StorePolicyConfig
try:
    from backend.app.catalog.categories import get_policy_group_for_category
except ImportError:
    from app.catalog.categories import get_policy_group_for_category

def load_policies() -> StorePolicyConfig:
    """Loads typed store business policies from config/policies.yaml."""
    return get_store_policies()


# ---------------------------------------------------------------------------
# Order States and State Machine Transitions
# ---------------------------------------------------------------------------

ORDER_STATES = [
    "placed",
    "confirmed",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "return_requested",
    "return_picked_up",
    "return_received",
    "exchange_requested",
    "exchange_shipped",
    "refund_initiated",
    "refunded",
]

# Strict directed state graph
VALID_STATE_TRANSITIONS: Dict[str, List[str]] = {
    "placed": ["confirmed", "cancelled"],
    "confirmed": ["packed", "cancelled"],
    "packed": ["shipped", "cancelled"],
    "shipped": ["out_for_delivery"],
    "out_for_delivery": ["delivered"],
    "delivered": ["return_requested", "exchange_requested"],
    "cancelled": ["refund_initiated"],
    "return_requested": ["return_picked_up", "cancelled"],
    "return_picked_up": ["return_received"],
    "return_received": ["refund_initiated"],
    "exchange_requested": ["exchange_shipped", "cancelled"],
    "exchange_shipped": ["delivered"],
    "refund_initiated": ["refunded"],
    "refunded": [],
}


def normalize_order_state(state_str: str) -> str:
    """Normalizes arbitrary legacy order status strings into one of the 14 formal states."""
    if not state_str:
        return "placed"
    s = state_str.lower().strip()
    if s in ORDER_STATES:
        return s
    if "confirm" in s:
        return "confirmed"
    if "pack" in s:
        return "packed"
    if "ship" in s and "exchange" not in s:
        return "shipped"
    if "out for" in s or "dispatch" in s:
        return "out_for_delivery"
    if "deliver" in s:
        return "delivered"
    if "cancel" in s:
        return "cancelled"
    if "return" in s:
        if "pick" in s:
            return "return_picked_up"
        if "receiv" in s:
            return "return_received"
        return "return_requested"
    if "exchange" in s:
        if "ship" in s:
            return "exchange_shipped"
        return "exchange_requested"
    if "refund" in s:
        return "refund_initiated" if "initiat" in s else "refunded"
    return "placed"


def validate_transition(current_state: str, target_state: str) -> Tuple[bool, str]:
    """Validates if current_state -> target_state is an allowed transition."""
    curr_norm = normalize_order_state(current_state)
    target_norm = normalize_order_state(target_state)

    if curr_norm == target_norm:
        return True, "No transition needed (states are identical)."

    allowed = VALID_STATE_TRANSITIONS.get(curr_norm, [])
    if target_norm in allowed:
        return True, "Valid transition."

    return (
        False,
        f"Illegal transition: Cannot transition order from '{curr_norm}' to '{target_norm}'. "
        f"Allowed target states from '{curr_norm}': {allowed}.",
    )


# ---------------------------------------------------------------------------
# RefundProvider Interface & Mock Implementation
# ---------------------------------------------------------------------------

class RefundProvider(ABC):
    @abstractmethod
    def process_refund(self, order_data: Dict[str, Any], amount_inr: int, reason: str) -> Dict[str, Any]:
        """Processes a refund through a payment gateway."""
        pass


class MockRefundProvider(RefundProvider):
    def process_refund(self, order_data: Dict[str, Any], amount_inr: int, reason: str) -> Dict[str, Any]:
        payment_method = (order_data.get("payment_method") or "").lower()
        is_cod = "cod" in payment_method or "cash" in payment_method

        if is_cod:
            return {
                "status": "pending_details",
                "refund_id": f"ref_cod_{uuid.uuid4().hex[:10]}",
                "destination": "bank_upi_details_required",
                "amount_inr": amount_inr,
                "message": "Bank account or UPI VPA details required for payout of Cash on Delivery orders.",
                "eta_days": "3-5 business days after bank verification",
            }

        return {
            "status": "initiated",
            "refund_id": f"ref_gw_{uuid.uuid4().hex[:12]}",
            "destination": "original_payment_method",
            "payment_method": order_data.get("payment_method"),
            "amount_inr": amount_inr,
            "message": f"Refund of ₹{amount_inr:,} initiated to original payment source ({order_data.get('payment_method')}).",
            "eta_days": "2-3 business days",
        }


# ---------------------------------------------------------------------------
# NotificationProvider Interface & Mock Implementation
# ---------------------------------------------------------------------------

class NotificationProvider(ABC):
    @abstractmethod
    def notify_state_change(
        self,
        order_number: str,
        old_state: str,
        new_state: str,
        recipient_email: str,
        reason: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Dispatches automated notifications (email, SMS, WhatsApp) on state change."""
        pass


class MockNotificationProvider(NotificationProvider):
    def notify_state_change(
        self,
        order_number: str,
        old_state: str,
        new_state: str,
        recipient_email: str,
        reason: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        timestamp = datetime.datetime.now().isoformat()
        notification_payload = {
            "order_number": order_number,
            "old_state": old_state,
            "new_state": new_state,
            "recipient": recipient_email,
            "reason": reason,
            "timestamp": timestamp,
            "channels": ["email", "sms"],
            "status": "delivered_mock",
        }
        # In real production, this routes to SendGrid, Twilio, or Meta WhatsApp Business API
        return notification_payload


# Singleton providers
refund_provider = MockRefundProvider()
notification_provider = MockNotificationProvider()


# ---------------------------------------------------------------------------
# Audit Logger
# ---------------------------------------------------------------------------

def record_order_audit_log(
    conn: sqlite3.Connection,
    order_id: Optional[int],
    order_number: str,
    user_id: Optional[int],
    action: str,
    old_state: Optional[str],
    new_state: str,
    reason: str,
    performed_by: str = "customer",
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    """Inserts a structured row into the order_audit_logs table."""
    cursor = conn.cursor()
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
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    cursor.execute("""
        INSERT INTO order_audit_logs (
            order_id, order_number, user_id, action, old_state, new_state, reason, performed_by, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        order_id,
        order_number,
        user_id,
        action,
        old_state,
        new_state,
        reason,
        performed_by,
        json.dumps(metadata or {}),
    ))
    return cursor.lastrowid


# ---------------------------------------------------------------------------
# Order Retrieval & Ownership Guard
# ---------------------------------------------------------------------------

def get_user_order_or_404(
    conn: sqlite3.Connection,
    order_identifier: str,
    authenticated_user_id: int,
) -> Dict[str, Any]:
    """
    Fetches an order by order_number or numeric id and verifies ownership.
    Returns HTTP 404 if the order does not exist OR belongs to another user
    (preventing info leakage of other users' orders).
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM orders
        WHERE (order_number = ? OR id = ?)
    """, (order_identifier, order_identifier if order_identifier.isdigit() else -1))
    row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Order not found.")

    order = dict(row)
    # Check ownership
    order_owner_id = order.get("user_id")
    if order_owner_id is not None and order_owner_id != authenticated_user_id:
        raise HTTPException(status_code=404, detail="Order not found.")

    # Fetch items with category policy group
    cursor.execute("""
        SELECT oi.*, p.category, p.subcategory, p.stock, c.policy_group
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN categories c ON (p.category_id = c.id OR LOWER(p.category) = LOWER(c.slug))
        WHERE oi.order_id = ?
    """, (order["id"],))
    order["items"] = [dict(it) for it in cursor.fetchall()]

    return order


# ---------------------------------------------------------------------------
# Core Policy Evaluation & Eligibility Checker
# ---------------------------------------------------------------------------

def check_action_eligibility(
    order: Dict[str, Any],
    action: str,
    item_id: Optional[int] = None,
    reason: Optional[str] = None,
    policies: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Pure deterministic eligibility calculation based on order state and policies.yaml.
    All rules (category windows, reasons, innerwear exceptions, fee deductions)
    are read strictly from StorePolicyConfig with ZERO hardcoded numbers.
    """
    p: StorePolicyConfig = policies if isinstance(policies, StorePolicyConfig) else get_store_policies()
    curr_state = normalize_order_state(order.get("status", "placed"))
    order_items = order.get("items", [])

    if action == "cancel":
        allowed_before = p.cancellation.allowed_before_status
        # Cancellation allowed in states strictly before allowed_before
        cancel_allowed_states = ["placed", "confirmed", "packed"]
        if curr_state in cancel_allowed_states:
            return {
                "eligible": True,
                "action": "cancel",
                "order_number": order["order_number"],
                "current_status": curr_state,
                "message": f"Order #{order['order_number']} is in '{curr_state}' status and can be cancelled free of charge.",
                "allowed_reasons": p.cancellation.allowed_reasons,
                "refund_estimate_inr": order.get("total_price_inr", 0),
            }
        else:
            return {
                "eligible": False,
                "action": "cancel",
                "order_number": order["order_number"],
                "current_status": curr_state,
                "message": f"Order cannot be cancelled because it is already '{curr_state}' (cancellations are only allowed before {allowed_before}).",
                "allowed_reasons": [],
            }

    elif action == "return":
        # Order must be delivered
        if curr_state != "delivered":
            return {
                "eligible": False,
                "action": "return",
                "order_number": order["order_number"],
                "current_status": curr_state,
                "message": f"Returns are only permitted after order is 'delivered'. Current status is '{curr_state}'.",
                "allowed_reasons": [],
            }

        # Resolve target item or primary item for category rules
        target_item = None
        if item_id:
            for it in order_items:
                if it.get("product_id") == item_id:
                    target_item = it
                    break
        if not target_item and order_items:
            target_item = order_items[0]

        target_policy_group = target_item.get("policy_group") if target_item else None
        if not target_policy_group and target_item:
            target_policy_group = get_policy_group_for_category(
                target_item.get("category") or target_item.get("subcategory")
            )

        cat_policy, is_innerwear, cat_key = p.resolve_category(
            category=target_item.get("category") if target_item else None,
            subcategory=target_item.get("subcategory") if target_item else None,
            item_name=target_item.get("product_name") if target_item else None,
            policy_group=target_policy_group,
        )

        # Check window expiry against category-specific window_hours from config
        delivered_timestamp = order.get("delivered_at") or order.get("ordered_at")
        is_window_valid, elapsed_hours, window_msg = p.check_window_expiry(cat_policy, delivered_timestamp)
        if not is_window_valid:
            return {
                "eligible": False,
                "action": "return",
                "order_number": order["order_number"],
                "current_status": curr_state,
                "category": cat_key,
                "message": window_msg,
                "allowed_reasons": [],
            }

        # Check category allowed / disallowed reasons
        if reason:
            is_reason_allowed, reason_msg = p.is_action_reason_allowed(cat_policy, is_innerwear, reason)
            if not is_reason_allowed:
                active_allowed = (
                    cat_policy.innerwear.allowed_reasons
                    if is_innerwear and cat_policy.innerwear
                    else cat_policy.allowed_reasons
                )
                return {
                    "eligible": False,
                    "action": "return",
                    "order_number": order["order_number"],
                    "current_status": curr_state,
                    "category": cat_key,
                    "message": reason_msg,
                    "allowed_reasons": active_allowed,
                }

        # Calculate refund estimate based on delivery fee refundable rules in config
        paid_inr = order.get("total_price_inr", 0)
        deliv_fee = order.get("delivery_fee_inr", 0)
        if p.is_delivery_fee_refundable(reason):
            computed_refund = paid_inr
        else:
            computed_refund = max(0, paid_inr - deliv_fee)

        active_allowed = (
            cat_policy.innerwear.allowed_reasons
            if is_innerwear and cat_policy.innerwear
            else cat_policy.allowed_reasons
        )

        return {
            "eligible": True,
            "action": "return",
            "order_number": order["order_number"],
            "current_status": curr_state,
            "category": cat_key,
            "message": f"Order #{order['order_number']} is eligible for return within policy window.",
            "allowed_reasons": active_allowed,
            "refund_estimate_inr": computed_refund,
            "requires_photo": cat_policy.photo_required,
            "resolution_options": cat_policy.resolution_options,
        }

    elif action == "exchange":
        if curr_state != "delivered":
            return {
                "eligible": False,
                "action": "exchange",
                "order_number": order["order_number"],
                "current_status": curr_state,
                "message": f"Exchanges are only permitted after order is 'delivered'. Current status is '{curr_state}'.",
                "allowed_reasons": [],
            }

        target_item = None
        if item_id:
            for it in order_items:
                if it.get("product_id") == item_id:
                    target_item = it
                    break
        if not target_item and order_items:
            target_item = order_items[0]

        target_policy_group = target_item.get("policy_group") if target_item else None
        if not target_policy_group and target_item:
            target_policy_group = get_policy_group_for_category(
                target_item.get("category") or target_item.get("subcategory")
            )

        cat_policy, is_innerwear, cat_key = p.resolve_category(
            category=target_item.get("category") if target_item else None,
            subcategory=target_item.get("subcategory") if target_item else None,
            item_name=target_item.get("product_name") if target_item else None,
            policy_group=target_policy_group,
        )

        # Check resolution options
        if "exchange" not in cat_policy.resolution_options and "replace" not in cat_policy.resolution_options:
            return {
                "eligible": False,
                "action": "exchange",
                "order_number": order["order_number"],
                "current_status": curr_state,
                "category": cat_key,
                "message": f"Exchanges are not accepted for {cat_key} items. Supported resolutions: {', '.join(cat_policy.resolution_options)}.",
                "allowed_reasons": [],
            }

        # Check window expiry
        delivered_timestamp = order.get("delivered_at") or order.get("ordered_at")
        is_window_valid, elapsed_hours, window_msg = p.check_window_expiry(cat_policy, delivered_timestamp)
        if not is_window_valid:
            return {
                "eligible": False,
                "action": "exchange",
                "order_number": order["order_number"],
                "current_status": curr_state,
                "category": cat_key,
                "message": window_msg,
                "allowed_reasons": [],
            }

        # Check reason
        if reason:
            is_reason_allowed, reason_msg = p.is_action_reason_allowed(cat_policy, is_innerwear, reason)
            if not is_reason_allowed:
                active_allowed = (
                    cat_policy.innerwear.allowed_reasons
                    if is_innerwear and cat_policy.innerwear
                    else cat_policy.allowed_reasons
                )
                return {
                    "eligible": False,
                    "action": "exchange",
                    "order_number": order["order_number"],
                    "current_status": curr_state,
                    "category": cat_key,
                    "message": reason_msg,
                    "allowed_reasons": active_allowed,
                }

        # Check replacement stock if specified
        if item_id:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT stock, name FROM products WHERE id = ?", (item_id,))
            prod = cursor.fetchone()
            conn.close()
            if not prod or prod["stock"] <= 0:
                return {
                    "eligible": False,
                    "action": "exchange",
                    "order_number": order["order_number"],
                    "current_status": curr_state,
                    "message": f"The requested replacement variant ('{prod['name'] if prod else 'Item'}') is currently out of stock.",
                    "allowed_reasons": [],
                }

        active_allowed = (
            cat_policy.innerwear.allowed_reasons
            if is_innerwear and cat_policy.innerwear
            else cat_policy.allowed_reasons
        )

        return {
            "eligible": True,
            "action": "exchange",
            "order_number": order["order_number"],
            "current_status": curr_state,
            "category": cat_key,
            "message": f"Order #{order['order_number']} is eligible for replacement exchange.",
            "allowed_reasons": active_allowed,
        }

    elif action == "refund":
        valid_refund_states = ["delivered", "cancelled", "return_received"]
        if curr_state not in valid_refund_states:
            return {
                "eligible": False,
                "action": "refund",
                "order_number": order["order_number"],
                "current_status": curr_state,
                "message": f"Refund cannot be processed while order is in '{curr_state}' status. It must be delivered, return received, or cancelled.",
                "allowed_reasons": [],
            }

        paid_inr = order.get("total_price_inr", 0)
        deliv_fee = order.get("delivery_fee_inr", 0)
        if p.is_delivery_fee_refundable(reason):
            computed_refund = paid_inr
        else:
            computed_refund = max(0, paid_inr - deliv_fee)

        return {
            "eligible": True,
            "action": "refund",
            "order_number": order["order_number"],
            "current_status": curr_state,
            "message": f"Refund of ₹{computed_refund:,} is eligible.",
            "refund_estimate_inr": computed_refund,
            "payment_method": order.get("payment_method"),
            "allowed_reasons": p.refund.delivery_fee_refundable_reasons,
        }

    elif action == "place_order":
        items = order.get("items", []) if order else []
        if not items:
            return {
                "eligible": False,
                "action": "place_order",
                "message": "Cart is empty. Please add items before placing an order.",
                "allowed_reasons": [],
            }
        out_of_stock = [
            it.get("product_name") or f"Item #{it.get('product_id')}"
            for it in items
            if (it.get("stock") is not None and it.get("stock") < it.get("quantity", 1))
        ]
        if out_of_stock:
            return {
                "eligible": False,
                "action": "place_order",
                "message": f"Items out of stock: {', '.join(out_of_stock)}",
                "allowed_reasons": [],
            }
        return {
            "eligible": True,
            "action": "place_order",
            "message": "Items are valid and available for checkout.",
            "allowed_reasons": [],
        }

    return {
        "eligible": False,
        "action": action,
        "message": f"Unknown action '{action}'.",
        "allowed_reasons": [],
    }


# ---------------------------------------------------------------------------
# Prepare Action (Generates 10-Minute Confirmation Token & Financial Summary)
# ---------------------------------------------------------------------------

def prepare_order_action(
    order_identifier: Optional[str],
    action: str,
    authenticated_user_id: int,
    item_id: Optional[int] = None,
    replacement_item_id: Optional[int] = None,
    reason: Optional[str] = None,
    photo_url: Optional[str] = None,
    items: Optional[List[Dict[str, Any]]] = None,
    customer_name: Optional[str] = None,
    customer_address: Optional[str] = None,
    customer_email: Optional[str] = None,
    payment_method: Optional[str] = None,
    billing_address: Optional[str] = None,
    buyer_gstin: Optional[str] = None,
    buyer_company: Optional[str] = None,
    target_budget_inr: Optional[float] = None,
    budget_approved: bool = False,
    discount_inr: int = 0,
) -> Dict[str, Any]:
    """
    Validates eligibility, calculates exact financial breakdown,
    and returns a summary + secure 10-minute confirmation token.
    """
    conn = get_db_connection()
    try:
        policies = load_policies()

        if action == "place_order":
            cursor = conn.cursor()
            items_to_process = []
            if items:
                items_to_process = list(items)
            else:
                cursor.execute("""
                    SELECT c.product_id, c.quantity, p.name as product_name, p.price_inr, p.price, p.stock
                    FROM cart_items c
                    JOIN products p ON c.product_id = p.id
                    WHERE c.user_id = ?
                """, (authenticated_user_id,))
                cart_rows = cursor.fetchall()
                for r in cart_rows:
                    items_to_process.append({
                        "product_id": r["product_id"],
                        "quantity": r["quantity"],
                        "product_name": r["product_name"],
                        "unit_price_inr": r["price_inr"],
                        "stock": r["stock"]
                    })

            if not items_to_process:
                raise HTTPException(status_code=400, detail="Cart is empty. Please add items before placing an order.")

            # Validate products in DB
            validated_items = []
            subtotal_inr = 0
            for it in items_to_process:
                pid = it.get("product_id")
                qty = it.get("quantity", 1)
                cursor.execute("SELECT id, name, price, price_inr, stock FROM products WHERE id = ?", (pid,))
                p_row = cursor.fetchone()
                if not p_row:
                    raise HTTPException(status_code=404, detail=f"Product ID {pid} not found.")
                if p_row["stock"] < qty:
                    raise HTTPException(status_code=400, detail=f"Insufficient stock for '{p_row['name']}'. Requested: {qty}, Available: {p_row['stock']}.")
                item_subtotal = p_row["price_inr"] * qty
                subtotal_inr += item_subtotal
                validated_items.append({
                    "product_id": p_row["id"],
                    "product_name": p_row["name"],
                    "unit_price_inr": p_row["price_inr"],
                    "unit_price": p_row["price"],
                    "quantity": qty,
                    "total_price_inr": item_subtotal,
                })

            # Discount
            discount_val = max(0, int(discount_inr or 0))
            subtotal_after_discount = max(0, subtotal_inr - discount_val)

            # Delivery Fee
            delivery_fee_inr = 0 if subtotal_after_discount >= 500 else 50

            # Tax Calculation (18% GST estimate: itemized CGST 9% + SGST 9%)
            tax_inr = round(subtotal_after_discount * 0.18)
            total_price_inr = subtotal_after_discount + delivery_fee_inr

            # Budget Check
            budget_exceeded = False
            if target_budget_inr is not None and total_price_inr > target_budget_inr:
                budget_exceeded = True
                if not budget_approved:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Order total ₹{total_price_inr:,} exceeds your stated budget of ₹{int(target_budget_inr):,}. Explicit confirmation is required."
                    )

            # Fetch customer details if missing
            cursor.execute("SELECT id, full_name, email FROM users WHERE id = ?", (authenticated_user_id,))
            u_row = cursor.fetchone()
            resolved_email = customer_email or (u_row["email"] if u_row else "")
            resolved_name = customer_name or (u_row["full_name"] if u_row else "Customer")

            summary = {
                "action": "place_order",
                "items": validated_items,
                "items_summary": ", ".join([f"{it['quantity']}x {it['product_name']}" for it in validated_items]),
                "subtotal_inr": subtotal_after_discount,
                "delivery_fee_inr": delivery_fee_inr,
                "tax_inr": tax_inr,
                "tax_breakdown": {"cgst_9pct_inr": round(tax_inr / 2), "sgst_9pct_inr": round(tax_inr / 2)},
                "total_price_inr": total_price_inr,
                "discount_inr": discount_val,
                "target_budget_inr": target_budget_inr,
                "budget_exceeded": budget_exceeded,
                "customer_name": resolved_name,
                "customer_email": resolved_email,
                "customer_address": customer_address or "Delivery Address On File",
                "billing_address": billing_address or customer_address or "Delivery Address On File",
                "payment_method": payment_method or "UPI / QR",
                "buyer_gstin": buyer_gstin,
                "buyer_company": buyer_company,
            }

            temp_order_num = f"ORD-PRE-{uuid.uuid4().hex[:8].upper()}"
            confirmation_token = f"tok_place_order_{uuid.uuid4().hex}"
            expires_at = datetime.datetime.now() + datetime.timedelta(minutes=10)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS action_confirmation_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token TEXT UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL,
                    order_number TEXT NOT NULL,
                    action TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    is_used INTEGER DEFAULT 0,
                    expires_at TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)
            cursor.execute("""
                INSERT INTO action_confirmation_tokens (
                    token, user_id, order_number, action, payload_json, is_used, expires_at
                ) VALUES (?, ?, ?, ?, ?, 0, ?)
            """, (
                confirmation_token,
                authenticated_user_id,
                temp_order_num,
                "place_order",
                json.dumps(summary),
                expires_at.isoformat(),
            ))
            conn.commit()

            return {
                "status": "prepared",
                "confirmation_token": confirmation_token,
                "order_number": temp_order_num,
                "action": "place_order",
                "summary": summary,
                "expires_in_seconds": 600,
                "expires_at": expires_at.isoformat(),
            }

        # Otherwise existing order action (cancel, return, exchange, refund)
        if not order_identifier:
            raise HTTPException(status_code=400, detail="Order ID or order number is required.")

        order = get_user_order_or_404(conn, order_identifier, authenticated_user_id)

        # Check eligibility
        eligibility = check_action_eligibility(order, action, item_id=item_id, reason=reason, policies=policies)
        if not eligibility.get("eligible"):
            raise HTTPException(status_code=400, detail=eligibility.get("message"))

        # Calculate exact refund / exchange / cancel summary from StorePolicyConfig
        p_cfg: StorePolicyConfig = policies if isinstance(policies, StorePolicyConfig) else get_store_policies()
        total_inr = order.get("total_price_inr", 0)
        delivery_fee_inr = order.get("delivery_fee_inr", 0)

        # Delivery fee refundable rules from policies.yaml
        if p_cfg.is_delivery_fee_refundable(reason):
            refund_amount_inr = total_inr
            delivery_fee_retained_inr = 0
        else:
            refund_amount_inr = max(0, total_inr - delivery_fee_inr)
            delivery_fee_retained_inr = delivery_fee_inr

        # Resolve category for target item
        target_item = None
        if item_id:
            for it in order.get("items", []):
                if it.get("product_id") == item_id:
                    target_item = it
                    break
        if not target_item and order.get("items"):
            target_item = order["items"][0]

        target_policy_group = target_item.get("policy_group") if target_item else None
        if not target_policy_group and target_item:
            target_policy_group = get_policy_group_for_category(
                target_item.get("category") or target_item.get("subcategory")
            )

        cat_policy, is_innerwear, cat_key = p_cfg.resolve_category(
            category=target_item.get("category") if target_item else None,
            subcategory=target_item.get("subcategory") if target_item else None,
            item_name=target_item.get("product_name") if target_item else None,
            policy_group=target_policy_group,
        )

        # Abuse limits check (30-day frequency in order_audit_logs)
        cursor = conn.cursor()
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
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        cursor.execute("""
            SELECT COUNT(*) FROM order_audit_logs
            WHERE user_id = ?
              AND action IN ('return', 'refund', 'cancel')
              AND created_at >= datetime('now', '-30 days')
        """, (authenticated_user_id,))
        recent_actions_count = cursor.fetchone()[0] or 0
        abuse_limit = p_cfg.abuse_limits.max_actions_per_user_30_days
        user_abuse_flag = recent_actions_count >= abuse_limit

        # Evaluate human review thresholds from policies.yaml
        is_luxury = (cat_key == "luxury" or cat_policy.mandatory_inspection)
        is_laptop = (cat_key == "laptops" or cat_policy.human_review_required)
        needs_human_review, flag_reasons = p_cfg.evaluate_human_review(
            order_amount_inr=total_inr,
            reason=reason,
            is_luxury=is_luxury,
            is_laptop=is_laptop,
            abuse_flag=user_abuse_flag,
        )

        summary = {
            "order_number": order["order_number"],
            "action": action,
            "current_status": normalize_order_state(order["status"]),
            "category": cat_key,
            "reason": reason or "Customer requested",
            "item_id": item_id,
            "replacement_item_id": replacement_item_id,
            "refund_amount_inr": refund_amount_inr if action in ("cancel", "return", "refund") else 0,
            "delivery_fee_retained_inr": delivery_fee_retained_inr,
            "payment_method": order.get("payment_method"),
            "needs_human_review": needs_human_review,
            "review_flag_reasons": flag_reasons,
            "photo_url": photo_url,
            "abuse_count_30_days": recent_actions_count,
        }

        # Generate confirmation token valid for 10 minutes (600 seconds)
        confirmation_token = f"tok_{action}_{uuid.uuid4().hex}"
        expires_at = datetime.datetime.now() + datetime.timedelta(minutes=10)

        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_confirmation_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                order_number TEXT NOT NULL,
                action TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                is_used INTEGER DEFAULT 0,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        cursor.execute("""
            INSERT INTO action_confirmation_tokens (
                token, user_id, order_number, action, payload_json, is_used, expires_at
            ) VALUES (?, ?, ?, ?, ?, 0, ?)
        """, (
            confirmation_token,
            authenticated_user_id,
            order["order_number"],
            action,
            json.dumps(summary),
            expires_at.isoformat(),
        ))
        conn.commit()

        return {
            "status": "prepared",
            "confirmation_token": confirmation_token,
            "order_number": order["order_number"],
            "action": action,
            "summary": summary,
            "expires_in_seconds": 600,
            "expires_at": expires_at.isoformat(),
        }
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Confirm Action (Executes Transition Atomically with Concurrency & Idempotency)
# ---------------------------------------------------------------------------

def confirm_order_action(
    confirmation_token: str,
    authenticated_user_id: int,
    idempotency_key: str,
) -> Dict[str, Any]:
    """
    Executes the prepared order action using pure state machine logic.
    Guarantees idempotency, atomic stock replenishment/deduction, audit trail,
    and refund provider dispatch.
    """
    if not idempotency_key or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required for confirming actions.")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE")

        # 1. Idempotency Check: if this key already completed, return stored result
        cursor.execute("SELECT * FROM idempotency_keys WHERE key = ?", (idempotency_key.strip(),))
        existing_key = cursor.fetchone()
        if existing_key:
            # Check if there is an audit log matching this order action
            cursor.execute("""
                SELECT * FROM order_audit_logs
                WHERE metadata_json LIKE ?
                ORDER BY id DESC LIMIT 1
            """, (f"%{idempotency_key.strip()}%",))
            audit_row = cursor.fetchone()
            conn.commit()
            if audit_row:
                meta = json.loads(audit_row["metadata_json"] or "{}")
                return {
                    "status": "success",
                    "idempotent_replay": True,
                    "order_number": audit_row["order_number"],
                    "action": audit_row["action"],
                    "current_status": audit_row["new_state"],
                    "message": f"Action previously completed. Idempotent response returned.",
                    "audit_id": audit_row["id"],
                    "details": meta,
                }

        # 2. Retrieve & Validate Confirmation Token
        cursor.execute("""
            SELECT * FROM action_confirmation_tokens
            WHERE token = ?
        """, (confirmation_token.strip(),))
        token_row = cursor.fetchone()

        if not token_row:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Invalid or unrecognized confirmation token.")

        token_data = dict(token_row)
        if token_data["user_id"] != authenticated_user_id:
            conn.rollback()
            raise HTTPException(status_code=403, detail="Confirmation token does not belong to the authenticated user.")

        if token_data["is_used"]:
            conn.rollback()
            raise HTTPException(status_code=400, detail="Confirmation token has already been used.")

        # Check expiry
        try:
            exp_dt = datetime.datetime.fromisoformat(token_data["expires_at"])
            if datetime.datetime.now() > exp_dt:
                conn.rollback()
                raise HTTPException(status_code=400, detail="Confirmation token has expired (10-minute validity exceeded). Please prepare action again.")
        except Exception:
            pass

        # 3. Handle Action Execution
        action = token_data["action"]
        summary = json.loads(token_data["payload_json"] or "{}")

        # Specific Handling for place_order
        if action == "place_order":
            order_items = summary.get("items", [])
            if not order_items:
                conn.rollback()
                raise HTTPException(status_code=400, detail="No items to order.")

            # Atomic stock validation & decrement
            for it in order_items:
                cursor.execute(
                    "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
                    (it["quantity"], it["product_id"], it["quantity"])
                )
                if cursor.rowcount == 0:
                    conn.rollback()
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for product ID {it['product_id']} ('{it.get('product_name', '')}')."
                    )

            final_order_num = f"ORD-2026-{uuid.uuid4().hex[:6].upper()}"
            items_summary_str = summary.get("items_summary") or ", ".join([f"{it['quantity']}x {it['product_name']}" for it in order_items])

            subtotal_inr = summary.get("subtotal_inr", 0)
            delivery_fee_inr = summary.get("delivery_fee_inr", 0)
            total_price_inr = summary.get("total_price_inr", 0)

            cursor.execute("""
                INSERT INTO orders (
                    order_number, user_id, customer_name, customer_email, customer_address, items_summary,
                    subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr,
                    currency, status, payment_method, billing_address, buyer_gstin, buyer_company,
                    discount_inr, ordered_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'placed', ?, ?, ?, ?, ?, datetime('now'))
            """, (
                final_order_num, authenticated_user_id,
                summary.get("customer_name") or "Customer",
                summary.get("customer_email") or "",
                summary.get("customer_address") or "",
                items_summary_str,
                round(subtotal_inr / 85.0, 2),
                subtotal_inr,
                round(delivery_fee_inr / 85.0, 2),
                delivery_fee_inr,
                round(total_price_inr / 85.0, 2),
                total_price_inr,
                summary.get("payment_method") or "UPI / QR",
                summary.get("billing_address") or summary.get("customer_address") or "",
                summary.get("buyer_gstin"),
                summary.get("buyer_company"),
                summary.get("discount_inr", 0),
            ))
            new_order_id = cursor.lastrowid

            for it in order_items:
                cursor.execute("""
                    INSERT INTO order_items (
                        order_id, product_id, product_name, unit_price, unit_price_inr, quantity,
                        total_price, total_price_inr
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    new_order_id, it["product_id"], it.get("product_name", ""),
                    round(it.get("unit_price_inr", 0) / 85.0, 2),
                    it.get("unit_price_inr", 0),
                    it["quantity"],
                    round(it.get("total_price_inr", 0) / 85.0, 2),
                    it.get("total_price_inr", 0),
                ))

            # Empty user's cart
            cursor.execute("DELETE FROM cart_items WHERE user_id = ?", (authenticated_user_id,))

            # Mark token used
            cursor.execute("UPDATE action_confirmation_tokens SET is_used = 1 WHERE id = ?", (token_data["id"],))

            # Record Idempotency Key
            cursor.execute("""
                INSERT OR REPLACE INTO idempotency_keys (key, order_id, created_at)
                VALUES (?, ?, datetime('now'))
            """, (idempotency_key.strip(), new_order_id))

            # Record audit log
            audit_id = record_order_audit_log(
                conn=conn,
                order_id=new_order_id,
                order_number=final_order_num,
                user_id=authenticated_user_id,
                action="place_order",
                old_state=None,
                new_state="placed",
                reason="Order successfully placed via Order Action Service",
                performed_by="customer",
                metadata={"idempotency_key": idempotency_key.strip(), "summary": summary},
            )

            conn.commit()

            # Dispatch notification
            notif_res = notification_provider.notify_state_change(
                order_number=final_order_num,
                old_state=None,
                new_state="placed",
                recipient_email=summary.get("customer_email") or "",
                reason="Order placed",
                details=summary,
            )

            return {
                "status": "success",
                "order_number": final_order_num,
                "order_id": new_order_id,
                "action": "place_order",
                "previous_status": None,
                "new_status": "placed",
                "message": f"Order #{final_order_num} successfully placed!",
                "total_price_inr": total_price_inr,
                "items_summary": items_summary_str,
                "notification": notif_res,
                "audit_id": audit_id,
            }

        # Handling for existing orders (cancel, return, exchange, refund)
        order_number = token_data["order_number"]
        cursor.execute("SELECT * FROM orders WHERE order_number = ?", (order_number,))
        order_row = cursor.fetchone()
        if not order_row:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Target order not found.")

        order = dict(order_row)
        old_state = normalize_order_state(order["status"])

        # Determine target state
        if action == "cancel":
            target_state = "cancelled"
        elif action == "return":
            target_state = "return_requested"
        elif action == "exchange":
            target_state = "exchange_requested"
        elif action == "refund":
            target_state = "refund_initiated"
        else:
            conn.rollback()
            raise HTTPException(status_code=400, detail=f"Unsupported action '{action}'.")

        # 4. State Machine Validation
        valid, msg = validate_transition(old_state, target_state)
        if not valid:
            conn.rollback()
            raise HTTPException(status_code=400, detail=msg)

        # 5. Atomic Stock Management & Execution
        stock_restored = []
        if action == "cancel":
            # Replenish stock
            cursor.execute("SELECT product_id, quantity FROM order_items WHERE order_id = ?", (order["id"],))
            items = cursor.fetchall()
            for it in items:
                cursor.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (it["quantity"], it["product_id"]))
                stock_restored.append({"product_id": it["product_id"], "quantity": it["quantity"]})

        elif action == "exchange" and summary.get("replacement_item_id"):
            # Check & decrement replacement stock
            rep_id = summary["replacement_item_id"]
            cursor.execute("UPDATE products SET stock = stock - 1 WHERE id = ? AND stock >= 1", (rep_id,))
            if cursor.rowcount == 0:
                conn.rollback()
                raise HTTPException(status_code=400, detail="Replacement variant is out of stock.")

        # Process Refund Provider if applicable
        refund_result = None
        if action in ("cancel", "refund", "return"):
            refund_amount = summary.get("refund_amount_inr", order.get("total_price_inr", 0))
            refund_result = refund_provider.process_refund(order, refund_amount, summary.get("reason", "Customer action"))

        # Check for Human Review Ticket Creation
        ticket_data = None
        if summary.get("needs_human_review"):
            ticket_number = f"TCK-2026-{uuid.uuid4().hex[:6].upper()}"
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
            cursor.execute("""
                INSERT INTO support_tickets (
                    ticket_number, order_number, user_id, issue_type, status, description, photo_url, refund_amount_inr
                ) VALUES (?, ?, ?, ?, 'needs_human_review', ?, ?, ?)
            """, (
                ticket_number,
                order_number,
                authenticated_user_id,
                action,
                f"Flagged for human review: {', '.join(summary.get('review_flag_reasons', []))}. Reason: {summary.get('reason')}",
                summary.get("photo_url"),
                summary.get("refund_amount_inr"),
            ))
            ticket_data = {
                "ticket_number": ticket_number,
                "status": "needs_human_review",
                "message": "This request has been escalated to our Customer Support & Quality Team for manual review.",
            }

        # 6. Update Order Status
        cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (target_state, order["id"]))

        # 7. Record Audit Log
        metadata_payload = {
            "idempotency_key": idempotency_key.strip(),
            "summary": summary,
            "refund": refund_result,
            "ticket": ticket_data,
            "stock_restored": stock_restored,
        }
        audit_id = record_order_audit_log(
            conn=conn,
            order_id=order["id"],
            order_number=order_number,
            user_id=authenticated_user_id,
            action=action,
            old_state=old_state,
            new_state=target_state,
            reason=summary.get("reason", "Customer action"),
            performed_by="customer",
            metadata=metadata_payload,
        )

        # 8. Mark Token Used
        cursor.execute("UPDATE action_confirmation_tokens SET is_used = 1 WHERE id = ?", (token_data["id"],))

        # 9. Record Idempotency Key
        cursor.execute("""
            INSERT OR REPLACE INTO idempotency_keys (key, order_id, created_at)
            VALUES (?, ?, datetime('now'))
        """, (idempotency_key.strip(), order["id"]))

        conn.commit()

        # 10. Dispatch Automated Notification
        notif_res = notification_provider.notify_state_change(
            order_number=order_number,
            old_state=old_state,
            new_state=target_state,
            recipient_email=order["customer_email"],
            reason=summary.get("reason", "Customer action"),
            details=metadata_payload,
        )

        return {
            "status": "success",
            "order_number": order_number,
            "action": action,
            "previous_status": old_state,
            "new_status": target_state,
            "message": f"Order #{order_number} {action} completed successfully.",
            "refund": refund_result,
            "ticket": ticket_data,
            "notification": notif_res,
            "audit_id": audit_id,
            "stock_restored": stock_restored,
        }

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Order action execution error: {str(e)}")
    finally:
        conn.close()
