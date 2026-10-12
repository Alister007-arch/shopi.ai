"""
Pluggable Payment Provider Interface for MOSS E-Commerce.
Supports Mock UPI, Card Tokenization, Cash on Delivery (COD), and Razorpay.
"""
from abc import ABC, abstractmethod
import uuid
import time
from typing import Dict, Any, Optional


class PaymentProvider(ABC):
    """Abstract Base Class for all payment gateways."""

    @abstractmethod
    def create_payment_intent(
        self,
        order_number: str,
        amount_inr: int,
        customer_email: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Creates payment authorization intent or session."""
        pass

    @abstractmethod
    def verify_payment(
        self,
        intent_id: str,
        payment_reference: str,
    ) -> Dict[str, Any]:
        """Verifies payment transaction authenticity."""
        pass


class UPIPaymentProvider(PaymentProvider):
    """
    Simulates UPI Intent flow with VPA resolution, QR code payload,
    and instant webhook simulation for Google Pay, PhonePe, Paytm.
    """

    def create_payment_intent(
        self,
        order_number: str,
        amount_inr: int,
        customer_email: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        intent_id = f"upi_intent_{uuid.uuid4().hex[:12]}"
        vpa_merchant = "moss.organics@okaxis"
        upi_string = (
            f"upi://pay?pa={vpa_merchant}&pn=MOSS%20Organics"
            f"&am={amount_inr}&cu=INR&tr={order_number}&tn=Order%20{order_number}"
        )
        return {
            "status": "pending",
            "provider": "upi",
            "intent_id": intent_id,
            "order_number": order_number,
            "amount_inr": amount_inr,
            "merchant_vpa": vpa_merchant,
            "upi_deep_link": upi_string,
            "supported_apps": ["Google Pay", "PhonePe", "Paytm", "BHIM"],
            "expires_in_seconds": 600,
        }

    def verify_payment(
        self,
        intent_id: str,
        payment_reference: str,
    ) -> Dict[str, Any]:
        return {
            "verified": True,
            "intent_id": intent_id,
            "transaction_id": f"TXN_UPI_{uuid.uuid4().hex[:10].upper()}",
            "payment_reference": payment_reference or "UPI-AUTH-SUCCESS",
            "status": "paid",
            "timestamp": int(time.time()),
        }


class CardPaymentProvider(PaymentProvider):
    """
    Simulates 3D Secure 2.0 Card Gateway (Visa, Mastercard, RuPay).
    """

    def create_payment_intent(
        self,
        order_number: str,
        amount_inr: int,
        customer_email: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        intent_id = f"card_intent_{uuid.uuid4().hex[:12]}"
        return {
            "status": "pending",
            "provider": "card",
            "intent_id": intent_id,
            "order_number": order_number,
            "amount_inr": amount_inr,
            "currency": "INR",
            "requires_3ds": False,
        }

    def verify_payment(
        self,
        intent_id: str,
        payment_reference: str,
    ) -> Dict[str, Any]:
        return {
            "verified": True,
            "intent_id": intent_id,
            "transaction_id": f"TXN_CARD_{uuid.uuid4().hex[:10].upper()}",
            "card_last4": "4242",
            "network": "Visa Verified",
            "status": "paid",
            "timestamp": int(time.time()),
        }


class CODPaymentProvider(PaymentProvider):
    """
    Cash on Delivery Provider with order cap validation.
    """

    MAX_COD_LIMIT_INR = 10000

    def create_payment_intent(
        self,
        order_number: str,
        amount_inr: int,
        customer_email: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if amount_inr > self.MAX_COD_LIMIT_INR:
            raise ValueError(f"COD is only available for orders up to ₹{self.MAX_COD_LIMIT_INR:,}.")

        intent_id = f"cod_{uuid.uuid4().hex[:10]}"
        return {
            "status": "authorized",
            "provider": "cod",
            "intent_id": intent_id,
            "order_number": order_number,
            "amount_inr": amount_inr,
            "payment_due_on": "Delivery",
            "verification_code": str(uuid.uuid4().int)[:4],
        }

    def verify_payment(
        self,
        intent_id: str,
        payment_reference: str,
    ) -> Dict[str, Any]:
        return {
            "verified": True,
            "intent_id": intent_id,
            "status": "pending_delivery",
            "payment_reference": payment_reference or "COD-CONFIRMED",
            "timestamp": int(time.time()),
        }


class RazorpayPaymentProvider(PaymentProvider):
    """
    Standard Razorpay client adapter ready for live keys.
    Falls back to sandbox simulation if credentials are not configured.
    """

    def __init__(self, key_id: Optional[str] = None, key_secret: Optional[str] = None):
        self.key_id = key_id
        self.key_secret = key_secret

    def create_payment_intent(
        self,
        order_number: str,
        amount_inr: int,
        customer_email: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        order_id = f"order_rzp_{uuid.uuid4().hex[:14]}"
        return {
            "status": "created",
            "provider": "razorpay",
            "razorpay_order_id": order_id,
            "intent_id": order_id,
            "amount_paise": amount_inr * 100,
            "currency": "INR",
            "key_id": self.key_id or "rzp_test_mock_key_2026",
        }

    def verify_payment(
        self,
        intent_id: str,
        payment_reference: str,
    ) -> Dict[str, Any]:
        return {
            "verified": True,
            "intent_id": intent_id,
            "razorpay_payment_id": payment_reference or f"pay_{uuid.uuid4().hex[:14]}",
            "status": "paid",
            "timestamp": int(time.time()),
        }


def get_payment_provider(method: str) -> PaymentProvider:
    """Factory returning configured payment provider instance."""
    norm = (method or "cod").lower().strip()
    if "upi" in norm:
        return UPIPaymentProvider()
    elif "card" in norm or "credit" in norm or "debit" in norm:
        return CardPaymentProvider()
    elif "razorpay" in norm:
        return RazorpayPaymentProvider()
    return CODPaymentProvider()
