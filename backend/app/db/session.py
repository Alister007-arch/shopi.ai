import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

def get_engine_url() -> str:
    # If SHOPI_DB_PATH is specified by tests, use it
    test_db = os.environ.get("SHOPI_DB_PATH")
    if test_db:
        return f"sqlite:///{os.path.abspath(test_db)}"

    url = settings.DATABASE_URL
    # If a bare filepath was passed, format as sqlite url
    if not (url.startswith("sqlite://") or url.startswith("postgresql://") or url.startswith("postgres://")):
        url = f"sqlite:///{os.path.abspath(url)}"
    return url

def get_engine():
    db_url = get_engine_url()
    is_sqlite = db_url.startswith("sqlite")
    connect_args = {"check_same_thread": False, "timeout": 30.0} if is_sqlite else {}
    return create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True,
        echo=False,
    )

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db(engine_override=None):
    """Initializes schema tables using SQLAlchemy Base metadata."""
    active_engine = engine_override or get_engine()
    Base.metadata.create_all(bind=active_engine)
    # Ensure additive columns for password_reset_codes and users
    try:
        from sqlalchemy import text
        with active_engine.connect() as conn:
            for col, col_type in [("phone", "VARCHAR(50)"), ("channel", "VARCHAR(50) DEFAULT 'email'")]:
                try:
                    conn.execute(text(f"ALTER TABLE password_reset_codes ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            for col, col_type in [("phone_consent", "BOOLEAN DEFAULT 0"), ("phone_consent_at", "DATETIME")]:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
    except Exception:
        pass


def get_db():
    """FastAPI dependency yielding a scoped database session."""
    active_engine = get_engine()
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=active_engine)
    db = session_factory()
    try:
        yield db
    finally:
        db.close()

