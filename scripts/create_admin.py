#!/usr/bin/env python3
"""
Interactive CLI utility for provisioning Trovi administrator accounts.
- Uses getpass for interactive password prompt (never accepts passwords via CLI arguments).
- Refuses to execute against production environments without the explicit '--yes' flag.
- Cryptographically hashes passwords using bcrypt with salt before persisting to the database.
"""

import os
import sys
import getpass
import argparse

# Ensure repo root and backend directory are in sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.app.config import settings
from backend.app.auth.security import hash_password
from backend.app.db.session import SessionLocal, get_engine, init_db
from backend.app.db.models import User


def main():
    parser = argparse.ArgumentParser(
        description="Create or promote a Trovi administrator user account."
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help="Explicitly confirm execution against a production environment."
    )
    parser.add_argument(
        "--email",
        type=str,
        help="Administrator email address."
    )
    parser.add_argument(
        "--name",
        type=str,
        help="Administrator full name."
    )
    args = parser.parse_args()

    # Guard: Strictly refuse execution against production without --yes
    app_env = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower().strip()
    is_production = app_env in ("production", "prod")

    if is_production and not args.yes:
        sys.stderr.write(
            "\n[SECURITY REFUSAL] The current environment is configured as PRODUCTION.\n"
            "Modifying administrator accounts in production requires explicit confirmation.\n"
            "Please rerun with the '--yes' flag: python scripts/create_admin.py --yes\n\n"
        )
        sys.exit(1)

    print("=" * 64)
    print("  Trovi Administrator Account Provisioning Utility")
    print(f"  Target Environment: {app_env.upper()}")
    print("=" * 64)

    # Email collection & validation
    email = args.email
    while not email or not email.strip() or "@" not in email:
        email = input("Enter administrator email address: ").strip()
        if not email or "@" not in email:
            print("Invalid email format. Please provide a valid email address.")

    clean_email = email.strip().lower()

    # Name collection
    name = args.name
    if not name or not name.strip():
        name = input("Enter administrator full name [Trovi Administrator]: ").strip() or "Trovi Administrator"

    # Interactive password prompt (never a CLI argument)
    while True:
        password = getpass.getpass("Enter secure admin password (min 8 chars): ")
        if len(password) < 8:
            print("Error: Password must be at least 8 characters long.")
            continue
        confirm = getpass.getpass("Confirm admin password: ")
        if password != confirm:
            print("Error: Passwords do not match. Please try again.")
            continue
        break

    # Database connection & provisioning
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == clean_email).first()
        hashed = hash_password(password)
        if user:
            print(f"User account '{clean_email}' already exists. Updating role to 'admin' and rotating password...")
            user.hashed_password = hashed
            user.role = "admin"
            user.full_name = name
            user.is_active = True
        else:
            user = User(
                email=clean_email,
                hashed_password=hashed,
                full_name=name,
                role="admin",
                is_active=True,
            )
            db.add(user)
        db.commit()
        print(f"\n[SUCCESS] Administrator account '{clean_email}' successfully provisioned with role 'admin'.\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
