"""
Pytest Suite for Store Business Policies (config/policies.yaml).
Tests:
- Each category's allowed and disallowed reasons (food, produce, clothing, innerwear, electronics, luxury)
- Window expiry per category (24h for produce, 48h for food/grocery, 7 days for clothing/electronics/luxury)
- Auto-approve vs human review thresholds (amount, disputed reasons, luxury inspection)
- Delivery-fee refund rules (store mistake vs customer change)
- Abuse limits (30-day frequency flag)
- Fail startup with clear RuntimeError if YAML is invalid or malformed
- get_policies tool returns text only
- GET /api/policies endpoint returns structured text and customer policy
"""

import os
import sys
import tempfile
import datetime
import pytest
from fastapi.testclient import TestClient

# Ensure repo root and backend are on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from backend.main import app
from backend.app.policies.loader import (
    load_store_policies,
    get_store_policies,
    reset_store_policies_cache,
    StorePolicyConfig,
)
from backend.services.order_actions import (
    check_action_eligibility,
    prepare_order_action,
    get_db_connection,
)
import backend.tools as tools

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Category Allowed Reasons Tests
# ---------------------------------------------------------------------------

def test_food_and_grocery_allowed_reasons():
    """Food & grocery accepts hygiene/damage issues only within 48h, rejects change of mind."""
    policies = get_store_policies()
    cat_policy, is_innerwear, cat_key = policies.resolve_category(category="groceries", subcategory="honey")
    assert cat_key in ("food_and_grocery", "packaged_food")
    assert is_innerwear is False
    assert cat_policy.allow_change_of_mind is False
    assert cat_policy.photo_required is True

    # Allowed reasons
    for allowed in ["damaged", "leaking", "expired", "wrong_item", "missing", "quality_issue"]:
        is_ok, msg = policies.is_action_reason_allowed(cat_policy, is_innerwear, allowed)
        assert is_ok is True, f"Expected {allowed} to be allowed"

    # Disallowed reasons (change of mind)
    for disallowed in ["changed_mind", "found_better_price", "size_fit_issue"]:
        is_ok, msg = policies.is_action_reason_allowed(cat_policy, is_innerwear, disallowed)
        assert is_ok is False, f"Expected {disallowed} to be rejected"
        assert "not accepted" in msg or "hygiene" in msg or "not in the allowed" in msg


def test_fresh_produce_allowed_reasons():
    """Fresh produce accepts damage/spoilage only within 24h, rejects change of mind."""
    policies = get_store_policies()
    cat_policy, is_innerwear, cat_key = policies.resolve_category(category="fruits-vegetables", subcategory="dairy")
    assert cat_key == "fresh_produce"
    assert cat_policy.window_hours == 24
    assert cat_policy.photo_required is True

    # Allowed reasons
    for allowed in ["damaged", "spoiled", "wrong_item", "missing"]:
        is_ok, msg = policies.is_action_reason_allowed(cat_policy, is_innerwear, allowed)
        assert is_ok is True

    # Disallowed reasons
    for disallowed in ["changed_mind", "found_better_price"]:
        is_ok, msg = policies.is_action_reason_allowed(cat_policy, is_innerwear, disallowed)
        assert is_ok is False


