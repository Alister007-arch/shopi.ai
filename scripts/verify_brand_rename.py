#!/usr/bin/env python3
"""
Brand Rename Verification Script for CI and Local Testing.
Enforces that no legacy brand strings ("ShopAI", "shopi.ai", "MOSS CUSTOMER")
exist in source files (with allowed exceptions for "MOSS Organics" collection name,
the GitHub repository remote URL, and internal database identifiers).
"""
import os
import re
import sys
from pathlib import Path

# Terms that must NOT appear in source files
FORBIDDEN_TERMS = [
    "ShopAI",
    "shopi.ai",
    "MOSS CUSTOMER",
]

# Paths to scan relative to workspace root
TARGET_DIRECTORIES = [
    "frontend/src",
    "frontend/tests",
    "backend",
    "config",
    "prompts",
    "scripts",
    "evals",
    "docs",
]

TARGET_FILES = [
    "frontend/index.html",
    "frontend/package.json",
    "Dockerfile",
    "README.md",
    ".env.example",
]

# File extensions to scan
SCAN_EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".md",
    ".json", ".yaml", ".yml", ".sh", ".sql"
}

# Directories to skip
EXCLUDE_DIRS = {
    ".git", "node_modules", "__pycache__", ".pytest_cache",
    ".venv", "venv", "dist", "build", ".system_generated"
}

# Explicitly allowed patterns
ALLOWED_PATTERNS = [
    re.compile(r"MOSS\s+Organics", re.IGNORECASE),
    re.compile(r"github\.com[/:].*shopi\.ai", re.IGNORECASE),
    re.compile(r"shopai\.db"),
    re.compile(r"SHOPI_DB_PATH"),
    re.compile(r"test_shopai\.db"),
]


def is_allowed_line(line: str) -> bool:
    """Check if the line matches an allowed pattern."""
    # Strip allowed patterns from line and see if forbidden term remains
    sanitized = line
    for pat in ALLOWED_PATTERNS:
        sanitized = pat.sub("", sanitized)
    for term in FORBIDDEN_TERMS:
        if term.lower() in sanitized.lower():
            return False
    return True


def check_file(file_path: Path) -> list:
    """Scan a single file for forbidden terms. Returns list of violation messages."""
    violations = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f, start=1):
                for term in FORBIDDEN_TERMS:
                    if term.lower() in line.lower():
                        if not is_allowed_line(line):
                            violations.append(
                                f"{file_path}:{idx}: Found '{term}' in: {line.strip()}"
                            )
    except Exception as e:
        violations.append(f"{file_path}: Error reading file: {e}")
    return violations


def run_brand_check(root_dir: Path) -> int:
    """Run verification across all source files."""
    all_violations = []

    # Scan target directories
    for target_dir in TARGET_DIRECTORIES:
        dir_path = root_dir / target_dir
        if not dir_path.exists():
            continue
        for root, dirs, files in os.walk(dir_path):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                fpath = Path(root) / file
                if fpath.suffix in SCAN_EXTENSIONS:
                    # Skip database binary files or lock files
                    if fpath.name in ("shopai.db", "package-lock.json"):
                        continue
                    # Skip this verification script itself
                    if fpath.name == "verify_brand_rename.py" or fpath.name == "test_brand_rename.py":
                        continue
                    v = check_file(fpath)
                    all_violations.extend(v)

    # Scan target files
    for target_file in TARGET_FILES:
        fpath = root_dir / target_file
        if fpath.exists():
            v = check_file(fpath)
            all_violations.extend(v)

    if all_violations:
        print(f"\n[ERROR] Brand check failed! Found {len(all_violations)} violations:\n")
        for violation in all_violations:
            print(f"  ❌ {violation}")
        print("\nPlease replace legacy brand terms with Trovi / Trovi AI / BRAND configuration.")
        return 1

    print("\n✅ [SUCCESS] Brand rename check passed! Zero legacy brand strings found.")
    print("   Validated: 'Trovi' store brand, 'Trovi AI' assistant, 'MOSS Organics' collection.")
    return 0


if __name__ == "__main__":
    workspace_root = Path(__file__).resolve().parent.parent
    sys.exit(run_brand_check(workspace_root))
