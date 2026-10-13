import sys
import os

# Ensure repo root and backend directory are always in Python path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.dirname(__file__)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import json
import sqlite3
import uuid
import time
import logging
import traceback
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Header, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

import tools
import vision
import graph
import review_intelligence
import audit_catalog

from sqlalchemy.orm import Session
try:
    from backend.app.config import settings
except ImportError:
    from app.config import settings
from backend.app.auth import auth_router, get_optional_current_user
from backend.app.auth.security import get_current_user, get_current_admin
from backend.app.db.session import get_db
from backend.app.db.models import User, Order, UserAddress, CartItem, Product
from backend.app.db.seed import seed_database
from backend.app.payments.router import router as payments_router
from backend.app.admin import admin_router
from backend.routers.order_actions import router as order_actions_router
from backend.app.orders import (
    generate_gst_invoice,
    cancel_order_atomic,
    transition_order_status,
    request_order_return,
    request_order_exchange,
    request_order_refund,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s")
logger = logging.getLogger("trovi.api")

# Execute startup self-check: verify all required runtime files and configurations
from backend.app.startup_check import run_startup_self_check
run_startup_self_check(exit_on_failure=True)

# Auto-seed database if missing
DB_PATH = os.path.join(os.path.dirname(__file__), "shopai.db")

if not os.path.exists(DB_PATH):
    try:
        import setup_db
        setup_db.create_database()
        print("[DB Init] Initialized shopai.db successfully.")
    except Exception as e:
        print(f"[DB Init Warning] {e}")

from backend.app.db.session import init_db
try:
    init_db()
except Exception as _db_init_err:
    print(f"[DB Init Tables Warning] {_db_init_err}")

from backend.app.policies.loader import load_store_policies, get_store_policies

# Strictly validate store policies at startup - fails startup immediately if YAML is missing or invalid
try:
    load_store_policies()
    logger.info("[Store Policies] Initial validation passed successfully.")
except Exception as _policy_init_err:
    logger.critical(f"[Store Policies FATAL] {_policy_init_err}")
    raise RuntimeError(f"FATAL: Store policies failed startup validation: {_policy_init_err}") from _policy_init_err

app = FastAPI(
    title="Trovi E-Commerce API",
    description="Production-grade API powering Trovi autonomous shopping assistant and storefront",
    version="3.1.0",
)

# Mount Modular Routers
app.include_router(auth_router)
app.include_router(payments_router)
app.include_router(admin_router)
app.include_router(order_actions_router)

@app.on_event("startup")
def on_app_startup():
    # Enforce runtime prerequisite self-check on startup
    run_startup_self_check(exit_on_failure=True)
    # Fail fast on missing required environment variables (names only, never values)
    settings.validate_environment()


    # Log port and registered auth routes at startup
    logger.info(f"[Server Startup] Listening on port: {settings.PORT} (environment: {settings.ENVIRONMENT})")
    logger.info("[Server Startup] Registered authentication routes:")
    for r in auth_router.routes:
        methods_str = ", ".join(r.methods) if hasattr(r, "methods") else "ALL"
        logger.info(f"  -> [{methods_str}] {r.path}")

    # Enforce policy validation on startup event as well
    try:
        load_store_policies()
    except Exception as e:
        logger.critical(f"[Store Policies Startup FATAL] {e}")
        raise RuntimeError(f"FATAL: Store policies failed startup validation: {e}") from e

    try:
        seed_database()
    except Exception as e:
        logger.warning(f"Database seed initialization notice: {e}")

@app.get("/api/policies")
def get_store_policies_api(section: Optional[str] = Query(None)):
    """Returns store policy configuration and customer-facing text."""
    p = get_store_policies()
    if section:
        return {
            "section": section,
            "text": p.get_section_text(section),
        }
    return {
        "title": p.customer_policy_text.title,
        "full_text": p.get_section_text(),
        "sections": {
            "cancellation": p.customer_policy_text.cancellation.strip(),
            "food_and_grocery": p.customer_policy_text.food_and_grocery.strip(),
            "fresh_produce": p.customer_policy_text.fresh_produce.strip(),
            "clothing": p.customer_policy_text.clothing.strip(),
            "electronics": p.customer_policy_text.electronics.strip(),
            "luxury": p.customer_policy_text.luxury.strip(),
            "refunds": p.customer_policy_text.refunds.strip(),
            "help": p.customer_policy_text.help.strip(),
        },
        "contact": p.contact_and_help.model_dump(),
        "windows": {
            k: {
                "window_hours": v.window_hours,
                "window_days": v.window_days,
                "photo_required": v.photo_required,
                "allow_change_of_mind": v.allow_change_of_mind,
                "allowed_reasons": v.allowed_reasons,
            }
            for k, v in p.categories.items()
        },
    }

# Environment-based strict CORS configuration
ALLOWED_ORIGINS = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Retry-After"],
)

# Request ID & Structured Logging Middleware
@app.middleware("http")
async def request_id_and_logging_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
    start_time = time.time()
    request.state.request_id = req_id

    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = req_id

    logger.info(
        json.dumps({
            "request_id": req_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        })
    )
    return response

