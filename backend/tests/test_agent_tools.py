import os
import json
import pytest
from unittest.mock import patch
from langchain_core.messages import AIMessage
from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver
from fastapi.testclient import TestClient

import backend.tools as tools
import backend.graph as graph
from backend.main import app
from backend.app.auth.security import create_access_token


class MockChatModel:
    """Mock Chat Model that simulates tool execution cycles in LangGraph."""
    def __init__(self, tool_name: str, tool_args: dict, final_reply: str):
        self.tool_name = tool_name
        self.tool_args = tool_args
        self.final_reply = final_reply
        self.call_count = 0

    def bind_tools(self, tool_list, **kwargs):
        return self

    def invoke(self, messages, **kwargs):
        self.call_count += 1
        if self.call_count == 1:
            return AIMessage(
                content="",
                tool_calls=[{
                    "name": self.tool_name,
                    "args": self.tool_args,
                    "id": f"call_{self.tool_name}",
                    "type": "tool_call",
                }],
            )
        return AIMessage(content=self.final_reply)


def run_turn_with_mock(mock_model: MockChatModel, user_query: str, thread_id: str):
    agent = create_agent(
        model=mock_model,
        tools=tools.LLM_ALLOWED_TOOLS,
        checkpointer=MemorySaver(),
    )
    with patch("backend.graph.get_agent", return_value=agent):
        res = graph.run_agent_chat(user_query, thread_id=thread_id)
    return res


# ---------------------------------------------------------------------------
# Tool 1: search_products
# ---------------------------------------------------------------------------

def test_tool_search_products_english():
    mock = MockChatModel(
        tool_name="search_products",
        tool_args={"query": "organic honey"},
        final_reply="Here are the top organic honey products from our catalog.",
    )
    res = run_turn_with_mock(mock, "search organic honey", thread_id="t_search_en")
    assert "organic honey" in res["reply"].lower()
    assert len(res["product_cards"]) > 0
    assert any("honey" in p["name"].lower() for p in res["product_cards"])


def test_tool_search_products_hinglish():
    mock = MockChatModel(
        tool_name="search_products",
        tool_args={"query": "kesar"},
        final_reply="Ye rahe kashmiri kesar options hamare catalog mein.",
    )
    res = run_turn_with_mock(mock, "kashmiri kesar dikhao", thread_id="t_search_hi")
    assert "kesar" in res["reply"].lower()
    assert len(res["product_cards"]) > 0


# ---------------------------------------------------------------------------
# Tool 2: compare_products (accepts names or ids, fuzzy match)
# ---------------------------------------------------------------------------

def test_tool_compare_products_names_english():
    mock = MockChatModel(
        tool_name="compare_products",
        tool_args={"product_1": "tearoa honey", "product_2": "nature's hive honey"},
        final_reply="Here is the side-by-side comparison between Aotearoa Manuka and Nature's Hive Honey.",
    )
    res = run_turn_with_mock(mock, "compare tearoa honey and nature's hive honey", thread_id="t_comp_en")
    assert "comparison" in res["reply"].lower()
    assert len(res["product_cards"]) >= 2
    names = [p["name"].lower() for p in res["product_cards"]]
    assert any("manuka" in n or "aotearoa" in n for n in names)
    assert any("raw honey" in n or "nature" in n for n in names)


def test_tool_compare_products_names_hinglish():
    mock = MockChatModel(
        tool_name="compare_products",
        tool_args={"product_1": "tearoa honey", "product_2": "nature's hive honey"},
        final_reply="Dono honeys ka comparison ye raha: Manuka premium hai aur Nature's Hive daily value ke liye best hai.",
    )
    res = run_turn_with_mock(mock, "tearoa honey aur nature's hive honey me kya difference he", thread_id="t_comp_hi")
    assert "comparison" in res["reply"].lower() or "manuka" in res["reply"].lower()
    assert len(res["product_cards"]) >= 2


# ---------------------------------------------------------------------------
# Tool 3: recommend_best
# ---------------------------------------------------------------------------

def test_tool_recommend_best_english():
    mock = MockChatModel(
        tool_name="recommend_best",
        tool_args={"query": "laptop for programming", "category": "laptops"},
        final_reply="I recommend the Zenith Ultrabook Pro 14 as the best programming laptop.",
    )
    res = run_turn_with_mock(mock, "recommend the best laptop for programming", thread_id="t_rec_en")
    assert "zenith" in res["reply"].lower() or "laptop" in res["reply"].lower()
    assert len(res["product_cards"]) > 0


def test_tool_recommend_best_hinglish():
    mock = MockChatModel(
        tool_name="recommend_best",
        tool_args={"query": "honey"},
        final_reply="Sabse best daily value ke liye Nature's Hive Raw Honey hai aur premium ke liye Aotearoa Manuka.",
    )
    res = run_turn_with_mock(mock, "best honey kon sa he", thread_id="t_rec_hi")
    assert "honey" in res["reply"].lower()
    assert len(res["product_cards"]) > 0


