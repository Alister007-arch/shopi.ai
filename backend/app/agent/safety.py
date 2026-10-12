"""
Agent Safety and Guardrail Defense Layers for MOSS E-Commerce.
Guards against prompt injection, system prompt extraction, jailbreaks, SQL injection, and budget overruns.
"""
import re
from typing import Tuple, Optional, Dict, Any

# Signatures of adversarial prompt injection & system bypasses
INJECTION_PATTERNS = [
    # System instruction bypass & jailbreaks
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"disregard\s+(all\s+)?(previous|prior|system)\s+prompts?",
    r"you\s+are\s+now\s+(in\s+developer\s+mode|dan|unfiltered|jailbroken)",
    r"act\s+as\s+(an\s+unfiltered|dan|root|sudo|admin|system\s+administrator)",
    r"pretend\s+you\s+have\s+no\s+(rules|restrictions|guidelines|morals)",
    r"reveal\s+.*?(system\s+prompt|developer\s+instructions|initial\s+prompt)",
    r"repeat\s+(everything|the\s+text)\s+(above|prior\s+to\s+this|from\s+the\s+beginning)",
    r"what\s+is\s+your\s+(secret|internal|system)\s+prompt",
    r"print\s+(your\s+)?(system\s+prompt|initial\s+instructions)",
    r"simulate\s+(a\s+)?(terminal|bash|powershell|linux\s+shell)",
    
    # Financial / discount exploits
    r"give\s+me\s+100%\s+discount",
    r"set\s+(the\s+)?price\s+to\s+0",
    r"override\s+(cart|order)\s+total\s+to\s+0",
    r"apply\s+infinite\s+credits",
    
    # SQL Injection in conversational queries
    r"(union\s+select|select\s+\*\s+from|drop\s+table|delete\s+from\s+products|insert\s+into\s+products)",
    r"(\bor\s+1=1\b|admin'--|';\s*drop)",
]

COMPILED_INJECTION_RE = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


def check_prompt_safety(user_message: str) -> Tuple[bool, Optional[str]]:
    """
    Scans incoming shopper message for prompt injection, jailbreaking,
    system prompt exfiltration, and adversarial exploits.
    Returns (is_safe, refusal_message_if_unsafe).
    """
    if not user_message:
        return True, None

    normalized = user_message.strip()

    for pattern in COMPILED_INJECTION_RE:
        if pattern.search(normalized):
            return False, (
                "I am Trovi AI, the multi-category shopping assistant for Trovi. "
                "I cannot override security policies, reveal system prompts, or execute unauthorized commands. "
                "How may I help you search for verified products today?"
            )

    return True, None


def sanitize_search_query(query: str) -> str:
    """
    Sanitizes raw search query string to prevent SQLite injection characters or wildcards.
    """
    if not query:
        return ""
    # Strip dangerous punctuation
    cleaned = re.sub(r"['\";\\`\x00]", "", query)
    # Collapse multiple whitespaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:100]  # Cap query length


def evaluate_budget_guardrail(
    total_inr: int,
    target_budget_inr: Optional[float],
    budget_approved: bool = False,
) -> Dict[str, Any]:
    """
    Strict code-level budget constraint enforcement.
    Refuses checkout if order exceeds budget without explicit confirmation.
    """
    if target_budget_inr is None or target_budget_inr <= 0:
        return {"passed": True, "overrun": False, "variance_inr": 0}

    target = int(target_budget_inr)
    if total_inr > target:
        variance = total_inr - target
        if not budget_approved:
            return {
                "passed": False,
                "overrun": True,
                "variance_inr": variance,
                "message": (
                    f"Budget Guardrail Active: The total order amount ₹{total_inr:,} exceeds your "
                    f"budget limit of ₹{target:,} by ₹{variance:,}. "
                    f"Please confirm if you approve the higher total to proceed."
                ),
            }
        return {
            "passed": True,
            "overrun": True,
            "variance_inr": variance,
            "approved": True,
            "message": f"Over-budget amount of ₹{variance:,} was explicitly approved by user.",
        }

    return {"passed": True, "overrun": False, "variance_inr": 0}