# Sanitized Global Exception Handlers
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    req_id = getattr(request.state, "request_id", uuid.uuid4().hex[:12])
    headers = {"X-Request-ID": req_id}
    if exc.headers:
        headers.update(exc.headers)

    content = {
        "status": "error",
        "message": exc.detail,
        "detail": exc.detail,
        "request_id": req_id,
    }
    if "Retry-After" in headers:
        try:
            content["retry_after"] = int(headers["Retry-After"])
        except ValueError:
            pass

    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=headers,
    )

@app.exception_handler(Exception)
async def custom_global_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", uuid.uuid4().hex[:12])
    logger.error(f"[Internal Server Error] request_id={req_id}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "An unexpected error occurred while processing your request. Please try again later.",
            "request_id": req_id,
        },
        headers={"X-Request-ID": req_id},
    )

# Mount sample resources directory for serving images
RESOURCES_DIR = os.path.join(os.path.dirname(__file__), "resources")
if os.path.exists(RESOURCES_DIR):
    app.mount("/static/resources", StaticFiles(directory=RESOURCES_DIR), name="resources")

# Mount local products directory for serving high-res verified product photos
PRODUCTS_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "products")
if not os.path.exists(PRODUCTS_DIR):
    PRODUCTS_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist", "products")
if os.path.exists(PRODUCTS_DIR):
    app.mount("/products", StaticFiles(directory=PRODUCTS_DIR), name="products")

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))


# ---------------------------------------------------------------------------
# Pydantic Request Models with Strict Validation
# ---------------------------------------------------------------------------

class ShippingAddress(BaseModel):
    recipient_name: str = Field(..., min_length=2, max_length=100, description="Full name of recipient")
    phone: str = Field(..., pattern=r"^[6-9]\d{9}$", description="Valid 10-digit Indian mobile number starting 6-9")
    postal_code: str = Field(..., pattern=r"^\d{6}$", description="Valid 6-digit Indian postal PIN code")
    street_address: str = Field(..., min_length=5, max_length=250, description="Street address, flat or apartment")
    city: str = Field(..., min_length=2, max_length=100, description="City")
    state: str = Field(..., min_length=2, max_length=100, description="State")

    def to_formatted_string(self) -> str:
        return f"{self.recipient_name}, {self.street_address}, {self.city}, {self.state} - {self.postal_code} (Phone: {self.phone})"


class BillingAddress(BaseModel):
    same_as_shipping: bool = True
    recipient_name: Optional[str] = Field(None, description="Billing contact or legal company name")
    phone: Optional[str] = Field(None, description="Billing 10-digit mobile number")
    postal_code: Optional[str] = Field(None, description="Billing 6-digit postal PIN code")
    street_address: Optional[str] = Field(None, description="Billing street address")
    city: Optional[str] = Field(None, description="Billing city")
    state: Optional[str] = Field(None, description="Billing state")
    is_business: Optional[bool] = False
    company_name: Optional[str] = None
    gstin: Optional[str] = None

    def to_formatted_string(self) -> str:
        parts = []
        if self.company_name:
            parts.append(self.company_name)
        if self.recipient_name and self.recipient_name != self.company_name:
            parts.append(self.recipient_name)
        if self.street_address:
            parts.append(self.street_address)
        loc_parts = [p for p in [self.city, self.state] if p]
        loc = ", ".join(loc_parts)
        if self.postal_code:
            loc += f" - {self.postal_code}"
        if loc:
            parts.append(loc)
        if self.phone:
            parts.append(f"(Phone: {self.phone})")
        if self.gstin:
            parts.append(f"[GSTIN: {self.gstin}]")
        return ", ".join(parts) if parts else ""


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    thread_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None


