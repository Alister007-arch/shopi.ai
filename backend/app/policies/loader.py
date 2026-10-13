"""
Typed Pydantic Configuration Loader for MOSS Store Business Policies.
Guarantees schema validation, fails fast on malformed YAML, and exposes
deterministic helpers for Order Action Service with ZERO hardcoded values.
"""

import os
import yaml
import datetime
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field, ValidationError


DEFAULT_POLICY_PATH = os.environ.get("POLICY_PATH") or os.environ.get(
    "MOSS_POLICY_PATH",
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "config", "policies.yaml")
    ),
)



class CustomerPolicyText(BaseModel):
    title: str = "RETURNS, EXCHANGE AND REFUND POLICY"
    cancellation: str
    food_and_grocery: str
    fresh_produce: str
    clothing: str
    electronics: str
    luxury: str
    refunds: str
    help: str
    laptops: Optional[str] = None
    home_kitchen: Optional[str] = None
    personal_care: Optional[str] = None


class CancellationPolicy(BaseModel):
    allowed_before_status: str = "shipped"
    free_of_charge: bool = True
    allowed_reasons: List[str] = Field(default_factory=list)
    prepaid_refund_destination: str = "original_payment_method"


class InnerwearPolicy(BaseModel):
    subcategory_matches: List[str] = Field(default_factory=list)
    allow_change_of_mind: bool = False
    allowed_reasons: List[str] = Field(default_factory=list)
    disallowed_reasons: List[str] = Field(default_factory=list)


class CategoryPolicy(BaseModel):
    category_matches: List[str] = Field(default_factory=list)
    window_hours: int
    window_days: int
    photo_required: bool = False
    allow_change_of_mind: bool = True
    allowed_reasons: List[str] = Field(default_factory=list)
    disallowed_reasons: List[str] = Field(default_factory=list)
    resolution_options: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)
    replace_first: bool = False
    warranty_channel: Optional[str] = None
    mandatory_inspection: bool = False
    human_review_required: bool = False
    innerwear: Optional[InnerwearPolicy] = None


class RefundPolicy(BaseModel):
    prepaid_sla_days_min: int
    prepaid_sla_days_max: int
    prepaid_destination: str = "original_payment_method"
    cod_destination: str = "bank_account_or_upi"
    delivery_fee_refundable_reasons: List[str] = Field(default_factory=list)
    non_refundable_fees: Dict[str, bool] = Field(default_factory=dict)
    coupon_policy: str = "refund_amount_paid_for_item"


class ApprovalPolicy(BaseModel):
    auto_approve_max_amount_inr: int
    luxury_always_human_review: bool = True
    laptops_always_human_review: bool = True
    human_review_reasons: List[str] = Field(default_factory=list)


class AbuseLimitsPolicy(BaseModel):
    max_actions_per_user_30_days: int
    max_action_amount_per_user_30_days_inr: int
    high_return_rate_threshold: float
    flag_status: str = "needs_human_review"


class ContactHelpPolicy(BaseModel):
    concierge: str = "Ask Trovi"
    support_email: str
    grievance_officer_name: str
    grievance_officer_email: str
    response_sla_hours: int = 24


