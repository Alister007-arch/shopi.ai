"""
Utility script to migrate data from local SQLite database into PostgreSQL.
Usage:
    export DATABASE_URL="postgresql+psycopg2://moss_user:moss_secure_password_2026@localhost:5432/moss_db"
    python scripts/migrate_sqlite_to_pg.py
"""

import os
import sys
import sqlite3
import argparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to sys.path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.app.db.models import Base, Product, User, Order, OrderItem, IdempotencyKey
from backend.app.auth.security import hash_password


def run_migration(sqlite_file: str, pg_url: str):
    if not os.path.exists(sqlite_file):
        print(f"Error: SQLite source file '{sqlite_file}' not found.")
        sys.exit(1)

    print(f"Connecting to source SQLite: {sqlite_file}")
    conn_sqlite = sqlite3.connect(sqlite_file)
    conn_sqlite.row_factory = sqlite3.Row
    c_sqlite = conn_sqlite.cursor()

    print(f"Connecting to target PostgreSQL: {pg_url}")
    engine_pg = create_engine(pg_url, echo=False)
    Base.metadata.create_all(bind=engine_pg)
    SessionPg = sessionmaker(bind=engine_pg)
    session_pg = SessionPg()

    try:
        # 1. Migrate Products
        c_sqlite.execute("SELECT * FROM products")
        products = c_sqlite.fetchall()
        print(f"Migrating {len(products)} products...")
        for p in products:
            p_obj = Product(
                id=p["id"],
                name=p["name"],
                category=p["category"],
                subcategory=p["subcategory"] if "subcategory" in p.keys() else None,
                brand=p["brand"] if "brand" in p.keys() else "Trovi Curated",
                price=float(p["price"]),
                price_inr=int(p["price_inr"]),
                currency=p["currency"] if "currency" in p.keys() else "INR",
                description=p["description"],
                specifications=p["specifications"] if "specifications" in p.keys() else None,
                stock=int(p["stock"]),
                is_organic=bool(p["is_organic"]),
                image_url=p["image_url"],
                badge=p["badge"] if "badge" in p.keys() else None,
                version=1,
            )
            session_pg.merge(p_obj)
        session_pg.commit()
        print(f"Successfully migrated {len(products)} products.")

        # 2. Seed Default Users if none
        if session_pg.query(User).count() == 0:
            print("Seeding initial administrator and demo customer...")
            admin = User(
                email="admin@moss.internal",
                hashed_password=hash_password("Admin@123456"),
                full_name="Trovi Administrator",
                role="admin",
                is_active=True,
            )
            shopper = User(
                email="shopper@moss.internal",
                hashed_password=hash_password("Shopper@123456"),
                full_name="Aditi Sharma",
                phone="9876543210",
                role="customer",
                is_active=True,
            )
            session_pg.add(admin)
            session_pg.add(shopper)
            session_pg.commit()
            print("Users seeded.")

        # 3. Migrate Orders & Order Items
        c_sqlite.execute("SELECT * FROM orders")
        orders = c_sqlite.fetchall()
        print(f"Migrating {len(orders)} orders...")
        for o in orders:
            order_obj = Order(
                id=o["id"],
                order_number=o["order_number"],
                customer_name=o["customer_name"],
                customer_email=o["customer_email"],
                customer_address=o["customer_address"],
                items_summary=o["items_summary"],
                subtotal=float(o["subtotal"]),
                subtotal_inr=int(o["subtotal_inr"]),
                delivery_fee=float(o["delivery_fee"]),
                delivery_fee_inr=int(o["delivery_fee_inr"]),
                total_price=float(o["total_price"]),
                total_price_inr=int(o["total_price_inr"]),
                currency=o["currency"] if "currency" in o.keys() else "INR",
                status=o["status"] if "status" in o.keys() else "Confirmed",
                payment_method=o["payment_method"] if "payment_method" in o.keys() else "COD",
            )
            session_pg.merge(order_obj)

        c_sqlite.execute("SELECT * FROM order_items")
        order_items = c_sqlite.fetchall()
        for oi in order_items:
            oi_obj = OrderItem(
                id=oi["id"],
                order_id=oi["order_id"],
                product_id=oi["product_id"],
                product_name=oi["product_name"],
                unit_price=float(oi["unit_price"]),
                unit_price_inr=int(oi["unit_price_inr"]),
                quantity=int(oi["quantity"]),
                total_price=float(oi["total_price"]),
                total_price_inr=int(oi["total_price_inr"]),
            )
            session_pg.merge(oi_obj)

        session_pg.commit()
        print("Migration complete!")
    except Exception as e:
        session_pg.rollback()
        print(f"Migration error: {e}")
        raise
    finally:
        session_pg.close()
        conn_sqlite.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate SQLite to PostgreSQL")
    parser.add_argument("--sqlite", default=os.path.join(ROOT_DIR, "backend", "shopai.db"), help="Path to SQLite DB")
    parser.add_argument("--pg-url", default=os.getenv("DATABASE_URL", "postgresql://moss_user:moss_secure_password_2026@localhost:5432/moss_db"), help="PostgreSQL connection URL")
    args = parser.parse_args()

    run_migration(args.sqlite, args.pg_url)
