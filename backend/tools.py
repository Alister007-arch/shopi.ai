import json
import os
import sqlite3
import re
import uuid
from typing import Optional, List, Dict, Any
from langchain.tools import tool
import review_intelligence

DB_PATH = os.path.join(os.path.dirname(__file__), "shopai.db")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def fetch_product_rating_internal(product_id: int) -> dict:
    """Internal helper to calculate rating and review count from SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE product_id = ?",
        (product_id,),
    )
    row = cursor.fetchone()
    conn.close()

    avg = round(float(row["avg_rating"]), 2) if row and row["avg_rating"] is not None else None
    count = int(row["review_count"]) if row and row["review_count"] else 0
    return {"product_id": product_id, "average_rating": avg, "review_count": count}


SPELLING_CORRECTIONS = {
    "oat": "oats",
    "hone": "honey",
    "honny": "honey",
    "chai": "tea",
    "koffee": "coffee",
    "quinoa": "quinoa",
    "flax": "flaxseed",
    "earphone": "headphones",
    "headphone": "headphones",
    "laptop": "laptop",
    "notebook": "laptop",
    "computer": "laptop",
}

def normalize_query(q: str) -> str:
    """Normalize common typos or singular/plural variants."""
    words = q.lower().split()
    corrected = [SPELLING_CORRECTIONS.get(w, w) for w in words]
    return " ".join(corrected)


def fetch_all_products(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    query: Optional[str] = None,
    max_price: Optional[float] = None,
    max_price_inr: Optional[float] = None,
    min_rating: Optional[float] = None,
    is_organic: Optional[bool] = None,
    sort_by: Optional[str] = None,
    brand: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Helper to query products joined with their verified review ratings and rich multi-category specs."""
    conn = get_db_connection()
    cursor = conn.cursor()

    sql = """
        SELECT p.id, p.name, p.category, p.subcategory, p.brand, p.price, p.price_inr, p.currency,
               p.description, p.is_organic, p.image_url, p.attributes, p.specifications, p.stock,
               p.stock_status, p.badge, p.is_demo, p.supplier,
               ROUND(AVG(r.rating), 2) as rating, COUNT(r.id) as review_count
        FROM products p
        LEFT JOIN reviews r ON p.id = r.product_id
        WHERE 1=1
    """
    params = []

    if query:
        norm_query = normalize_query(query)
        stop_words = {"a", "an", "the", "in", "for", "with", "me", "chahiye", "kar", "do", "karo", "ek", "hai", "ka", "ki", "ke", "ko", "please"}
        tokens = [t for t in norm_query.lower().split() if len(t) > 1 and t not in stop_words]
        
        if tokens:
            token_clauses = []
            for token in tokens:
                token_clauses.append("""(
                    LOWER(p.name) LIKE ? OR
                    LOWER(p.description) LIKE ? OR
                    LOWER(p.category) LIKE ? OR
                    LOWER(IFNULL(p.subcategory, '')) LIKE ? OR
                    LOWER(IFNULL(p.brand, '')) LIKE ? OR
                    LOWER(IFNULL(p.specifications, '')) LIKE ?
                )""")
                like = f"%{token}%"
                params.extend([like, like, like, like, like, like])
            sql += " AND (" + " AND ".join(token_clauses) + ")"
        else:
            sql += """ AND (
                LOWER(p.name) LIKE ? OR
                LOWER(p.description) LIKE ? OR
                LOWER(p.category) LIKE ? OR
                LOWER(IFNULL(p.subcategory, '')) LIKE ? OR
                LOWER(IFNULL(p.brand, '')) LIKE ? OR
                LOWER(IFNULL(p.specifications, '')) LIKE ?
            )"""
            like = f"%{norm_query.lower()}%"
            params.extend([like, like, like, like, like, like])

    if category and category.lower() != "all":
        sql += " AND LOWER(p.category) = LOWER(?)"
        params.append(category)

    if subcategory:
        sql += " AND LOWER(p.subcategory) = LOWER(?)"
        params.append(subcategory)

    if brand:
        sql += " AND LOWER(p.brand) LIKE LOWER(?)"
        params.append(f"%{brand}%")

    if max_price_inr is not None:
        sql += " AND p.price_inr <= ?"
        params.append(max_price_inr)
    elif max_price is not None:
        sql += " AND p.price <= ?"
        params.append(max_price)

    if is_organic is not None:
        sql += " AND p.is_organic = ?"
        params.append(1 if is_organic else 0)

    sql += " GROUP BY p.id"

    # Sorting options
    if sort_by in ("cheapest", "price_asc"):
        sql += " ORDER BY p.price_inr ASC, rating DESC"
    elif sort_by == "price_desc":
        sql += " ORDER BY p.price_inr DESC"
    elif sort_by == "reviews":
        sql += " ORDER BY review_count DESC, rating DESC"
    else:  # default: best rated
        sql += " ORDER BY rating DESC, review_count DESC, p.id ASC"

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()

    products = []
    for row in rows:
        rating_val = float(row["rating"]) if row["rating"] is not None else None
        
        parsed_attrs = {}
        if row["attributes"]:
            try:
                parsed_attrs = json.loads(row["attributes"])
            except Exception:
                parsed_attrs = {}

        p_dict = {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "subcategory": row["subcategory"],
            "brand": row["brand"],
            "price": float(row["price"]),
            "price_inr": int(row["price_inr"]) if row["price_inr"] is not None else round(float(row["price"]) * 85),
            "currency": row["currency"] or "INR",
            "description": row["description"],
            "is_organic": bool(row["is_organic"]),
            "image_url": row["image_url"],
            "attributes": parsed_attrs,
            "specifications": row["specifications"],
            "stock": int(row["stock"]) if row["stock"] is not None else 0,
            "stock_status": row["stock_status"] or ("In Stock" if (row["stock"] or 0) > 0 else "Out of Stock"),
            "badge": row["badge"],
            "is_demo": bool(row["is_demo"]),
            "rating": rating_val,
            "review_count": int(row["review_count"]),
        }
        products.append(p_dict)

    if min_rating is not None:
        products = [p for p in products if p["rating"] is not None and p["rating"] >= min_rating]

    return products


