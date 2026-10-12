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


@pytest.fixture
def auth_headers(client):
    """Provides valid JWT Bearer auth headers for testing."""
    reg_resp = client.post("/api/auth/register", json={
        "email": "test_fixture_user@moss.eco",
        "password": "Password@123456",
        "full_name": "Test Fixture User",
        "phone": "9876543210",
    })
    if reg_resp.status_code == 201:
        token = reg_resp.json()["access_token"]
    else:
        login_resp = client.post("/api/auth/login", json={
            "email": "test_fixture_user@moss.eco",
            "password": "Password@123456",
        })
        token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