# ---------------------------------------------------------------------------
# Tool 4: analyze_reviews
# ---------------------------------------------------------------------------

def test_tool_analyze_reviews_english():
    mock = MockChatModel(
        tool_name="analyze_reviews",
        tool_args={"product_id": 1},
        final_reply="Based on 4 verified reviews, Nature's Hive Honey has strong customer sentiment for purity and taste.",
    )
    res = run_turn_with_mock(mock, "analyze reviews for product 1", thread_id="t_rev_en")
    assert "reviews" in res["reply"].lower() or "purity" in res["reply"].lower()


def test_tool_analyze_reviews_hinglish():
    mock = MockChatModel(
        tool_name="analyze_reviews",
        tool_args={"product_id": 1},
        final_reply="Product 1 ke reviews bohot positive hain, 4.62 rating hai aur customers purity ko praise kar rahe hain.",
    )
    res = run_turn_with_mock(mock, "product 1 ke reviews kaise he", thread_id="t_rev_hi")
    assert "reviews" in res["reply"].lower() or "positive" in res["reply"].lower()


# ---------------------------------------------------------------------------
# Tool 5: check_delivery
# ---------------------------------------------------------------------------

def test_tool_check_delivery_english():
    mock = MockChatModel(
        tool_name="check_delivery",
        tool_args={"pincode": "560038"},
        final_reply="Delivery to Bengaluru 560038 is active with 10-minute instant delivery available.",
    )
    res = run_turn_with_mock(mock, "check delivery to 560038", thread_id="t_del_en")
    assert "560038" in res["reply"] or "delivery" in res["reply"].lower()


def test_tool_check_delivery_hinglish():
    mock = MockChatModel(
        tool_name="check_delivery",
        tool_args={"pincode": "560038"},
        final_reply="Haan! 560038 par 10-minute instant delivery service available hai.",
    )
    res = run_turn_with_mock(mock, "kya 560038 pe deliver ho sakta he", thread_id="t_del_hi")
    assert "560038" in res["reply"] or "delivery" in res["reply"].lower()


# ---------------------------------------------------------------------------
# Tool 6: list_categories
# ---------------------------------------------------------------------------

def test_tool_list_categories_english():
    mock = MockChatModel(
        tool_name="list_categories",
        tool_args={},
        final_reply="We have 7 departments: Grocery & Gourmet, Fashion, Electronics, Laptops, Home, Personal Care, and Luxury.",
    )
    res = run_turn_with_mock(mock, "list all store categories", thread_id="t_cat_en")
    assert "categories" in res["reply"].lower() or "departments" in res["reply"].lower() or "grocery" in res["reply"].lower()


def test_tool_list_categories_hinglish():
    mock = MockChatModel(
        tool_name="list_categories",
        tool_args={},
        final_reply="Store me Grocery, Electronics, Laptops, Fashion aur Personal Care jaise categories available hain.",
    )
    res = run_turn_with_mock(mock, "store me kaun kaun se categories available hai", thread_id="t_cat_hi")
    assert "categories" in res["reply"].lower() or "grocery" in res["reply"].lower()


# ---------------------------------------------------------------------------
# Real Provider Smoke Test (Skipped when no API key)
# ---------------------------------------------------------------------------

@pytest.mark.skipif(
    not (os.getenv("GROQ_API_KEY") or os.getenv("GOOGLE_API_KEY")),
    reason="Smoke test skipped when no LLM API key present in environment",
)
def test_real_provider_smoke():
    llm = graph.get_llm()
    res = llm.invoke("Reply with the word PONG only.")
    text = getattr(res, "content", str(res)).strip().upper()
    assert "PONG" in text


# ---------------------------------------------------------------------------
# /api/health/llm Endpoint Tests
# ---------------------------------------------------------------------------

def test_health_llm_admin_endpoint():
    client = TestClient(app)
    
    # 1. Unauthenticated -> 401
    r_unauth = client.get("/api/health/llm")
    assert r_unauth.status_code == 401

    # 2. Customer user (non-admin) -> 403
    cust_token = create_access_token({"sub": "99", "role": "customer"})
    r_cust = client.get("/api/health/llm", headers={"Authorization": f"Bearer {cust_token}"})
    assert r_cust.status_code == 401 or r_cust.status_code == 403

    # 3. Admin user -> 200 with provider, model, latency_ms
    admin_token = create_access_token({"sub": "1", "role": "admin"})
    r_admin = client.get("/api/health/llm", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_admin.status_code == 200
    data = r_admin.json()
    assert data["status"] in ("healthy", "unhealthy")
    assert "provider" in data
    assert "model" in data
    assert "latency_ms" in data
    assert isinstance(data["latency_ms"], int)
