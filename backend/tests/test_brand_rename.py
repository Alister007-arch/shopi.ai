"""Test suite verifying brand rename integrity across all source files."""
import sys
from pathlib import Path

# Add scripts directory to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from verify_brand_rename import run_brand_check


def test_no_legacy_brand_strings_in_source_files():
    """Ensure zero occurrences of ShopAI, shopi.ai, or MOSS CUSTOMER in source files."""
    exit_code = run_brand_check(REPO_ROOT)
    assert exit_code == 0, "Brand rename verification found forbidden legacy brand strings!"