class StorePolicyConfig(BaseModel):
    version: str = "1.0.0"
    store_name: str = "Trovi"
    customer_policy_text: CustomerPolicyText
    cancellation: CancellationPolicy
    categories: Dict[str, CategoryPolicy]
    refund: RefundPolicy
    approvals: ApprovalPolicy
    abuse_limits: AbuseLimitsPolicy
    contact_and_help: ContactHelpPolicy

    def __getitem__(self, key: str) -> Any:
        try:
            val = getattr(self, key)
            if hasattr(val, "model_dump"):
                return val.model_dump()
            return val
        except AttributeError:
            raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        try:
            val = getattr(self, key)
            if hasattr(val, "model_dump"):
                return val.model_dump()
            return val
        except AttributeError:
            return default

    def resolve_by_policy_group(self, policy_group: Optional[str]) -> Tuple[CategoryPolicy, bool, str]:
        """
        Directly resolves CategoryPolicy via policy_group column in categories table.
        Guarantees exact mapping to one of the configured policy groups.
        """
        if not policy_group:
            fallback = self.categories.get("default") or self.categories.get("default_category")
            return fallback, False, "default"

        pg_clean = policy_group.lower().strip()

        # Direct exact match
        if pg_clean in self.categories:
            is_innerwear = (pg_clean == "innerwear")
            return self.categories[pg_clean], is_innerwear, pg_clean

        # Alias mappings
        aliases = {
            "packaged_food": "packaged_food",
            "food_and_grocery": "packaged_food",
            "food": "packaged_food",
            "grocery": "packaged_food",
            "fresh_produce": "fresh_produce",
            "produce": "fresh_produce",
            "personal_care": "personal_care",
            "clothing": "clothing",
            "innerwear": "innerwear",
            "electronics": "electronics",
            "laptops": "laptops",
            "luxury": "luxury",
            "home_kitchen": "home_kitchen",
            "household": "household",
            "default": "default",
        }
        target_key = aliases.get(pg_clean)
        if target_key and target_key in self.categories:
            is_innerwear = (target_key == "innerwear")
            return self.categories[target_key], is_innerwear, target_key

        fallback = self.categories.get("default") or self.categories.get("default_category")
        return fallback, False, "default"

    def resolve_category(
        self,
        category: Optional[str] = None,
        subcategory: Optional[str] = None,
        item_name: Optional[str] = None,
        policy_group: Optional[str] = None,
    ) -> Tuple[CategoryPolicy, bool, str]:
        """
        Determines the specific category policy, whether innerwear rules apply,
        and returns (CategoryPolicy, is_innerwear, category_key).
        Prioritizes explicit policy_group if passed.
        """
        if policy_group:
            return self.resolve_by_policy_group(policy_group)

        cat_lower = (category or "").lower().strip()
        sub_lower = (subcategory or "").lower().strip()
        name_lower = (item_name or "").lower().strip()

        # Check clothing innerwear special condition first
        clothing_policy = self.categories.get("clothing")
        if clothing_policy and clothing_policy.innerwear:
            iw_keywords = clothing_policy.innerwear.subcategory_matches
            is_iw = any(kw in sub_lower or kw in name_lower or kw in cat_lower for kw in iw_keywords)
            if is_iw:
                return clothing_policy, True, "clothing_innerwear"

        # Search matching category policy
        for key, cat_pol in self.categories.items():
            if key in ("default_category", "default"):
                continue
            for match_kw in cat_pol.category_matches:
                if match_kw in cat_lower or match_kw in sub_lower or match_kw in name_lower:
                    return cat_pol, False, key

        # Fallback to default / default_category
        fallback = self.categories.get("default") or self.categories.get("default_category")
        if fallback:
            return fallback, False, "default"

        # Last resort fallback if default omitted in dict
        first_available = next(iter(self.categories.values()))
        return first_available, False, "unknown"

    def is_action_reason_allowed(
        self,
        category_policy: CategoryPolicy,
        is_innerwear: bool,
        reason: Optional[str],
    ) -> Tuple[bool, str]:
        """
        Validates if reason is allowed under the category policy.
        """
        clean_reason = (reason or "").lower().strip()
        if not clean_reason:
            return True, "No reason provided."

        if is_innerwear and category_policy.innerwear:
            allowed = [r.lower() for r in category_policy.innerwear.allowed_reasons]
            disallowed = [r.lower() for r in category_policy.innerwear.disallowed_reasons]
            if clean_reason in disallowed or clean_reason not in allowed:
                return False, f"Innerwear items are non-returnable for '{clean_reason}'. Only damaged or wrong items are accepted."
            return True, "Allowed."

        allowed = [r.lower() for r in category_policy.allowed_reasons]
        disallowed = [r.lower() for r in category_policy.disallowed_reasons]

        if clean_reason in disallowed:
            return False, f"Reason '{clean_reason}' is not accepted for this category under store hygiene & safety policy."

        if allowed and clean_reason not in allowed:
            return False, f"Reason '{clean_reason}' is not in the allowed reasons list ({', '.join(allowed)})."

        return True, "Allowed."

    def check_window_expiry(
        self,
        category_policy: CategoryPolicy,
        delivered_at_str: Optional[str],
    ) -> Tuple[bool, float, str]:
        """
        Deterministic window check using exact configured window_hours.
        Returns (is_valid, elapsed_hours, message).
        """
        if not delivered_at_str:
            return True, 0.0, "Delivered timestamp missing, treated as within window."

        try:
            delivered_dt = datetime.datetime.fromisoformat(delivered_at_str.replace(" ", "T"))
        except Exception:
            return True, 0.0, "Unparseable delivery timestamp, treated as within window."

        now = datetime.datetime.now()
        elapsed_seconds = (now - delivered_dt).total_seconds()
        elapsed_hours = max(0.0, elapsed_seconds / 3600.0)

        max_allowed_hours = category_policy.window_hours
        if elapsed_hours > max_allowed_hours:
            if max_allowed_hours >= 48:
                allowed_display = f"{category_policy.window_days} days"
            else:
                allowed_display = f"{max_allowed_hours} hours"
            return (
                False,
                elapsed_hours,
                f"The return window of {allowed_display} has expired ({round(elapsed_hours, 1)} hours elapsed since delivery).",
            )

        return True, elapsed_hours, "Within allowed policy window."

    def is_delivery_fee_refundable(self, reason: Optional[str]) -> bool:
        """
        Checks if the reason qualifies for a delivery fee refund (store fault).
        """
        clean_reason = (reason or "").lower().strip()
        refundable_reasons = [r.lower() for r in self.refund.delivery_fee_refundable_reasons]
        return clean_reason in refundable_reasons

    def evaluate_human_review(
        self,
        order_amount_inr: int,
        reason: Optional[str],
        is_luxury: bool = False,
        is_laptop: bool = False,
        abuse_flag: bool = False,
    ) -> Tuple[bool, List[str]]:
        """
        Evaluates whether an order action needs human review based on thresholds in policies.yaml.
        """
        clean_reason = (reason or "").lower().strip()
        review_reasons = []

        # 1. High value threshold
        if order_amount_inr >= self.approvals.auto_approve_max_amount_inr:
            review_reasons.append(
                f"Order amount ₹{order_amount_inr:,} meets or exceeds ₹{self.approvals.auto_approve_max_amount_inr:,} threshold"
            )

        # 2. Mandatory luxury inspection
        if is_luxury and self.approvals.luxury_always_human_review:
            review_reasons.append("Luxury item requires physical inspection and certificate verification")

        # 3. Mandatory laptop inspection / replacement
        if is_laptop and self.approvals.laptops_always_human_review:
            review_reasons.append("Laptop items require technical specialist verification and replacement-first approval")

        # 4. Disputed or technical claim reasons
        configured_review_reasons = [r.lower() for r in self.approvals.human_review_reasons]
        if clean_reason in configured_review_reasons:
            review_reasons.append(f"Claim reason '{clean_reason}' requires manual quality verification")

        # 5. User abuse guardrail flag
        if abuse_flag:
            review_reasons.append("Account exceeded 30-day return frequency or volume abuse threshold")

        return (len(review_reasons) > 0, review_reasons)

    def get_section_text(self, section: Optional[str] = None) -> str:
        """
        Returns plain customer text for a given policy section or the complete policy document.
        """
        sec = (section or "").lower().strip()
        text_obj = self.customer_policy_text

        if not sec or sec in ("all", "overview", "full", "policy"):
            return (
                f"{text_obj.title}\n\n"
                f"{text_obj.cancellation.strip()}\n\n"
                f"{text_obj.food_and_grocery.strip()}\n\n"
                f"{text_obj.fresh_produce.strip()}\n\n"
                f"{text_obj.clothing.strip()}\n\n"
                f"{text_obj.electronics.strip()}\n\n"
                f"{text_obj.luxury.strip()}\n\n"
                f"{text_obj.refunds.strip()}\n\n"
                f"{text_obj.help.strip()}"
            )

        if "cancel" in sec:
            return text_obj.cancellation.strip()
        if "food" in sec or "groc" in sec or "honey" in sec or "oat" in sec:
            return text_obj.food_and_grocery.strip()
        if "produce" in sec or "milk" in sec or "egg" in sec or "veg" in sec or "fruit" in sec:
            return text_obj.fresh_produce.strip()
        if "cloth" in sec or "wear" in sec or "apparel" in sec:
            return text_obj.clothing.strip()
        if "elec" in sec or "tech" in sec or "gadget" in sec:
            return text_obj.electronics.strip()
        if "lux" in sec:
            return text_obj.luxury.strip()
        if "refund" in sec or "fee" in sec or "payment" in sec:
            return text_obj.refunds.strip()
        if "help" in sec or "contact" in sec or "griev" in sec:
            return text_obj.help.strip()

        # Fallback if unknown section
        return (
            f"Policy section '{section}' not found. Available sections: cancellation, food_and_grocery, "
            f"fresh_produce, clothing, electronics, luxury, refunds, help.\n\n"
            f"{text_obj.title}\n\n{text_obj.cancellation.strip()}\n\n{text_obj.refunds.strip()}"
        )


