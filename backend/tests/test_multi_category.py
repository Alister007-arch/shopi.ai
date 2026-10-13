"""
Tests for MOSS Multi-Category Architecture, Catalog Structure,
Policy Group Resolution, Dynamic Attribute Filtering, and Category-Aware Agent Routing.
"""

import json
import io
import pytest
from fastapi.testclient import TestClient
import secrets
from backend.tests.conftest import make_random_password
from backend.app.catalog.categories import CATEGORY_TREE, CATEGORY_ATTRIBUTE_SCHEMAS
from backend.app.policies.loader import get_store_policies
import tools


def get_admin_auth_headers(client: TestClient) -> dict:
    """Helper to dynamically create an admin user and obtain authorization headers."""
    email = f"admin_{secrets.token_hex(4)}@moss.internal"
    pw = make_random_password()
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": pw,
        "full_name": "Dynamic Admin",
        "phone": "9876543210",
    })
    assert resp.status_code == 201, f"Admin register failed: {resp.text}"
    conn = tools.get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE users SET role = 'admin' WHERE LOWER(email) = LOWER(?)", (email,))
    conn.commit()
    conn.close()
    login_resp = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_category_hierarchy_structure():
    """Verify that all 7 top-level departments exist and have defined child subcategories."""
    expected_departments = [
        "grocery",
        "fashion",
        "electronics",
        "laptops",
        "home-kitchen",
        "personal-care",
        "luxury",
    ]
    actual_departments = [dept["slug"] for dept in CATEGORY_TREE]
    for dept in expected_departments:
        assert dept in actual_departments, f"Department '{dept}' missing from CATEGORY_TREE"

    # Verify each category has a valid policy group
    store_config = get_store_policies()
    available_groups = set(store_config.categories.keys())

    for dept in CATEGORY_TREE:
        assert dept["policy_group"] in available_groups, (
            f"Department {dept['slug']} has invalid policy_group {dept['policy_group']}"
        )
        for sub in dept.get("children", []):
            assert sub["policy_group"] in available_groups, (
                f"Subcategory {sub['slug']} has invalid policy_group {sub['policy_group']}"
            )


def test_category_attribute_schemas():
    """Verify attribute schemas exist for all 7 main departments."""
    for schema_key in ["grocery", "clothing", "laptops", "electronics", "home_kitchen", "personal_care", "luxury"]:
        assert schema_key in CATEGORY_ATTRIBUTE_SCHEMAS, f"Missing schema key {schema_key}"
        fields = CATEGORY_ATTRIBUTE_SCHEMAS[schema_key]
        assert isinstance(fields, list)
        assert len(fields) > 0, f"Empty attribute schema for {schema_key}"


def test_database_category_mapping(test_db_path):
    """Verify that all products in test database have category_id mapped without orphan records."""
    import sqlite3
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()

    # Check that categories table has rows
    cur.execute("SELECT COUNT(*) FROM categories")
    cat_count = cur.fetchone()[0]
    assert cat_count >= 30, f"Expected at least 30 categories, found {cat_count}"

    # Check products table
    cur.execute("SELECT COUNT(*), COUNT(category_id) FROM products")
    total_prod, mapped_prod = cur.fetchone()
    assert total_prod > 0
    assert total_prod == mapped_prod, f"Found unmapped products: {total_prod - mapped_prod}"

    # Verify every product category_id points to an existing category
    cur.execute("""
        SELECT p.id, p.name, p.category, p.category_id
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE c.id IS NULL
    """)
    orphans = cur.fetchall()
    assert len(orphans) == 0, f"Found products with invalid category_id: {orphans}"
    conn.close()


def test_policy_group_resolution():
    """Verify category policy lookup correctly differentiates laptops, groceries, innerwear, etc."""
    config = get_store_policies()

    # 1. Laptops policy group: replacement first, human review required, 7-day window
    laptop_policy, is_iw, key = config.resolve_by_policy_group("laptops")
    assert laptop_policy.replace_first is True, "Laptops must be replacement-first"
    assert config.approvals.laptops_always_human_review is True, "Laptops must require human review"
    assert laptop_policy.window_days == 7

    # 2. Fresh produce policy group: 24 hours / 1 day, photo required
    produce_policy, is_iw, key = config.resolve_by_policy_group("fresh_produce")
    assert produce_policy.window_days == 1
    assert produce_policy.photo_required is True

    # 3. Innerwear policy group: non-returnable once opened
    innerwear_policy, is_iw, key = config.resolve_by_policy_group("innerwear")
    assert innerwear_policy.allow_change_of_mind is False
    assert is_iw is True

    # 4. Standard clothing: 7 days, unworn with tags
    clothing_policy, is_iw, key = config.resolve_by_policy_group("clothing")
    assert clothing_policy.window_days == 7
    assert clothing_policy.replace_first is False

    # 5. Fallback group
    default_policy, is_iw, key = config.resolve_by_policy_group("unknown_group")
    assert key == "default"


