"""
Reviews API — reads from the `reviews` table in store.db/shopai.db and returns
aggregated rating information and evidence-based review intelligence for products.
"""

import sqlite3
import os
import sys

# Support both store.db and shopai.db
DB_DIR = os.path.dirname(__file__)
STORE_DB_PATH = os.path.join(DB_DIR, "store.db")
SHOPAI_DB_PATH = os.path.join(os.path.dirname(DB_DIR), "backend", "shopai.db")

def get_db_path() -> str:
    if os.path.exists(SHOPAI_DB_PATH):
        return SHOPAI_DB_PATH
    return STORE_DB_PATH


def get_product_rating(product_id: int) -> dict:
    """Return average rating and review count for a single product."""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT AVG(rating), COUNT(*) FROM reviews WHERE product_id = ?",
        (product_id,),
    )
    row = cursor.fetchone()
    conn.close()

    avg = round(row[0], 2) if row and row[0] is not None else 0.0
    count = row[1] if row else 0
    return {"product_id": product_id, "average_rating": avg, "review_count": count}


def get_ratings_for_products(product_ids: list[int]) -> list[dict]:
    """Return ratings for a list of product IDs."""
    if not product_ids:
        return []
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    placeholders = ",".join("?" * len(product_ids))
    cursor.execute(
        f"""
        SELECT product_id, AVG(rating), COUNT(*)
        FROM reviews
        WHERE product_id IN ({placeholders})
        GROUP BY product_id
        """,
        product_ids,
    )
    rows = cursor.fetchall()
    conn.close()

    ratings_map = {r[0]: {"average_rating": round(r[1], 2), "review_count": r[2]} for r in rows}
    return [
        {
            "product_id": pid,
            "average_rating": ratings_map.get(pid, {}).get("average_rating", 0.0),
            "review_count":   ratings_map.get(pid, {}).get("review_count", 0),
        }
        for pid in product_ids
    ]


def get_review_intelligence(product_id: int) -> dict:
    """
    Delegates to backend.review_intelligence for full evidence synthesis,
    theme extraction, sample size disclosures, and verbatim citations.
    """
    backend_dir = os.path.join(os.path.dirname(DB_DIR), "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    try:
        import review_intelligence
        return review_intelligence.analyze_product_reviews(product_id)
    except Exception as e:
        return {"error": str(e), "product_id": product_id}


if __name__ == "__main__":
    result = get_product_rating(1)
    print("Single product rating:")
    print(f"  Product {result['product_id']}: {result['average_rating']} stars ({result['review_count']} reviews)")

    intel = get_review_intelligence(1)
    print("\nReview Intelligence Summary:")
    print(" ", intel.get("evidence_summary"))
