"""
Migration script for MOSS Multi-Category Catalog & Policy Groups.
Migrates database schema for `categories` and `products`, seeds category hierarchy tree,
and links existing products to categories table with zero data loss.
"""

import os
import sys
import sqlite3

_backend_dir = os.path.dirname(__file__)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
_root_dir = os.path.dirname(_backend_dir)
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

from backend.app.catalog.categories import get_all_categories_flat, CATEGORY_TREE, get_category_by_slug

DB_PATH = os.environ.get("SHOPI_DB_PATH", os.path.join(os.path.dirname(__file__), "shopai.db"))


def migrate_categories_database(target_db_path: str = None):
    db_file = target_db_path or DB_PATH
    print(f"Starting category tree migration on: {db_file}")
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    # 1. Update categories table schema
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            icon VARCHAR(100),
            parent_id INTEGER,
            policy_group VARCHAR(50) DEFAULT 'default' NOT NULL,
            display_order INTEGER DEFAULT 0 NOT NULL,
            FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
        )
    """)

    # Ensure columns exist if table was already created with fewer columns
    for col_name, col_type in [
        ("parent_id", "INTEGER"),
        ("policy_group", "VARCHAR(50) DEFAULT 'default'"),
        ("display_order", "INTEGER DEFAULT 0"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE categories ADD COLUMN {col_name} {col_type}")
        except sqlite3.OperationalError:
            pass  # Already exists

    # 2. Seed category tree
    flat_cats = get_all_categories_flat()
    for cat in flat_cats:
        cursor.execute("""
            INSERT INTO categories (id, name, slug, description, icon, parent_id, policy_group, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                slug=excluded.slug,
                description=excluded.description,
                icon=excluded.icon,
                parent_id=excluded.parent_id,
                policy_group=excluded.policy_group,
                display_order=excluded.display_order
        """, (
            cat["id"],
            cat["name"],
            cat["slug"],
            cat["description"],
            cat.get("icon"),
            cat["parent_id"],
            cat["policy_group"],
            cat["display_order"],
        ))

    # 3. Ensure products table has category_id column
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)")
    except sqlite3.OperationalError:
        pass  # Already exists

    # 4. Migrate existing products to attach category_id without data loss
    cursor.execute("SELECT id, name, category, subcategory FROM products")
    products = cursor.fetchall()
    print(f"Migrating {len(products)} products to new category tree...")

    # Build slug -> id lookup
    slug_to_id = {c["slug"].lower(): c["id"] for c in flat_cats}
    name_to_id = {c["name"].lower(): c["id"] for c in flat_cats}

    migrated_count = 0
    for pid, pname, pcat, psub in products:
        target_cat_id = None
        pcat_lower = (pcat or "").lower().strip()
        psub_lower = (psub or "").lower().strip()

        # Priority 1: Match subcategory slug/name
        if psub_lower in slug_to_id:
            target_cat_id = slug_to_id[psub_lower]
        elif psub_lower in name_to_id:
            target_cat_id = name_to_id[psub_lower]

        # Priority 2: Match category slug/name
        if not target_cat_id and pcat_lower in slug_to_id:
            target_cat_id = slug_to_id[pcat_lower]
        elif not target_cat_id and pcat_lower in name_to_id:
            target_cat_id = name_to_id[pcat_lower]

        # Priority 3: Fallback mappings for known legacy categories
        if not target_cat_id:
            legacy_map = {
                "laptops": 304, # Laptops
                "laptop": 304,
                "electronics": 3,
                "clothing": 201,
                "apparel": 202,
                "innerwear": 203,
                "honey": 101,
                "oil": 103,
                "nuts": 104,
                "seeds": 105,
                "grains": 106,
                "tea": 107,
                "coffee": 108,
                "snacks": 109,
                "dairy-alt": 110,
                "daily-essentials": 111,
                "fruits-vegetables": 112,
                "produce": 113,
                "groceries": 114,
                "home-kitchen": 5,
                "household": 503,
                "personal-care": 6,
                "luxury": 7,
            }
            target_cat_id = legacy_map.get(pcat_lower)

        # Fallback default
        if not target_cat_id:
            target_cat_id = 1  # Grocery default

        cursor.execute("UPDATE products SET category_id = ? WHERE id = ?", (target_cat_id, pid))
        migrated_count += 1

    conn.commit()

    # Verification checks
    cursor.execute("SELECT count(*) FROM categories")
    cat_count = cursor.fetchone()[0]

    cursor.execute("SELECT count(*) FROM products WHERE category_id IS NOT NULL")
    mapped_prod_count = cursor.fetchone()[0]

    cursor.execute("SELECT count(*) FROM products WHERE category_id IS NULL")
    unmapped_prod_count = cursor.fetchone()[0]

    print(f"Migration completed successfully:")
    print(f"  Total categories in tree: {cat_count}")
    print(f"  Products mapped: {mapped_prod_count}")
    print(f"  Unmapped products: {unmapped_prod_count}")

    conn.close()
    return True


if __name__ == "__main__":
    migrate_categories_database()
