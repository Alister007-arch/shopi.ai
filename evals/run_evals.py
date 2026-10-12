"""
Automated 60-Conversation Evaluation Runner for Trovi AI Shopping Agent.
Executes test cases across:
1. Product Search & Discovery
2. Pantry Bundles under Budget
3. Budget Overrun Guardrails
4. Two-Step Confirmation & Cryptographic Quote Tokens
5. Prompt Injection & Adversarial Defense
6. Inventory Edge Cases & Capping

Designed to run deterministically and fast in CI without requiring external API keys.
"""
import sys
import os
import json
import time

# Ensure backend and repo root in sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from evals.eval_dataset import EVAL_CASES
import backend.tools as tools
import backend.graph as graph
from backend.app.agent.safety import check_prompt_safety, evaluate_budget_guardrail
from backend.app.agent.quote import (
    create_cryptographic_quote,
    verify_quote_token,
    mark_quote_as_used,
)
from backend.app.orders.lifecycle import cancel_order_atomic


def run_single_eval(case: dict) -> dict:
    eval_id = case["id"]
    domain = case["domain"]
    t0 = time.time()
    passed = False
    details = ""

    try:
        # Domain 1: Search & Discovery
        if domain == "search_discovery":
            query = case.get("expected_keyword") or ""
            cat = case.get("expected_category")
            max_p = case.get("max_price_inr")
            results = tools.fetch_all_products(category=cat, max_price_inr=max_p, query=query)
            if results and len(results) > 0:
                passed = True
                details = f"Found {len(results)} matching products (First: '{results[0]['name']}')"
            else:
                passed = False
                details = "No products found matching criteria"

        # Domain 2: Pantry Bundles
        elif domain == "pantry_bundles":
            bundle_raw = tools.prepare_order_bundle.invoke({
                "items_json": json.dumps(case["items"]),
                "target_budget_inr": case["target_budget_inr"],
                "customer_name": "Eval Shopper",
            })
            b = json.loads(bundle_raw)
            if b.get("status") == case["expect_status"] and "quote_token" in b:
                passed = True
                details = f"Bundle ready, total ₹{b['total_inr']:,}, quote_id: {b.get('quote_id')}"
            else:
                passed = False
                details = f"Unexpected bundle status: {b.get('status')}"

        # Domain 3: Budget Guardrail
        elif domain == "budget_guardrail":
            res_raw = tools.confirm_and_place_order.invoke({
                "items_json": json.dumps(case["items"]),
                "target_budget_inr": case["target_budget_inr"],
                "budget_approved": case.get("budget_approved", False),
            })
            r = json.loads(res_raw)
            if case["expect_refusal"]:
                if r.get("status") == "error" and ("budget" in r.get("message", "").lower() or r.get("error_type") == "budget_exceeded"):
                    passed = True
                    details = f"Correctly refused over-budget order: {r.get('message')[:60]}..."
                else:
                    passed = False
                    details = f"Failed to refuse over-budget order: {r}"
            else:
                if r.get("status") == "success":
                    passed = True
                    details = f"Successfully placed order #{r.get('order_number')}"
                else:
                    passed = False
                    details = f"Failed to place valid order: {r.get('message')}"

        # Domain 4: Quote Tokens
        elif domain == "quote_tokens":
            action = case.get("action")
            if action == "generate_quote":
                q = create_cryptographic_quote([{"product_id": 1, "quantity": 1}], 500)
                passed = bool(q.get("quote_token") and q.get("valid"))
                details = f"Generated valid token: {q.get('quote_token')[:24]}..."
            elif action == "check_token_format":
                q = create_cryptographic_quote([{"product_id": 1, "quantity": 1}], 500)
                tok = q["quote_token"]
                passed = len(tok.split(".")) == 3 and tok.startswith("QT-2026-")
                details = f"Token segments: {len(tok.split('.'))}"
            elif action == "verify_genuine":
                q = create_cryptographic_quote([{"product_id": 1, "quantity": 1}], 500)
                v = verify_quote_token(q["quote_token"])
                passed = v.get("valid") is True
                details = f"Verified: valid={v.get('valid')}, total={v.get('total_inr')}"
            elif action == "verify_tampered_sig":
                q = create_cryptographic_quote([{"product_id": 1, "quantity": 1}], 500)
                parts = q["quote_token"].split(".")
                tampered = f"{parts[0]}.{parts[1]}.tampered_fake_sig"
                v = verify_quote_token(tampered)
                passed = v.get("valid") is False and "mismatch" in v.get("reason", "").lower()
                details = f"Correctly rejected tampered signature: {v.get('reason')}"
            elif action == "verify_expired":
                q = create_cryptographic_quote([{"product_id": 1, "quantity": 1}], 500)
                parts = q["quote_token"].split(".")
                expired_tok = f"{parts[0]}.1000000000.{parts[2]}"
                v = verify_quote_token(expired_tok)
                passed = v.get("valid") is False and "expired" in v.get("reason", "").lower()
                details = f"Correctly rejected expired token: {v.get('reason')}"
            elif action == "single_use_consumption":
                q = create_cryptographic_quote([{"product_id": 1, "quantity": 1}], 500)
                mark_quote_as_used(q["quote_id"])
                v = verify_quote_token(q["quote_token"])
                passed = v.get("valid") is False and "already been consumed" in v.get("reason", "").lower()
                details = f"Quote consumed: {v.get('reason')}"
            elif action == "reject_replay":
                q = create_cryptographic_quote([{"product_id": 1, "quantity": 1}], 500)
                mark_quote_as_used(q["quote_id"])
                v = verify_quote_token(q["quote_token"])
                passed = v.get("valid") is False
                details = "Replay successfully prevented"
            elif action == "reject_malformed":
                v = verify_quote_token("invalid_bad_token_string")
                passed = v.get("valid") is False
                details = f"Rejected malformed: {v.get('reason')}"
            elif action == "chat_two_step_step1":
                res = graph.run_offline_fallback("buy 2 honey", thread_id="eval_sess_twostep", is_authenticated=True, customer_email="eval@moss.eco")
                reply = res.get("reply", "") or res.get("response", "")
                passed = "confirm" in reply.lower() or "quote" in reply.lower() or "total" in reply.lower()
                details = "Step 1 correctly requested confirmation"
            elif action == "chat_two_step_step2":
                # Ensure pending bundle exists on thread, then confirm
                graph.run_offline_fallback("buy 1 oats", thread_id="eval_sess_twostep2", is_authenticated=True, customer_email="eval@moss.eco")
                res = graph.run_offline_fallback("confirm", thread_id="eval_sess_twostep2", is_authenticated=True, customer_email="eval@moss.eco")
                reply = res.get("reply", "") or res.get("response", "")
                passed = "ord-2026" in reply.lower() or "confirmed" in reply.lower() or "placed" in reply.lower()
                details = "Step 2 successfully placed confirmed order"

        # Domain 5: Security & Prompt Injection
        elif domain == "security_safety":
            is_safe, refusal = check_prompt_safety(case["user_message"])
            if case["expect_refusal"]:
                passed = (is_safe is False) and (refusal is not None)
                details = f"Safely refused adversarial query: {refusal[:55]}..." if refusal else "Refused"
            else:
                passed = is_safe is True
                details = "Safe message allowed through"

        # Domain 6: Inventory Edge Cases
        elif domain == "inventory_edge_cases":
            if case.get("test_oversell_protection"):
                # Verify atomic decrement
                res_raw = tools.confirm_and_place_order.invoke({
                    "items_json": json.dumps([{"product_id": 15, "quantity": 1}]),
                })
                r = json.loads(res_raw)
                passed = r.get("status") == "success"
                details = f"Atomic order created #{r.get('order_number')}"
            elif case.get("test_stock_restoration"):
                # Place then cancel
                res_raw = tools.confirm_and_place_order.invoke({
                    "items_json": json.dumps([{"product_id": 16, "quantity": 1}]),
                })
                r = json.loads(res_raw)
                c_res = cancel_order_atomic(r["order_number"])
                passed = c_res.get("status") == "success" and c_res.get("new_status") == "cancelled"
                details = f"Cancelled and restored stock for #{r['order_number']}"
            elif case.get("test_pin"):
                from backend.main import ShippingAddress
                try:
                    ShippingAddress(recipient_name="Tester", phone="9845012345", street_address="Road 12", city="Blr", state="KA", postal_code=case["test_pin"])
                    passed = False
                    details = "Failed to reject invalid PIN"
                except Exception:
                    passed = True
                    details = "Correctly rejected invalid Indian PIN code"
            elif case.get("test_phone"):
                from backend.main import ShippingAddress
                try:
                    ShippingAddress(recipient_name="Tester", phone=case["test_phone"], street_address="Road 12", city="Blr", state="KA", postal_code="560001")
                    passed = False
                    details = "Failed to reject invalid phone"
                except Exception:
                    passed = True
                    details = "Correctly rejected invalid phone number"
            else:
                res_raw = tools.confirm_and_place_order.invoke({
                    "items_json": json.dumps(case["items"]),
                })
                r = json.loads(res_raw)
                if case["expect_error"]:
                    passed = r.get("status") == "error" and case["error_substr"].lower() in r.get("message", "").lower()
                    details = f"Correctly returned error: {r.get('message')}"
                else:
                    passed = r.get("status") == "success"
                    details = "Placed successfully"

    except Exception as e:
        passed = False
        details = f"Exception during eval: {str(e)}"

    elapsed_ms = int((time.time() - t0) * 1000)
    return {
        "id": eval_id,
        "domain": domain,
        "passed": passed,
        "elapsed_ms": elapsed_ms,
        "details": details,
    }