class CheckoutRequest(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: Optional[int] = Field(1, ge=1, le=20)
    customer_name: Optional[str] = None
    shipping_address: Optional[ShippingAddress] = None
    idempotency_key: Optional[str] = None


class CartItemPayload(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(1, ge=1, le=20)


class AddCartItemRequest(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(1, ge=1, le=20)


class MergeCartRequest(BaseModel):
    items: List[CartItemPayload] = Field(default_factory=list)


class MultiCheckoutRequest(BaseModel):
    items: List[CartItemPayload] = Field(..., min_length=1)
    shipping_address: Optional[ShippingAddress] = None
    billing_address: Optional[BillingAddress] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    customer_email: Optional[str] = None
    payment_method: Optional[str] = "upi"
    payment_details: Optional[Dict[str, Any]] = None
    coupon_code: Optional[str] = None
    discount_inr: Optional[int] = 0
    idempotency_key: Optional[str] = None
    target_budget_inr: Optional[float] = None
    budget_approved: Optional[bool] = False


class PrepareOrderRequest(BaseModel):
    items_json: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    target_budget_inr: Optional[float] = None
    customer_name: Optional[str] = "Online Shopper"


class ImageSearchPayload(BaseModel):
    base64_image: Optional[str] = None
    sample_name: Optional[str] = None


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Trovi Agent Backend",
        "database": "shopai.db",
        "environment": settings.ENVIRONMENT,
        "port": settings.PORT,
        "version": "3.1.0",
        "currency": "INR",
        "catalog_source": "SQLite verified multi-category store",
        "timestamp": int(time.time()),
    }


@app.get("/")
def root_endpoint():
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return health_check()


@app.get("/api/catalog/audit")
def catalog_audit_endpoint():
    """Diagnostic endpoint to inspect data integrity, image mappings, prices, and reviews."""
    return audit_catalog.run_catalog_audit()


@app.post("/api/chat")
def chat_endpoint(
    req: ChatRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Primary endpoint for AI Shopping Agent conversation.
    Invokes graph.py agent with SQLite tools, isolated thread memory,
    and automatic deterministic fallback. Thread IDs are strictly isolated per user or guest.
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Derive unique per-session/per-user thread ID
    if current_user:
        if req.thread_id and req.thread_id.strip().startswith(f"user_{current_user.id}_"):
            session_thread_id = req.thread_id.strip()
        else:
            sub_id = req.thread_id.strip() if req.thread_id and req.thread_id.strip() not in ("session-web", "default_session", "") else "session"
            session_thread_id = f"user_{current_user.id}_{sub_id}"
        cust_name = current_user.full_name
        cust_email = current_user.email
        user_id_val = current_user.id
        is_authenticated = True
    else:
        session_thread_id = (
            req.thread_id.strip()
            if req.thread_id and req.thread_id.strip() not in ("session-web", "default_session", "")
            else f"guest_{uuid.uuid4().hex[:12]}"
        )
        cust_name = req.customer_name or "Guest"
        cust_email = req.customer_email or ""
        user_id_val = None
        is_authenticated = False

    # Prompt Injection & Safety Guardrail Check
    from backend.app.agent.safety import check_prompt_safety
    from backend.app.agent.traces import record_agent_trace
    is_safe, refusal = check_prompt_safety(req.message)
    if not is_safe:
        record_agent_trace(
            thread_id=session_thread_id,
            user_message=req.message.strip(),
            agent_reply=refusal,
            tool_calls=[],
            latency_ms=1,
            total_tokens=len(req.message.split()) + len(refusal.split()),
            status="safety_refusal",
        )
        return {
            "response": refusal,
            "reply": refusal,
            "thread_id": session_thread_id,
            "tool_calls": [],
            "status": "safety_refusal",
        }

    t0 = time.time()
    info = graph.get_llm_info()
    provider_name = info.get("provider", "groq")
    error_type = None
    status = "success"

    try:
        result = graph.run_agent_chat(
            message=req.message.strip(),
            thread_id=session_thread_id,
            idempotency_key=req.idempotency_key,
            customer_name=cust_name,
            customer_email=cust_email,
            customer_address=req.customer_address,
            is_authenticated=is_authenticated,
            user_id=user_id_val,
        )
        if result.get("error_type"):
            error_type = result["error_type"]
            status = "error"
    except Exception as e:
        req_id = f"req_{uuid.uuid4().hex[:12]}"
        error_type = type(e).__name__
        status = "error"
        logger.error(f"[{req_id}] Chat Endpoint Exception: {e}\n{traceback.format_exc()}")
        try:
            result = graph.run_offline_fallback(
                message=req.message.strip(),
                thread_id=session_thread_id,
                idempotency_key=req.idempotency_key,
                customer_name=cust_name,
                customer_email=cust_email,
                customer_address=req.customer_address,
                is_authenticated=is_authenticated,
                user_id=user_id_val,
            )
            result["thread_id"] = session_thread_id
            result["request_id"] = req_id
        except Exception as fb_e:
            logger.error(f"[{req_id}] Chat Fallback Exception: {fb_e}\n{traceback.format_exc()}")
            result = {
                "reply": f"I apologize, but I encountered an issue processing your request. Please try again. (Reference ID: {req_id})",
                "product_cards": [],
                "cart_action": None,
                "placed_order": None,
                "order_bundle": None,
                "action_card": None,
                "thread_id": session_thread_id,
                "request_id": req_id,
                "error_type": error_type,
            }

    latency_ms = int((time.time() - t0) * 1000)
    reply_text = result.get("response") or result.get("reply") or ""
    tool_calls = result.get("tool_calls") or []
    meta = {
        "product_cards": result.get("product_cards") or [],
        "placed_order": result.get("placed_order"),
        "cart_action": result.get("cart_action"),
        "order_bundle": result.get("order_bundle"),
        "action_card": result.get("action_card"),
        "return_action": result.get("return_action"),
        "exchange_action": result.get("exchange_action"),
        "refund_action": result.get("refund_action"),
    }
    record_agent_trace(
        thread_id=session_thread_id,
        user_message=req.message.strip(),
        agent_reply=reply_text,
        tool_calls=tool_calls,
        latency_ms=latency_ms,
        total_tokens=len(req.message.split()) + len(reply_text.split()),
        status=status,
        provider_name=provider_name,
        error_type=error_type,
        metadata=meta,
    )
    return result


@app.get("/api/chat/history")
def get_chat_history_endpoint(
    thread_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Returns historical chat conversation messages for current user or guest thread from SQLite.
    """
    from backend.app.agent.traces import get_thread_chat_history
    target_threads = []
    if current_user:
        target_threads.append(f"user_{current_user.id}_session")
        target_threads.append(f"user_{current_user.id}_main")
        if thread_id and thread_id.strip() and thread_id.strip() not in target_threads:
            target_threads.append(thread_id.strip())
    elif thread_id and thread_id.strip():
        target_threads.append(thread_id.strip())

    messages = get_thread_chat_history(target_threads, limit=100)
    return {"messages": messages, "count": len(messages)}


@app.delete("/api/chat/history")
def clear_chat_history_endpoint(
    thread_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Clears historical chat messages for current user or guest thread.
    """
    from backend.app.agent.traces import clear_thread_chat_history
    target_threads = []
    if current_user:
        target_threads.append(f"user_{current_user.id}_session")
        target_threads.append(f"user_{current_user.id}_main")
        if thread_id and thread_id.strip() and thread_id.strip() not in target_threads:
            target_threads.append(thread_id.strip())
    elif thread_id and thread_id.strip():
        target_threads.append(thread_id.strip())

    deleted_count = clear_thread_chat_history(target_threads)
    return {"status": "success", "deleted_count": deleted_count}


@app.get("/api/health/llm", dependencies=[Depends(get_current_admin)])
def health_llm():
    """
    Admin-only diagnostic endpoint. Runs a tiny test call and reports
    provider, model, and latency in milliseconds.
    """
    t0 = time.time()
    try:
        llm = graph.get_llm()
        info = graph.get_llm_info()
        res = llm.invoke("Ping")
        latency_ms = int((time.time() - t0) * 1000)
        return {
            "status": "healthy",
            "provider": info.get("provider", "unknown"),
            "model": info.get("model", "unknown"),
            "latency_ms": latency_ms,
            "sample_response": getattr(res, "content", str(res))[:100],
        }
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000)
        info = graph.get_llm_info()
        logger.error(f"[Health LLM Error] {e}\n{traceback.format_exc()}")
        return {
            "status": "unhealthy",
            "provider": info.get("provider", "unknown"),
            "model": info.get("model", "unknown"),
            "latency_ms": latency_ms,
            "error_type": type(e).__name__,
            "error": str(e),
        }


MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

@app.post("/api/vision/search")
async def vision_search_file(
    file: Optional[UploadFile] = File(None),
    sample_name: Optional[str] = Form(None),
):
    """
    Multimodal visual search endpoint with input validation and relevance scoring.
    """
    try:
        if file is not None:
            mime = file.content_type or "image/jpeg"
            if mime not in ALLOWED_MIME_TYPES:
                raise HTTPException(status_code=400, detail=f"Unsupported image format '{mime}'. Please upload JPEG, PNG, or WebP.")

            contents = await file.read()
            if len(contents) > MAX_UPLOAD_SIZE:
                raise HTTPException(status_code=400, detail="Image exceeds maximum allowed size of 5 MB.")

            analysis = vision.analyze_product_image(image_bytes=contents, mime_type=mime)
            return analysis

        if sample_name:
            safe_name = os.path.basename(sample_name)
            sample_path = os.path.join(RESOURCES_DIR, safe_name)
            if os.path.exists(sample_path):
                analysis = vision.analyze_product_image(image_path=sample_path)
                return analysis
            else:
                raise HTTPException(status_code=404, detail=f"Sample resource '{safe_name}' not found.")

        raise HTTPException(status_code=400, detail="Provide an image file or a valid sample_name.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Vision Endpoint Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/vision/search-base64")
async def vision_search_base64(payload: ImageSearchPayload):
    """
    Multimodal visual search endpoint for JSON base64 payloads and sample presets.
    """
    try:
        if payload.sample_name:
            safe_name = os.path.basename(payload.sample_name)
            sample_path = os.path.join(RESOURCES_DIR, safe_name)
            if os.path.exists(sample_path):
                return vision.analyze_product_image(image_path=sample_path)
            else:
                raise HTTPException(status_code=404, detail=f"Sample '{safe_name}' not found.")

        if payload.base64_image:
            return vision.analyze_product_image(base64_data=payload.base64_image)

        raise HTTPException(status_code=400, detail="Provide base64_image or sample_name")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Vision Base64 Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/products")
def get_products(
    q: Optional[str] = Query(None, description="Search query across name, brand, category, tags"),
    query: Optional[str] = Query(None, description="Alias for q"),
    category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    max_price: Optional[float] = Query(None),
    max_price_inr: Optional[float] = Query(None),
    min_rating: Optional[float] = Query(None),
    is_organic: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    attributes: Optional[str] = Query(None, description="JSON string or key:val of attribute filters"),
    limit: Optional[int] = Query(None, ge=1, le=100),
    offset: Optional[int] = Query(0, ge=0),
):
    """
    Browse and search store products directly from SQLite database with multi-category filters,
    full-text fuzzy matching, category hierarchy expansion, and pagination.
    """
    search_term = q if q is not None else query
    attr_dict = None
    if attributes:
        try:
            attr_dict = json.loads(attributes)
        except Exception:
            # Fallback if passed as key:val
            if ":" in attributes:
                k, v = attributes.split(":", 1)
                attr_dict = {k.strip(): v.strip()}

    result = tools.fetch_all_products_paged(
        category=category,
        subcategory=subcategory,
        query=search_term,
        max_price=max_price,
        max_price_inr=max_price_inr,
        min_rating=min_rating,
        is_organic=is_organic,
        sort_by=sort_by,
        brand=brand,
        attribute_filters=attr_dict,
        limit=limit,
        offset=offset,
    )
    return {
        "products": result["products"],
        "count": result["count"],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
        "has_more": (result["offset"] + result["count"]) < result["total"],
    }


@app.get("/api/categories/tree")
def get_categories_tree_api():
    """Returns the nested category tree for mega menu, navigation, and department browsing."""
    try:
        from backend.app.catalog.categories import get_category_tree
    except ImportError:
        from app.catalog.categories import get_category_tree
    return {"departments": get_category_tree()}


@app.get("/api/categories/schema")
def get_categories_schema_api(category: Optional[str] = Query(None)):
    """Returns category-specific attribute schemas for storefront dynamic filters and admin form."""
    try:
        from backend.app.catalog.categories import CATEGORY_ATTRIBUTE_SCHEMAS, get_attribute_schema_for_category
    except ImportError:
        from app.catalog.categories import CATEGORY_ATTRIBUTE_SCHEMAS, get_attribute_schema_for_category
    if category:
        return {"category": category, "fields": get_attribute_schema_for_category(category)}
    return {"schemas": CATEGORY_ATTRIBUTE_SCHEMAS}


@app.get("/api/me")
def get_api_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns authenticated user information with real database counts.
    Requires valid JWT Bearer token (returns 401 if anonymous).
    """
    orders_count = db.query(Order).filter(Order.customer_email == current_user.email).count()
    addresses = db.query(UserAddress).filter(UserAddress.user_id == current_user.id).all()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone or "",
        "phone_consent": bool(getattr(current_user, "phone_consent", False)),
        "phone_consent_at": current_user.phone_consent_at.isoformat() if getattr(current_user, "phone_consent_at", None) else None,
        "role": current_user.role,
        "orders_count": orders_count,
        "addresses_count": len(addresses),
        "saved_addresses": [
            {
                "id": str(a.id),
                "tag": a.tag,
                "title": a.title,
                "name": a.name,
                "phone": a.phone,
                "flat": a.flat,
                "street": a.street,
                "landmark": a.landmark or "",
                "city": a.city,
                "state": a.state,
                "pinCode": a.pin_code,
                "isDefault": a.is_default,
            }
            for a in addresses
        ],
    }


class UserAddressCreateRequest(BaseModel):
    tag: str = Field("home", description="home | office | college | other")
    title: str = Field(..., min_length=2, max_length=100)
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    flat: str = Field(..., min_length=2, max_length=250)
    street: str = Field(..., min_length=2, max_length=250)
    landmark: Optional[str] = None
    city: str = Field("Bengaluru", min_length=2, max_length=100)
    state: str = Field("Karnataka", min_length=2, max_length=100)
    pin_code: str = Field(..., min_length=6, max_length=6)
    is_default: Optional[bool] = False


@app.get("/api/user/addresses")
def get_user_addresses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all saved delivery addresses for the authenticated user from real database."""
    addresses = db.query(UserAddress).filter(UserAddress.user_id == current_user.id).order_by(UserAddress.is_default.desc(), UserAddress.id.asc()).all()
    return {
        "addresses": [
            {
                "id": str(a.id),
                "tag": a.tag,
                "title": a.title,
                "name": a.name,
                "phone": a.phone,
                "flat": a.flat,
                "street": a.street,
                "landmark": a.landmark or "",
                "city": a.city,
                "state": a.state,
                "pinCode": a.pin_code,
                "isDefault": a.is_default,
            }
            for a in addresses
        ],
        "count": len(addresses),
    }


@app.post("/api/user/addresses")
def add_user_address(
    req: UserAddressCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new delivery address for the authenticated user in the database."""
    existing_count = db.query(UserAddress).filter(UserAddress.user_id == current_user.id).count()
    is_first = existing_count == 0

    if req.is_default or is_first:
        db.query(UserAddress).filter(UserAddress.user_id == current_user.id).update({"is_default": False})

    new_addr = UserAddress(
        user_id=current_user.id,
        tag=req.tag.lower().strip(),
        title=req.title.strip(),
        name=req.name.strip(),
        phone=req.phone.strip(),
        flat=req.flat.strip(),
        street=req.street.strip(),
        landmark=req.landmark.strip() if req.landmark else None,
        city=req.city.strip(),
        state=req.state.strip(),
        pin_code=req.pin_code.strip(),
        is_default=True if (req.is_default or is_first) else False,
    )
    db.add(new_addr)
    db.commit()
    db.refresh(new_addr)

    return {
        "status": "success",
        "message": "Address saved successfully.",
        "address": {
            "id": str(new_addr.id),
            "tag": new_addr.tag,
            "title": new_addr.title,
            "name": new_addr.name,
            "phone": new_addr.phone,
            "flat": new_addr.flat,
            "street": new_addr.street,
            "landmark": new_addr.landmark or "",
            "city": new_addr.city,
            "state": new_addr.state,
            "pinCode": new_addr.pin_code,
            "isDefault": new_addr.is_default,
        }
    }


@app.delete("/api/user/addresses/{addr_id}")
def delete_user_address(
    addr_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved delivery address from the database."""
    addr = db.query(UserAddress).filter(UserAddress.id == addr_id, UserAddress.user_id == current_user.id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found.")
    db.delete(addr)
    db.commit()
    return {"status": "success", "message": "Address deleted."}



@app.get("/api/products/compare")
def compare_products_endpoint(p1: int = Query(...), p2: int = Query(...)):
    """Compare two products side by side with review intelligence."""
    return review_intelligence.compare_two_products_intelligence(p1, p2)


@app.get("/api/products/{product_id}")
def get_single_product(product_id: int):
    """Get detailed product specs including reviews, stock, and ratings."""
    raw_details = tools.get_product_details.invoke({"product_id": product_id})
    return json.loads(raw_details)


@app.get("/api/products/{product_id}/reviews-analysis")
def get_product_review_analysis(product_id: int):
    """Perform deep evidence-based review intelligence for a specific product."""
    analysis = review_intelligence.analyze_product_reviews(product_id)
    if analysis.get("status") == "not_found":
        raise HTTPException(status_code=404, detail=analysis.get("error", "Product not found"))
    return analysis


@app.get("/api/categories")
def get_categories():
    """Get list of product categories in store."""
    raw_cats = tools.list_categories.invoke({})
    return {"categories": json.loads(raw_cats)}


@app.post("/api/order/prepare")
def prepare_order_endpoint(req: PrepareOrderRequest):
    """One-command multi-item bundle preparation with budget overrun detection."""
    payload = req.items_json
    if not payload and req.items:
        payload = json.dumps(req.items)
    elif not payload:
        payload = "[]"

    raw_res = tools.prepare_order_bundle.invoke({
        "items_json": payload,
        "target_budget_inr": req.target_budget_inr,
        "customer_name": req.customer_name or "Valued Customer",
    })
    return json.loads(raw_res)


# ---------------------------------------------------------------------------
# Cart Endpoints (Server-side Cart with Guest Merging)
# ---------------------------------------------------------------------------

@app.get("/api/cart")
def get_user_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetches server cart items for the authenticated user."""
    items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    result = []
    for it in items:
        p = it.product
        if p:
            result.append({
                "id": p.id,
                "name": p.name,
                "brand": p.brand,
                "price": p.price,
                "price_inr": p.price_inr,
                "image_url": p.image_url,
                "stock": p.stock,
                "quantity": it.quantity,
                "category": p.category,
            })
    return {"items": result, "count": len(result)}


@app.post("/api/cart/items")
def add_to_user_cart(
    req: AddCartItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adds or updates an item in user's server cart."""
    prod = db.query(Product).filter(Product.id == req.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    cart_item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.product_id == req.product_id
    ).first()

    qty_to_set = min(prod.stock, min(20, req.quantity))
    if cart_item:
        cart_item.quantity = qty_to_set
    else:
        cart_item = CartItem(
            user_id=current_user.id,
            product_id=req.product_id,
            quantity=qty_to_set
        )
        db.add(cart_item)
    db.commit()
    return {"status": "success", "message": "Cart updated", "quantity": qty_to_set}


@app.post("/api/cart/merge")
def merge_user_cart(
    req: MergeCartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Merges guest localStorage cart with server cart upon login.
    No duplicates, quantities summed, capped at available stock (max 20).
    """
    for g_item in req.items:
        prod = db.query(Product).filter(Product.id == g_item.product_id).first()
        if not prod or prod.stock <= 0:
            continue

        existing = db.query(CartItem).filter(
            CartItem.user_id == current_user.id,
            CartItem.product_id == g_item.product_id
        ).first()

        if existing:
            summed = existing.quantity + g_item.quantity
            existing.quantity = min(prod.stock, min(20, summed))
        else:
            capped = min(prod.stock, min(20, g_item.quantity))
            new_item = CartItem(
                user_id=current_user.id,
                product_id=g_item.product_id,
                quantity=capped
            )
            db.add(new_item)
    db.commit()

    # Return full merged cart
    items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    result = []
    for it in items:
        p = it.product
        if p:
            result.append({
                "id": p.id,
                "name": p.name,
                "brand": p.brand,
                "price": p.price,
                "price_inr": p.price_inr,
                "image_url": p.image_url,
                "stock": p.stock,
                "quantity": it.quantity,
                "category": p.category,
            })
    return {"items": result, "count": len(result)}


@app.delete("/api/cart")
def clear_user_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Empties authenticated user's server cart."""
    db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
    db.commit()
    return {"status": "success", "message": "Cart cleared"}


# ---------------------------------------------------------------------------
# Order Checkout & Lifecycle Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/order/checkout")
def multi_checkout_endpoint(
    req: MultiCheckoutRequest,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Multi-item atomic checkout endpoint. Requires authenticated JWT.
    Validates inventory, prices, shipping address, creates real order in SQLite,
    and decrements stock. Order is strictly attached to the authenticated user.
    """
    idemp_key = idempotency_key_header or req.idempotency_key

    # Enforce real, validated shipping address
    if not req.shipping_address:
        raise HTTPException(
            status_code=422,
            detail="A real, validated shipping address is required to place an order (name, 10-digit phone, 6-digit PIN, address, city, state)."
        )

    cust_name = req.shipping_address.recipient_name.strip()
    cust_address = req.shipping_address.to_formatted_string()
    cust_email = current_user.email
    user_id = current_user.id

    # Resolve billing address & GST tax invoice details
    billing_address_str = cust_address
    buyer_gstin = None
    buyer_company = None
    if req.billing_address:
        if not req.billing_address.same_as_shipping:
            formatted_b = req.billing_address.to_formatted_string()
            if formatted_b:
                billing_address_str = formatted_b
        buyer_gstin = req.billing_address.gstin
        buyer_company = req.billing_address.company_name

    payment_method_str = req.payment_method or "UPI / QR"
    discount_inr_val = req.discount_inr or 0

    items_dicts = [{"product_id": it.product_id, "quantity": it.quantity} for it in req.items]
    raw_res = tools.confirm_and_place_order.invoke({
        "items_json": json.dumps(items_dicts),
        "customer_name": cust_name,
        "customer_address": cust_address,
        "customer_email": cust_email,
        "idempotency_key": idemp_key,
        "target_budget_inr": req.target_budget_inr,
        "budget_approved": req.budget_approved or False,
        "payment_method": payment_method_str,
        "billing_address": billing_address_str,
        "buyer_gstin": buyer_gstin,
        "buyer_company": buyer_company,
        "discount_inr": discount_inr_val,
        "user_id": user_id,
    })
    res_data = json.loads(raw_res)
    if res_data.get("status") == "error":
        raise HTTPException(status_code=400, detail=res_data.get("message", "Checkout failed"))

    # Empty user's server cart upon confirmed order
    try:
        db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
        db.commit()
    except Exception:
        pass

    # Multi-channel notification dispatch
    from backend.app.notifications import send_order_confirmation_notification
    try:
        send_order_confirmation_notification({
            "order_number": res_data.get("order_number"),
            "customer_name": cust_name,
            "customer_email": cust_email,
            "customer_address": cust_address,
            "total_price_inr": res_data.get("total_price_inr", 0),
        })
    except Exception as e:
        logger.warning(f"Notification dispatch notice: {e}")

    return res_data


@app.post("/api/checkout")
def legacy_checkout(
    req: CheckoutRequest,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
):
    """Single item checkout endpoint for quick buying. Requires authenticated user."""
    idemp_key = idempotency_key_header or req.idempotency_key

    if req.shipping_address:
        cust_name = req.shipping_address.recipient_name.strip()
        cust_address = req.shipping_address.to_formatted_string()
    else:
        raise HTTPException(
            status_code=422,
            detail="A real, validated shipping address is required (name, phone, pin, address, city, state)."
        )

    raw_res = tools.confirm_and_place_order.invoke({
        "items_json": json.dumps([{"product_id": req.product_id, "quantity": req.quantity or 1}]),
        "customer_name": cust_name,
        "customer_address": cust_address,
        "customer_email": current_user.email,
        "idempotency_key": idemp_key,
        "user_id": current_user.id,
    })
    res_data = json.loads(raw_res)
    if res_data.get("status") == "error":
        raise HTTPException(status_code=400, detail=res_data.get("message", "Checkout failed"))
    return res_data


@app.get("/api/orders")
def get_orders(
    order_numbers: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch placed orders from SQLite database with item details and tracking.
    Strictly scoped to the authenticated customer account (or all for admin).
    """
    conn = tools.get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT o.id, o.order_number, o.user_id, o.customer_name, o.customer_email, o.customer_address,
               o.items_summary, o.subtotal, o.subtotal_inr, o.delivery_fee, o.delivery_fee_inr,
               o.total_price, o.total_price_inr, o.currency, o.status, o.payment_method,
               o.billing_address, o.buyer_gstin, o.buyer_company, o.discount_inr, o.ordered_at
        FROM orders o
        WHERE 1=1
    """
    params = []

    ord_list = [o.strip() for o in order_numbers.split(",") if o.strip()] if order_numbers else []

    if current_user.role != "admin":
        if ord_list:
            placeholders = ",".join(["?"] * len(ord_list))
            # Auto-claim unassigned/session orders for current user
            cursor.execute(f"""
                UPDATE orders SET user_id = ?, customer_email = ?
                WHERE order_number IN ({placeholders})
                  AND (user_id IS NULL OR user_id = 0 OR LOWER(customer_email) IN ('shopper@trovi.internal', 'customer@moss.store', ''))
            """, [current_user.id, current_user.email.strip()] + ord_list)
            conn.commit()

            query += f" AND (o.user_id = ? OR LOWER(o.customer_email) = LOWER(?) OR (o.order_number IN ({placeholders}) AND (o.user_id = ? OR o.user_id IS NULL)))"
            params.extend([current_user.id, current_user.email.strip()] + ord_list + [current_user.id])
        else:
            query += " AND (o.user_id = ? OR LOWER(o.customer_email) = LOWER(?))"
            params.extend([current_user.id, current_user.email.strip()])
    else:
        if ord_list:
            placeholders = ",".join(["?"] * len(ord_list))
            query += f" AND o.order_number IN ({placeholders})"
            params.extend(ord_list)

    query += " ORDER BY o.id DESC LIMIT 50"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    orders = []
    for r in rows:
        order_dict = dict(r)
        
        # Fetch associated order items if available
        cursor.execute("""
            SELECT oi.product_id, oi.product_name, oi.unit_price, oi.unit_price_inr,
                   oi.quantity, oi.total_price, oi.total_price_inr, p.image_url
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        """, (order_dict["id"],))
        items_rows = cursor.fetchall()
        order_dict["items"] = [dict(it) for it in items_rows]
        orders.append(order_dict)

    conn.close()
    return {"orders": orders, "count": len(orders)}


@app.get("/api/orders/{order_identifier}")
def get_single_order(
    order_identifier: str,
    current_user: User = Depends(get_current_user),
):
    """
    Fetches a single order by ID or order_number.
    Returns 404 if not found or if the order belongs to another customer.
    """
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.* FROM orders o
        WHERE o.id = ? OR o.order_number = ?
    """, (order_identifier, order_identifier))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Order not found")

    order_dict = dict(row)
    if current_user.role != "admin":
        is_owner = (
            (order_dict.get("user_id") is not None and order_dict.get("user_id") == current_user.id)
            or (order_dict.get("customer_email", "").strip().lower() == current_user.email.strip().lower())
        )
        if not is_owner:
            conn.close()
            raise HTTPException(status_code=404, detail="Order not found")

    cursor.execute("""
        SELECT oi.*, p.image_url FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    """, (order_dict["id"],))
    items_rows = cursor.fetchall()
    order_dict["items"] = [dict(it) for it in items_rows]
    conn.close()
    return order_dict


@app.get("/api/orders/{order_identifier}/track")
def track_order_endpoint(
    order_identifier: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Public and authenticated order tracking endpoint.
    Returns status, live shipment stepper, items summary, and masked delivery details.
    """
    raw_res = tools.track_order.invoke({"order_identifier": order_identifier})
    data = json.loads(raw_res) if isinstance(raw_res, str) else raw_res
    if data.get("status") == "not_found":
        raise HTTPException(status_code=404, detail=data.get("message", f"Order '{order_identifier}' not found."))
    return data


@app.get("/api/orders/{order_number}/invoice")
def get_order_invoice(
    order_number: str,
    format: Optional[str] = Query("json"),
    current_user: User = Depends(get_current_user),
):
    """
    Computes GST Tax Invoice breakdown and returns structured JSON or print-ready HTML.
    Requires authentication and ownership of the order.
    """
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE order_number = ?", (order_number,))
    order_row = cursor.fetchone()
    if not order_row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Order '{order_number}' not found.")

    order_dict = dict(order_row)
    if current_user.role != "admin":
        is_owner = (
            (order_dict.get("user_id") is not None and order_dict.get("user_id") == current_user.id)
            or (order_dict.get("customer_email", "").strip().lower() == current_user.email.strip().lower())
        )
        if not is_owner:
            conn.close()
            raise HTTPException(status_code=404, detail="Order not found.")

    cursor.execute("""
        SELECT oi.*, p.category, p.brand
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    """, (order_dict["id"],))
    items_rows = cursor.fetchall()
    conn.close()

    items = [dict(it) for it in items_rows]
    invoice = generate_gst_invoice(order_dict, items)

    if format == "html":
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=invoice["rendered_html"], status_code=200)
    return invoice


class CancelOrderRequest(BaseModel):
    reason: Optional[str] = "Customer requested cancellation"


@app.post("/api/orders/{order_number}/cancel")
def cancel_order_endpoint(
    order_number: str,
    req: Optional[CancelOrderRequest] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Atomically cancels an order and restores inventory stock to products table.
    """
    reason = req.reason if req else "Customer requested cancellation"
    res = cancel_order_atomic(order_number, reason=reason)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res


class ReturnOrderRequest(BaseModel):
    reason: Optional[str] = "Customer requested return"
    return_action: Optional[str] = "refund"


@app.post("/api/orders/{order_number}/return")
def return_order_endpoint(
    order_number: str,
    req: Optional[ReturnOrderRequest] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Initiates doorstep return request for an order.
    """
    reason = req.reason if req else "Customer requested return"
    action = req.return_action if req else "refund"
    res = request_order_return(order_number, reason=reason, return_action=action)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res


class ExchangeOrderRequest(BaseModel):
    reason: Optional[str] = "Size or variant exchange"
    replacement_product: Optional[str] = "Alternative variant"


@app.post("/api/orders/{order_number}/exchange")
def exchange_order_endpoint(
    order_number: str,
    req: Optional[ExchangeOrderRequest] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Initiates product exchange request with doorstep courier swap.
    """
    reason = req.reason if req else "Size or variant exchange"
    replacement = req.replacement_product if req else "Alternative variant"
    res = request_order_exchange(order_number, reason=reason, replacement_product=replacement)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res


class RefundOrderRequest(BaseModel):
    reason: Optional[str] = "Customer requested refund"
    refund_method: Optional[str] = "Original Payment Method"


@app.post("/api/orders/{order_number}/refund")
def refund_order_endpoint(
    order_number: str,
    req: Optional[RefundOrderRequest] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Processes an instant refund for an order back to original payment source.
    """
    reason = req.reason if req else "Customer requested refund"
    method = req.refund_method if req else "Original Payment Method"
    res = request_order_refund(order_number, reason=reason, refund_method=method)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res


class OrderStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Target status: placed, packed, shipped, delivered, cancelled")


@app.patch("/api/orders/{order_number}/status")
def update_order_status_endpoint(
    order_number: str,
    req: OrderStatusUpdateRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Updates order status enforcing valid lifecycle state transitions.
    """
    res = transition_order_status(order_number, req.status)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))

    # Status update notification dispatch
    from backend.app.notifications import send_status_update_notification
    try:
        send_status_update_notification(order_number=order_number, new_status=req.status)
    except Exception as e:
        logger.warning(f"Status update notification notice: {e}")

    return res


# Mount Vite production assets and SPA fallback
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Pass through API, static, products, health, and docs routes
        if full_path.startswith(("api", "static", "products", "health", "docs", "openapi.json", "redoc")):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not Found")


if __name__ == "__main__":
    if "--check" in sys.argv:
        passed = run_startup_self_check(exit_on_failure=True)
        if passed:
            print("[Startup Self-Check] ALL RUNTIME PREREQUISITES VERIFIED SUCCESSFULLY.")
            sys.exit(0)
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