def test_clothing_and_innerwear_allowed_reasons():
    """Clothing allows returns & exchanges for change of mind and size, but innerwear is non-returnable except damaged/wrong."""
    policies = get_store_policies()
    # Regular clothing
    reg_policy, is_iw_reg, cat_reg = policies.resolve_category(category="clothing", subcategory="shirts")
    assert cat_reg == "clothing"
    assert is_iw_reg is False
    assert reg_policy.allow_change_of_mind is True

    for allowed in ["size_fit_issue", "changed_mind", "damaged", "wrong_item", "quality_issue"]:
        is_ok, msg = policies.is_action_reason_allowed(reg_policy, is_iw_reg, allowed)
        assert is_ok is True

    # Innerwear
    iw_policy, is_iw, cat_iw = policies.resolve_category(category="clothing", subcategory="boxers", item_name="Cotton Boxer")
    assert is_iw is True
    # Innerwear allows damaged or wrong item only
    is_damaged_ok, _ = policies.is_action_reason_allowed(iw_policy, is_iw, "damaged")
    is_wrong_ok, _ = policies.is_action_reason_allowed(iw_policy, is_iw, "wrong_item")
    assert is_damaged_ok is True
    assert is_wrong_ok is True

    # Innerwear rejects change of mind or size fit
    is_mind_ok, mind_msg = policies.is_action_reason_allowed(iw_policy, is_iw, "changed_mind")
    is_size_ok, size_msg = policies.is_action_reason_allowed(iw_policy, is_iw, "size_fit_issue")
    assert is_mind_ok is False
    assert is_size_ok is False
    assert "Innerwear items are non-returnable" in mind_msg


def test_electronics_allowed_reasons():
    """Electronics accepts defective, dead on arrival, damaged, wrong items, but rejects change of mind."""
    policies = get_store_policies()
    cat_policy, is_innerwear, cat_key = policies.resolve_category(category="electronics", subcategory="headphones")
    assert cat_key == "electronics"
    assert cat_policy.window_days == 7

    for allowed in ["defective", "dead_on_arrival", "damaged", "wrong_item"]:
        is_ok, msg = policies.is_action_reason_allowed(cat_policy, is_innerwear, allowed)
        assert is_ok is True

    for disallowed in ["changed_mind", "found_better_price"]:
        is_ok, msg = policies.is_action_reason_allowed(cat_policy, is_innerwear, disallowed)
        assert is_ok is False


def test_luxury_allowed_reasons():
    """Luxury items require tags and certificates, mandatory inspection, and accept defined reasons."""
    policies = get_store_policies()
    cat_policy, is_innerwear, cat_key = policies.resolve_category(category="luxury", subcategory="watch")
    assert cat_key == "luxury"
    assert cat_policy.mandatory_inspection is True
    assert cat_policy.window_days == 7

    for allowed in ["damaged", "wrong_item", "quality_issue", "changed_mind"]:
        is_ok, msg = policies.is_action_reason_allowed(cat_policy, is_innerwear, allowed)
        assert is_ok is True


# ---------------------------------------------------------------------------
# 2. Window Expiry Per Category Tests
# ---------------------------------------------------------------------------

def test_window_expiry_produce_24_hours():
    """Fresh produce expires after 24 hours."""
    policies = get_store_policies()
    cat_policy, _, _ = policies.resolve_category(category="fruits-vegetables")
    assert cat_policy.window_hours == 24

    now = datetime.datetime.now()
    # 10 hours ago: eligible
    t_10h = (now - datetime.timedelta(hours=10)).isoformat()
    valid_10h, _, msg_10h = policies.check_window_expiry(cat_policy, t_10h)
    assert valid_10h is True
    assert "Within" in msg_10h

    # 25 hours ago: expired
    t_25h = (now - datetime.timedelta(hours=25)).isoformat()
    valid_25h, _, msg_25h = policies.check_window_expiry(cat_policy, t_25h)
    assert valid_25h is False
    assert "return window of 24 hours has expired" in msg_25h


def test_window_expiry_food_grocery_48_hours():
    """Food and grocery expires after 48 hours."""
    policies = get_store_policies()
    cat_policy, _, _ = policies.resolve_category(category="groceries", subcategory="honey")
    assert cat_policy.window_hours == 48

    now = datetime.datetime.now()
    # 36 hours ago: eligible
    t_36h = (now - datetime.timedelta(hours=36)).isoformat()
    valid_36h, _, _ = policies.check_window_expiry(cat_policy, t_36h)
    assert valid_36h is True

    # 50 hours ago: expired
    t_50h = (now - datetime.timedelta(hours=50)).isoformat()
    valid_50h, _, msg_50h = policies.check_window_expiry(cat_policy, t_50h)
    assert valid_50h is False
    assert "expired" in msg_50h