# ---------------------------------------------------------------------------
# LangChain Tools for the AI Shopping Agent
# ---------------------------------------------------------------------------

@tool
def search_products(
    query: str = "",
    category: Optional[str] = None,
    max_price_inr: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    is_organic: Optional[bool] = None,
    sort_by: Optional[str] = None,
    brand: Optional[str] = None,
) -> str:
    """
    Search multi-category product catalog by keyword (e.g. laptop, headphones, oats, watermelon),
    category, maximum budget in INR (₹) or USD ($), minimum rating, or brand.
    Returns structured JSON list of verified products with specs, ratings, and real inventory prices.
    """
    products = fetch_all_products(
        category=category,
        query=query if query else None,
        max_price=max_price,
        max_price_inr=max_price_inr,
        min_rating=min_rating,
        is_organic=is_organic,
        sort_by=sort_by,
        brand=brand,
    )

    if not products:
        return json.dumps({
            "status": "not_found",
            "message": "No matching products found under your specified criteria.",
            "results": [],
            "count": 0,
        })

    return json.dumps(products[:8], indent=2)


@tool
def get_product_details(product_id: int) -> str:
    """
    Get detailed product specs including review intelligence, verified advantages/limitations,
    stock level, full hardware or food specifications, and dual currency pricing.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    p_row = cursor.fetchone()
    conn.close()

    if not p_row:
        return json.dumps({"error": f"Product with ID {product_id} not found."})

    rev_intel = review_intelligence.analyze_product_reviews(product_id)
    price_usd = float(p_row["price"])
    price_inr = int(p_row["price_inr"]) if p_row["price_inr"] else round(price_usd * 85)

    attrs = {}
    if p_row["attributes"]:
        try:
            attrs = json.loads(p_row["attributes"])
        except Exception:
            attrs = {}

    details = {
        "id": p_row["id"],
        "name": p_row["name"],
        "category": p_row["category"],
        "subcategory": p_row["subcategory"],
        "brand": p_row["brand"],
        "price_usd": price_usd,
        "price_inr": price_inr,
        "currency": p_row["currency"] or "INR",
        "description": p_row["description"],
        "specifications": p_row["specifications"],
        "attributes": attrs,
        "is_organic": bool(p_row["is_organic"]),
        "stock": int(p_row["stock"]) if p_row["stock"] is not None else 0,
        "stock_status": p_row["stock_status"],
        "badge": p_row["badge"],
        "is_demo": bool(p_row["is_demo"]),
        "average_rating": rev_intel.get("average_rating"),
        "review_count": rev_intel.get("analyzed_reviews_count", 0),
        "verified_advantages": rev_intel.get("verified_advantages", []),
        "verified_limitations": rev_intel.get("verified_limitations", []),
        "sample_disclosure": rev_intel.get("sample_disclosure"),
    }
    return json.dumps(details, indent=2)


@tool
def compare_products(product_id_1: int, product_id_2: int) -> str:
    """
    Compare two products side by side using verified database values, hardware/food specifications,
    and review intelligence. Use when asked: 'Compare laptop #38 and #39', 'Compare headphones', etc.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id IN (?, ?)", (product_id_1, product_id_2))
    rows = {r["id"]: dict(r) for r in cursor.fetchall()}
    conn.close()

    p1 = rows.get(product_id_1)
    p2 = rows.get(product_id_2)

    if not p1 or not p2:
        return json.dumps({"error": "One or both product IDs do not exist in the store catalog."})

    intel1 = review_intelligence.analyze_product_reviews(product_id_1)
    intel2 = review_intelligence.analyze_product_reviews(product_id_2)

    def parse_attrs(row):
        try:
            return json.loads(row.get("attributes") or "{}")
        except Exception:
            return {}

    comp = {
        "product_1": {
            "id": p1["id"],
            "name": p1["name"],
            "brand": p1["brand"],
            "category": p1["category"],
            "price_inr": f"₹{p1['price_inr']:,}",
            "price_usd": f"${p1['price']:.2f}",
            "rating": intel1.get("average_rating"),
            "review_count": intel1.get("analyzed_reviews_count"),
            "attributes": parse_attrs(p1),
            "specifications": p1["specifications"],
            "advantages": intel1.get("verified_advantages", []),
            "limitations": intel1.get("verified_limitations", []),
        },
        "product_2": {
            "id": p2["id"],
            "name": p2["name"],
            "brand": p2["brand"],
            "category": p2["category"],
            "price_inr": f"₹{p2['price_inr']:,}",
            "price_usd": f"${p2['price']:.2f}",
            "rating": intel2.get("average_rating"),
            "review_count": intel2.get("analyzed_reviews_count"),
            "attributes": parse_attrs(p2),
            "specifications": p2["specifications"],
            "advantages": intel2.get("verified_advantages", []),
            "limitations": intel2.get("verified_limitations", []),
        }
    }
    return json.dumps(comp, indent=2)