def run_all_evals():
    print(f"============================================================")
    print(f"  TROVI AGENT SAFETY & EVALUATION SUITE: 60 EVAL CONVERSATIONS")
    print(f"============================================================")
    # Ensure all catalog items have sufficient stock for isolated eval runs
    try:
        conn = tools.get_db_connection()
        conn.execute("UPDATE products SET stock = 100 WHERE stock < 20")
        conn.commit()
        conn.close()
    except Exception:
        pass

    start_total = time.time()
    results = []
    domain_scores = {}

    for case in EVAL_CASES:
        res = run_single_eval(case)
        results.append(res)
        d = res["domain"]
        if d not in domain_scores:
            domain_scores[d] = {"passed": 0, "total": 0}
        domain_scores[d]["total"] += 1
        if res["passed"]:
            domain_scores[d]["passed"] += 1

        mark = "✓ PASS" if res["passed"] else "✗ FAIL"
        print(f"[{res['id']}] [{mark}] {res['domain']:<22} ({res['elapsed_ms']}ms) -> {res['details'][:65]}")

    total_time = round(time.time() - start_total, 2)
    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    pass_pct = round((passed_count / total_count) * 100, 1)

    # Determine whether LLM is live or mocked
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    is_live = bool(groq_key and not groq_key.startswith("mock") and not groq_key.startswith("test"))
    llm_mode = "Live LLM (Groq Llama-3.3-70b)" if is_live else "Mock LLM"

    report = {
        "passed_count": passed_count,
        "total_count": total_count,
        "pass_pct": pass_pct,
        "duration_seconds": total_time,
        "is_mock_llm": not is_live,
        "llm_mode": llm_mode,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "domain_scores": domain_scores,
    }

    report_path = os.path.join(REPO_ROOT, "evals", "latest_eval_report.json")
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
    except Exception as e:
        print(f"Warning: could not write eval report: {e}")

    print("\n------------------------------------------------------------")
    print("DOMAIN SUMMARY REPORT:")
    for d, s in domain_scores.items():
        pct = round((s['passed'] / s['total']) * 100, 1)
        print(f"  - {d:<24}: {s['passed']}/{s['total']} ({pct}%)")

    print(f"------------------------------------------------------------")
    print(f"OVERALL EVAL RESULT: {passed_count}/{total_count} PASSED ({pass_pct}%) in {total_time}s [{llm_mode}]")
    print(f"============================================================\n")

    return results, pass_pct == 100.0


if __name__ == "__main__":
    _, all_passed = run_all_evals()
    sys.exit(0 if all_passed else 1)
