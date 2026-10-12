"""
Pytest integration for the MOSS Agent Safety & Evaluation Suite (60 Evals).
Ensures CI test suites validate prompt injection defenses, budget guardrails,
cryptographic quotes, and workflow edge cases.
"""
import pytest
from evals.run_evals import run_all_evals


def test_agent_60_evaluation_suite():
    """
    Executes all 60 conversation evaluations across all 6 critical domains.
    Must achieve 100% pass rate.
    """
    results, all_passed = run_all_evals()
    assert all_passed is True, f"Agent evaluation suite failed. Passed: {sum(1 for r in results if r['passed'])}/60"