@tool
def prepare_order_bundle(
    items_json: str,
    target_budget_inr: Optional[float] = None,
    customer_name: str = "Valued Customer",
) -> str:
    """
    Parses a multi-product shopping command (e.g. '1kg oats, 500g honey, and two litres milk under ₹800').
    Validates stock, computes subtotals from backend verified prices, checks for budget overruns,
    and returns a complete itemized order bundle for explicit user confirmation.
    
    items_json format: [{"query": "oats", "quantity": 1}, {"query": "honey", "quantity": 1}, ...]
    """
    try:
        if isinstance(items_json, str):
            items_list = json.loads(items_json)
        else:
            items_list = items_json
    except Exception as e:
        return json.dumps({"status": "error", "message": f"Failed to parse items: {str(e)}"})

    selected_bundle = []
    subtotal_inr = 0
    subtotal_usd = 0.0
    stock_errors = []

    for req in items_list:
        q = req.get("query", "").strip()
        qty = max(1, int(req.get("quantity", 1)))
        
        # Search catalog
        matches = fetch_all_products(query=q)
        if not matches:
            stock_errors.append(f"No catalog item found matching '{q}'.")
            continue

        best_item = matches[0]
        # Check stock
        if best_item["stock"] < qty:
            stock_errors.append(f"Insufficient stock for '{best_item['name']}' (Requested: {qty}, Available: {best_item['stock']}).")
            continue

        item_total_inr = best_item["price_inr"] * qty
        item_total_usd = round(best_item["price"] * qty, 2)
        subtotal_inr += item_total_inr
        subtotal_usd += item_total_usd

        selected_bundle.append({
            "id": best_item["id"],
            "product_id": best_item["id"],
            "name": best_item["name"],
            "brand": best_item["brand"],
            "category": best_item["category"],
            "price": best_item["price"],
            "price_inr": best_item["price_inr"],
            "unit_price_inr": best_item["price_inr"],
            "unit_price_usd": best_item["price"],
            "quantity": qty,
            "total_inr": item_total_inr,
            "total_usd": item_total_usd,
            "image_url": best_item["image_url"],
            "rating": best_item.get("rating") or 4.8,
            "stock": best_item.get("stock", 0),
        })

    # Shipping policy: Free delivery over ₹500, else ₹50
    delivery_fee_inr = 0 if subtotal_inr >= 500 or subtotal_inr == 0 else 50
    delivery_fee_usd = 0.0 if subtotal_inr >= 500 or subtotal_inr == 0 else 0.59
    total_inr = subtotal_inr + delivery_fee_inr
    total_usd = round(subtotal_usd + delivery_fee_usd, 2)

    # Budget Check
    is_budget_exceeded = False
    budget_variance_inr = 0
    if target_budget_inr is not None and total_inr > target_budget_inr:
        is_budget_exceeded = True
        budget_variance_inr = total_inr - target_budget_inr

    items_summary_str = ", ".join([f"{item['quantity']}x {item['name']}" for item in selected_bundle])

    return json.dumps({
        "status": "budget_exceeded" if is_budget_exceeded else ("partial_ready" if stock_errors else "ready"),
        "customer_name": customer_name,
        "items": selected_bundle,
        "items_summary": items_summary_str,
        "subtotal_inr": subtotal_inr,
        "subtotal_usd": round(subtotal_usd, 2),
        "delivery_fee_inr": delivery_fee_inr,
        "delivery_fee_usd": delivery_fee_usd,
        "total_inr": total_inr,
        "total_usd": total_usd,
        "target_budget_inr": target_budget_inr,
        "is_budget_exceeded": is_budget_exceeded,
        "budget_variance_inr": budget_variance_inr,
        "stock_errors": stock_errors,
        "requires_confirmation": True,
        "message": f"Prepared order bundle totaling ₹{total_inr:,} (${total_usd:.2f}) for {len(selected_bundle)} item(s)."
    }, indent=2)


