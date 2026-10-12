import os
import sqlite3
import logging
from sqlalchemy.orm import Session
from backend.app.db.session import engine, SessionLocal, Base, get_engine, init_db
from backend.app.db.models import User, Product, Category, Order, OrderItem
from backend.app.auth.security import hash_password
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("trovi.seed")


def seed_database(db: Session = None):
    """
    Idempotently sets up tables and seeds initial users and catalog.
    Can be run against SQLite or PostgreSQL.
    """
    active_engine = get_engine()
    init_db(active_engine)

    import sqlalchemy
    try:
        with active_engine.connect() as conn:
            for col_sql in [
                "ALTER TABLE orders ADD COLUMN user_id INTEGER",
                "ALTER TABLE orders ADD COLUMN idempotency_key TEXT",
            ]:
                try:
                    conn.execute(sqlalchemy.text(col_sql))
                    conn.commit()
                except Exception:
                    pass
    except Exception:
        pass

    own_session = False
    if db is None:
        session_factory = sessionmaker(autocommit=False, autoflush=False, bind=active_engine)
        db = session_factory()
        own_session = True

    try:
        # 1. Seed Default Users
        admin = db.query(User).filter(User.email == "admin@moss.internal").first()
        if not admin:
            admin = User(
                email="admin@moss.internal",
                hashed_password=hash_password("Admin@123456"),
                full_name="Trovi Administrator",
                role="admin",
                is_active=True,
            )
            db.add(admin)

        shopper = db.query(User).filter(User.email == "shopper@moss.internal").first()
        if not shopper:
            shopper = User(
                email="shopper@moss.internal",
                hashed_password=hash_password("Shopper@123456"),
                full_name="Aditi Sharma",
                phone="9876543210",
                role="customer",
                is_active=True,
            )
            db.add(shopper)

        db.commit()

        # 2. Check if products exist in SQLAlchemy (sync if missing or upgraded)
        sqlite_path = os.environ.get("SHOPI_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "shopai.db"))
        if not os.path.exists(sqlite_path):
            import backend.setup_db as setup_db
            setup_db.create_database(sqlite_path)

        # Seed categories if missing
        cat_count = db.query(Category).count()
        if cat_count == 0 and os.path.exists(sqlite_path):
            c_conn = sqlite3.connect(sqlite_path)
            c_conn.row_factory = sqlite3.Row
            c_cur = c_conn.cursor()
            try:
                c_cur.execute("SELECT * FROM categories")
                for cr in c_cur.fetchall():
                    cat_obj = Category(
                        id=cr["id"],
                        name=cr["name"],
                        slug=cr["slug"],
                        parent_id=cr["parent_id"] if "parent_id" in cr.keys() else None,
                        policy_group=cr["policy_group"] if "policy_group" in cr.keys() else "default",
                        description=cr["description"] if "description" in cr.keys() else None,
                        display_order=cr["display_order"] if "display_order" in cr.keys() else 1,
                    )
                    db.merge(cat_obj)
                db.commit()
            except Exception as e:
                logger.warning(f"Category seeding note: {e}")
            finally:
                c_conn.close()

        prod_count = db.query(Product).count()
        if prod_count < 136:
            if os.path.exists(sqlite_path):
                conn = sqlite3.connect(sqlite_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM products")
                rows = cursor.fetchall()

                for r in rows:
                    p = Product(
                        id=r["id"],
                        name=r["name"],
                        category=r["category"],
                        category_id=r["category_id"] if "category_id" in r.keys() else None,
                        subcategory=r["subcategory"] if "subcategory" in r.keys() else None,
                        brand=r["brand"] if "brand" in r.keys() else "Trovi Curated",
                        price=float(r["price"]),
                        price_inr=int(r["price_inr"]),
                        currency="INR",
                        description=r["description"],
                        attributes=r["attributes"] if "attributes" in r.keys() else None,
                        specifications=r["specifications"] if "specifications" in r.keys() else None,
                        stock=int(r["stock"]),
                        is_organic=bool(r["is_organic"]),
                        image_url=r["image_url"],
                        badge=r["badge"] if "badge" in r.keys() else None,
                        version=1,
                    )
                    db.merge(p)
                db.commit()
                conn.close()

        logger.info("Database seeding completed successfully.")
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    seed_database()
    print("Database seeding completed.")
