import pytest
from fastapi.testclient import TestClient


def test_search_by_exact_name(client: TestClient):
    """Verifies search finds a product by exact full title."""
    resp = client.get("/api/products?q=Alphonso Mangoes (1kg Box)")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert any("alphonso mango" in p["name"].lower() for p in data["products"])


def test_search_by_partial_name_mango(client: TestClient):
    """Verifies searching 'mango' finds both fresh and dried mango products."""
    resp = client.get("/api/products?q=mango")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 2, f"Expected at least 2 mango products, got {data['count']}"
    for p in data["products"]:
        match = "mango" in p["name"].lower() or "mango" in (p.get("description") or "").lower()
        assert match, f"Product {p['name']} should match 'mango'"


def test_search_by_category_filter(client: TestClient):
    """Verifies searching with a category filter returns products in that category."""
    resp = client.get("/api/products?category=fruits-vegetables")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] > 0
    for p in data["products"]:
        assert p["category"].lower() == "fruits-vegetables"


def test_search_typo_tolerance_mago(client: TestClient):
    """Verifies searching small typo 'mago' resolves to 'mango' products."""
    resp = client.get("/api/products?q=mago")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert any("mango" in p["name"].lower() for p in data["products"])


def test_search_unknown_term_returns_empty_list_cleanly(client: TestClient):
    """Verifies that an unknown search term returns HTTP 200 with an empty list and no 500 error."""
    resp = client.get("/api/products?q=xyznotexist999nonexistent")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0
    assert data["products"] == []
    assert data["total"] == 0


def test_search_q_and_query_aliases(client: TestClient):
    """Verifies both ?q=... and ?query=... query parameters return identical results."""
    resp_q = client.get("/api/products?q=honey")
    resp_query = client.get("/api/products?query=honey")
    assert resp_q.status_code == 200
    assert resp_query.status_code == 200
    data_q = resp_q.json()
    data_query = resp_query.json()
    assert data_q["count"] == data_query["count"]
    assert len(data_q["products"]) == len(data_query["products"])


def test_search_pagination_limit_and_offset(client: TestClient):
    """Verifies search results support pagination with limit and offset."""
    resp_paged1 = client.get("/api/products?q=mango&limit=1&offset=0")
    assert resp_paged1.status_code == 200
    data1 = resp_paged1.json()
    assert len(data1["products"]) == 1
    assert data1["total"] >= 2

    resp_paged2 = client.get("/api/products?q=mango&limit=1&offset=1")
    assert resp_paged2.status_code == 200
    data2 = resp_paged2.json()
    assert len(data2["products"]) == 1
    # Different product returned on page 2
    assert data1["products"][0]["id"] != data2["products"][0]["id"]