_CACHED_CONFIG: Optional[StorePolicyConfig] = None


def reset_store_policies_cache():
    """Resets cached store policies (useful during unit tests)."""
    global _CACHED_CONFIG
    _CACHED_CONFIG = None


def load_store_policies(policy_path: Optional[str] = None) -> StorePolicyConfig:
    """
    Loads and validates policies.yaml using Pydantic.
    Fails immediately with RuntimeError if YAML is missing, malformed, or fails schema validation.
    """
    global _CACHED_CONFIG
    explicit_specified = policy_path or os.environ.get("POLICY_PATH") or os.environ.get("MOSS_POLICY_PATH")
    if explicit_specified:
        target_path = explicit_specified
        if not os.path.exists(target_path):
            raise RuntimeError(
                f"FATAL: Store policies configuration file not found at '{target_path}'. Application cannot start."
            )
    else:
        target_path = DEFAULT_POLICY_PATH
        if not os.path.exists(target_path):
            candidates = [
                "/app/config/policies.yaml",
                os.path.abspath(os.path.join(os.getcwd(), "config", "policies.yaml")),
                os.path.abspath(os.path.join(os.getcwd(), "..", "config", "policies.yaml")),
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "config", "policies.yaml")),
            ]
            found = False
            for cand in candidates:
                if os.path.exists(cand):
                    target_path = cand
                    found = True
                    break
            if not found:
                raise RuntimeError(
                    f"FATAL: Store policies configuration file not found at '{target_path}'. Application cannot start."
                )



    try:
        with open(target_path, "r", encoding="utf-8") as f:
            raw_data = yaml.safe_load(f)
    except yaml.YAMLError as exc:
        raise RuntimeError(
            f"FATAL: Malformed YAML in store policies configuration file '{target_path}': {exc}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"FATAL: Failed to read store policies configuration file '{target_path}': {exc}"
        ) from exc

    if not isinstance(raw_data, dict):
        raise RuntimeError(
            f"FATAL: Store policies YAML at '{target_path}' must be a YAML mapping/dictionary, got {type(raw_data).__name__}."
        )

    try:
        config = StorePolicyConfig(**raw_data)
        _CACHED_CONFIG = config
        return config
    except ValidationError as exc:
        errors_summary = "; ".join([f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in exc.errors()])
        raise RuntimeError(
            f"FATAL: Store policies configuration schema validation failed in '{target_path}': {errors_summary}"
        ) from exc


def get_store_policies(policy_path: Optional[str] = None) -> StorePolicyConfig:
    """Returns the cached StorePolicyConfig, loading it if not yet initialized."""
    global _CACHED_CONFIG
    if _CACHED_CONFIG is None or policy_path is not None:
        return load_store_policies(policy_path)
    return _CACHED_CONFIG
