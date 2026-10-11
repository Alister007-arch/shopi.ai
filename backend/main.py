import os
import json
import sqlite3
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import tools
import vision
import graph
import review_intelligence
import audit_catalog

# Auto-seed database if missing
DB_PATH = os.path.join(os.path.dirname(__file__), "shopai.db")
if not os.path.exists(DB_PATH):
    try:
        import setup_db
        setup_db.create_database()
        print("[DB Init] Initialized shopai.db successfully.")
    except Exception as e:
        print(f"[DB Init Warning] {e}")

app = FastAPI(
    title="ShopAI API",
    description="Backend API powering the ShopAI Shopping Agent, Visual Search & Review Intelligence",
    version="3.0.0",
)

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
# Pydantic Request Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = "session-web"


class CheckoutRequest(BaseModel):
    product_id: int
    quantity: Optional[int] = 1
    customer_name: Optional[str] = "Online Shopper"


class CartItemPayload(BaseModel):
    product_id: int
    quantity: int = 1


class MultiCheckoutRequest(BaseModel):
    items: List[CartItemPayload]
    customer_name: Optional[str] = "Online Shopper"
    customer_address: Optional[str] = "Flat 402, Green Park Avenue, Bengaluru 560034"
    customer_email: Optional[str] = "shopper@shopai.internal"


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
        "service": "ShopAI Agent Backend",
        "database": "shopai.db",
        "version": "3.0.0",
        "currency": "INR",
        "catalog_source": "SQLite verified multi-category store",
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
def chat_endpoint(req: ChatRequest):
    """
    Primary endpoint for AI Shopping Agent conversation.
    Invokes graph.py agent with SQLite tools, persistent thread memory,
    and automatic deterministic fallback.
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        result = graph.run_agent_chat(
            message=req.message.strip(),
            thread_id=req.thread_id or "session-web",
        )
        return result
    except Exception as e:
        print(f"[Chat Error] {e}")
        fallback_res = graph.run_offline_fallback(req.message.strip())
        fallback_res["thread_id"] = req.thread_id
        return fallback_res


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
    category: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    max_price: Optional[float] = Query(None),
    max_price_inr: Optional[float] = Query(None),
    min_rating: Optional[float] = Query(None),
    is_organic: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
):
    """
    Browse and search store products directly from SQLite shopai.db with multi-category filters.
    """
    items = tools.fetch_all_products(
        category=category,
        subcategory=subcategory,
        query=query,
        max_price=max_price,
        max_price_inr=max_price_inr,
        min_rating=min_rating,
        is_organic=is_organic,
        sort_by=sort_by,
        brand=brand,
    )
    return {
        "products": items,
        "count": len(items),
    }


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


@app.post("/api/order/checkout")
def multi_checkout_endpoint(req: MultiCheckoutRequest):
    """
    Multi-item atomic checkout endpoint. Validates inventory, prices,
    creates real order in SQLite, and decrements stock.
    """
    items_dicts = [{"product_id": it.product_id, "quantity": it.quantity} for it in req.items]
    raw_res = tools.confirm_and_place_order.invoke({
        "items_json": json.dumps(items_dicts),
        "customer_name": req.customer_name or "Online Shopper",
        "customer_address": req.customer_address or "Flat 402, Green Park Avenue, Bengaluru 560034",
        "customer_email": req.customer_email or "shopper@shopai.internal",
    })
    return json.loads(raw_res)


@app.post("/api/checkout")
def legacy_checkout(req: CheckoutRequest):
    """Single item checkout endpoint for quick buying."""
    raw_res = tools.confirm_and_place_order.invoke({
        "items_json": json.dumps([{"product_id": req.product_id, "quantity": req.quantity or 1}]),
        "customer_name": req.customer_name or "Online Shopper",
    })
    return json.loads(raw_res)


@app.get("/api/orders")
def get_orders():
    """
    Fetch all placed orders from SQLite shopai.db with item details and tracking.
    """
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.id, o.order_number, o.customer_name, o.customer_email, o.customer_address,
               o.items_summary, o.subtotal, o.subtotal_inr, o.delivery_fee, o.delivery_fee_inr,
               o.total_price, o.total_price_inr, o.currency, o.status, o.payment_method, o.ordered_at
        FROM orders o
        ORDER BY o.id DESC
    """)
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
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