@tool
def confirm_and_place_order(
    items_json: str,
    customer_name: str = "Valued Customer",
    customer_address: str = "Flat 402, Green Park Avenue, Bengaluru 560034",
    customer_email: str = "shopper@shopai.internal",
) -> str:
    """
    Completes checkout and saves a confirmed order into SQLite database transactions in 1 command.
    Validates inventory and prices, decrements stock atomically, and returns a verified order ID.
    items_json: list of [{"product_id": int, "quantity": int}] or [{"query": str, "quantity": int}]
    """
    try:
        if isinstance(items_json, str):
            items_list = json.loads(items_json)
        else:
            items_list = items_json
    except Exception as e:
        return json.dumps({"status": "error", "message": f"Invalid items payload: {str(e)}"})

    if not items_list:
        return json.dumps({"status": "error", "message": "Cannot checkout empty cart."})

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN TRANSACTION")

        # Validate stock and calculate authoritative total
        validated_items = []
        ordered_products = []
        subtotal_inr = 0
        subtotal_usd = 0.0

        for it in items_list:
            pid = it.get("product_id")
            qty = max(1, int(it.get("quantity", 1)))

            # If product_id not provided directly, lookup by query or name
            if pid is None or pid == "":
                lookup_term = it.get("query") or it.get("name") or it.get("item") or ""
                matches = fetch_all_products(query=str(lookup_term))
                if matches:
                    pid = matches[0]["id"]
                else:
                    conn.rollback()
                    conn.close()
                    return json.dumps({
                        "status": "error",
                        "message": f"Product matching '{lookup_term}' not found in store catalog."
                    })
            else:
                try:
                    pid = int(pid)
                except (ValueError, TypeError):
                    conn.rollback()
                    conn.close()
                    return json.dumps({"status": "error", "message": f"Invalid product ID: {pid}"})

            cursor.execute("SELECT id, name, category, brand, price, price_inr, stock, image_url, badge FROM products WHERE id = ?", (pid,))
            row = cursor.fetchone()
            if not row:
                conn.rollback()
                conn.close()
                return json.dumps({"status": "error", "message": f"Product #{pid} does not exist in store catalog."})

            if row["stock"] < qty:
                conn.rollback()
                conn.close()
                return json.dumps({
                    "status": "error",
                    "message": f"Insufficient stock for '{row['name']}'. Requested: {qty}, Available: {row['stock']}."
                })

            p_inr = int(row["price_inr"]) if row["price_inr"] is not None else round(float(row["price"]) * 85)
            p_usd = float(row["price"])
            item_tot_inr = p_inr * qty
            item_tot_usd = round(p_usd * qty, 2)

            subtotal_inr += item_tot_inr
            subtotal_usd += item_tot_usd

            rating_data = fetch_product_rating_internal(pid)

            validated_items.append({
                "product_id": pid,
                "product_name": row["name"],
                "unit_price": p_usd,
                "unit_price_inr": p_inr,
                "quantity": qty,
                "total_price": item_tot_usd,
                "total_price_inr": item_tot_inr,
            })

            ordered_products.append({
                "id": pid,
                "name": row["name"],
                "category": row["category"],
                "brand": row["brand"],
                "price": p_usd,
                "price_inr": p_inr,
                "quantity": qty,
                "image_url": row["image_url"],
                "badge": row["badge"],
                "rating": rating_data.get("average_rating") or 4.8,
                "review_count": rating_data.get("review_count") or 1,
            })

        # Calculate shipping
        delivery_inr = 0 if subtotal_inr >= 500 else 50
        delivery_usd = 0.0 if subtotal_inr >= 500 else 0.59
        total_inr = subtotal_inr + delivery_inr
        total_usd = round(subtotal_usd + delivery_usd, 2)

        order_num = f"ORD-2026-{uuid.uuid4().hex[:6].upper()}"
        items_summary = ", ".join([f"{x['quantity']}x {x['product_name']}" for x in validated_items])

        # Insert Order
        cursor.execute("""
            INSERT INTO orders (
                order_number, customer_name, customer_email, customer_address, items_summary,
                subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr,
                currency, status, payment_method, ordered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'Confirmed', 'Demo Pay / COD', datetime('now'))
        """, (
            order_num, customer_name, customer_email, customer_address, items_summary,
            subtotal_usd, subtotal_inr, delivery_usd, delivery_inr, total_usd, total_inr
        ))
        order_id = cursor.lastrowid

        # Insert Order Items & Decrement Stock
        for itm in validated_items:
            cursor.execute("""
                INSERT INTO order_items (
                    order_id, product_id, product_name, unit_price, unit_price_inr, quantity,
                    total_price, total_price_inr
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                order_id, itm["product_id"], itm["product_name"], itm["unit_price"],
                itm["unit_price_inr"], itm["quantity"], itm["total_price"], itm["total_price_inr"]
            ))

            cursor.execute(
                "UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?",
                (itm["quantity"], itm["product_id"])
            )

        conn.commit()
        conn.close()

        return json.dumps({
            "status": "success",
            "order_id": order_id,
            "order_number": order_num,
            "items_summary": items_summary,
            "item_count": len(validated_items),
            "subtotal_inr": subtotal_inr,
            "delivery_fee_inr": delivery_inr,
            "total_price_inr": total_inr,
            "total_price_usd": total_usd,
            "delivery_address": customer_address,
            "status_text": "Confirmed (Demo Checkout)",
            "message": f"Order #{order_num} successfully placed for ₹{total_inr:,} (${total_usd:.2f})! View tracking under 'My Orders'.",
            "ordered_products": ordered_products,
        }, indent=2)

    except Exception as e:
        conn.rollback()
        conn.close()
        return json.dumps({"status": "error", "message": f"Transaction failed: {str(e)}"})


@tool
def add_to_cart(product_id: int, quantity: int = 1) -> str:
    """Add a verified product and quantity to the user's shopping cart."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return json.dumps({"action": "ADD_TO_CART", "status": "error", "message": f"Product #{product_id} not found."})

    qty = max(1, quantity)
    rating_data = fetch_product_rating_internal(product_id)

    item_data = {
        "id": row["id"],
        "name": row["name"],
        "brand": row["brand"],
        "category": row["category"],
        "price": float(row["price"]),
        "price_inr": int(row["price_inr"]) if row["price_inr"] else round(float(row["price"]) * 85),
        "image_url": row["image_url"],
        "stock": int(row["stock"]) if row["stock"] is not None else 0,
        "badge": row["badge"],
        "rating": rating_data["average_rating"],
        "quantity": qty,
    }
    return json.dumps({
        "action": "ADD_TO_CART",
        "status": "success",
        "product_id": row["id"],
        "product_name": row["name"],
        "quantity": qty,
        "price_inr": item_data["price_inr"],
        "total_inr": item_data["price_inr"] * qty,
        "product": item_data,
        "message": f"Added {qty}x '{row['name']}' to cart (₹{item_data['price_inr'] * qty:,}).",
    })


@tool
def remove_from_cart(product_id: int) -> str:
    """Remove a product from the shopping cart by product ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    conn.close()
    name = row["name"] if row else f"Product #{product_id}"

    return json.dumps({
        "action": "REMOVE_FROM_CART",
        "status": "success",
        "product_id": product_id,
        "product_name": name,
        "message": f"Removed '{name}' from your cart.",
    })


@tool
def list_categories() -> str:
    """List all available product categories in the shop."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT category, count(*) as count FROM products GROUP BY category ORDER BY category ASC")
    cats = [{"category": row["category"], "count": row["count"]} for row in cursor.fetchall()]
    conn.close()
    return json.dumps(cats)


@tool
def analyze_reviews(product_id: int) -> str:
    """Deep evidence-based review intelligence on a product: advantages, limitations, and citations."""
    intel = review_intelligence.analyze_product_reviews(product_id)
    return json.dumps(intel, indent=2)


@tool
def get_product_rating(product_id: int) -> str:
    """Get customer rating score (1-5) and total reviews count for a product ID."""
    rating_data = fetch_product_rating_internal(product_id)
    return json.dumps(rating_data)
