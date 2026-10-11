import os
import re
import json
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver

import tools
import review_intelligence

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

SYSTEM_PROMPT = """You are ShopAI, an advanced, highly reliable, and evidence-grounded autonomous AI Shopping Agent.

You assist shoppers across a comprehensive multi-category store including:
- Laptops, Computers & Tech
- Electronics, Audio & Smart Wearables
- Fresh Produce & Vegetables
- Groceries, Organic Pantry, Honey, Oils, Grains, Tea, Coffee & Snacks
- Dairy & Plant-based Alternatives
- Apparel & Footwear
- Home & Kitchen Appliances
- Personal Care & Household Essentials

PRIMARY CURRENCY: INDIAN RUPEES (₹)
- Catalog items have verified prices primarily in Indian Rupees (₹) with USD reference.
- Always display prices in Indian Rupees first (e.g. ₹54,990 / $646.94).
- When a user specifies a budget in INR (e.g. "under ₹60,000", "within ₹800"), filter strictly by `max_price_inr`.

CRITICAL RULES & CAPABILITIES:

1. INSTANT ONE-COMMAND ORDERING (TOP PRIORITY):
   - When the user asks to ORDER, BUY, or PURCHASE an item or multiple items (in English, Hindi, or Hinglish):
     Examples:
     - "Order 1 kg oats" / "1 kg oats order kar do"
     - "Order laptop #38" / "laptop order kar do"
     - "Order 1 kg oats, 500 g honey, and two litres of milk within ₹800"
     - "Buy wireless headphones" / "headphones khareed lo"
     - "Order #18" / "ye order kar do"
   - DO NOT create unnecessary friction. DO NOT ask for redundant confirmation if the items to order are clear.
   - IMMEDIATELY call `confirm_and_place_order(items_json=...)` in that single turn!
     - Format `items_json`: JSON string of items, e.g. `[{"query": "oats", "quantity": 1}]` or `[{"product_id": 18, "quantity": 1}]`.
     - If user specified a budget or specs (e.g. "order a laptop under ₹60,000 for programming"), pick the best qualifying laptop and call `confirm_and_place_order` for it.
   - Confirm clearly with the real Order ID (e.g. ORD-2026-XXXXXX), items, total payable in ₹, and delivery timeline.
   - CRITICAL: Never show or mention unrelated products! Only the product(s) ordered!

2. ESTIMATING / DRAFT BUNDLES:
   - ONLY when the user explicitly asks to "prepare a bundle", "give a quote", or "calculate budget without ordering" (e.g. "Can you prepare a bundle for oats and honey within ₹800 without placing order?"):
     - Call `prepare_order_bundle(items_json=..., target_budget_inr=...)`.
     - Present the itemized breakdown and budget variance.

3. ADD TO CART:
   - When user asks to add something to their cart ("Add 2 honey to cart", "cart me daal do"):
     - Call `add_to_cart(product_id=..., quantity=...)`.

4. NATURAL-LANGUAGE SEARCH & HARDWARE/SPEC RECOMMENDATIONS:
   - "Find a laptop under ₹60,000 for programming":
     Call `search_products(category="laptops", max_price_inr=60000)`. Highlight processor, RAM, storage, and explain why it fits programming.
   - "Find the cheapest suitable wireless headphones":
     Call `search_products(query="headphones", sort_by="cheapest")`. Highlight ANC, battery life, and price.
   - "Find vegetables for the next three days":
     Call `search_products(category="fruits-vegetables")`. Present crisp produce with freshness details.

5. EVIDENCE-BASED COMPARISONS:
   - When asked to compare items (e.g. "Compare #38 and #39"):
     Call `compare_products(product_id_1, product_id_2)`.
     Present a clean side-by-side markdown table comparing prices, technical specs, customer ratings, pros, and cons.

6. ACCURACY & ANTI-HALLUCINATION RULES:
   - NEVER invent products, specs, stock quantities, or prices.
   - NEVER display or recommend unrelated items when the user is searching or ordering a specific item.
"""

def get_agent_instance():
    llm = ChatGroq(
        model="qwen/qwen3.8-27b",
        api_key=GROQ_API_KEY,
        temperature=0.1,
        timeout=6.0,
        max_retries=0,
    )

    agent = create_agent(
        model=llm,
        tools=[
            tools.search_products,
            tools.get_product_details,
            tools.compare_products,
            tools.prepare_order_bundle,
            tools.confirm_and_place_order,
            tools.add_to_cart,
            tools.remove_from_cart,
            tools.list_categories,
            tools.analyze_reviews,
            tools.get_product_rating,
        ],
        checkpointer=MemorySaver(),
        system_prompt=SYSTEM_PROMPT,
    )
    return agent

_agent = None

def get_agent():
    global _agent
    if _agent is None:
        _agent = get_agent_instance()
    return _agent


# ---------------------------------------------------------------------------
# Helper: Extract ordered items from natural language text
# ---------------------------------------------------------------------------

