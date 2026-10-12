"""
Order Lifecycle and State Machine for MOSS E-Commerce.
Enforces legal status transitions and atomic cancellation with stock replenishment.
"""
import sqlite3
from typing import Dict, Any, List
import backend.tools as tools

ALLOWED_TRANSITIONS = {
    "placed": ["packed", "cancelled", "return_requested", "exchange_requested", "refund_initiated"],
    "confirmed": ["packed", "cancelled", "return_requested", "exchange_requested", "refund_initiated"],
    "confirmed (demo checkout)": ["packed", "cancelled", "return_requested", "exchange_requested", "refund_initiated"],
    "packed": ["shipped", "cancelled", "return_requested", "exchange_requested", "refund_initiated"],
    "shipped": ["delivered", "return_requested", "exchange_requested", "refund_initiated"],
    "delivered": ["return_requested", "returned", "exchange_requested", "refund_initiated", "refunded"],
    "return_requested": ["returned", "refund_initiated", "refunded", "cancelled"],
    "returned": ["refund_initiated", "refunded"],
    "exchange_requested": ["exchanged", "packed", "shipped", "delivered", "refunded", "cancelled"],
    "exchanged": ["return_requested", "delivered"],
    "refund_initiated": ["refunded"],
    "refunded": [],
    "cancelled": ["refund_initiated", "refunded"],
}


def normalize_status(s: str) -> str:
    norm = (s or "").lower().strip()
    if "confirm" in norm or "place" in norm:
        return "placed"
    if "return" in norm:
        return "return_requested" if "request" in norm else "returned"
    if "exchange" in norm:
        return "exchange_requested" if "request" in norm else "exchanged"
    if "refund" in norm:
        return "refund_initiated" if "initiat" in norm else "refunded"
    return norm


def validate_status_transition(current_status: str, target_status: str) -> bool:
    c = normalize_status(current_status)
    t = normalize_status(target_status)
    if c == t:
        return True
    allowed = ALLOWED_TRANSITIONS.get(c, [])
    return t in allowed or target_status.lower() in [x.lower() for x in allowed]


def cancel_order_atomic(order_number: str, reason: str = "Customer requested cancellation") -> Dict[str, Any]:
    """
    Atomically cancels an order and replenishes reserved product stock back to the store.
    Uses BEGIN IMMEDIATE for concurrency safety.
    """
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("BEGIN IMMEDIATE")
        
        # 1. Fetch order
        cursor.execute("SELECT id, order_number, status, customer_email FROM orders WHERE order_number = ?", (order_number,))
        order = cursor.fetchone()
        if not order:
            conn.rollback()
            return {"status": "error", "message": f"Order {order_number} not found."}
        
        curr_status = order["status"]
        norm_curr = normalize_status(curr_status)
        
        if norm_curr in ("delivered", "cancelled"):
            conn.rollback()
            return {
                "status": "error",
                "message": f"Order cannot be cancelled because it is already {curr_status}."
            }
        
        # 2. Fetch order items to replenish
        cursor.execute("SELECT product_id, quantity FROM order_items WHERE order_id = ?", (order["id"],))
        items = cursor.fetchall()
        
        replenished_items = []
        for it in items:
            pid = it["product_id"]
            qty = it["quantity"]
            cursor.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (qty, pid))
            replenished_items.append({"product_id": pid, "quantity_restored": qty})
        
        # 3. Mark order as cancelled
        cursor.execute(
            "UPDATE orders SET status = 'cancelled' WHERE id = ?",
            (order["id"],)
        )
        
        conn.commit()
        return {
            "status": "success",
            "message": f"Order {order_number} has been cancelled successfully. Stock replenished.",
            "order_number": order_number,
            "previous_status": curr_status,
            "new_status": "cancelled",
            "replenished_items": replenished_items,
            "cancellation_reason": reason,
        }
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": f"Failed to cancel order: {str(e)}"}
    finally:
        conn.close()


def transition_order_status(order_number: str, target_status: str) -> Dict[str, Any]:
    """
    Advances or modifies an order's status enforcing state machine rules.
    """
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT id, order_number, status FROM orders WHERE order_number = ?", (order_number,))
        order = cursor.fetchone()
        if not order:
            conn.rollback()
            return {"status": "error", "message": f"Order {order_number} not found."}
        
        curr = order["status"]
        if not validate_status_transition(curr, target_status):
            conn.rollback()
            return {
                "status": "error",
                "message": f"Illegal status transition from '{curr}' to '{target_status}'."
            }
        
        cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (target_status, order["id"]))
        conn.commit()
        return {
            "status": "success",
            "order_number": order_number,
            "previous_status": curr,
            "current_status": target_status,
        }
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