def test_hierarchical_category_expansion(test_db_path):
    """Test that querying a parent category like 'laptops' returns items in child categories."""
    results = tools.fetch_all_products_paged(category="laptops", limit=50)
    laptop_products = results.get("products", [])
    assert len(laptop_products) > 0, "Expected laptop products when querying 'laptops' parent slug"

    # All returned products should belong to laptops or its subcategories
    for p in laptop_products:
        cat_lower = p["category"].lower()
        assert any(term in cat_lower for term in ["laptop", "ultrabook", "gaming", "workstation", "notebook"]), (
            f"Unexpected product category '{p['category']}' returned for laptops query"
        )


def test_category_attribute_filtering(test_db_path):
    """Test filtering by category-specific JSON attributes."""
    # Filter laptops by RAM attribute
    laptop_filtered = tools.fetch_all_products_paged(
        category="laptops",
        attribute_filters={"ram": "32GB"},
        limit=20
    )
    products = laptop_filtered.get("products", [])
    for p in products:
        attrs = p.get("attributes", {})
        if isinstance(attrs, str):
            attrs = json.loads(attrs)
        assert "32GB" in str(attrs.get("ram", "")) or "32GB" in str(attrs)


def test_unit_price_calculation():
    """Verify unit price helper computes price per 100g or 100ml correctly."""
    # 500g jar of honey for 450 INR -> ₹90.0 / 100g
    up1 = tools.calculate_unit_price({
        "name": "MOSS Wild Raw Honey",
        "price_inr": 450,
        "description": "Pure raw forest honey in a 500g glass jar",
    })
    assert up1 == "₹90.0 / 100g"

    # 1kg pack of oats for 240 INR -> ₹24.0 / 100g
    up2 = tools.calculate_unit_price({
        "name": "MOSS Rolled Oats",
        "price_inr": 240,
        "attributes": json.dumps({"weight": "1kg"}),
    })
    assert up2 == "₹24.0 / 100g"

    # Non-food or no weight item -> None
    up3 = tools.calculate_unit_price({
        "name": "MOSS UltraBook Pro",
        "price_inr": 99999,
        "description": "Intel Core Ultra 7 laptop",
    })
    assert up3 is None


def test_organic_trust_claims_restricted(test_db_path):
    """Verify organic claims ('certified organic') only apply to organic products."""
    all_prods = tools.fetch_all_products_paged(limit=150).get("products", [])

    organic_prods = [p for p in all_prods if p.get("is_organic") is True]
    non_organic_prods = [p for p in all_prods if not p.get("is_organic")]

    assert len(organic_prods) > 0, "Expected organic products in catalog"
    assert len(non_organic_prods) > 0, "Expected non-organic products in catalog"

    # Laptops and electronics must NEVER be marked organic
    tech_prods = [
        p for p in all_prods
        if any(t in p["category"].lower() for t in ["laptop", "electronic", "audio", "headphone"])
    ]
    for p in tech_prods:
        assert not p.get("is_organic"), f"Tech item '{p['name']}' illegally marked organic!"


def test_agent_ambiguous_category_disambiguation():
    """Verify detect_ambiguous_category identifies cross-category terms and suggests clarifications."""
    # 'apple' -> Fresh Produce vs Apple Laptops/Tech
    amb_apple = tools.detect_ambiguous_category("I want to buy an apple", None)
    assert amb_apple is not None
    assert "clarifying_question" in amb_apple
    options_text = " ".join([o.get("label", "") for o in amb_apple.get("options", [])])
    assert "Produce" in options_text or "Fresh" in options_text
    assert "MacBook" in options_text or "Computing" in options_text

    # 'watch' -> Smartwatch vs Luxury Watch
    amb_watch = tools.detect_ambiguous_category("Show me a watch under 50000", None)
    assert amb_watch is not None
    assert "clarifying_question" in amb_watch

    # Unambiguous query
    unamb = tools.detect_ambiguous_category("Pure raw mustard oil", None)
    assert unamb is None


