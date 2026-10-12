from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from backend.app.payments.provider import get_payment_provider
from backend.app.auth.security import get_optional_current_user
from backend.app.db.models import User

router = APIRouter(prefix="/api/payments", tags=["payments"])


class PaymentIntentRequest(BaseModel):
    order_number: str = Field(..., description="Unique order reference identifier")
    amount_inr: int = Field(..., gt=0, description="Total amount to charge in INR")
    payment_method: str = Field("upi", description="Payment method: upi, card, cod, razorpay")
    customer_email: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class PaymentVerifyRequest(BaseModel):
    payment_method: str
    intent_id: str
    payment_reference: Optional[str] = "SUCCESS"


@router.post("/intent")
def create_payment_intent_endpoint(
    req: PaymentIntentRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Initializes a payment intent across UPI, Card, COD, or Razorpay gateways.
    """
    try:
        provider = get_payment_provider(req.payment_method)
        email = (current_user.email if current_user else None) or req.customer_email or "guest@moss.internal"
        intent = provider.create_payment_intent(
            order_number=req.order_number,
            amount_inr=req.amount_inr,
            customer_email=email,
            metadata=req.metadata,
        )
        return {
            "status": "success",
            "intent": intent,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment intent failed: {str(e)}")


@router.post("/verify")
def verify_payment_endpoint(req: PaymentVerifyRequest):
    """
    Verifies payment completion and transaction signature.
    """
    try:
        provider = get_payment_provider(req.payment_method)
        result = provider.verify_payment(
            intent_id=req.intent_id,
            payment_reference=req.payment_reference or "AUTH_VERIFIED",
        )
        return {
            "status": "success",
            "verification": result,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {str(e)}")
