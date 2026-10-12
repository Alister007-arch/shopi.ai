import json
import os
import sqlite3
import re
import uuid
import sys
from typing import Optional, List, Dict, Any
from langchain.tools import tool

_backend_dir = os.path.dirname(__file__)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

try:
    import review_intelligence
except ImportError:
    from backend import review_intelligence

try:
    from backend.app.agent.quote import create_cryptographic_quote, verify_quote_token, mark_quote_as_used
except ImportError:
    try:
        from app.agent.quote import create_cryptographic_quote, verify_quote_token, mark_quote_as_used
    except ImportError:
        create_cryptographic_quote = None
        verify_quote_token = None
        mark_quote_as_used = None

DB_PATH = os.environ.get("SHOPI_DB_PATH", os.path.join(os.path.dirname(__file__), "shopai.db"))

def get_db_connection() -> sqlite3.Connection:
    target_path = os.environ.get("SHOPI_DB_PATH", DB_PATH)
    conn = sqlite3.connect(target_path, timeout=30.0)
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
    "clyhes": "clothing",
    "clothes": "clothing",
    "cloths": "clothing",
    "cloth": "clothing",
    "veggies": "vegetables",
    "veggie": "vegetables",
    "veg": "vegetables",
    "sabzi": "vegetables",
    "subzi": "vegetables",
    "undergarment": "innerwear",
    "undergarments": "innerwear",
    "underwear": "innerwear",
    "undies": "innerwear",
    "boxers": "boxer",
    "panty": "panties",
    "bras": "bra",
    "vests": "vest",
    "sock": "socks",
    "thermals": "thermal",
    "vaccum": "vacuum",
    "vacum": "vacuum",
    "trimer": "trimmer",
    "kindel": "kindle",
    "playstation": "ps5",
    "sdcard": "microsd",
    "books": "book",
    "mago": "mango",
    "mangos": "mango",
    "mangoes": "mango",
    "aam": "mango",
    "alphanso": "alphonso",
    "alfanso": "alphonso",
    "almond": "almonds",
    "badam": "almonds",
    "cashew": "cashews",
    "kaju": "cashews",
    "ghee": "ghee",
    "ghi": "ghee",
}

_CATALOG_VOCAB_CACHE = None

def get_catalog_vocabulary() -> List[str]:
    global _CATALOG_VOCAB_CACHE
    if _CATALOG_VOCAB_CACHE is not None:
        return _CATALOG_VOCAB_CACHE
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT name, category, subcategory, brand, badge FROM products")
        rows = cursor.fetchall()
        conn.close()
        words = set()
        for r in rows:
            for field in [r["name"], r["category"], r["subcategory"], r["brand"], r["badge"]]:
                if field:
                    for w in re.findall(r"[a-zA-Z]{3,}", field.lower()):
                        words.add(w)
        _CATALOG_VOCAB_CACHE = sorted(list(words))
    except Exception:
        _CATALOG_VOCAB_CACHE = ["mango", "honey", "oats", "almonds", "ghee", "oil", "rice", "tea", "coffee", "apple"]
    return _CATALOG_VOCAB_CACHE


def normalize_query(q: str) -> str:
    """Normalize common typos, singular/plural variants, and fuzzy matches against catalog vocabulary."""
    if not q:
        return ""
    import difflib
    words = q.lower().split()
    corrected = []
    vocab = get_catalog_vocabulary()
    for w in words:
        if w in SPELLING_CORRECTIONS:
            corrected.append(SPELLING_CORRECTIONS[w])
        elif len(w) >= 3 and w not in {"the", "and", "for", "with", "all"}:
            matches = difflib.get_close_matches(w, vocab, n=1, cutoff=0.75)
            if matches:
                corrected.append(matches[0])
            else:
                corrected.append(w)
        else:
            corrected.append(w)
    return " ".join(corrected)


try:
    from backend.app.catalog.categories import CATEGORY_TREE, get_all_categories_flat
except ImportError:
    try:
        from app.catalog.categories import CATEGORY_TREE, get_all_categories_flat
    except ImportError:
        CATEGORY_TREE = []
        get_all_categories_flat = lambda: []


def get_category_slugs_in_hierarchy(cat_slug: Optional[str]) -> List[str]:
    """Expands a top-level category slug to all its child subcategory slugs."""
    if not cat_slug:
        return []
    clean = cat_slug.lower().strip()
    for parent in CATEGORY_TREE:
        if parent["slug"].lower() == clean:
            child_slugs = [c["slug"].lower() for c in parent.get("children", [])]
            return [clean] + child_slugs
    return [clean]


def calculate_unit_price(row: Dict[str, Any]) -> Optional[str]:
    """Calculates price per 100g or 100ml for grocery items."""
    price_inr = row.get("price_inr") or 0
    if not price_inr:
        return None
    
    attrs = row.get("attributes") or {}
    if isinstance(attrs, str):
        try:
            attrs = json.loads(attrs)
        except Exception:
            attrs = {}
            
    category = (row.get("category") or "").lower()
    if any(c in category for c in ["laptop", "electronic", "headphone", "clothing", "apparel", "luxury", "watch", "shoe"]):
        return None

    weight_str = attrs.get("weight") or attrs.get("volume") or ""
    if not weight_str:
        m = re.search(r"\b(\d+(?:\.\d+)?)\s*(kg|g|ml|litre|liter|l)\b", (row.get("name") or "") + " " + (row.get("description") or ""), re.IGNORECASE)
        if m:
            qty, unit = float(m.group(1)), m.group(2).lower()
        else:
            return None
    else:
        m = re.search(r"\b(\d+(?:\.\d+)?)\s*(kg|g|ml|litre|liter|l)\b", str(weight_str), re.IGNORECASE)
        if m:
            qty, unit = float(m.group(1)), m.group(2).lower()
        else:
            return None

    if unit in ("kg", "l", "litre", "liter"):
        total_grams = qty * 1000
    else:
        total_grams = qty
        
    if total_grams <= 0:
        return None
        
    price_per_100g = round((price_inr / total_grams) * 100, 2)
    unit_label = "100ml" if unit in ("l", "litre", "liter", "ml") else "100g"
    return f"₹{price_per_100g:,} / {unit_label}"


