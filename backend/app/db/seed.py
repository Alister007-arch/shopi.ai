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
        # 1. Administrator Account from Environment Variables
        app_env = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower().strip()
        demo_mode = os.getenv("DEMO_MODE", "false").lower().strip() in ("true", "1", "yes")

        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        admin_password_reset = os.getenv("ADMIN_PASSWORD_RESET", "false").lower().strip() in ("true", "1", "yes")

        if admin_email and admin_password and admin_email.strip() and admin_password.strip():
            clean_admin_email = admin_email.strip().lower()
            existing_admin = db.query(User).filter(User.email == clean_admin_email).first()
            if not existing_admin:
                admin = User(
                    email=clean_admin_email,
                    hashed_password=hash_password(admin_password.strip()),
                    full_name="Trovi Administrator",
                    role="admin",
                    is_active=True,
                )
                db.add(admin)
                logger.info(f"[DB Seed] Created initial administrator account for '{clean_admin_email}'.")
            elif admin_password_reset:
                existing_admin.hashed_password = hash_password(admin_password.strip())
                existing_admin.role = "admin"
                existing_admin.is_active = True
                logger.info(f"[DB Seed] Synchronized administrator password for '{clean_admin_email}' (ADMIN_PASSWORD_RESET=true).")
            else:
                logger.info(f"[DB Seed] Existing administrator '{clean_admin_email}' preserved. Set ADMIN_PASSWORD_RESET=true to overwrite password.")
        else:
            logger.warning(
                "[DB Seed Warning] ADMIN_EMAIL or ADMIN_PASSWORD not configured. Initial admin account creation skipped. (No default password, in every environment)"
            )

        # 2. Demo Users (Created ONLY when APP_ENV in ('dev', 'development') and DEMO_MODE=true)
        if app_env in ("dev", "development") and demo_mode:
            import secrets
            import string

            def _gen_random_pw(length: int = 16) -> str:
                chars = string.ascii_letters + string.digits + "!@#$%^&*"
                return "".join(secrets.choice(chars) for _ in range(length))

            demo_admin = db.query(User).filter(User.email == "admin@moss.internal").first()
            if not demo_admin:
                demo_admin_pw = _gen_random_pw()
                demo_admin = User(
                    email="admin@moss.internal",
                    hashed_password=hash_password(demo_admin_pw),
                    full_name="Trovi Administrator (Demo)",
                    role="admin",
                    is_active=True,
                )
                db.add(demo_admin)
                print(
                    f"\n[DEMO MODE INITIALIZED]\nDemo Admin: admin@moss.internal | Generated Password: {demo_admin_pw}\nNever use demo accounts in production.\n",
                    flush=True,
                )

            demo_shopper = db.query(User).filter(User.email == "shopper@moss.internal").first()
            if not demo_shopper:
                demo_shopper_pw = _gen_random_pw()
                demo_shopper = User(
                    email="shopper@moss.internal",
                    hashed_password=hash_password(demo_shopper_pw),
                    full_name="Aditi Sharma (Demo)",
                    phone="9876543210",
                    role="customer",
                    is_active=True,
                )
                db.add(demo_shopper)
                print(
                    f"[DEMO MODE INITIALIZED]\nDemo Shopper: shopper@moss.internal | Generated Password: {demo_shopper_pw}\n",
                    flush=True,
                )

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
