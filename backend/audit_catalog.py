import sqlite3
import os
import json
from typing import Dict, Any, List

DB_PATH = os.path.join(os.path.dirname(__file__), "shopai.db")

def run_catalog_audit() -> Dict[str, Any]:
    """
    Comprehensive catalog and database integrity audit.
    Audits products, image URLs, prices, stock levels, attributes, and reviews.
    """
    if not os.path.exists(DB_PATH):
        return {
            "status": "error",
            "message": f"Database file not found at {DB_PATH}",
            "health_score": 0,
        }

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM products")
    products = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM reviews")
    reviews = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM orders")
    orders = [dict(row) for row in cursor.fetchall()]

    conn.close()

    total_products = len(products)
    product_ids = {p["id"] for p in products}
    issues: List[Dict[str, Any]] = []
    seen_images: Dict[str, List[int]] = {}

    valid_products_count = 0

    for p in products:
        p_id = p["id"]
        name = p.get("name", "")
        category = p.get("category", "")
        price = p.get("price")
        price_inr = p.get("price_inr")
        stock = p.get("stock")
        img_url = p.get("image_url", "")
        p_has_issue = False

        # 1. Missing name or category
        if not name or len(name.strip()) < 2:
            issues.append({"type": "missing_name", "product_id": p_id, "detail": "Product name is missing or too short."})
            p_has_issue = True
        if not category or len(category.strip()) < 2:
            issues.append({"type": "missing_category", "product_id": p_id, "detail": "Category is missing."})
            p_has_issue = True

        # 2. Invalid pricing
        if price is None or price <= 0:
            issues.append({"type": "invalid_price_usd", "product_id": p_id, "detail": f"Price USD is non-positive: {price}"})
            p_has_issue = True
        if price_inr is None or price_inr <= 0:
            issues.append({"type": "invalid_price_inr", "product_id": p_id, "detail": f"Price INR is non-positive: {price_inr}"})
            p_has_issue = True

        # 3. Invalid stock
        if stock is None or stock < 0:
            issues.append({"type": "invalid_stock", "product_id": p_id, "detail": f"Stock is invalid or negative: {stock}"})
            p_has_issue = True

        # 4. Image URL checks
        if not img_url or not (img_url.startswith("http://") or img_url.startswith("https://") or img_url.startswith("/")):
            issues.append({"type": "invalid_image_url", "product_id": p_id, "detail": f"Image URL is empty or malformed: '{img_url}'"})
            p_has_issue = True
        else:
            if img_url not in seen_images:
                seen_images[img_url] = []
            seen_images[img_url].append(p_id)

        # 5. Attributes JSON validity
        attrs = p.get("attributes")
        if attrs:
            try:
                json.loads(attrs)
            except Exception:
                issues.append({"type": "invalid_attributes_json", "product_id": p_id, "detail": "Attributes string is not valid JSON."})
                p_has_issue = True

        if not p_has_issue:
            valid_products_count += 1

    # Check duplicate image assignments across different categories
    for img, p_ids in seen_images.items():
        if len(p_ids) > 1:
            # Check if they share the same category (e.g. same honey variety) or mismatch
            prods_sharing = [p for p in products if p["id"] in p_ids]
            cats = {p["category"] for p in prods_sharing}
            if len(cats) > 1:
                issues.append({
                    "type": "cross_category_duplicate_image",
                    "product_ids": p_ids,
                    "detail": f"Image '{img[:50]}...' is reused across conflicting categories: {list(cats)}",
                })

    # 6. Orphan reviews check
    orphan_reviews = 0
    for r in reviews:
        if r["product_id"] not in product_ids:
            issues.append({"type": "orphan_review", "review_id": r["id"], "product_id": r["product_id"], "detail": f"Review points to non-existent product #{r['product_id']}."})
            orphan_reviews += 1

    health_score = round((valid_products_count / max(1, total_products)) * 100, 1) if not issues else max(0, round((1.0 - (len(issues) / (total_products * 2))) * 100, 1))

    report = {
        "status": "healthy" if len(issues) == 0 else "warnings_found",
        "health_score": f"{health_score}%",
        "total_products": total_products,
        "valid_products_count": valid_products_count,
        "total_reviews": len(reviews),
        "total_orders": len(orders),
        "orphan_reviews_count": orphan_reviews,
        "issues_count": len(issues),
        "issues": issues,
        "categories_breakdown": {},
    }

    for p in products:
        c = p.get("category", "uncategorized")
        report["categories_breakdown"][c] = report["categories_breakdown"].get(c, 0) + 1

    return report

if __name__ == "__main__":
    rep = run_catalog_audit()
    print("Catalog Audit Report:")
    print(json.dumps(rep, indent=2))