def test_window_expiry_clothing_7_days():
    """Clothing expires after 7 days (168 hours)."""
    policies = get_store_policies()
    cat_policy, _, _ = policies.resolve_category(category="clothing")
    assert cat_policy.window_days == 7

    now = datetime.datetime.now()
    # 5 days ago: eligible
    t_5d = (now - datetime.timedelta(days=5)).isoformat()
    valid_5d, _, _ = policies.check_window_expiry(cat_policy, t_5d)
    assert valid_5d is True

    # 8 days ago: expired
    t_8d = (now - datetime.timedelta(days=8)).isoformat()
    valid_8d, _, msg_8d = policies.check_window_expiry(cat_policy, t_8d)
    assert valid_8d is False
    assert "window of 7 days has expired" in msg_8d


# ---------------------------------------------------------------------------
# 3. Auto-Approve vs Human Review Thresholds Tests
# ---------------------------------------------------------------------------

def test_human_review_high_value_threshold():
    """Orders with amount >= 10,000 INR require human review."""
    policies = get_store_policies()
    limit = policies.approvals.auto_approve_max_amount_inr
    assert limit == 10000

    # Below limit (e.g. ₹9,999) with standard reason -> auto-approved
    needs_review_low, reasons_low = policies.evaluate_human_review(
        order_amount_inr=limit - 1,
        reason="changed_mind",
        is_luxury=False,
        abuse_flag=False,
    )
    assert needs_review_low is False
    assert len(reasons_low) == 0

    # At or above limit (₹10,000) -> needs human review
    needs_review_high, reasons_high = policies.evaluate_human_review(
        order_amount_inr=limit,
        reason="changed_mind",
        is_luxury=False,
        abuse_flag=False,
    )
    assert needs_review_high is True
    assert any("exceeds" in r or "meets" in r for r in reasons_high)


def test_human_review_luxury_inspection():
    """Luxury items always trigger mandatory human review inspection."""
    policies = get_store_policies()
    needs_review, reasons = policies.evaluate_human_review(
        order_amount_inr=500,
        reason="damaged",
        is_luxury=True,
        abuse_flag=False,
    )
    assert needs_review is True
    assert any("Luxury" in r for r in reasons)


def test_human_review_disputed_reasons():
    """Disputed quality, defective or dead_on_arrival reasons require human review."""
    policies = get_store_policies()
    for disputed in ["quality_issue", "defective", "dead_on_arrival"]:
        needs_review, reasons = policies.evaluate_human_review(
            order_amount_inr=500,
            reason=disputed,
            is_luxury=False,
            abuse_flag=False,
        )
        assert needs_review is True
        assert any("manual quality verification" in r for r in reasons)


# ---------------------------------------------------------------------------
# 4. Delivery-Fee Refund Rules Tests
# ---------------------------------------------------------------------------

def test_delivery_fee_refunded_on_store_mistake():
    """Delivery fee is refunded when the mistake is ours (damaged, wrong, missing, expired, defective, DOA, spoiled)."""
    policies = get_store_policies()
    store_mistakes = ["damaged", "wrong_item", "missing", "expired", "defective", "dead_on_arrival", "spoiled"]

    for reason in store_mistakes:
        assert policies.is_delivery_fee_refundable(reason) is True, f"Expected {reason} to refund delivery fee"


def test_delivery_fee_retained_on_customer_reasons():
    """Delivery fee is not refunded for customer change of mind or variant preferences."""
    policies = get_store_policies()
    customer_reasons = ["changed_mind", "size_fit_issue", "color_variant_preference", "found_better_price"]

    for reason in customer_reasons:
        assert policies.is_delivery_fee_refundable(reason) is False, f"Expected {reason} to NOT refund delivery fee"


# ---------------------------------------------------------------------------
# 5. Abuse Limits Tests
# ---------------------------------------------------------------------------