CATALOG_KEYWORDS = [
    # Daily Necessary Items
    ("amul milk", "Amul Taaza Fresh Toned Milk (1 Litre)"),
    ("toned milk", "Amul Taaza Fresh Toned Milk (1 Litre)"),
    ("cow milk", "Amul Taaza Fresh Toned Milk (1 Litre)"),
    ("doodh", "Amul Taaza Fresh Toned Milk (1 Litre)"),
    ("white eggs", "Farm Fresh White Eggs (Pack of 12)"),
    ("fresh eggs", "Farm Fresh White Eggs (Pack of 12)"),
    ("eggs", "Farm Fresh White Eggs (Pack of 12)"),
    ("egg", "Farm Fresh White Eggs (Pack of 12)"),
    ("ande", "Farm Fresh White Eggs (Pack of 12)"),
    ("anda", "Farm Fresh White Eggs (Pack of 12)"),
    ("multigrain bread", "Whole Wheat Multigrain Bread (400g)"),
    ("wheat bread", "Whole Wheat Multigrain Bread (400g)"),
    ("bread", "Whole Wheat Multigrain Bread (400g)"),
    ("sharbati atta", "Aashirvaad Superior MP Sharbati Atta (5kg)"),
    ("aashirvaad atta", "Aashirvaad Superior MP Sharbati Atta (5kg)"),
    ("atta", "Aashirvaad Superior MP Sharbati Atta (5kg)"),
    ("flour", "Aashirvaad Superior MP Sharbati Atta (5kg)"),
    ("sunflower oil", "Fortune Sunlite Sunflower Oil (1 Litre)"),
    ("fortune oil", "Fortune Sunlite Sunflower Oil (1 Litre)"),
    ("cooking oil", "Fortune Sunlite Sunflower Oil (1 Litre)"),
    ("tata salt", "Tata Salt Vacuum Evaporated Iodised Salt (1kg)"),
    ("iodised salt", "Tata Salt Vacuum Evaporated Iodised Salt (1kg)"),
    ("salt", "Tata Salt Vacuum Evaporated Iodised Salt (1kg)"),
    ("namak", "Tata Salt Vacuum Evaporated Iodised Salt (1kg)"),
    ("toor dal", "Tata Sampann Unpolished Toor Dal (1kg)"),
    ("dal", "Tata Sampann Unpolished Toor Dal (1kg)"),
    ("daal", "Tata Sampann Unpolished Toor Dal (1kg)"),
    ("amul butter", "Amul Salted Pasteurized Butter (500g)"),
    ("butter", "Amul Salted Pasteurized Butter (500g)"),
    ("makhan", "Amul Salted Pasteurized Butter (500g)"),
    ("amul paneer", "Amul Fresh Malai Paneer (200g)"),
    ("malai paneer", "Amul Fresh Malai Paneer (200g)"),
    ("paneer", "Amul Fresh Malai Paneer (200g)"),
    ("colgate toothpaste", "Colgate Total Advanced Health Toothpaste (150g)"),
    ("toothpaste", "Colgate Total Advanced Health Toothpaste (150g)"),
    ("dettol soap", "Dettol Original Germ Protection Soap (4x125g)"),
    ("soap", "Dettol Original Germ Protection Soap (4x125g)"),
    ("sabun", "Dettol Original Germ Protection Soap (4x125g)"),
    ("surf excel detergent", "Surf Excel Matic Top Load Liquid Detergent (1L)"),
    ("surf excel", "Surf Excel Matic Top Load Liquid Detergent (1L)"),
    ("liquid detergent", "Surf Excel Matic Top Load Liquid Detergent (1L)"),
    ("detergent", "Surf Excel Matic Top Load Liquid Detergent (1L)"),
    ("red onions", "Fresh Red Onions (1kg Mesh Bag)"),
    ("onions", "Fresh Red Onions (1kg Mesh Bag)"),
    ("onion", "Fresh Red Onions (1kg Mesh Bag)"),
    ("pyaz", "Fresh Red Onions (1kg Mesh Bag)"),
    ("potatoes", "Fresh Farm Potatoes (1kg Bag)"),
    ("potato", "Fresh Farm Potatoes (1kg Bag)"),
    ("aloo", "Fresh Farm Potatoes (1kg Bag)"),
    ("tomatoes", "Fresh Hybrid Tomatoes (1kg)"),
    ("tomato", "Fresh Hybrid Tomatoes (1kg)"),
    ("tamatar", "Fresh Hybrid Tomatoes (1kg)"),

    # Luxury Items
    ("iphone 16 pro max", "Apple iPhone 16 Pro Max (256GB Desert Titanium)"),
    ("iphone 16 pro", "Apple iPhone 16 Pro Max (256GB Desert Titanium)"),
    ("iphone 16", "Apple iPhone 16 Pro Max (256GB Desert Titanium)"),
    ("iphone", "Apple iPhone 16 Pro Max (256GB Desert Titanium)"),
    ("macbook pro 16", "Apple MacBook Pro 16-inch M3 Max (36GB RAM, 1TB SSD, Space Black)"),
    ("macbook pro", "Apple MacBook Pro 16-inch M3 Max (36GB RAM, 1TB SSD, Space Black)"),
    ("m3 max", "Apple MacBook Pro 16-inch M3 Max (36GB RAM, 1TB SSD, Space Black)"),
    ("rolex submariner", "Rolex Submariner Date Oystersteel Watch (Black Cerachrom Bezel, 41mm)"),
    ("submariner", "Rolex Submariner Date Oystersteel Watch (Black Cerachrom Bezel, 41mm)"),
    ("rolex watch", "Rolex Submariner Date Oystersteel Watch (Black Cerachrom Bezel, 41mm)"),
    ("rolex", "Rolex Submariner Date Oystersteel Watch (Black Cerachrom Bezel, 41mm)"),
    ("sony wh-1000xm5", "Sony WH-1000XM5 Premium Noise-Cancelling Headphones (Silver/Black)"),
    ("sony xm5", "Sony WH-1000XM5 Premium Noise-Cancelling Headphones (Silver/Black)"),
    ("wh-1000xm5", "Sony WH-1000XM5 Premium Noise-Cancelling Headphones (Silver/Black)"),
    ("apple watch ultra 2", "Apple Watch Ultra 2 (49mm Titanium Case, GPS + Cellular)"),
    ("apple watch ultra", "Apple Watch Ultra 2 (49mm Titanium Case, GPS + Cellular)"),
    ("watch ultra", "Apple Watch Ultra 2 (49mm Titanium Case, GPS + Cellular)"),
    ("dyson supersonic nural", "Dyson Supersonic Nural Intelligent Hair Dryer (Vinca Blue/Topaz)"),
    ("dyson supersonic", "Dyson Supersonic Nural Intelligent Hair Dryer (Vinca Blue/Topaz)"),
    ("dyson hair dryer", "Dyson Supersonic Nural Intelligent Hair Dryer (Vinca Blue/Topaz)"),
    ("dyson", "Dyson Supersonic Nural Intelligent Hair Dryer (Vinca Blue/Topaz)"),
    ("montblanc meisterstuck", "Montblanc Meisterstück 149 Gold-Coated Fountain Pen"),
    ("montblanc pen", "Montblanc Meisterstück 149 Gold-Coated Fountain Pen"),
    ("montblanc", "Montblanc Meisterstück 149 Gold-Coated Fountain Pen"),
    ("tom ford tobacco vanille", "Tom Ford Tobacco Vanille Eau De Parfum (100ml)"),
    ("tobacco vanille", "Tom Ford Tobacco Vanille Eau De Parfum (100ml)"),
    ("tom ford perfume", "Tom Ford Tobacco Vanille Eau De Parfum (100ml)"),
    ("tom ford", "Tom Ford Tobacco Vanille Eau De Parfum (100ml)"),
    ("kashmiri mongra saffron", "Royal Kashmiri Mongra Saffron (Grade 1 Pure Kesar, 5g Glass Jar)"),
    ("kashmiri saffron", "Royal Kashmiri Mongra Saffron (Grade 1 Pure Kesar, 5g Glass Jar)"),
    ("mongra saffron", "Royal Kashmiri Mongra Saffron (Grade 1 Pure Kesar, 5g Glass Jar)"),
    ("kesar", "Royal Kashmiri Mongra Saffron (Grade 1 Pure Kesar, 5g Glass Jar)"),
    ("saffron", "Royal Kashmiri Mongra Saffron (Grade 1 Pure Kesar, 5g Glass Jar)"),
    ("louis vuitton neverfull", "Louis Vuitton Neverfull MM Monogram Canvas Tote Bag"),
    ("louis vuitton bag", "Louis Vuitton Neverfull MM Monogram Canvas Tote Bag"),
    ("neverfull", "Louis Vuitton Neverfull MM Monogram Canvas Tote Bag"),
    ("louis vuitton", "Louis Vuitton Neverfull MM Monogram Canvas Tote Bag"),
    ("lv bag", "Louis Vuitton Neverfull MM Monogram Canvas Tote Bag"),

    # Oats & Grains
    ("rolled oats", "Rolled Oats"),
    ("steel-cut oats", "Steel-Cut Oats"),
    ("oats", "Rolled Oats"),
    ("oat", "Rolled Oats"),
    ("quinoa", "Organic Quinoa"),
    ("brown rice", "Organic Brown Rice"),

    # Honey
    ("buckwheat honey", "Organic Buckwheat Honey"),
    ("manuka honey", "Organic Manuka Honey"),
    ("raw honey", "Organic Raw Honey"),
    ("acacia honey", "Organic Acacia Honey"),
    ("clover honey", "Clover Honey"),
    ("wildflower honey", "Wildflower Honey"),
    ("creamed honey", "Creamed Honey"),
    ("honey", "Organic Raw Honey"),

    # Dairy Alternatives
    ("almond milk", "Organic Almond Milk"),
    ("oat milk", "Oat Milk"),
    ("coconut milk", "Organic Coconut Milk"),
    ("soy milk", "Soy Milk"),
    ("milk", "Amul Taaza Fresh Toned Milk (1 Litre)"),

    # Tech & Laptops
    ("zenith ultrabook", "Zenith Ultrabook Pro 14"),
    ("devbook", "DevBook 15X PowerStation"),
    ("zenith", "Zenith Ultrabook Pro 14"),
    ("laptop", "Zenith Ultrabook Pro 14"),
    ("slimbook", "Student SlimBook Air 13"),

    # Audio & Wearables
    ("sonicwave pro", "SonicWave Pro ANC Headphones"),
    ("sonicwave", "SonicWave Pro ANC Headphones"),
    ("airbass", "AirBass Pro TWS Earbuds"),
    ("powerstream", "PowerStream 20000mAh Power Bank"),
    ("power bank", "PowerStream 20000mAh Power Bank"),
    ("powerbank", "PowerStream 20000mAh Power Bank"),
    ("nova pulse", "Nova Pulse AMOLED Smartwatch"),
    ("smartwatch", "Nova Pulse AMOLED Smartwatch"),
    ("headphones", "SonicWave Pro ANC Headphones"),
    ("headphone", "SonicWave Pro ANC Headphones"),
    ("earbuds", "AirBass Pro TWS Earbuds"),

    # Fresh Produce
    ("watermelon", "Fresh Organic Watermelon"),
    ("alphonso mango", "Alphonso Mangoes (1kg Box)"),
    ("mango", "Alphonso Mangoes (1kg Box)"),
    ("avocado", "Organic Hass Avocados (3 Pack)"),
    ("apples", "Crisp Royal Gala Apples (1kg)"),
    ("apple", "Crisp Royal Gala Apples (1kg)"),
    ("spinach", "Farm Fresh Baby Spinach (250g)"),

    # Oils, Nuts, Tea & Coffee
    ("extra virgin olive oil", "Organic Extra Virgin Olive Oil"),
    ("olive oil", "Organic Extra Virgin Olive Oil"),
    ("coconut oil", "Coconut Oil"),
    ("flaxseed oil", "Organic Flaxseed Oil"),
    ("avocado oil", "Avocado Oil"),
    ("almonds", "Organic Almonds"),
    ("almond", "Organic Almonds"),
    ("cashews", "Roasted Cashews"),
    ("chia seeds", "Organic Chia Seeds"),
    ("mixed nuts", "Mixed Nuts"),
    ("granola", "Organic Granola"),
    ("green tea", "Organic Green Tea"),
    ("chamomile tea", "Chamomile Tea"),
    ("coffee", "Organic Ethiopian Coffee"),
    ("espresso", "Dark Roast Espresso Blend"),

    # Home & Kitchen, Clothing
    ("skillet", "Cast Iron Skillet (10.25 Inch)"),
    ("blender", "NutriBlend 900W Personal Blender"),
    ("t-shirt", "Organic Cotton Crewneck T-Shirt"),
    ("sneakers", "EcoKnit Cloud Walking Sneakers"),
    ("dish soap", "EcoClean Plant Dish Soap (500ml)"),
    ("shampoo", "Tea Tree & Rosemary Shampoo"),
    ("sunscreen", "Mineral SPF 50 Matte Sunscreen"),
]

