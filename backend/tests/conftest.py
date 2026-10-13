import os
import sys
import tempfile
import sqlite3
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import setup_db
import tools
from main import app


@pytest.fixture(scope="session", autouse=True)
def configure_test_env():
    """Configure environment variables for testing."""
    os.environ["ENVIRONMENT"] = "testing"
    os.environ["CORS_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173,https://test.moss.internal"


@pytest.fixture
def test_db_path(tmp_path):
    """Creates a temporary, isolated SQLite database initialized with store schema."""
    db_file = str(tmp_path / "test_shopai.db")
    os.environ["SHOPI_DB_PATH"] = db_file
    tools.DB_PATH = db_file

    # Build schema and seed products
    setup_db.create_database(db_file)
    from backend.app.db.session import init_db
    init_db()

    yield db_file

    # Clean up environment variable
    if "SHOPI_DB_PATH" in os.environ:
        del os.environ["SHOPI_DB_PATH"]


@pytest.fixture
def client(test_db_path):
    """Provides a TestClient connected to the isolated test database."""
    with TestClient(app) as test_client:
        yield test_client


import secrets
import string

def make_random_password(length: int = 16) -> str:
    """Generates a secure random password satisfying complexity requirements."""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "T1!" + "".join(secrets.choice(chars) for _ in range(length - 3))


@pytest.fixture
def random_password() -> str:
    """Provides a fresh, secure random password for test cases."""
    return make_random_password()


@pytest.fixture
def auth_headers(client):
    """Provides valid JWT Bearer auth headers for testing with dynamic credentials."""
    user_email = f"test_user_{secrets.token_hex(4)}@moss.internal"
    user_pw = make_random_password()
    reg_resp = client.post("/api/auth/register", json={
        "email": user_email,
        "password": user_pw,
        "full_name": "Test Fixture User",
        "phone": "9876543210",
    })
    if reg_resp.status_code == 201:
        token = reg_resp.json()["access_token"]
    else:
        login_resp = client.post("/api/auth/login", json={
            "email": user_email,
            "password": user_pw,
        })
        token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def customer_user(client):
    """Dynamically creates a verified customer with random credentials."""
    email = f"cust_{secrets.token_hex(4)}@moss.internal"
    password = make_random_password()
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Dynamic Test Customer",
        "phone": "9876543210",
    })
    token = resp.json()["access_token"]
    return {
        "email": email,
        "password": password,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def admin_user(client):
    """Dynamically creates an administrator user with random credentials."""
    email = f"admin_{secrets.token_hex(4)}@moss.internal"
    password = make_random_password()
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Dynamic Test Admin",
        "phone": "9876543210",
    })
    # Elevate role to admin in database
    conn = tools.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER(?)", (email,))
    conn.commit()
    conn.close()

    # Login to obtain fresh admin claims token
    login_resp = client.post("/api/auth/login", json={
        "email": email,
        "password": password,
    })
    token = login_resp.json()["access_token"]
    return {
        "email": email,
        "password": password,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def admin_auth_headers(admin_user):
    """Provides admin authorization headers."""
    return admin_user["headers"]