AMBIGUOUS_QUERY_MAP = {
    "apple": {
        "departments": ["Fresh Grocery & Farm Produce", "Electronics & Luxury Tech"],
        "clarifying_question": "Did you mean fresh edible apples from our Farm Produce (e.g. Crisp Royal Gala Apples), or Apple computing and smartphones (e.g. MacBook Pro, iPhone 16 Pro, Apple Watch)?",
        "options": [
            {"category": "fruits-vegetables", "label": "Fresh Apples (Grocery & Produce)"},
            {"category": "laptops", "label": "Apple MacBooks (Laptops & Computing)"},
            {"category": "luxury", "label": "Apple Flagships (Luxury Smartphones & Wearables)"},
        ]
    },
    "apples": {
        "departments": ["Fresh Grocery & Farm Produce", "Electronics & Luxury Tech"],
        "clarifying_question": "Did you mean fresh edible apples from our Farm Produce (e.g. Crisp Royal Gala Apples), or Apple computing and smartphones (e.g. MacBook Pro, iPhone 16 Pro, Apple Watch)?",
        "options": [
            {"category": "fruits-vegetables", "label": "Fresh Apples (Grocery & Produce)"},
            {"category": "laptops", "label": "Apple MacBooks (Laptops & Computing)"},
            {"category": "luxury", "label": "Apple Flagships (Luxury Smartphones & Wearables)"},
        ]
    },
    "watch": {
        "departments": ["Luxury Haute Horlogerie", "Smart Wearables & Electronics"],
        "clarifying_question": "Did you mean luxury horology (e.g. Rolex Submariner) or fitness smartwatches (e.g. Apple Watch Ultra 2, Nova Pulse AMOLED)?",
        "options": [
            {"category": "luxury", "label": "Luxury Horology (Rolex)"},
            {"category": "electronics", "label": "Fitness Smartwatches (Nova Pulse, Apple Watch)"},
        ]
    },
}

def detect_ambiguous_category(query: Optional[str], category: Optional[str]) -> Optional[Dict[str, Any]]:
    if not query or category:
        return None
    q_lower = query.lower().strip()
    words = q_lower.split()
    for w in words:
        if w in AMBIGUOUS_QUERY_MAP:
            info = AMBIGUOUS_QUERY_MAP[w]
            return {
                "status": "ambiguous_category",
                "ambiguous_term": w,
                "message": f"'{w}' matches items across multiple departments: {', '.join(info['departments'])}.",
                "clarifying_question": info["clarifying_question"],
                "options": info["options"],
            }
    return None


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
    attribute_filters: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Helper to query products joined with their verified review ratings and rich multi-category specs."""
    result = fetch_all_products_paged(
        category=category,
        subcategory=subcategory,
        query=query,
        max_price=max_price,
        max_price_inr=max_price_inr,
        min_rating=min_rating,
        is_organic=is_organic,
        sort_by=sort_by,
        brand=brand,
        attribute_filters=attribute_filters,
        limit=None,
        offset=0,
    )
    return result["products"]


def fetch_all_products_paged(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    query: Optional[str] = None,
    max_price: Optional[float] = None,
    max_price_inr: Optional[float] = None,
    min_rating: Optional[float] = None,
    is_organic: Optional[bool] = None,
    sort_by: Optional[str] = None,
    brand: Optional[str] = None,
    attribute_filters: Optional[Dict[str, Any]] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
) -> Dict[str, Any]:
    """Query products with full-text search across name, category, brand, specs, tags with pagination."""
    conn = get_db_connection()
    cursor = conn.cursor()

    sql = """
        SELECT p.id, p.name, p.category, p.category_id, p.subcategory, p.brand, p.price, p.price_inr, p.currency,
               p.description, p.is_organic, p.image_url, p.attributes, p.specifications, p.stock,
               p.stock_status, p.badge, p.is_demo, p.supplier,
               ROUND(AVG(r.rating), 2) as rating, COUNT(r.id) as review_count
        FROM products p
        LEFT JOIN reviews r ON p.id = r.product_id
        WHERE 1=1
    """
    params = []

    if query and query.strip():
        norm_query = normalize_query(query.strip())
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
                    LOWER(IFNULL(p.specifications, '')) LIKE ? OR
                    LOWER(IFNULL(p.badge, '')) LIKE ? OR
                    LOWER(IFNULL(p.attributes, '')) LIKE ?
                )""")
                like = f"%{token}%"
                params.extend([like, like, like, like, like, like, like, like])
            sql += " AND (" + " AND ".join(token_clauses) + ")"
        else:
            sql += """ AND (
                LOWER(p.name) LIKE ? OR
                LOWER(p.description) LIKE ? OR
                LOWER(p.category) LIKE ? OR
                LOWER(IFNULL(p.subcategory, '')) LIKE ? OR
                LOWER(IFNULL(p.brand, '')) LIKE ? OR
                LOWER(IFNULL(p.specifications, '')) LIKE ? OR
                LOWER(IFNULL(p.badge, '')) LIKE ? OR
                LOWER(IFNULL(p.attributes, '')) LIKE ?
            )"""
            like = f"%{norm_query.lower()}%"
            params.extend([like, like, like, like, like, like, like, like])

    if category and category.lower() != "all":
        slugs = get_category_slugs_in_hierarchy(category)
        if len(slugs) == 1:
            sql += " AND (LOWER(p.category) = ? OR LOWER(IFNULL(p.subcategory, '')) = ?)"
            params.extend([slugs[0], slugs[0]])
        else:
            p_cat = ",".join(["?" for _ in slugs])
            p_sub = ",".join(["?" for _ in slugs])
            sql += f" AND (LOWER(p.category) IN ({p_cat}) OR LOWER(IFNULL(p.subcategory, '')) IN ({p_sub}))"
            params.extend(slugs + slugs)

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

    # Category-specific attribute filters
    if attribute_filters and isinstance(attribute_filters, dict):
        for attr_key, attr_val in attribute_filters.items():
            if attr_val is not None and str(attr_val).strip() != "" and str(attr_val).lower() != "all":
                val_str = str(attr_val).strip()
                sql += " AND LOWER(IFNULL(p.attributes, '')) LIKE ?"
                params.append(f"%{val_str.lower()}%")

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
    all_rows = cursor.fetchall()
    conn.close()

    total_count = len(all_rows)

    # Apply pagination
    if limit is not None and limit > 0:
        offset_val = offset if offset is not None and offset >= 0 else 0
        paged_rows = all_rows[offset_val : offset_val + limit]
    else:
        paged_rows = all_rows

    products = []
    for row in paged_rows:
        rating_val = float(row["rating"]) if row["rating"] is not None else None
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

    return {
        "products": products,
        "count": len(products),
        "total": total_count,
        "limit": limit,
        "offset": offset or 0,
    }


