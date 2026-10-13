import os
import re
import json
import uuid
import time
import logging
import traceback
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver
import sys

_backend_dir = os.path.dirname(__file__)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

try:
    import tools
    import review_intelligence
except ImportError:
    from backend import tools
    from backend import review_intelligence

load_dotenv()
logger = logging.getLogger("trovi.graph")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

PROMPT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "prompts", "agent_system.md")
)

def load_system_prompt() -> str:
    if os.path.exists(PROMPT_PATH):
        try:
            with open(PROMPT_PATH, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            pass
    return """You are Trovi AI, the advanced AI Shopping Assistant for Trovi multi-category store.
You cover Grocery & Gourmet, Fashion & Apparel, Electronics & Audio, Laptops & Computing, Home & Kitchen, Personal Care, and Luxury & Premium.
MOSS Organics is strictly a sub-brand collection for organic grocery.
Organic claims appear ONLY on verified organic items.
For ambiguous queries like 'apple', ask a clarifying question.
Never recommend laptops for grocery queries or vice versa.
All mutation actions require handoff via start_order_action tool."""

SYSTEM_PROMPT = load_system_prompt()

def get_llm(provider: Optional[str] = None):
    """
    Returns the configured Chat Model instance with fallback support.
    Providers: 'groq', 'google'/'gemini', or 'auto'.
    """
    selected_provider = (provider or os.getenv("LLM_PROVIDER", "auto")).lower().strip()

    groq_llm = None
    if GROQ_API_KEY and GROQ_API_KEY.strip():
        try:
            groq_llm = ChatGroq(
                model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
                api_key=GROQ_API_KEY.strip(),
                temperature=0.1,
                timeout=12.0,
                max_retries=1,
            )
        except Exception as e:
            logger.warning(f"Failed to initialize ChatGroq: {e}")

    google_llm = None
    if GOOGLE_API_KEY and GOOGLE_API_KEY.strip():
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            google_llm = ChatGoogleGenerativeAI(
                model=os.getenv("GOOGLE_MODEL", "gemini-3.8-flash"),
                google_api_key=GOOGLE_API_KEY.strip(),
                temperature=0.1,
                timeout=15.0,
            )
        except Exception as e:
            logger.warning(f"Failed to initialize ChatGoogleGenerativeAI: {e}")

    if selected_provider in ("google", "gemini"):
        if google_llm is not None:
            if groq_llm is not None:
                return google_llm.with_fallbacks([groq_llm])
            return google_llm
        if groq_llm is not None:
            return groq_llm

    if selected_provider == "groq":
        if groq_llm is not None:
            if google_llm is not None:
                return groq_llm.with_fallbacks([google_llm])
            return groq_llm
        if google_llm is not None:
            return google_llm

    # Default / 'auto' mode:
    # Prefer Groq if available (fast & reliable without Gemini free-tier quota exhaustion)
    if groq_llm is not None:
        if google_llm is not None:
            return groq_llm.with_fallbacks([google_llm])
        return groq_llm
    if google_llm is not None:
        return google_llm

    raise RuntimeError("No valid LLM provider configured. Please set GROQ_API_KEY or GOOGLE_API_KEY.")


def get_llm_info(provider: Optional[str] = None) -> Dict[str, str]:
    """
    Returns metadata about active LLM provider and model.
    """
    selected_provider = (provider or os.getenv("LLM_PROVIDER", "auto")).lower().strip()
    if selected_provider in ("google", "gemini") and GOOGLE_API_KEY:
        return {"provider": "google", "model": os.getenv("GOOGLE_MODEL", "gemini-3.8-flash")}
    if GROQ_API_KEY:
        return {"provider": "groq", "model": os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")}
    if GOOGLE_API_KEY:
        return {"provider": "google", "model": os.getenv("GOOGLE_MODEL", "gemini-3.8-flash")}
    return {"provider": "unknown", "model": "none"}


def get_agent_instance():
    llm = get_llm()
    agent = create_agent(
        model=llm,
        tools=tools.LLM_ALLOWED_TOOLS,
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
# Thread State Registry for Pending Order Bundles
# ---------------------------------------------------------------------------
PENDING_BUNDLES: Dict[str, Dict[str, Any]] = {}

# ---------------------------------------------------------------------------
# Address Auto-Selection & Saved Presets
# ---------------------------------------------------------------------------
SAVED_ADDRESSES = {
    "home": "Flat 402, Green Park Avenue, 12th Main Road, Indiranagar, Bengaluru - 560038",
    "office": "Prestige Tech Park, Building 4B, Outer Ring Road, Bellandur, Bengaluru - 560103",
    "parents": "14/2 Lotus Boulevard, Koramangala 4th Block, Bengaluru - 560034",
}

def auto_choose_address(message: str, default_address: Optional[str] = None) -> tuple[str, str]:
    """
    Auto-chooses delivery address based on customer command cues.
    Returns (address_string, address_label).
    """
    msg_low = message.lower()
    if any(k in msg_low for k in ["office", "work", "kaam", "tech park"]):
        return SAVED_ADDRESSES["office"], "Office"
    if any(k in msg_low for k in ["parents", "koramangala", "boulevard"]):
        return SAVED_ADDRESSES["parents"], "Parents / Koramangala"
    if any(k in msg_low for k in ["home", "ghar", "indiranagar", "residence"]):
        return SAVED_ADDRESSES["home"], "Home"

    # Match custom inline address syntax (e.g. "deliver to 45 MG Road, Mumbai 400001")
    addr_match = re.search(r"(?:to|at|address|deliver to|ship to)[:\s]+([a-zA-Z0-9\s,\-\/]{10,80})", message, re.IGNORECASE)
    if addr_match:
        candidate = addr_match.group(1).strip()
        skip_words = ["order", "buy", "cart", "honey", "oats", "milk", "tea", "shoes", "confirm"]
        if not any(candidate.lower().startswith(x) for x in skip_words):
            return candidate, "Custom Address"

    if default_address and len(default_address) > 5:
        return default_address, "Selected Profile Address"
    return SAVED_ADDRESSES["home"], "Home (Default)"


# ---------------------------------------------------------------------------
# Deterministic Fallback Engine (Runs when LLM is offline or rate-limited)
# ---------------------------------------------------------------------------

def run_offline_fallback(
    message: str,
    thread_id: str = "offline-session",
    idempotency_key: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_email: Optional[str] = None,
    customer_address: Optional[str] = None,
    is_authenticated: Optional[bool] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Robust rule-based shopping engine with autonomous auto-order execution,
    address auto-selection, return/exchange/refund actions, and real SQLite transactions.
    """
    msg_lower = message.lower().strip()
    all_prods = tools.fetch_all_products()

    # Determine resolved auth state
    if is_authenticated is None:
        is_auth = (user_id is not None) or bool(
            customer_email and customer_email not in ("shopper@trovi.internal", "shopper@moss.internal", "guest@moss.internal", "")
        )
    else:
        is_auth = is_authenticated

    # Prompt injection and jailbreak defense
    injection_patterns = [
        "ignore previous instructions", "disregard all instructions", "disregard previous",
        "system prompt", "reveal instructions", "you are now", "act as dan", "jailbreak",
        "system override", "developer mode", "bypass confirmation"
    ]
    if any(pat in msg_lower for pat in injection_patterns):
        return {
            "reply": "🛡️ As Trovi AI, I can only assist with browsing products, comparing specs, and placing verified orders from our store catalog.",
            "product_cards": [],
            "cart_action": None,
            "placed_order": None,
            "order_bundle": None,
            "thread_id": thread_id,
        }

    # 1. RETURN ORDER INTENT (Handoff to Action Service)
    is_return_intent = any(
        msg_lower == rk or msg_lower.startswith(rk + " ") or f" {rk}" in msg_lower
        for rk in ["return", "return order", "wapas", "return my order", "wapas karna", "return karna"]
    )
    if is_return_intent:
        ord_match = re.search(r"ORD-[\w-]+", message.upper())
        target_ord_no = ord_match.group(0) if ord_match else None
        if not target_ord_no:
            conn = tools.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT order_number FROM orders WHERE status NOT LIKE '%cancel%' AND status NOT LIKE '%refund%' ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            conn.close()
            if row:
                target_ord_no = row["order_number"]

        return {
            "reply": "I've opened the return flow for you below.",
            "action_card": {
                "type": "order_action",
                "action": "return",
                "order_id": target_ord_no,
                "status": "ready_for_user_action",
            },
            "product_cards": [],
            "cart_action": None,
            "placed_order": None,
            "order_bundle": None,
            "thread_id": thread_id,
        }

    # 2. EXCHANGE ORDER INTENT (Handoff to Action Service)
    is_exchange_intent = any(
        msg_lower == ek or msg_lower.startswith(ek + " ") or f" {ek}" in msg_lower
        for ek in ["exchange", "exchange order", "badalna", "swap", "replace order", "replacement", "exchange karna"]
    )
    if is_exchange_intent:
        ord_match = re.search(r"ORD-[\w-]+", message.upper())
        target_ord_no = ord_match.group(0) if ord_match else None
        if not target_ord_no:
            conn = tools.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT order_number FROM orders WHERE status NOT LIKE '%cancel%' AND status NOT LIKE '%refund%' ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            conn.close()
            if row:
                target_ord_no = row["order_number"]

        return {
            "reply": "I've opened the exchange flow for you below.",
            "action_card": {
                "type": "order_action",
                "action": "exchange",
                "order_id": target_ord_no,
                "status": "ready_for_user_action",
            },
            "product_cards": [],
            "cart_action": None,
            "placed_order": None,
            "order_bundle": None,
            "thread_id": thread_id,
        }

    # 3. REFUND ORDER INTENT (Handoff to Action Service)
    is_refund_intent = any(
        msg_lower == rk or msg_lower.startswith(rk + " ") or f" {rk}" in msg_lower
        for rk in ["refund", "refund order", "paisa wapas", "refund my order", "instant refund", "refund chahiye", "refund status"]
    )
    if is_refund_intent:
        ord_match = re.search(r"ORD-[\w-]+", message.upper())
        target_ord_no = ord_match.group(0) if ord_match else None
        if not target_ord_no:
            conn = tools.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT order_number FROM orders WHERE status NOT LIKE '%refund%' ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            conn.close()
            if row:
                target_ord_no = row["order_number"]

        return {
            "reply": "I've opened the refund flow for you below.",
            "action_card": {
                "type": "order_action",
                "action": "refund",
                "order_id": target_ord_no,
                "status": "ready_for_user_action",
            },
            "product_cards": [],
            "cart_action": None,
            "placed_order": None,
            "order_bundle": None,
            "thread_id": thread_id,
        }

    # 4. CANCEL ORDER INTENT (Handoff to Action Service)
    is_cancel_intent = any(
        msg_lower == ck
        or msg_lower.startswith(ck + " ")
        or f" {ck}" in msg_lower
        for ck in ["cancel", "abort", "mat karo", "rehne do", "stop order", "cancel order", "cancel my order", "cancel it", "cancel last order"]
    ) or (msg_lower in ["no", "nahi", "nah", "stop"])

    if is_cancel_intent:
        ord_match = re.search(r"ORD-[\w-]+", message.upper())
        target_ord_no = ord_match.group(0) if ord_match else None
        if not target_ord_no:
            conn = tools.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT order_number FROM orders WHERE status NOT LIKE '%cancel%' ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            conn.close()
            if row:
                target_ord_no = row["order_number"]

        return {
            "reply": "I've opened the cancel flow for you below.",
            "action_card": {
                "type": "order_action",
                "action": "cancel",
                "order_id": target_ord_no,
                "status": "ready_for_user_action",
            },
            "product_cards": [],
            "cart_action": None,
            "placed_order": None,
            "order_bundle": None,
            "thread_id": thread_id,
        }

    # 4.5. ORDER TRACKING INTENT (Live shipment & status tracking)
    track_keywords = [
        "track", "tracking", "kahan hai", "where is my order", "order status",
        "status of order", "track order", "track my order", "mera order",
        "order track", "track my active orders", "track package", "shipment status"
    ]
    is_track_intent = any(
        msg_lower == tk or msg_lower.startswith(tk + " ") or f" {tk}" in msg_lower
        for tk in track_keywords
    )
    if is_track_intent:
        ord_match = re.search(r"ORD-[\w-]+", message.upper())
        target_ord_no = ord_match.group(0) if ord_match else None
        conn = tools.get_db_connection()
        cursor = conn.cursor()
        if target_ord_no:
            cursor.execute("SELECT * FROM orders WHERE UPPER(order_number) = ?", (target_ord_no,))
            ord_row = cursor.fetchone()
        else:
            if user_id:
                cursor.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
            elif customer_email:
                cursor.execute("SELECT * FROM orders WHERE LOWER(customer_email) = LOWER(?) ORDER BY id DESC LIMIT 1", (customer_email.strip(),))
            else:
                cursor.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 1")
            ord_row = cursor.fetchone()
        conn.close()

        if not ord_row:
            return {
                "reply": "🔍 **No active orders found.** You can explore our catalog and place an order anytime. Once placed, you can track it live right here!",
                "product_cards": [],
                "cart_action": None,
                "placed_order": None,
                "order_bundle": None,
                "thread_id": thread_id,
            }

        track_raw = tools.track_order.invoke({"order_identifier": ord_row["order_number"]})
        track_data = json.loads(track_raw) if isinstance(track_raw, str) else track_raw
        st = (track_data.get("current_status") or "Placed").lower()

        step1 = "✓ Placed"
        step2 = "✓ Packed" if any(w in st for w in ["pack", "ship", "deliver"]) else "○ Packed"
        step3 = "✓ Shipped" if any(w in st for w in ["ship", "deliver"]) else "○ Shipped"
        step4 = "✓ Delivered" if "deliver" in st else "○ Delivered"

        reply_md = (
            f"📦 **Live Order Tracking: #{track_data.get('order_number')}**\n\n"
            f"- **Status:** `{track_data.get('current_status', 'Confirmed')}`\n"
            f"- **Items:** {track_data.get('items_summary', 'Catalog Items')}\n"
            f"- **Total:** ₹{track_data.get('total_price_inr', 0):,} ({track_data.get('payment_method', 'Verified Pay')})\n"
            f"- **Delivery Destination:** {track_data.get('delivery_address_masked', 'Saved Address')}\n"
            f"- **Ordered At:** {track_data.get('ordered_at', 'Recent')}\n\n"
            f"🚚 **Shipment Progress:**\n`{step1}  ➜  {step2}  ➜  {step3}  ➜  {step4}`"
        )

        return {
            "reply": reply_md,
            "product_cards": [],
            "cart_action": None,
            "placed_order": track_data,
            "order_bundle": None,
            "thread_id": thread_id,
        }

    # 5. TEXT CONFIRMATION ATTEMPTS
    confirm_keywords = [
        "confirm and pay", "confirm & pay", "confirm order", "place order",
        "confirm", "yes", "haan", "ha", "kar do", "kardo", "proceed",
        "sure", "ok", "okay", "yup", "done", "pay", "go ahead",
        "order it", "buy it", "auto confirm", "yes please", "please confirm",
        "confirm it", "confirm please", "place the order", "buy now",
        "order now", "confirm now", "proceed with order", "cancel kar do"
    ]
    is_confirm_intent = any(
        msg_lower == ck or msg_lower.startswith(ck + " ") or f" {ck}" in msg_lower
        for ck in confirm_keywords
    )
    if is_confirm_intent:
        if thread_id in PENDING_BUNDLES:
            bundle = PENDING_BUNDLES.pop(thread_id)
            placed_raw = tools.confirm_and_place_order.invoke({
                "items_json": json.dumps(bundle["items"]),
                "customer_name": customer_name or bundle.get("customer_name") or "Verified Customer",
                "customer_email": customer_email or "shopper@trovi.internal",
                "customer_address": bundle.get("address") or customer_address or SAVED_ADDRESSES["home"],
                "idempotency_key": idempotency_key,
                "user_id": user_id,
            })
            placed = json.loads(placed_raw) if isinstance(placed_raw, str) else placed_raw
            item_pids = [it["product_id"] for it in bundle["items"]]
            prods = [p for p in all_prods if p["id"] in item_pids]
            return {
                "reply": f"🎉 **Order Placed Successfully!** Order #{placed.get('order_number')}.\n\nTotal: ₹{placed.get('total_inr', 0):,} | Estimated Delivery: {placed.get('estimated_delivery', 'Standard')}",
                "product_cards": prods,
                "cart_action": None,
                "placed_order": placed,
                "order_bundle": bundle,
                "thread_id": thread_id,
            }
        return {
            "reply": "To confirm or execute any order action, please click the interactive Confirm button on the action card. Actions cannot be executed by typing text in chat.",
            "product_cards": [],
            "cart_action": None,
            "placed_order": None,
            "order_bundle": None,
            "thread_id": thread_id,
        }

    # 6. ORDER PLACEMENT INTENT (Two-step quote & confirmation)
    is_order_intent = any(w in msg_lower for w in [
        "order", "buy", "purchase", "kharid", "khareed", "mangalwa",
        "checkout", "le lo", "book kar do", "kharido", "auto order"
    ])
    if is_order_intent:
        items_to_search = extract_items_from_message(msg_lower, all_prods)
        matching_products = [p for p in all_prods if p["id"] in [it["product_id"] for it in items_to_search]]
        total_inr = sum(
            next((p["price_inr"] for p in all_prods if p["id"] == it["product_id"]), 0) * it.get("quantity", 1)
            for it in items_to_search
        )
        total_usd = sum(
            next((p["price"] for p in all_prods if p["id"] == it["product_id"]), 0.0) * it.get("quantity", 1)
            for it in items_to_search
        )
        addr, addr_label = auto_choose_address(message, customer_address)
        bundle = {
            "items": items_to_search,
            "total_inr": total_inr,
            "total_usd": total_usd,
            "address": addr,
            "address_label": addr_label,
            "customer_name": customer_name or "Guest",
        }

        if not is_auth:
            return {
                "reply": "Please sign in to place an order. I have prepared your order bundle so you can proceed to checkout once you sign in.",
                "action_card": None,
                "product_cards": matching_products,
                "cart_action": None,
                "placed_order": None,
                "order_bundle": bundle,
                "requires_auth": True,
                "thread_id": thread_id,
            }

        PENDING_BUNDLES[thread_id] = bundle
        return {
            "reply": f"I've prepared your order quote for ₹{total_inr:,} to be delivered to {addr}. Please confirm to place the order.",
            "action_card": {
                "type": "order_action",
                "action": "place_order",
                "items": items_to_search,
                "status": "ready_for_user_action",
            },
            "product_cards": matching_products,
            "cart_action": None,
            "placed_order": None,
            "order_bundle": bundle,
            "thread_id": thread_id,
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

    # 5. Product Comparison (e.g. "Compare #38 and #39" or "Compare tearoa honey and nature's hive honey")
    if "compare" in msg_lower or " vs " in msg_lower or "difference between" in msg_lower:
        ids = [int(x) for x in re.findall(r"#?(\d+)", msg_lower)]
        if len(ids) < 2:
            cand_text = re.sub(r"(compare|difference|between|products?|kaun sa|achha hai|batao|kya)", "", msg_lower).strip()
            parts = re.split(r"\s+(?:and|aur|vs\.?|versus|with)\s+", cand_text)
            resolved_pids = []
            for part in parts:
                p = tools.resolve_product_identifier(part.strip())
                if p and p["id"] not in resolved_pids:
                    resolved_pids.append(p["id"])
            if len(resolved_pids) >= 2:
                ids = resolved_pids[:2]
            else:
                ids = [38, 39]  # Default to comparing the two laptops
        
        comp_raw = tools.compare_products.invoke({"product_id_1": str(ids[0]), "product_id_2": str(ids[1])})
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
        "reply": "Namaste! Main Trovi AI hoon. Kya dhoond rahe ho: honey, kapde, ya laptop?",
        "product_cards": [],
        "cart_action": None,
        "placed_order": None,
        "order_bundle": None,
        "thread_id": "offline-session",
    }


def run_agent_chat(
    message: str,
    thread_id: str = "default_session",
    idempotency_key: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_email: Optional[str] = None,
    customer_address: Optional[str] = None,
    is_authenticated: Optional[bool] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Executes a turn with the Trovi AI agent with session memory and safe confirmation.
    If external API is unavailable or returns an error, cleanly falls back
    to the deterministic database engine with zero downtime or false claims.
    """
    msg_lower = message.lower().strip()
    
    # Check for direct cancellation intent
    is_cancel_intent = any(
        msg_lower == ck
        or msg_lower.startswith(ck + " ")
        or f" {ck}" in msg_lower
        for ck in ["cancel", "abort", "mat karo", "rehne do", "stop order"]
    ) or (msg_lower in ["no", "nahi", "nah", "stop", "cancel it", "cancel this", "cancel my order", "cancel order"])

    # Check for return, exchange, or refund intents
    is_return_intent = any(
        msg_lower == rk or msg_lower.startswith(rk + " ") or f" {rk}" in msg_lower
        for rk in ["return", "return order", "wapas", "return my order", "wapas karna", "return karna"]
    )
    is_exchange_intent = any(
        msg_lower == ek or msg_lower.startswith(ek + " ") or f" {ek}" in msg_lower
        for ek in ["exchange", "exchange order", "badalna", "swap", "replace order", "replacement", "exchange karna"]
    )
    is_refund_intent = any(
        msg_lower == rk or msg_lower.startswith(rk + " ") or f" {rk}" in msg_lower
        for rk in ["refund", "refund order", "paisa wapas", "refund my order", "instant refund", "refund chahiye", "refund status"]
    )
    
    informational_keywords = [
        "compare", "search", "best", "recommend", "review", "detail", "policy",
        "delivery", "status", "track", "category", "categories", "find", "show",
        "what", "which", "kya", "kon", "kaun", "difference", "vs", "versus", "explain"
    ]
    is_informational = any(cue in msg_lower for cue in informational_keywords)

    # Check for direct confirmation intent (only if not an informational inquiry)
    confirm_keywords = [
        "confirm and pay", "confirm & pay", "confirm order", "place order",
        "confirm", "yes", "haan", "ha", "kar do", "kardo", "proceed",
        "sure", "ok", "okay", "yup", "done", "pay", "go ahead",
        "order it", "buy it", "auto confirm", "yes please", "please confirm",
        "confirm it", "confirm please", "place the order", "buy now",
        "order now", "confirm now", "proceed with order"
    ]
    is_confirm_intent = (not is_informational) and any(
        msg_lower == ck
        or msg_lower.startswith(ck + " ")
        or msg_lower.endswith(" " + ck)
        or f" {ck} " in f" {msg_lower} "
        for ck in confirm_keywords
    )

    has_auto_confirm_cmd = any(k in msg_lower for k in [
        "auto order", "auto-order", "auto confirm", "auto-confirm", "autoconfirm",
        "direct order", "place directly", "order directly", "buy directly", "place now"
    ])

    has_order_intent = any(k in msg_lower for k in [
        "order", "buy", "purchase", "kharid", "kar do", "kardo", "mangwa", "checkout"
    ])

    is_track_intent = any(
        msg_lower == tk or msg_lower.startswith(tk + " ") or f" {tk}" in msg_lower
        for tk in [
            "track", "tracking", "kahan hai", "where is my order", "order status",
            "track order", "track my order", "mera order", "order track", "track my active orders", "track package"
        ]
    )

    # Intercept cancellation, returns, exchanges, refunds, confirmation, tracking, or explicit order placement
    if (
        is_cancel_intent
        or is_return_intent
        or is_exchange_intent
        or is_refund_intent
        or is_confirm_intent
        or is_order_placement
        or is_track_intent
    ):
        res = run_offline_fallback(
            message,
            thread_id=thread_id,
            idempotency_key=idempotency_key,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_address=customer_address,
            is_authenticated=is_authenticated,
            user_id=user_id,
        )
        res["thread_id"] = thread_id
        return res

    try:
        agent = get_agent()
        response = agent.invoke(
            {"messages": [{"role": "user", "content": message}]},
            config={"configurable": {"thread_id": thread_id}},
        )

        raw_reply = response["messages"][-1].content
        if isinstance(raw_reply, list):
            reply_content = "".join(
                item.get("text", "") if isinstance(item, dict) else str(item)
                for item in raw_reply
            )
        else:
            reply_content = str(raw_reply)

        cart_action = None
        placed_order = None
        order_bundle = None
        action_card = None
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
                    # Action Card handoff
                    if msg_name == "start_order_action" or tool_data.get("action_card"):
                        action_card = tool_data.get("action_card") or tool_data

                    # Add to cart
                    elif msg_name == "add_to_cart" and tool_data.get("status") == "success":
                        cart_action = tool_data
                        if tool_data.get("product") and not product_cards:
                            product_cards = [tool_data["product"]]

                    # Compare products
                    elif msg_name == "compare_products" and not product_cards:
                        p1_id = tool_data.get("product_1", {}).get("id")
                        p2_id = tool_data.get("product_2", {}).get("id")
                        comp_ids = [i for i in [p1_id, p2_id] if i]
                        if comp_ids:
                            product_cards = [p for p in get_all_prods() if p["id"] in comp_ids]

                    # Recommend best
                    elif msg_name == "recommend_best" and not product_cards:
                        recs = tool_data.get("recommendations")
                        if isinstance(recs, list) and recs:
                            product_cards = recs[:4]
                        else:
                            top_p = tool_data.get("top_recommendation")
                            alts = tool_data.get("alternatives") or []
                            cand_ids = []
                            if isinstance(top_p, dict) and top_p.get("id"):
                                cand_ids.append(top_p["id"])
                            for a in alts:
                                if isinstance(a, dict) and a.get("id") and a["id"] not in cand_ids:
                                    cand_ids.append(a["id"])
                            if cand_ids:
                                product_cards = [p for p in get_all_prods() if p["id"] in cand_ids][:4]

                    # Product details
                    elif msg_name == "get_product_details" and not product_cards:
                        pid = tool_data.get("id")
                        if pid:
                            match = next((p for p in get_all_prods() if p["id"] == pid), None)
                            if match:
                                product_cards = [match]

                elif tool_data and msg_name == "search_products" and not product_cards:
                    if isinstance(tool_data, list):
                        product_cards = tool_data[:6]
                    elif isinstance(tool_data, dict) and "products" in tool_data:
                        product_cards = tool_data["products"][:6]

        # Explicit fallback for product cards: ONLY if no tool provided cards
        if not product_cards and not action_card:
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
            "action_card": action_card,
            "thread_id": thread_id,
        }

    except Exception as e:
        req_id = f"req_{uuid.uuid4().hex[:12]}"
        logger.error(f"[{req_id}] Agent Execution Error: {e}\n{traceback.format_exc()}")
        try:
            fallback = run_offline_fallback(
                message,
                thread_id=thread_id,
                idempotency_key=idempotency_key,
                customer_name=customer_name,
                customer_email=customer_email,
                customer_address=customer_address,
                is_authenticated=is_authenticated,
                user_id=user_id,
            )
            fallback["thread_id"] = thread_id
            fallback["request_id"] = req_id
            return fallback
        except Exception as fb_err:
            logger.error(f"[{req_id}] Offline Fallback Error: {fb_err}\n{traceback.format_exc()}")
            return {
                "reply": f"I apologize, but I encountered an issue processing your request. Please try again in a moment. (Reference ID: {req_id})",
                "product_cards": [],
                "cart_action": None,
                "placed_order": None,
                "order_bundle": None,
                "action_card": None,
                "thread_id": thread_id,
                "request_id": req_id,
                "error_type": type(e).__name__,
            }