def test_recommend_and_search_category_aware(test_db_path):
    """Verify search_products evaluates products according to category-specific criteria."""
    # Grocery query: searches honey within budget
    raw_grocery = tools.search_products.invoke({"query": "honey", "category": "honey", "max_price_inr": 1000})
    grocery_data = json.loads(raw_grocery)
    assert len(grocery_data) > 0
    top_grocery = grocery_data[0]
    assert "honey" in top_grocery["category"].lower()

    # Laptop query: searches laptops within budget
    raw_laptop = tools.search_products.invoke({"query": "laptop", "category": "laptops", "max_price_inr": 150000})
    laptop_data = json.loads(raw_laptop)
    assert len(laptop_data) > 0
    top_laptop = laptop_data[0]
    assert any(term in top_laptop["category"].lower() for term in ["laptop", "ultrabook", "gaming", "workstation"])

    # Strict isolation: Asking for grocery category must NOT return laptops
    raw_grocery_only = tools.search_products.invoke({"category": "honey"})
    grocery_only_data = json.loads(raw_grocery_only)
    for p in grocery_only_data:
        assert "laptop" not in p["category"].lower()


def test_compare_products_category_comparison(test_db_path):
    """Verify compare_products provides side-by-side comparison with category-specific criteria."""
    import sqlite3
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()
    cur.execute("SELECT id FROM products WHERE category LIKE '%laptop%' LIMIT 2")
    laptop_rows = cur.fetchall()
    conn.close()

    if len(laptop_rows) >= 2:
        id1, id2 = laptop_rows[0][0], laptop_rows[1][0]
        raw_cmp = tools.compare_products.invoke({"product_id_1": str(id1), "product_id_2": str(id2)})
        cmp_result = json.loads(raw_cmp)
        assert "product_1" in cmp_result
        assert "product_2" in cmp_result
        assert "category_comparison" in cmp_result
        assert cmp_result["category_comparison"]["type"] == "laptops"
        assert "processor" in cmp_result["category_comparison"]
        assert "ram" in cmp_result["category_comparison"]


def test_hinglish_and_english_routing_intent(test_db_path):
    """Verify agent search and filter handles English and Hinglish domain queries."""
    # Hinglish query 1: "Mujhe coding ke liye laptop chahiye"
    laptop_res = tools.fetch_all_products_paged(query="laptop", category="laptops")
    assert len(laptop_res["products"]) > 0

    # Hinglish query 2: "Sabse accha pure honey konsa hai"
    honey_res = tools.fetch_all_products_paged(query="honey", category="honey")
    assert len(honey_res["products"]) > 0
    assert honey_res["products"][0]["category"] == "honey"

    # Hinglish query 3: "Pure cotton shirt"
    cotton_res = tools.fetch_all_products_paged(query="cotton")
    assert len(cotton_res["products"]) > 0
    assert any("cloth" in p["category"].lower() or "fashion" in p["category"].lower() for p in cotton_res["products"])


def test_api_categories_tree_endpoint(client):
    """Verify GET /api/categories/tree returns the complete 7-department hierarchy."""
    res = client.get("/api/categories/tree")
    assert res.status_code == 200
    data = res.json()
    assert "departments" in data
    assert len(data["departments"]) == 7

    slugs = [d["slug"] for d in data["departments"]]
    for expected in ["grocery", "fashion", "electronics", "laptops", "home-kitchen", "personal-care", "luxury"]:
        assert expected in slugs


def test_api_categories_schema_endpoint(client):
    """Verify GET /api/categories/schema returns attribute schemas for filtering."""
    res = client.get("/api/categories/schema?category=laptops")
    assert res.status_code == 200
    data = res.json()
    assert data["category"] == "laptops"
    assert "fields" in data
    keys = [f["key"] for f in data["fields"]]
    assert "ram" in keys or "processor" in keys


def test_admin_csv_export_and_import(client):
    """Verify CSV export and import endpoints handle multi-category products with attributes."""
    admin_headers = get_admin_auth_headers(client)

    # 1. Export CSV
    export_res = client.get("/api/admin/catalog/export-csv", headers=admin_headers)
    assert export_res.status_code == 200
    csv_text = export_res.text
    assert "name" in csv_text and "price_inr" in csv_text and "category" in csv_text and "ram" in csv_text

    # 2. Import CSV with a new laptop and organic honey
    new_csv = (
        "name,category,brand,price_inr,stock,description,image_url,is_organic,category_id,attributes\n"
        'MOSS DevBook Pro,laptops,MOSS Tech,139999,10,M3 Max Power,/products/laptop1.webp,false,15,"{""ram"": ""64GB"", ""storage"": ""1TB SSD""}"\n'
        'MOSS Wild Raw Jamun Honey,honey,MOSS Organics,650,20,Raw mono-floral jamun honey,/products/honey_jamun.webp,true,8,"{""purity"": ""100% Raw""}"\n'
    )
    files = {"file": ("new_catalog.csv", io.BytesIO(new_csv.encode("utf-8")), "text/csv")}
    import_res = client.post("/api/admin/catalog/import-csv", headers=admin_headers, files=files)
    assert import_res.status_code == 200
    import_data = import_res.json()
    assert import_data["created_count"] + import_data["updated_count"] >= 2