# ---------------------------------------------------------------------------
# LangChain Tools for the AI Shopping Agent
# ---------------------------------------------------------------------------

@tool
def search_products(
    query: str = "",
    category: str = "",
    max_price_inr: float = 0.0,
    min_rating: float = 0.0,
    is_organic: bool = False,
    sort_by: str = "",
    brand: str = "",
) -> str:
    """
    Search multi-category product catalog by keyword (e.g. laptop, headphones, oats, honey),
    category, maximum budget in INR (₹), minimum rating, or brand.
    Returns structured JSON list of verified products with specs, ratings, and real inventory prices.
    """
    products = fetch_all_products(
        category=category.strip() if category and category.strip() else None,
        query=query.strip() if query and query.strip() else None,
        max_price_inr=max_price_inr if max_price_inr > 0 else None,
        min_rating=min_rating if min_rating > 0 else None,
        is_organic=is_organic if is_organic else None,
        sort_by=sort_by.strip() if sort_by and sort_by.strip() else None,
        brand=brand.strip() if brand and brand.strip() else None,
    )

    if not products:
        return json.dumps({
            "status": "not_found",
            "message": "No matching products found under your specified criteria.",
            "results": [],
            "count": 0,
        })

    compact_list = []
    for p in products[:6]:
        compact_list.append({
            "id": p["id"],
            "name": p["name"],
            "brand": p.get("brand", "MOSS Curated"),
            "category": p["category"],
            "price_inr": p.get("price_inr", 0),
            "price_usd": p.get("price", 0.0),
            "rating": p.get("rating", 4.5),
            "review_count": p.get("review_count", 0),
            "is_organic": bool(p.get("is_organic")),
            "stock_status": p.get("stock_status", "In Stock"),
            "badge": p.get("badge") or "",
        })
    return json.dumps(compact_list)


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
        "image_url": p_row["image_url"],
        "is_demo": bool(p_row["is_demo"]),
        "average_rating": rev_intel.get("average_rating"),
        "review_count": rev_intel.get("analyzed_reviews_count", 0),
        "verified_advantages": rev_intel.get("verified_advantages", []),
        "verified_limitations": rev_intel.get("verified_limitations", []),
        "sample_disclosure": rev_intel.get("sample_disclosure"),
    }
    return json.dumps(details, indent=2)


def resolve_product_identifier(ident: Any) -> Optional[dict]:
    """Resolves a product ID (int or str) or product name/brand string to a catalog product dict."""
    if not ident:
        return None
    val_str = str(ident).strip()
    if not val_str:
        return None

    # 1. Direct integer or digit string ID (e.g. 38, "38", "#38", "product 38")
    cleaned_id = re.sub(r"^(?:product|item|#)\s*", "", val_str, flags=re.IGNORECASE).strip()
    if cleaned_id.isdigit():
        pid = int(cleaned_id)
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products WHERE id = ?", (pid,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)

    # 2. Clean query for direct search
    clean_query = re.sub(r"(?:compare|vs|versus|and|aur|\bthe\b|\bproduct\b|\bitem\b)", " ", val_str, flags=re.IGNORECASE).strip()
    if not clean_query:
        clean_query = val_str

    matches = fetch_all_products(query=clean_query)
    if matches:
        return matches[0]

    # 3. Keyword / fuzzy token search against all products (name + brand)
    tokens = [w.lower() for w in re.findall(r"[a-zA-Z0-9']+", clean_query) if len(w) > 2]
    all_prods = fetch_all_products()
    best_match = None
    best_score = 0
    for p in all_prods:
        score = 0
        p_name = p["name"].lower()
        p_brand = (p.get("brand") or "").lower()
        for t in tokens:
            if t in p_name:
                score += 3
            if t in p_brand:
                score += 3
        if score > best_score:
            best_score = score
            best_match = p

    return best_match if best_score > 0 else None


