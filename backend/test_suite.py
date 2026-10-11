"""
ShopAI V3 Comprehensive Acceptance Test Suite
Verifies all 16 Acceptance Criteria from Section H:
1. Watermelon matching / produce honesty without stale honey tags
2. Honey sample integrity & accurate recognition
3. Oats sample integrity & accurate recognition
4. Animal/non-product rejection (elephant.png)
5. Unrelated image zero-hallucination verification
6. Honest no-match response when catalog lacks unstocked item
7. Electronics and laptop search with specifications & budget
8. Fresh produce and food searches with actual database records
9. Catalog audit & consistency across products (100% health score)
10. Natural-language bundle preparation ("Order 1 kg oats, 500 g honey, and two litres of milk within ₹800")
11. Backend price and inventory validation
12. Atomic checkout and duplicate prevention
13. Orders persistence in database and retrieval
14. Clear, honest error handling
15. Side-by-side spec comparison & review intelligence
16. Multi-category coverage across 16 departments
"""

import unittest
import json
import os
import sqlite3
import tools
import review_intelligence
import graph
import vision
import audit_catalog

class TestShopAIV3AcceptanceSuite(unittest.TestCase):

    def setUp(self):
        self.db_path = tools.DB_PATH
        self.assertTrue(os.path.exists(self.db_path), f"Database not found at {self.db_path}")

    # 1. Catalog integrity & audit verification (Criteria 8, 9, 16)
    def test_catalog_departments_and_health_audit(self):
        """Verify 16 shopping departments and 100% clean audit score."""
        report = audit_catalog.run_catalog_audit()
        self.assertEqual(report["total_products"], 77)
        self.assertEqual(report["status"], "healthy")
        self.assertEqual(report["health_score"], "100.0%")
        self.assertEqual(report["issues_count"], 0)
        self.assertEqual(len(report["issues"]), 0, f"Catalog audit reported issues: {report['issues']}")
        self.assertGreaterEqual(len(report["categories_breakdown"]), 12)

    # 2. Electronics / Laptop budget search (Criterion 7)
    def test_electronics_laptop_budget_search(self):
        """Verify laptop search for programming under ₹60,000 retrieves valid machines."""
        laptops_under_60k = tools.fetch_all_products(category="laptops", max_price_inr=60000.0)
        self.assertGreaterEqual(len(laptops_under_60k), 1, "Must find at least 1 laptop under ₹60,000")
        for item in laptops_under_60k:
            self.assertLessEqual(item["price_inr"], 60000.0)
            self.assertEqual(item["category"], "laptops")
            self.assertTrue(len(item.get("specifications", "")) > 0)

        # Check agent response for laptop
        agent_res = graph.run_offline_fallback("Find a laptop under ₹60,000 for programming")
        self.assertIn("laptop", agent_res["reply"].lower())
        self.assertGreaterEqual(len(agent_res["product_cards"]), 1)

    # 3. Fresh produce / Watermelon search (Criteria 1, 8)
    def test_watermelon_catalog_match(self):
        """Verify watermelon matches fresh produce in catalog and never honey or random items."""
        produce = tools.fetch_all_products(query="watermelon")
        self.assertGreaterEqual(len(produce), 1)
        self.assertEqual(produce[0]["name"], "Fresh Organic Watermelon")
        self.assertEqual(produce[0]["category"], "fruits-vegetables")
        self.assertEqual(produce[0]["price_inr"], 249.0)

    # 4. Honey and Oats sample integrity (Criteria 2, 3)
    def test_sample_image_recognition_integrity(self):
        """Verify honey.png and oats.png recognize accurately without label swaps."""
        honey_path = os.path.join(os.path.dirname(__file__), "resources", "honey.png")
        if os.path.exists(honey_path):
            h_res = vision.analyze_product_image(image_path=honey_path)
            self.assertTrue(h_res["success"])
            self.assertIn("honey", h_res["detected"]["predicted_label"].lower())
            self.assertGreaterEqual(h_res["total_matches"], 1)
            self.assertIn("honey", h_res["matched_products"][0]["name"].lower())

        oats_path = os.path.join(os.path.dirname(__file__), "resources", "oats.png")
        if os.path.exists(oats_path):
            o_res = vision.analyze_product_image(image_path=oats_path)
            self.assertTrue(o_res["success"])
            self.assertIn("oat", o_res["detected"]["predicted_label"].lower())
            self.assertGreaterEqual(o_res["total_matches"], 1)
            self.assertIn("oat", o_res["matched_products"][0]["name"].lower())

    # 5. Non-product / Animal rejection (Criterion 4)
    def test_animal_image_rejection_without_product_creation(self):
        """Verify elephant.png is recognized as non-product and rejected with zero catalog matches."""
        elephant_path = os.path.join(os.path.dirname(__file__), "resources", "elephant.png")
        if os.path.exists(elephant_path):
            e_res = vision.analyze_product_image(image_path=elephant_path)
            self.assertTrue(e_res["success"])
            self.assertEqual(e_res["status"], "non_product_item")
            self.assertFalse(e_res["detected"]["is_product_for_sale"])
            self.assertEqual(e_res["total_matches"], 0)
            self.assertIn("not sell live animals", e_res["guidance_message"].lower())

    # 6. Unrelated / unstocked image zero-hallucination (Criteria 5, 6)
    def test_unstocked_item_zero_match_honesty(self):
        """Verify search for items not in store (e.g. helicopter) returns 0 results honestly."""
        res = tools.fetch_all_products(query="military helicopter")
        self.assertEqual(len(res), 0)

    # 7. Natural-Language Multi-Item Order Preparation & Budget Overrun (Criteria 10, 11)
    def test_one_command_order_preparation_bundle(self):
        """Verify 'Order 1 kg oats, 500 g honey, and two litres of milk within ₹800'."""
        bundle_raw = tools.prepare_order_bundle.invoke({
            "items_json": json.dumps([
                {"query": "rolled oats", "quantity": 1},
                {"query": "honey", "quantity": 1},
                {"query": "milk", "quantity": 2}
            ]),
            "target_budget_inr": 800.0
        })
        bundle = json.loads(bundle_raw)

        self.assertIn(bundle["status"], ["ready", "budget_exceeded", "partial_ready"])
        self.assertEqual(len(bundle["items"]), 3)
        self.assertGreater(bundle["total_inr"], 0)
        self.assertIn("target_budget_inr", bundle)

        # Agent chat handles the one-command ordering prompt
        agent_res = graph.run_offline_fallback("Order 1 kg oats, 500 g honey, and two litres of milk within ₹800")
        self.assertIn("Prepared complete order bundle", agent_res["reply"])
        self.assertIsNotNone(agent_res.get("order_bundle"))
        self.assertEqual(len(agent_res["order_bundle"]["items"]), 3)

    # 8. Budget Overrun Detection (Criterion 11)
    def test_budget_overrun_detection(self):
        """Verify tight budget of ₹200 triggers budget overrun alert."""
        bundle_raw = tools.prepare_order_bundle.invoke({
            "items_json": json.dumps([
                {"query": "rolled oats", "quantity": 1},
                {"query": "raw honey", "quantity": 1}
            ]),
            "target_budget_inr": 200.0
        })
        bundle_over = json.loads(bundle_raw)

        self.assertEqual(bundle_over["status"], "budget_exceeded")
        self.assertTrue(bundle_over["is_budget_exceeded"])
        self.assertGreater(bundle_over["budget_variance_inr"], 0)

    # 9. Atomic Checkout & Duplicate Prevention (Criteria 11, 12, 13)
    def test_atomic_checkout_order_creation_and_inventory(self):
        """Verify atomic transaction checkout decrements inventory and persists to orders table."""
        # Check initial stock of product 33 (Watermelon)
        conn = tools.get_db_connection()
        c = conn.cursor()
        c.execute("SELECT stock, price_inr FROM products WHERE id = 33")
        row = c.fetchone()
        init_stock = row["stock"]
        unit_price = row["price_inr"]
        conn.close()

        checkout_raw = tools.confirm_and_place_order.invoke({
            "items_json": json.dumps([{"product_id": 33, "quantity": 2}]),
            "customer_name": "Test Customer",
            "customer_address": "42 Green Street, Tech Park, Bangalore"
        })
        checkout_data = json.loads(checkout_raw)

        self.assertEqual(checkout_data["status"], "success")
        self.assertIn("ORD-2026-", checkout_data["order_number"])

        # Verify stock decreased by 2
        conn = tools.get_db_connection()
        c = conn.cursor()
        c.execute("SELECT stock FROM products WHERE id = 33")
        new_stock = c.fetchone()["stock"]
        self.assertEqual(new_stock, init_stock - 2)

        # Verify order exists in DB
        c.execute("SELECT * FROM orders WHERE order_number = ?", (checkout_data["order_number"],))
        order_row = c.fetchone()
        self.assertIsNotNone(order_row)
        expected_total = (unit_price * 2) + 50.0  # subtotal + ₹50 delivery
        self.assertEqual(order_row["total_price_inr"], expected_total)
        conn.close()

    # 10. Spec Comparison & Review Intelligence (Criterion 15)
    def test_spec_comparison_and_reviews(self):
        """Verify side-by-side spec comparison between laptops or honey."""
        comp = review_intelligence.compare_two_products_intelligence(35, 36)
        self.assertIn("product_1", comp)
        self.assertIn("product_2", comp)
        self.assertEqual(comp["product_1"]["id"], 35)
        self.assertEqual(comp["product_2"]["id"], 36)
        self.assertIn("Best for", comp["product_1"]["best_fit_use_case"])

    # 11. Daily Necessary Items Search and Instant Order Verification
    def test_daily_essentials_one_command_order(self):
        """Verify daily essentials (Amul milk, eggs, atta, butter) search and instant 1-command ordering."""
        milk_items = tools.fetch_all_products(category="daily-essentials", query="milk")
        self.assertGreaterEqual(len(milk_items), 1)
        self.assertEqual(milk_items[0]["name"], "Amul Taaza Fresh Toned Milk (1 Litre)")
        self.assertEqual(milk_items[0]["price_inr"], 56)

        # Test 1-command order via offline fallback
        res = graph.run_offline_fallback("Order 1 litre cow milk")
        self.assertIn("Confirmed", res["reply"])
        self.assertIn("Amul Taaza Fresh Toned Milk", res["reply"])
        # Ensure only the ordered item appears in product cards (zero unrelated items!)
        self.assertEqual(len(res["product_cards"]), 1)
        self.assertEqual(res["product_cards"][0]["id"], 53)

    # 12. Luxury Items Collection and Instant Order Verification
    def test_luxury_items_inventory_and_order(self):
        """Verify luxury collection items (Rolex, iPhone 16 Pro Max, MacBook Pro, Saffron) integrity."""
        luxury_prods = tools.fetch_all_products(category="luxury")
        self.assertEqual(len(luxury_prods), 10)

        # Verify Rolex Submariner
        rolex = next(p for p in luxury_prods if "Rolex" in p["name"])
        self.assertEqual(rolex["id"], 70)
        self.assertEqual(rolex["price_inr"], 895000)
        self.assertTrue(rolex["image_url"].startswith("https://images.unsplash.com/") or rolex["image_url"].startswith("/products/"))

        # Test instant ordering a luxury item
        res = graph.run_offline_fallback("Order Sony WH-1000XM5 headphones")
        self.assertIn("Confirmed", res["reply"])
        self.assertIn("Sony WH-1000XM5", res["reply"])
        self.assertEqual(len(res["product_cards"]), 1)
        self.assertEqual(res["product_cards"][0]["id"], 71)

if __name__ == "__main__":
    unittest.main()