def request_order_return(order_number: str, reason: str = "Customer requested return", return_action: str = "refund") -> Dict[str, Any]:
    """
    Initiates return workflow for an order.
    Sets status to 'Return Requested' and generates return tracking reference.
    """
    import uuid
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT id, order_number, status, total_price_inr, items_summary FROM orders WHERE order_number = ?", (order_number,))
        order = cursor.fetchone()
        if not order:
            conn.rollback()
            return {"status": "error", "message": f"Order {order_number} not found."}

        curr_status = order["status"]
        if "refunded" in curr_status.lower() or "cancel" in curr_status.lower():
            conn.rollback()
            return {"status": "error", "message": f"Cannot return an order that is already {curr_status}."}

        return_ref = f"RET-{uuid.uuid4().hex[:8].upper()}"
        refund_amount = order["total_price_inr"] or 0

        cursor.execute("UPDATE orders SET status = 'Return Requested' WHERE id = ?", (order["id"],))
        conn.commit()

        return {
            "status": "success",
            "message": f"Return request registered for Order {order_number}. Courier pickup scheduled within 24-48 hours.",
            "order_number": order_number,
            "return_reference": return_ref,
            "previous_status": curr_status,
            "new_status": "Return Requested",
            "reason": reason,
            "refundable_amount_inr": refund_amount,
            "pickup_timeline": "1-2 business days",
        }
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": f"Failed to process return: {str(e)}"}
    finally:
        conn.close()


def request_order_exchange(order_number: str, reason: str = "Size / variant exchange", replacement_product: str = "Alternative variant") -> Dict[str, Any]:
    """
    Initiates an exchange request for an existing order.
    Sets status to 'Exchange Requested' and reserves replacement dispatch.
    """
    import uuid
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT id, order_number, status, items_summary FROM orders WHERE order_number = ?", (order_number,))
        order = cursor.fetchone()
        if not order:
            conn.rollback()
            return {"status": "error", "message": f"Order {order_number} not found."}

        curr_status = order["status"]
        if "cancel" in curr_status.lower() or "refund" in curr_status.lower():
            conn.rollback()
            return {"status": "error", "message": f"Cannot exchange an order that is already {curr_status}."}

        exc_ref = f"EXC-{uuid.uuid4().hex[:8].upper()}"
        cursor.execute("UPDATE orders SET status = 'Exchange Requested' WHERE id = ?", (order["id"],))
        conn.commit()

        return {
            "status": "success",
            "message": f"Exchange request created for Order {order_number}. Doorstep replacement will be dispatched.",
            "order_number": order_number,
            "exchange_reference": exc_ref,
            "previous_status": curr_status,
            "new_status": "Exchange Requested",
            "reason": reason,
            "replacement_details": replacement_product,
            "doorstep_exchange": "Courier will deliver replacement and collect existing item simultaneously.",
        }
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": f"Failed to process exchange: {str(e)}"}
    finally:
        conn.close()


def request_order_refund(order_number: str, reason: str = "Customer requested refund", refund_method: str = "Original Payment Method") -> Dict[str, Any]:
    """
    Processes an atomic refund for an order.
    Restores stock if appropriate, marks order 'Refunded', and issues refund transaction ID.
    """
    import uuid
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT id, order_number, status, total_price_inr, items_summary, payment_method FROM orders WHERE order_number = ?", (order_number,))
        order = cursor.fetchone()
        if not order:
            conn.rollback()
            return {"status": "error", "message": f"Order {order_number} not found."}

        curr_status = order["status"]
        if "refunded" in curr_status.lower():
            conn.rollback()
            return {"status": "error", "message": f"Order {order_number} has already been refunded."}

        refund_ref = f"REF-{uuid.uuid4().hex[:8].upper()}"
        refund_amount = order["total_price_inr"] or 0

        # Replenish stock if order has not been delivered
        replenished = []
        if "deliver" not in curr_status.lower():
            cursor.execute("SELECT product_id, quantity FROM order_items WHERE order_id = ?", (order["id"],))
            items = cursor.fetchall()
            for it in items:
                cursor.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (it["quantity"], it["product_id"]))
                replenished.append({"product_id": it["product_id"], "quantity_restored": it["quantity"]})

        cursor.execute("UPDATE orders SET status = 'Refunded' WHERE id = ?", (order["id"],))
        conn.commit()

        return {
            "status": "success",
            "message": f"Refund of ₹{refund_amount:,} processed successfully for Order {order_number}.",
            "order_number": order_number,
            "refund_reference": refund_ref,
            "previous_status": curr_status,
            "new_status": "Refunded",
            "amount_refunded_inr": refund_amount,
            "destination": refund_method or order["payment_method"] or "Original Payment Source",
            "settlement_time": "Instant to 2 hours",
            "items_replenished": replenished,
            "reason": reason,
        }
    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": f"Failed to process refund: {str(e)}"}
    finally:
        conn.close()