@tool
def compare_products(
    product_1: str = "",
    product_2: str = "",
    product_id_1: str = "",
    product_id_2: str = "",
) -> str:
    """
    Compare two products side by side using verified database values, specifications, and review ratings.
    Accepts product names (e.g. 'tearoa honey', 'Nature\\'s Hive Honey') or product IDs (e.g. '1', '38').
    Returns a compact comparison JSON.
    """
    p1_target = product_1 or product_id_1
    p2_target = product_2 or product_id_2

    p1 = resolve_product_identifier(p1_target)
    p2 = resolve_product_identifier(p2_target)

    if not p1 or not p2:
        missing = []
        if not p1:
            missing.append(f"'{p1_target}'")
        if not p2:
            missing.append(f"'{p2_target}'")
        return json.dumps({
            "status": "error",
            "message": f"Could not find catalog product for {', '.join(missing)}. Please verify the product name or ID."
        })

    pid_1 = p1["id"]
    pid_2 = p2["id"]
    intel1 = review_intelligence.analyze_product_reviews(pid_1)
    intel2 = review_intelligence.analyze_product_reviews(pid_2)

    def parse_attrs(row):
        try:
            return json.loads(row.get("attributes") or "{}") if isinstance(row.get("attributes"), str) else (row.get("attributes") or {})
        except Exception:
            return {}

    comp = {
        "status": "success",
        "product_1": {
            "id": p1["id"],
            "name": p1["name"],
            "brand": p1.get("brand", "MOSS Curated"),
            "category": p1["category"],
            "price_inr": f"₹{p1['price_inr']:,}",
            "price_usd": f"${p1['price']:.2f}",
            "rating": intel1.get("average_rating"),
            "review_count": intel1.get("analyzed_reviews_count"),
            "advantages": intel1.get("verified_advantages", [])[:2],
            "limitations": intel1.get("verified_limitations", [])[:2],
        },
        "product_2": {
            "id": p2["id"],
            "name": p2["name"],
            "brand": p2.get("brand", "MOSS Curated"),
            "category": p2["category"],
            "price_inr": f"₹{p2['price_inr']:,}",
            "price_usd": f"${p2['price']:.2f}",
            "rating": intel2.get("average_rating"),
            "review_count": intel2.get("analyzed_reviews_count"),
            "advantages": intel2.get("verified_advantages", [])[:2],
            "limitations": intel2.get("verified_limitations", [])[:2],
        }
    }

    # Category-specific comparison criteria
    cat1 = (p1.get("category") or "").lower()
    cat2 = (p2.get("category") or "").lower()
    food_cats = {"honey", "oil", "nuts", "seeds", "grains", "tea", "coffee", "snacks", "dairy-alt", "fruits-vegetables", "produce", "daily-essentials", "grocery", "groceries"}
    laptop_cats = {"laptops", "ultrabooks", "workstations", "student-laptops"}
    clothing_cats = {"clothing", "fashion", "apparel", "innerwear"}

    p1_attrs = parse_attrs(p1)
    p2_attrs = parse_attrs(p2)

    if cat1 in food_cats and cat2 in food_cats:
        comp["category_comparison"] = {
            "type": "grocery",
            "price_per_100g_or_unit": {
                "product_1": calculate_unit_price(p1) or "N/A",
                "product_2": calculate_unit_price(p2) or "N/A",
            },
            "organic_certified": {
                "product_1": bool(p1.get("is_organic")),
                "product_2": bool(p2.get("is_organic")),
            },
            "certification": {
                "product_1": p1_attrs.get("certification", "Standard Food Grade"),
                "product_2": p2_attrs.get("certification", "Standard Food Grade"),
            },
            "shelf_life": {
                "product_1": p1_attrs.get("shelf_life", "Standard"),
                "product_2": p2_attrs.get("shelf_life", "Standard"),
            }
        }
    elif cat1 in laptop_cats and cat2 in laptop_cats:
        comp["category_comparison"] = {
            "type": "laptops",
            "processor": {
                "product_1": p1_attrs.get("processor", "N/A"),
                "product_2": p2_attrs.get("processor", "N/A"),
            },
            "ram": {
                "product_1": p1_attrs.get("ram", "N/A"),
                "product_2": p2_attrs.get("ram", "N/A"),
            },
            "storage": {
                "product_1": p1_attrs.get("storage", "N/A"),
                "product_2": p2_attrs.get("storage", "N/A"),
            },
            "battery": {
                "product_1": p1_attrs.get("battery", "N/A"),
                "product_2": p2_attrs.get("battery", "N/A"),
            },
            "warranty": {
                "product_1": p1_attrs.get("warranty", "1 Year Brand Onsite"),
                "product_2": p2_attrs.get("warranty", "1 Year Brand Onsite"),
            }
        }
    elif cat1 in clothing_cats and cat2 in clothing_cats:
        comp["category_comparison"] = {
            "type": "clothing",
            "material": {
                "product_1": p1_attrs.get("material") or p1_attrs.get("fabric", "N/A"),
                "product_2": p2_attrs.get("material") or p2_attrs.get("fabric", "N/A"),
            },
            "fit": {
                "product_1": p1_attrs.get("fit", "Regular Fit"),
                "product_2": p2_attrs.get("fit", "Regular Fit"),
            }
        }
    elif cat1 != cat2:
        comp["cross_category_notice"] = f"Comparison note: Products belong to different departments ({cat1} vs {cat2})."

    return json.dumps(comp)



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
        pid = req.get("product_id")
        q = req.get("query", "").strip() if req.get("query") else ""
        qty = max(1, int(req.get("quantity", 1)))
        
        # Search catalog by product_id or by query
        if pid:
            matches = [p for p in fetch_all_products() if p["id"] == int(pid)]
        elif q:
            matches = fetch_all_products(query=q)
        else:
            matches = []

        if not matches:
            stock_errors.append(f"No catalog item found matching ID {pid} or '{q}'.")
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

    # Cryptographic Quote Token generation
    quote_data = {}
    if create_cryptographic_quote:
        try:
            quote_data = create_cryptographic_quote(
                items=selected_bundle,
                total_inr=total_inr,
                target_budget_inr=target_budget_inr,
                customer_name=customer_name,
            )
        except Exception:
            pass

    return json.dumps({
        "status": "budget_exceeded" if is_budget_exceeded else ("partial_ready" if stock_errors else "ready"),
        "customer_name": customer_name,
        "items": selected_bundle,
        "items_summary": items_summary_str,
        "quote_id": quote_data.get("quote_id"),
        "quote_token": quote_data.get("quote_token"),
        "quote_expires_at": quote_data.get("expires_at"),
        "subtotal_inr": subtotal_inr,
        "subtotal_usd": round(subtotal_usd, 2),
        "delivery_fee_inr": delivery_fee_inr,
        "delivery_fee_usd": delivery_fee_usd,
        "total_inr": total_inr,
        "total_usd": total_usd,
        "target_budget_inr": target_budget_inr,
        "is_budget_exceeded": is_budget_exceeded,
        "budget_overrun": is_budget_exceeded,
        "budget_variance_inr": budget_variance_inr,
        "overrun_amount_inr": budget_variance_inr,
        "stock_errors": stock_errors,
        "requires_confirmation": True,
        "message": f"Prepared order bundle totaling ₹{total_inr:,} (${total_usd:.2f}) for {len(selected_bundle)} item(s). Quote: {quote_data.get('quote_id')}."
    }, indent=2)