def test_abuse_limits_flagging():
    """Users exceeding 30-day action frequency trigger abuse flag and human review."""
    policies = get_store_policies()
    limit = policies.abuse_limits.max_actions_per_user_30_days
    assert limit == 5

    # Not abuse (flag=False)
    needs_review_ok, _ = policies.evaluate_human_review(500, "damaged", False, abuse_flag=False)
    assert needs_review_ok is False

    # Flagged abuse
    needs_review_abuse, reasons_abuse = policies.evaluate_human_review(500, "damaged", False, abuse_flag=True)
    assert needs_review_abuse is True
    assert any("abuse" in r for r in reasons_abuse)


# ---------------------------------------------------------------------------
# 6. Startup Failure on Invalid YAML Tests
# ---------------------------------------------------------------------------

def test_fail_startup_on_missing_yaml():
    """Fails with clear RuntimeError if policy YAML file is missing."""
    with pytest.raises(RuntimeError) as exc_info:
        load_store_policies("/path/does/not/exist/policies.yaml")
    assert "FATAL" in str(exc_info.value)
    assert "not found" in str(exc_info.value)


def test_fail_startup_on_malformed_yaml():
    """Fails with clear RuntimeError if policy YAML has syntax errors."""
    with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as tmp:
        tmp.write("invalid_yaml: [unclosed list")
        tmp_path = tmp.name

    try:
        with pytest.raises(RuntimeError) as exc_info:
            load_store_policies(tmp_path)
        assert "FATAL" in str(exc_info.value)
        assert "Malformed YAML" in str(exc_info.value)
    finally:
        os.remove(tmp_path)


def test_fail_startup_on_schema_validation_error():
    """Fails with clear RuntimeError if policy YAML violates Pydantic schema."""
    with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as tmp:
        # Missing required categories, cancellation, refund sections
        tmp.write("version: '1.0.0'\nstore_name: 'MOSS'\n")
        tmp_path = tmp.name

    try:
        with pytest.raises(RuntimeError) as exc_info:
            load_store_policies(tmp_path)
        assert "FATAL" in str(exc_info.value)
        assert "schema validation failed" in str(exc_info.value)
    finally:
        os.remove(tmp_path)


# ---------------------------------------------------------------------------
# 7. get_policies Tool & API Endpoint Tests
# ---------------------------------------------------------------------------

def test_get_policies_tool_returns_text_only():
    """get_policies tool must return pure text (string) without JSON formatting."""
    # Test specific sections
    cancel_text = tools.get_policies.invoke({"section": "cancellation"})
    assert isinstance(cancel_text, str)
    assert "Cancel your order" in cancel_text
    assert not cancel_text.startswith("{")

    food_text = tools.get_policies.invoke({"section": "food"})
    assert isinstance(food_text, str)
    assert "Food and grocery" in food_text
    assert "48 hours" in food_text

    produce_text = tools.get_policies.invoke({"section": "produce"})
    assert isinstance(produce_text, str)
    assert "Fresh produce" in produce_text
    assert "24 hours" in produce_text

    clothing_text = tools.get_policies.invoke({"section": "clothing"})
    assert isinstance(clothing_text, str)
    assert "Clothing" in clothing_text
    assert "Innerwear is not returnable" in clothing_text

    refunds_text = tools.get_policies.invoke({"section": "refunds"})
    assert isinstance(refunds_text, str)
    assert "Prepaid orders: 5 to 7 business days" in refunds_text

    # Full text
    full_text = tools.get_policies.invoke({})
    assert isinstance(full_text, str)
    assert "RETURNS, EXCHANGE AND REFUND POLICY" in full_text


def test_policies_api_endpoint():
    """GET /api/policies returns customer text and structured policy metadata."""
    res = client.get("/api/policies")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "RETURNS, EXCHANGE AND REFUND POLICY"
    assert "cancellation" in data["sections"]
    assert "fresh_produce" in data["sections"]
    assert data["windows"]["fresh_produce"]["window_hours"] == 24
    assert data["windows"]["food_and_grocery"]["window_hours"] == 48
    assert data["windows"]["clothing"]["window_days"] == 7