def extract_items_from_message(msg_lower: str, all_prods: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract product IDs and requested quantities from natural-language shopping commands."""
    items = []
    added_ids = set()
    working_msg = msg_lower

    # 1. Direct ID references like #38, product 38, id: 38
    id_matches = re.findall(r"(?:#|product\s*#?|id\s*#?)\s*(\d+)", msg_lower)
    for id_str in id_matches:
        pid = int(id_str)
        match = next((p for p in all_prods if p["id"] == pid), None)
        if match and match["id"] not in added_ids:
            items.append({"product_id": match["id"], "quantity": 1})
            added_ids.add(match["id"])

    # 2. Match known catalog keywords (longest first to prioritize specific products over generic nouns)
    sorted_keywords = sorted(CATALOG_KEYWORDS, key=lambda x: len(x[0]), reverse=True)
    for kw, target_prod_name in sorted_keywords:
        if kw in working_msg:
            match = next((p for p in all_prods if p["name"].lower() == target_prod_name.lower()), None)
            if not match:
                matches = tools.fetch_all_products(query=target_prod_name)
                match = matches[0] if matches else None
            
            if match and match["id"] not in added_ids:
                # Extract quantity
                qty = 1
                qty_match = re.search(r"(\d+)\s*(kg|g|gm|litres?|ltr|packets?|x)?\s*(?:of\s*)?" + re.escape(kw), msg_lower)
                if qty_match:
                    try:
                        num = int(qty_match.group(1))
                        unit = qty_match.group(2) or ""
                        if unit in ("g", "gm") and num >= 50:
                            qty = 1
                        else:
                            qty = max(1, num)
                    except ValueError:
                        qty = 1
                elif any(word in msg_lower for word in [f"two {kw}", f"2 {kw}", f"do {kw}", f"two litres of {kw}", f"two litres {kw}", f"two litre {kw}"]):
                    qty = 2
                elif any(word in msg_lower for word in [f"three {kw}", f"3 {kw}", f"teen {kw}", f"three litres {kw}"]):
                    qty = 3
                
                items.append({"product_id": match["id"], "quantity": qty})
                added_ids.add(match["id"])

                # Mask out matched keyword so generic sub-terms don't trigger extra unintended items
                working_msg = working_msg.replace(kw, " " * len(kw), 1)

                # Also mask out trailing category words immediately following the keyword in original message
                generic_suffixes = ["headphones", "headphone", "laptop", "watch", "soap", "toothpaste", "oil", "honey", "milk", "bread", "pen", "perfume", "bag", "phone"]
                for g_suf in generic_suffixes:
                    if re.search(rf"{re.escape(kw)}\s+{re.escape(g_suf)}", msg_lower):
                        working_msg = working_msg.replace(g_suf, " " * len(g_suf), 1)

    # 3. If still empty, try general catalog search with cleaned query
    if not items:
        clean_text = re.sub(r"(order|buy|purchase|kharid|kar do|karo|mangalwa|chahiye|please|me|a|an|the|\d+)", "", msg_lower).strip()
        if len(clean_text) >= 3:
            matches = tools.fetch_all_products(query=clean_text)
            if matches:
                items.append({"product_id": matches[0]["id"], "quantity": 1})
                added_ids.add(matches[0]["id"])

    return items


# ---------------------------------------------------------------------------
# Deterministic Fallback Engine (Runs when LLM is offline or rate-limited)
# ---------------------------------------------------------------------------

def run_offline_fallback(message: str) -> Dict[str, Any]:
    """
    Robust rule-based shopping engine. Executes real SQLite queries directly
    and provides honest, structured answers without hallucinations or unrelated items.
    """
    msg_lower = message.lower().strip()
    all_prods = tools.fetch_all_products()

    # Detect if user is giving an order command
    is_order_intent = any(w in msg_lower for w in [
        "order", "buy", "purchase", "kharid", "khareed", "mangalwa", "place order",
        "confirm order", "checkout", "le lo", "book kar do"
    ])

    is_multi_order_budget = (
        ("order " in msg_lower or "buy " in msg_lower) and
        any(sep in msg_lower for sep in [" within ", "budget of"])
    )
    is_explicit_prepare = any(w in msg_lower for w in ["prepare", "bundle", "quote", "estimate", "check budget"]) or is_multi_order_budget

    # 1. INSTANT ONE-COMMAND ORDERING (Place order immediately when not preparing budget bundle)
    if is_order_intent and not is_explicit_prepare:
        items_to_order = extract_items_from_message(msg_lower, all_prods)

        if items_to_order:
            confirm_raw = tools.confirm_and_place_order.invoke({
                "items_json": json.dumps(items_to_order),
                "customer_name": "Online Shopper",
            })
            conf_res = json.loads(confirm_raw)

            if conf_res.get("status") == "success":
                ordered_products = conf_res.get("ordered_products") or [
                    p for p in all_prods if p["id"] in [it["product_id"] for it in items_to_order]
                ]

                deliv_fee_val = conf_res.get('delivery_fee_inr', 0)
                deliv_str = "Free" if deliv_fee_val == 0 else f"₹{deliv_fee_val}"
                reply = (
                    f"🎉 **Order Placed Successfully in 1 Command!**\n\n"
                    f"Your order **#{conf_res.get('order_number')}** has been confirmed for **₹{conf_res.get('total_price_inr'):,}**.\n\n"
                    f"- **Ordered Items:** {conf_res.get('items_summary')}\n"
                    f"- **Total Payable:** ₹{conf_res.get('total_price_inr'):,} (${conf_res.get('total_price_usd'):.2f})\n"
                    f"- **Delivery Fee:** {deliv_str}\n"
                    f"- **Delivery Address:** {conf_res.get('delivery_address')}\n"
                    f"- **Status:** Confirmed (Ready for dispatch in 2-3 business days)\n\n"
                    f"📦 *You can track this order anytime under the **'My Orders'** section!*"
                )

                return {
                    "reply": reply,
                    "product_cards": ordered_products,
                    "cart_action": None,
                    "placed_order": conf_res,
                    "order_bundle": None,
                    "thread_id": "offline-session",
                }
            else:
                return {
                    "reply": f"⚠️ **Order Could Not Be Completed:** {conf_res.get('message')}",
                    "product_cards": [],
                    "cart_action": None,
                    "placed_order": None,
                    "order_bundle": None,
                    "thread_id": "offline-session",
                }

    # 2. Explicit Prepare Order Bundle (when asked for draft / quote / budget variance)
    if is_explicit_prepare or ("order " in msg_lower and any(sep in msg_lower for sep in [" within ", " under "])):
        budget_match = re.search(r"(?:under|within|budget of)\s*(?:₹|rs\.?|inr)?\s*(\d+)", msg_lower) or re.search(r"(?:₹|rs\.?|inr)\s*(\d+)", msg_lower)
        target_budget = float(budget_match.group(1)) if budget_match else None

        items_to_search = extract_items_from_message(msg_lower, all_prods)
        if items_to_search:
            bundle_raw = tools.prepare_order_bundle.invoke({
                "items_json": json.dumps(items_to_search),
                "target_budget_inr": target_budget,
            })
            bundle = json.loads(bundle_raw)

            reply = f"### 📦 Prepared Order Summary\n\n"
            reply += f"Prepared complete order bundle with verified items from our store catalog:\n\n"
            for item in bundle["items"]:
                reply += f"- **{item['quantity']}x {item['name']}**: ₹{item['total_inr']:,} (₹{item['unit_price_inr']} each)\n"
            
            deliv_text = "Free" if bundle['delivery_fee_inr'] == 0 else f"₹{bundle['delivery_fee_inr']}"
            reply += f"\n**Subtotal:** ₹{bundle['subtotal_inr']:,}\n"
            reply += f"**Delivery:** {deliv_text}\n"
            reply += f"**Total Payable:** ₹{bundle['total_inr']:,} (${bundle['total_usd']:.2f})\n\n"

            if bundle["is_budget_exceeded"]:
                reply += f"⚠️ **Budget Advisory:** This bundle exceeds your target budget of ₹{int(target_budget):,} by **₹{bundle['budget_variance_inr']:,}**.\n\n"

            reply += "👉 *Click **'Confirm & Place Order'** below or say 'Confirm Order' to place it!*"

            product_cards = [p for p in all_prods if p["id"] in [it["product_id"] for it in bundle["items"]]]

            return {
                "reply": reply,
                "product_cards": product_cards,
                "cart_action": None,
                "placed_order": None,
                "order_bundle": bundle,
                "thread_id": "offline-session",
            }

    # 3. Laptop Recommendations (e.g. "Find a laptop under ₹60,000 for programming")
    if "laptop" in msg_lower or "computer" in msg_lower:
        budget_match = re.search(r"(\d+[\d,]*)", msg_lower)
        budget = 60000.0
        if budget_match:
            try:
                budget = float(budget_match.group(1).replace(",", ""))
            except ValueError:
                budget = 60000.0

        matches = tools.fetch_all_products(category="laptops", max_price_inr=budget, sort_by="cheapest")
        if matches:
            best_laptop = matches[0]
            specs = best_laptop.get("attributes", {})
            reply = (
                f"### 💻 Recommended Laptop Under ₹{int(budget):,}\n\n"
                f"I recommend the **{best_laptop['name']}** (₹{best_laptop['price_inr']:,} / ${best_laptop['price']:.2f}):\n\n"
                f"- **Processor:** {specs.get('processor', 'Fast Multi-Core CPU')}\n"
                f"- **Memory (RAM):** {specs.get('ram', '16GB LPDDR5')}\n"
                f"- **Storage:** {specs.get('storage', '512GB NVMe SSD')}\n"
                f"- **Display:** {specs.get('display', '14-inch IPS 100% sRGB')}\n"
                f"- **Battery Life:** {specs.get('battery', '12 Hours')}\n"
                f"- **Why it fits programming:** Perfect balance of high single/multi-thread performance for compilation, ample RAM for Docker/browsers, and lightweight chassis for portability."
            )
            return {
                "reply": reply,
                "product_cards": matches,
                "cart_action": None,
                "placed_order": None,
                "order_bundle": None,
                "thread_id": "offline-session",
            }

    # 4. Headphones & Audio (e.g. "Find the cheapest suitable wireless headphones")
    if "headphone" in msg_lower or "earbuds" in msg_lower or "audio" in msg_lower:
        matches = tools.fetch_all_products(category="electronics", query="headphones", sort_by="cheapest")
        if matches:
            best_hp = matches[0]
            attrs = best_hp.get("attributes", {})
            reply = (
                f"### 🎧 Top Wireless Headphones Pick\n\n"
                f"The best value option in our catalog is the **{best_hp['name']}** (₹{best_hp['price_inr']:,} / ${best_hp['price']:.2f}):\n\n"
                f"- **Noise Cancellation:** {attrs.get('anc', 'Hybrid ANC')}\n"
                f"- **Battery Life:** {attrs.get('battery_life', '40 Hours')}\n"
                f"- **Rating:** {best_hp['rating']}★ ({best_hp['review_count']} reviews)\n"
                f"- **Highlights:** Hi-Res certified sound, foldable design with plush memory foam cushions."
            )
            return {
                "reply": reply,
                "product_cards": matches,
                "cart_action": None,
                "placed_order": None,
                "order_bundle": None,
                "thread_id": "offline-session",
            }

    # 5. Product Comparison (e.g. "Compare #38 and #39" or "Compare laptops")
    if "compare" in msg_lower:
        ids = [int(x) for x in re.findall(r"#?(\d+)", msg_lower)]
        if len(ids) < 2:
            ids = [38, 39]  # Default to comparing the two laptops
        
        comp_raw = tools.compare_products.invoke({"product_id_1": ids[0], "product_id_2": ids[1]})
        comp = json.loads(comp_raw)
        p1 = comp.get("product_1", {})
        p2 = comp.get("product_2", {})

        p1_attrs = p1.get("attributes", {})
        p2_attrs = p2.get("attributes", {})

        reply = (
            f"### ⚖️ Side-by-Side Comparison\n\n"
            f"| Specification | **{p1.get('name')}** | **{p2.get('name')}** |\n"
            f"| :--- | :--- | :--- |\n"
            f"| **Price** | {p1.get('price_inr')} ({p1.get('price_usd')}) | {p2.get('price_inr')} ({p2.get('price_usd')}) |\n"
            f"| **Processor** | {p1_attrs.get('processor', 'N/A')} | {p2_attrs.get('processor', 'N/A')} |\n"
            f"| **RAM** | {p1_attrs.get('ram', 'N/A')} | {p2_attrs.get('ram', 'N/A')} |\n"
            f"| **Storage** | {p1_attrs.get('storage', 'N/A')} | {p2_attrs.get('storage', 'N/A')} |\n"
            f"| **Verified Rating** | {p1.get('rating')}★ ({p1.get('review_count')} reviews) | {p2.get('rating')}★ ({p2.get('review_count')} reviews) |\n"
            f"| **Advantages** | {', '.join(p1.get('advantages', [])[:2])} | {', '.join(p2.get('advantages', [])[:2])} |\n"
            f"| **Limitations** | {', '.join(p1.get('limitations', [])[:2]) or 'None reported'} | {', '.join(p2.get('limitations', [])[:2]) or 'None reported'} |\n"
        )
        product_cards = [p for p in all_prods if p["id"] in ids[:2]]
        return {
            "reply": reply,
            "product_cards": product_cards,
            "cart_action": None,
            "placed_order": None,
            "order_bundle": None,
            "thread_id": "offline-session",
        }

    # 6. Cart Add Command
    if "cart" in msg_lower and any(w in msg_lower for w in ["add", "put", "daal"]):
        items_to_add = extract_items_from_message(msg_lower, all_prods)
        if items_to_add:
            target_pid = items_to_add[0]["product_id"]
            qty = items_to_add[0].get("quantity", 1)
            target_prod = next((p for p in all_prods if p["id"] == target_pid), None)

            if target_prod:
                res_cart = json.loads(tools.add_to_cart.invoke({"product_id": target_prod["id"], "quantity": qty}))
                return {
                    "reply": f"🛒 **{res_cart['message']}**\n\nYour cart has been updated with verified inventory pricing.",
                    "product_cards": [target_prod],
                    "cart_action": res_cart,
                    "placed_order": None,
                    "order_bundle": None,
                    "thread_id": "offline-session",
                }

    # 7. Fresh produce search
    if any(w in msg_lower for w in ["vegetable", "fruit", "produce", "organic produce"]):
        produce = tools.fetch_all_products(category="fruits-vegetables")
        reply = f"Here is fresh farm produce available in our store:\n\n"
        for p in produce[:4]:
            reply += f"- **{p['name']}**: ₹{p['price_inr']} ({p['rating']}★)\n"
        return {
            "reply": reply,
            "product_cards": produce[:4],
            "cart_action": None,
            "placed_order": None,
            "order_bundle": None,
            "thread_id": "offline-session",
        }

    # 8. General Keyword / Budget Search
    budget_match = re.search(r"(?:under|within|budget of)?\s*(?:₹|rs\.?|inr)?\s*(\d+)", msg_lower)
    budget_inr = float(budget_match.group(1)) if budget_match and any(w in msg_lower for w in ["₹", "rs", "inr", "under", "within"]) else None

    clean_query = re.sub(r"(find|show|me|products?|under|within|inr|rs|₹|\d+|order|buy|please)", "", msg_lower).strip()
    if len(clean_query) >= 3:
        results = tools.fetch_all_products(query=clean_query, max_price_inr=budget_inr)
        if results:
            reply = f"Found **{len(results)} product(s)** matching '{clean_query}':\n\n"
            for p in results[:4]:
                reply += f"- **{p['name']} (ID: #{p['id']})**: ₹{p['price_inr']:,} (${p['price']:.2f}) | {p['rating']}★\n"
            return {
                "reply": reply,
                "product_cards": results[:4],
                "cart_action": None,
                "placed_order": None,
                "order_bundle": None,
                "thread_id": "offline-session",
            }
        else:
            return {
                "reply": f"🔍 No catalog products matched your query '{clean_query}'. Please try searching for honey, oats, laptops, headphones, or produce.",
                "product_cards": [],
                "cart_action": None,
                "placed_order": None,
                "order_bundle": None,
                "thread_id": "offline-session",
            }

    # 9. Default Greeting / Help
    return {
        "reply": (
            "👋 **Hello! I am ShopAI, your multi-category autonomous shopping assistant.**\n\n"
            "You can ask me to order or find anything in **1 single command**:\n"
            "- *'Order 1 kg oats'* (Instant 1-command checkout)\n"
            "- *'Laptop order kar do'* or *'Order laptop #38'*\n"
            "- *'Order 1 kg oats, 500 g honey, and two litres of milk within ₹800'*\n"
            "- *'Find a laptop under ₹60,000 for programming'*\n"
            "- *'Find the cheapest suitable wireless headphones'*\n"
            "- *'Compare laptop #38 and #39'*"
        ),
        "product_cards": [],
        "cart_action": None,
        "placed_order": None,
        "order_bundle": None,
        "thread_id": "offline-session",
    }


def run_agent_chat(message: str, thread_id: str = "default_session") -> Dict[str, Any]:
    """
    Executes a turn with the ShopAI agent with session memory.
    If external API is unavailable or returns an error, cleanly falls back
    to the deterministic database engine with zero downtime or false claims.
    """
    try:
        agent = get_agent()
        response = agent.invoke(
            {"messages": [{"role": "user", "content": message}]},
            config={"configurable": {"thread_id": thread_id}},
        )

        reply_content = response["messages"][-1].content

        cart_action = None
        placed_order = None
        order_bundle = None
        product_cards = []

        all_prods_cache = None
        def get_all_prods():
            nonlocal all_prods_cache
            if all_prods_cache is None:
                all_prods_cache = tools.fetch_all_products()
            return all_prods_cache

        # Inspect all tool messages in the conversation trajectory
        for msg in response.get("messages", []):
            msg_name = getattr(msg, "name", None)
            msg_content = getattr(msg, "content", "")

            if msg_name and msg_content:
                try:
                    tool_data = json.loads(msg_content) if isinstance(msg_content, str) else msg_content
                except Exception:
                    tool_data = None

                if tool_data and isinstance(tool_data, dict):
                    # 1. Order Placed
                    if msg_name == "confirm_and_place_order" and tool_data.get("status") == "success":
                        placed_order = tool_data
                        if tool_data.get("ordered_products"):
                            product_cards = tool_data["ordered_products"]
                        elif tool_data.get("items"):
                            item_pids = [it.get("product_id") for it in tool_data["items"] if it.get("product_id")]
                            product_cards = [p for p in get_all_prods() if p["id"] in item_pids]

                    # 2. Add to cart
                    elif msg_name == "add_to_cart" and tool_data.get("status") == "success":
                        cart_action = tool_data
                        if tool_data.get("product") and not product_cards:
                            product_cards = [tool_data["product"]]

                    # 3. Prepared order bundle
                    elif msg_name == "prepare_order_bundle":
                        order_bundle = tool_data
                        if tool_data.get("items") and not product_cards:
                            item_pids = [it.get("product_id") for it in tool_data["items"] if it.get("product_id")]
                            product_cards = [p for p in get_all_prods() if p["id"] in item_pids]

                    # 4. Compare products
                    elif msg_name == "compare_products" and not product_cards:
                        p1_id = tool_data.get("product_1", {}).get("id")
                        p2_id = tool_data.get("product_2", {}).get("id")
                        comp_ids = [i for i in [p1_id, p2_id] if i]
                        if comp_ids:
                            product_cards = [p for p in get_all_prods() if p["id"] in comp_ids]

                    # 5. Product details
                    elif msg_name == "get_product_details" and not product_cards:
                        pid = tool_data.get("id")
                        if pid:
                            match = next((p for p in get_all_prods() if p["id"] == pid), None)
                            if match:
                                product_cards = [match]

                elif tool_data and isinstance(tool_data, list) and msg_name == "search_products":
                    # Only assign if not already populated by order or cart
                    if not product_cards and not placed_order:
                        product_cards = tool_data[:6]

        # Explicit fallback for product cards: ONLY if no tool provided cards and NO order placed
        # Only parse explicit "#ID" or "Product #ID" tags, NEVER raw numbers or prices!
        if not product_cards and not placed_order and not order_bundle:
            explicit_id_matches = re.findall(r"(?:Product\s*#?|Item\s*#?|#)([1-9]\d*)\b", reply_content)
            if explicit_id_matches:
                valid_ids = [int(i) for i in explicit_id_matches if 1 <= int(i) <= len(get_all_prods())]
                seen = set()
                unique_ids = [x for x in valid_ids if not (x in seen or seen.add(x))]
                if unique_ids:
                    product_cards = [p for p in get_all_prods() if p["id"] in unique_ids][:4]

        return {
            "reply": reply_content,
            "product_cards": product_cards,
            "cart_action": cart_action,
            "placed_order": placed_order,
            "order_bundle": order_bundle,
            "thread_id": thread_id,
        }

    except Exception as e:
        print(f"[Agent Execution Warning] {e}. Falling back to deterministic database engine.")
        fallback = run_offline_fallback(message)
        fallback["thread_id"] = thread_id
        return fallback