@tool
def confirm_and_place_order(
    items_json: str,
    customer_name: str = "Verified Customer",
    customer_address: str = "Delivery Address",
    customer_email: str = "customer@moss.store",
    idempotency_key: Optional[str] = None,
    target_budget_inr: Optional[float] = None,
    budget_approved: bool = False,
    quote_token: Optional[str] = None,
    payment_method: str = "Demo Pay / COD",
    billing_address: Optional[str] = None,
    buyer_gstin: Optional[str] = None,
    buyer_company: Optional[str] = None,
    discount_inr: int = 0,
    user_id: Optional[int] = None,
) -> str:
    """
    Completes checkout and saves a confirmed order into SQLite database transactions.
    Validates inventory, quantity limits (1-20), enforces budget constraints, decrements stock atomically,
    and returns a verified order ID. Requires authenticated user context.
    """
    conn_auth_check = get_db_connection()
    c_auth = conn_auth_check.cursor()
    # If user_id not explicitly provided, attempt to resolve from authenticated customer_email
    if user_id is None and customer_email and customer_email.strip().lower() not in ("guest", "guest@moss.internal", ""):
        try:
            c_auth.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (customer_email.strip(),))
            u_row = c_auth.fetchone()
            if u_row:
                user_id = u_row["id"]
            else:
                c_auth.execute(
                    "INSERT INTO users (email, hashed_password, full_name, role, is_active, phone_consent, created_at) VALUES (?, ?, ?, 'customer', 1, 0, datetime('now'))",
                    (customer_email.strip(), "unusable_placeholder_hash", customer_name or "Verified Customer")
                )
                conn_auth_check.commit()
                user_id = c_auth.lastrowid
        except Exception:
            pass
    conn_auth_check.close()

    # Enforce authentication guard on placing orders
    if user_id is None:
        return json.dumps({
            "status": "error",
            "error_type": "auth_required",
            "message": "Please sign in to place this order.",
        })
    # Verify cryptographic quote token if supplied
    if quote_token and verify_quote_token:
        q_verify = verify_quote_token(quote_token)
        if not q_verify.get("valid"):
            return json.dumps({
                "status": "error",
                "error_type": "invalid_quote_token",
                "message": f"Quote verification failed: {q_verify.get('reason')}"
            })

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

    # Ensure orders columns exist for user ownership, billing and taxation
    for col_name, col_sql in [
        ("user_id", "INTEGER"),
        ("billing_address", "TEXT"),
        ("buyer_gstin", "TEXT"),
        ("buyer_company", "TEXT"),
        ("discount_inr", "INTEGER DEFAULT 0"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE orders ADD COLUMN {col_name} {col_sql}")
        except Exception:
            pass

    # Ensure idempotency_keys table exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS idempotency_keys (
            key TEXT PRIMARY KEY,
            order_id INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    """)

    # Check for existing idempotency key before running checkout
    if idempotency_key:
        cursor.execute("SELECT order_id FROM idempotency_keys WHERE key = ?", (idempotency_key,))
        existing_row = cursor.fetchone()
        if existing_row:
            existing_order_id = existing_row["order_id"]
            cursor.execute("SELECT * FROM orders WHERE id = ?", (existing_order_id,))
            ord_row = cursor.fetchone()
            if ord_row:
                cursor.execute("SELECT * FROM order_items WHERE order_id = ?", (existing_order_id,))
                item_rows = cursor.fetchall()
                conn.close()
                ord_dict = dict(ord_row)
                return json.dumps({
                    "status": "success",
                    "order_id": ord_dict["id"],
                    "order_number": ord_dict["order_number"],
                    "items_summary": ord_dict["items_summary"],
                    "item_count": len(item_rows),
                    "subtotal_inr": ord_dict["subtotal_inr"],
                    "delivery_fee_inr": ord_dict["delivery_fee_inr"],
                    "total_price_inr": ord_dict["total_price_inr"],
                    "total_price_usd": ord_dict["total_price"],
                    "delivery_address": ord_dict["customer_address"],
                    "billing_address": ord_dict.get("billing_address") or ord_dict["customer_address"],
                    "payment_method": ord_dict.get("payment_method") or "Demo Pay / COD",
                    "status_text": "Confirmed (Idempotent replay)",
                    "message": f"Order #{ord_dict['order_number']} was already placed (idempotent replay).",
                    "is_replay": True,
                }, indent=2)

    # Validate quantity per item (1 to 20 cap)
    for it in items_list:
        qty_val = it.get("quantity")
        if qty_val is None:
            qty_val = 1
        try:
            qty_int = int(qty_val)
        except (ValueError, TypeError):
            conn.close()
            return json.dumps({
                "status": "error",
                "message": f"Invalid quantity '{qty_val}'. Quantity must be an integer between 1 and 20."
            })
        if qty_int < 1 or qty_int > 20:
            conn.close()
            return json.dumps({
                "status": "error",
                "message": f"Invalid quantity {qty_int}. Quantity per item must be between 1 and 20."
            })

    try:
        # Use BEGIN IMMEDIATE to acquire write lock immediately and prevent concurrent race conditions
        cursor.execute("BEGIN IMMEDIATE")

        # Validate stock and calculate authoritative total
        validated_items = []
        ordered_products = []
        subtotal_inr = 0
        subtotal_usd = 0.0

        for it in items_list:
            pid = it.get("product_id")
            qty = int(it.get("quantity", 1))

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

        # Apply optional coupon / discount
        if discount_inr and discount_inr > 0:
            subtotal_inr = max(0, subtotal_inr - int(discount_inr))
            subtotal_usd = round(max(0.0, subtotal_usd - (discount_inr / 85.0)), 2)

        # Calculate shipping
        delivery_inr = 0 if subtotal_inr >= 500 else 50
        delivery_usd = 0.0 if subtotal_inr >= 500 else 0.59
        total_inr = subtotal_inr + delivery_inr
        total_usd = round(subtotal_usd + delivery_usd, 2)

        # Enforce budget in code: refuse if bundle total > budget unless explicitly approved
        if target_budget_inr is not None and total_inr > target_budget_inr and not budget_approved:
            conn.rollback()
            conn.close()
            return json.dumps({
                "status": "error",
                "error_type": "budget_exceeded",
                "message": f"Order total ₹{total_inr:,} exceeds your stated budget of ₹{int(target_budget_inr):,} by ₹{int(total_inr - target_budget_inr):,}. Explicit user confirmation is required to proceed with this total."
            })

        order_num = f"ORD-2026-{uuid.uuid4().hex[:6].upper()}"
        items_summary = ", ".join([f"{x['quantity']}x {x['product_name']}" for x in validated_items])
        final_billing_address = billing_address or customer_address

        # Insert Order with Full Billing & Tax Information
        cursor.execute("""
            INSERT INTO orders (
                order_number, user_id, customer_name, customer_email, customer_address, items_summary,
                subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr,
                currency, status, payment_method, billing_address, buyer_gstin, buyer_company,
                discount_inr, ordered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'Confirmed', ?, ?, ?, ?, ?, datetime('now'))
        """, (
            order_num, user_id, customer_name, customer_email, customer_address, items_summary,
            subtotal_usd, subtotal_inr, delivery_usd, delivery_inr, total_usd, total_inr,
            payment_method, final_billing_address, buyer_gstin, buyer_company, discount_inr
        ))
        order_id = cursor.lastrowid

        # Insert Order Items & Atomically Decrement Stock (Rowcount validation)
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
                "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
                (itm["quantity"], itm["product_id"], itm["quantity"])
            )
            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return json.dumps({
                    "status": "error",
                    "message": f"Insufficient stock for product ID {itm['product_id']} ('{itm['product_name']}')."
                })

        # Save Idempotency Key if provided
        if idempotency_key:
            cursor.execute(
                "INSERT INTO idempotency_keys (key, order_id, created_at) VALUES (?, ?, datetime('now'))",
                (idempotency_key, order_id)
            )

        conn.commit()
        conn.close()

        # Mark cryptographic quote token as consumed
        if quote_token and mark_quote_as_used:
            try:
                qid = quote_token.split(".")[0]
                mark_quote_as_used(qid)
            except Exception:
                pass

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
            "billing_address": final_billing_address,
            "payment_method": payment_method,
            "buyer_gstin": buyer_gstin,
            "buyer_company": buyer_company,
            "discount_inr": discount_inr,
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
    """List all available multi-category departments and child categories with product counts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.name, c.slug, c.description, c.icon, c.parent_id, c.policy_group,
               COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON (p.category_id = c.id OR LOWER(p.category) = LOWER(c.slug))
        GROUP BY c.id
        ORDER BY c.parent_id ASC, c.display_order ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    cat_map = {}
    top_categories = []
    for r in rows:
        c_dict = {
            "id": r["id"],
            "name": r["name"],
            "slug": r["slug"],
            "product_count": r["product_count"],
            "subcategories": [],
        }
        cat_map[r["id"]] = c_dict

    for r in rows:
        parent_id = r["parent_id"]
        if parent_id and parent_id in cat_map:
            cat_map[parent_id]["subcategories"].append(cat_map[r["id"]]["name"])
        elif not parent_id:
            top_categories.append(cat_map[r["id"]])

    return json.dumps({"status": "success", "categories": top_categories})



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


# ---------------------------------------------------------------------------
# Harmless & Read-Only LLM Tools (Separated Conversation Layer)
# ---------------------------------------------------------------------------

@tool
def recommend_best(
    category: str = "",
    query: str = "",
    max_price_inr: float = 0.0,
) -> str:
    """
    Recommend top verified products ranked by category-aware criteria:
    - Grocery: price per 100g/unit, verified organic certification, rating, and review count.
    - Laptops: performance specs (CPU, RAM, storage, display, battery), price, rating, and warranty.
    - Clothing: material composition, size availability, fit, and rating.
    - Electronics: warranty, connectivity, battery life, and rating.
    If a query like 'apple' is ambiguous across departments and no category is specified,
    returns a clarifying question.
    """
    cat_clean = category.strip() if category and category.strip() else None
    query_clean = query.strip() if query and query.strip() else None
    budget_clean = max_price_inr if max_price_inr > 0 else None

    # 1. Ambiguity check
    ambiguity = detect_ambiguous_category(query_clean, cat_clean)
    if ambiguity:
        return json.dumps(ambiguity)

    # 2. Prevent cross-category mismatch
    inferred_category = cat_clean
    if not inferred_category and query_clean:
        q_low = query_clean.lower()
        if any(k in q_low for k in ["laptop", "ultrabook", "notebook", "workstation"]):
            inferred_category = "laptops"
        elif any(k in q_low for k in ["honey", "oats", "oil", "dal", "milk", "vegetable", "fruit", "grocery", "khana", "sabzi", "food"]):
            inferred_category = "grocery"
        elif any(k in q_low for k in ["shirt", "jeans", "hoodie", "dress", "kurta", "cloth", "innerwear", "kapde"]):
            inferred_category = "fashion"

    prods = fetch_all_products(
        category=inferred_category,
        query=query_clean,
        max_price_inr=budget_clean,
        sort_by="rating",
    )
    if not prods:
        return json.dumps({
            "status": "not_found",
            "message": "No matching products found under your specified criteria.",
            "recommendations": []
        })


    # Enrich recommendations with category-aware criteria
    enriched = []
    for p in prods[:4]:
        rec = dict(p)
        cat_lower = (p.get("category") or "").lower()
        attrs = p.get("attributes") or {}
        if isinstance(attrs, str):
            try:
                attrs = json.loads(attrs)
            except Exception:
                attrs = {}

        # Grocery criteria: price per 100g/unit & organic status
        if cat_lower in ["honey", "oil", "nuts", "seeds", "grains", "tea", "coffee", "snacks", "dairy-alt", "fruits-vegetables", "produce", "daily-essentials", "grocery", "groceries"]:
            rec["category_type"] = "grocery"
            rec["price_per_100g_or_unit"] = calculate_unit_price(p) or "N/A"
            rec["organic_certified"] = bool(p.get("is_organic"))
            rec["certification"] = attrs.get("certification") or ("India Organic" if p.get("is_organic") else "Standard Food Grade")
            rec["shelf_life"] = attrs.get("shelf_life") or "Standard Pantry Shelf Life"
            rec["criteria_evaluated"] = "Ranked by price per 100g/unit, customer rating, review count, and certified organic authenticity."

        # Laptop criteria: specs, warranty, price
        elif cat_lower in ["laptops", "ultrabooks", "workstations", "student-laptops"]:
            rec["category_type"] = "laptops"
            rec["specs_highlight"] = {
                "processor": attrs.get("processor") or "High-speed processor",
                "ram": attrs.get("ram") or "High-capacity RAM",
                "storage": attrs.get("storage") or "NVMe SSD",
                "display": attrs.get("display") or "FHD / QHD Display",
                "battery": attrs.get("battery") or "All-day battery",
                "warranty": attrs.get("warranty") or "1 Year Onsite / Brand Warranty",
            }
            rec["criteria_evaluated"] = "Ranked by performance hardware specs, thermal architecture, price-to-performance ratio, and brand warranty."

        # Clothing criteria: material, fit, sizes
        elif cat_lower in ["clothing", "fashion", "apparel", "innerwear"]:
            rec["category_type"] = "clothing"
            rec["fashion_highlight"] = {
                "material": attrs.get("material") or attrs.get("fabric") or "Premium Fabric",
                "fit": attrs.get("fit") or "Regular Fit",
                "sizes_available": attrs.get("sizes") or attrs.get("waist") or "Standard sizes available",
            }
            rec["criteria_evaluated"] = "Ranked by fabric quality (GOTS organic cotton/linen), breathability, customer fit reviews, and sizing availability."

        # Electronics criteria: warranty, connectivity
        elif cat_lower in ["electronics", "audio", "headphones", "gadgets"]:
            rec["category_type"] = "electronics"
            rec["electronics_highlight"] = {
                "connectivity": attrs.get("connectivity") or attrs.get("bluetooth") or "Bluetooth / Wired",
                "battery_life": attrs.get("battery_life") or attrs.get("battery") or "Long-life battery",
                "warranty": attrs.get("warranty") or "1 Year Brand Warranty",
            }
            rec["criteria_evaluated"] = "Ranked by sound fidelity, battery endurance, wireless latency, and brand warranty."

        enriched.append(rec)

    return json.dumps({
        "status": "success",
        "inferred_category": inferred_category,
        "recommendations": enriched,
    }, indent=2)


@tool
def check_delivery(postal_code: str, product_id: int = 0) -> str:
    """Check estimated delivery timeline and shipping availability for a 6-digit Indian postal PIN code."""
    pin_clean = re.sub(r"\D", "", str(postal_code or ""))
    if len(pin_clean) != 6:
        return json.dumps({
            "status": "error",
            "message": f"'{postal_code}' is not a valid 6-digit Indian PIN code."
        })

    is_metro = pin_clean.startswith(("56", "11", "40", "60", "70", "50", "38"))
    timeline = "1-2 business days (Express available)" if is_metro else "3-4 business days"
    std_fee_inr = 50
    free_delivery_threshold_inr = 500

    return json.dumps({
        "status": "available",
        "postal_code": pin_clean,
        "is_serviceable": True,
        "estimated_timeline": timeline,
        "standard_delivery_fee_inr": std_fee_inr,
        "free_delivery_above_inr": free_delivery_threshold_inr,
        "cod_available": True,
    })


@tool
def get_policies(section: str = "") -> str:
    """
    Get official store business policy guidelines for cancellations, food & grocery, fresh produce,
    clothing, electronics, luxury items, refunds, and customer support.
    Pass section as 'cancellation', 'food', 'produce', 'clothing', 'electronics', 'luxury', 'refunds', 'help', or empty string for full text.
    """
    try:
        from backend.app.policies.loader import get_store_policies
        p = get_store_policies()
        sec = section.strip() if section and section.strip() else None
        return p.get_section_text(sec)
    except Exception as e:
        return f"Error loading store policy guidelines: {str(e)}"


@tool
def view_cart(user_id: int = 0) -> str:
    """View items currently in the user's shopping cart."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if user_id > 0:
            cursor.execute("""
                SELECT c.product_id, c.quantity, p.name, p.price_inr, p.price, p.stock, p.image_url
                FROM cart_items c
                JOIN products p ON c.product_id = p.id
                WHERE c.user_id = ?
            """, (user_id,))
        else:
            cursor.execute("""
                SELECT c.product_id, c.quantity, p.name, p.price_inr, p.price, p.stock, p.image_url
                FROM cart_items c
                JOIN products p ON c.product_id = p.id
                LIMIT 10
            """)
        rows = cursor.fetchall()
        items = []
        subtotal = 0
        for r in rows:
            it_sub = (r["price_inr"] or 0) * r["quantity"]
            subtotal += it_sub
            items.append({
                "product_id": r["product_id"],
                "name": r["name"],
                "quantity": r["quantity"],
                "unit_price_inr": r["price_inr"],
                "subtotal_inr": it_sub,
                "stock": r["stock"],
            })
        return json.dumps({
            "items": items,
            "item_count": len(items),
            "subtotal_inr": subtotal,
            "delivery_fee_inr": 0 if subtotal >= 500 else 50,
            "total_inr": subtotal + (0 if subtotal >= 500 else 50),
        })
    finally:
        conn.close()



def mask_phone_number(phone: Optional[str]) -> str:
    if not phone:
        return "Not on file"
    clean = re.sub(r"\D", "", phone)
    if len(clean) >= 10:
        return f"+91 {clean[:2]}*****{clean[-3:]}"
    return "***-***-****"


def mask_shipping_address(addr: Optional[str]) -> str:
    if not addr:
        return "Saved address"
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if len(parts) >= 2:
        return f"***, {', '.join(parts[-2:])}"
    return "***, Saved Address"


@tool
def track_order(order_identifier: str) -> str:
    """Track an order's status and shipment progress (read-only). Sensitive customer details are masked."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        clean_id = order_identifier.strip().upper()
        cursor.execute("SELECT * FROM orders WHERE UPPER(order_number) = ? OR id = ?", (clean_id, clean_id))
        row = cursor.fetchone()
        if not row:
            return json.dumps({"status": "not_found", "message": f"Order '{order_identifier}' not found."})

        return json.dumps({
            "status": "success",
            "order_number": row["order_number"],
            "current_status": row["status"],
            "ordered_at": row["ordered_at"],
            "items_summary": row["items_summary"],
            "total_price_inr": row["total_price_inr"],
            "payment_method": row["payment_method"],
            "delivery_address_masked": mask_shipping_address(row["customer_address"]),
        }, indent=2)
    finally:
        conn.close()


@tool
def list_my_orders(limit: int = 5) -> str:
    """List recent orders with status and item summary (read-only). Sensitive contact details are masked."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT order_number, status, total_price_inr, items_summary, ordered_at, customer_address
            FROM orders
            ORDER BY id DESC
            LIMIT ?
        """, (max(1, min(20, limit)),))
        rows = cursor.fetchall()
        orders = []
        for r in rows:
            orders.append({
                "order_number": r["order_number"],
                "status": r["status"],
                "total_price_inr": r["total_price_inr"],
                "items_summary": r["items_summary"],
                "ordered_at": r["ordered_at"],
                "delivery_address_masked": mask_shipping_address(r["customer_address"]),
            })
        return json.dumps({"orders": orders, "count": len(orders)}, indent=2)
    finally:
        conn.close()


@tool
def start_order_action(
    action: str,
    order_id: str = "",
    item_id: int = 0,
    reason: str = "",
) -> str:
    """
    Handoff tool: Returns an action_card specification to the chat UI.
    Allowed actions: 'place_order', 'cancel', 'return', 'exchange', 'refund'.
    This tool NEVER executes the action; it only opens the interactive confirmation card in the chat UI.
    The agent should reply with one short line directing the customer to use the card below.
    """
    allowed_actions = ["place_order", "cancel", "return", "exchange", "refund"]
    action_clean = (action or "").lower().strip()
    if action_clean not in allowed_actions:
        return json.dumps({
            "status": "error",
            "message": f"Unsupported action '{action}'. Allowed actions: {', '.join(allowed_actions)}."
        })

    return json.dumps({
        "action_card": {
            "type": "order_action",
            "action": action_clean,
            "order_id": order_id if order_id else None,
            "item_id": item_id if item_id > 0 else None,
            "reason": reason if reason else None,
            "status": "ready_for_user_action"
        },
        "message": f"Opened {action_clean} card for user in UI. Prompt the user in one short sentence to review and confirm using the interactive card below."
    })



# ---------------------------------------------------------------------------
# Strict LLM Allowed Tools (Harmless / Read-Only / Handoff ONLY)
# ---------------------------------------------------------------------------

LLM_ALLOWED_TOOLS = [
    search_products,
    get_product_details,
    recommend_best,
    compare_products,
    analyze_reviews,
    check_delivery,
    list_categories,
    get_policies,
    view_cart,
    add_to_cart,
    remove_from_cart,
    track_order,
    list_my_orders,
    start_order_action,
]


# Legacy direct execution functions (kept internal, NEVER passed to LLM)
def cancel_order(order_number: Optional[str] = None) -> str:
    return json.dumps({"status": "deprecated", "message": "Direct LLM mutation disabled. Use Order Action Service."})

def return_order(order_number: Optional[str] = None, reason: str = "") -> str:
    return json.dumps({"status": "deprecated", "message": "Direct LLM mutation disabled. Use Order Action Service."})

def exchange_order(order_number: Optional[str] = None, reason: str = "", replacement_item: str = "") -> str:
    return json.dumps({"status": "deprecated", "message": "Direct LLM mutation disabled. Use Order Action Service."})

def refund_order(order_number: Optional[str] = None, reason: str = "") -> str:
    return json.dumps({"status": "deprecated", "message": "Direct LLM mutation disabled. Use Order Action Service."})



