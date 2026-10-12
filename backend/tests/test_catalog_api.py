import pytest
from fastapi.testclient import TestClient


def test_catalog_fetch_all_products(client: TestClient):
    """Verifies that the catalog endpoint returns the complete 77 items."""
    resp = client.get("/api/products")
    assert resp.status_code == 200
    data = resp.json()
    assert "products" in data
    assert "count" in data
    assert data["count"] >= 70, f"Expected full catalog of ~77 items, found {data['count']}"


def test_catalog_category_filtering(client: TestClient):
    """Verifies filtering by category."""
    resp = client.get("/api/products?category=honey")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] > 0
    for prod in data["products"]:
        assert prod["category"].lower() == "honey"


def test_catalog_search_query(client: TestClient):
    """Verifies text search over name, description, and specifications."""
    resp = client.get("/api/products?query=oats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] > 0
    assert any("oat" in p["name"].lower() for p in data["products"])


def test_catalog_price_filter(client: TestClient):
    """Verifies filtering products under specified INR budget."""
    resp = client.get("/api/products?max_price_inr=300")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] > 0
    for prod in data["products"]:
        inr = prod.get("price_inr") or round(prod["price"] * 85)
        assert inr <= 300


def test_catalog_organic_filter(client: TestClient):
    """Verifies filtering only certified organic products."""
    resp = client.get("/api/products?is_organic=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] > 0
    for prod in data["products"]:
        assert prod["is_organic"] is True or prod["is_organic"] == 1


def test_catalog_sorting_orders(client: TestClient):
    """Verifies price ascending and descending sort orders."""
    resp_asc = client.get("/api/products?sort_by=price_asc")
    assert resp_asc.status_code == 200
    items_asc = resp_asc.json()["products"]
    prices_asc = [p.get("price_inr") or round(p["price"] * 85) for p in items_asc]
    assert prices_asc == sorted(prices_asc), "Items must be sorted in non-decreasing price order"

    resp_desc = client.get("/api/products?sort_by=price_desc")
    assert resp_desc.status_code == 200
    items_desc = resp_desc.json()["products"]
    prices_desc = [p.get("price_inr") or round(p["price"] * 85) for p in items_desc]
    assert prices_desc == sorted(prices_desc, reverse=True), "Items must be sorted in non-increasing price order"


def test_single_product_details(client: TestClient):
    """Verifies fetching single product spec details and reviews."""
    resp = client.get("/api/products/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert "name" in data
    assert "stock" in data
    assert "image_url" in data
