"""
Startup Self-Check for Trovi E-Commerce Application.
Validates all required runtime configuration files and environment variables.
Lists missing required files and missing/invalid environment variables strictly by NAME (never values).
Fails fast with exit code 1 and a clear diagnostic message if prerequisites are not met.
"""

import os
import sys
import logging
from typing import List, Tuple, Dict, Any

logger = logging.getLogger("trovi.startup_check")


def resolve_candidate_path(candidates: List[str]) -> Tuple[bool, str]:
    """
    Checks a list of candidate file paths in order.
    Returns (True, matching_path) if any exists, else (False, primary_candidate).
    """
    for path in candidates:
        if path and os.path.exists(path) and os.path.isfile(path):
            return True, path
    return False, candidates[0] if candidates else ""


def check_startup_prerequisites() -> Tuple[bool, List[str], List[str]]:
    """
    Performs runtime self-check of required files and environment variables.
    
    Returns:
        (is_valid, missing_files, missing_env_vars)
        - is_valid: True if all checks pass, False otherwise.
        - missing_files: Human-readable names and expected paths of missing files.
        - missing_env_vars: Names (NEVER VALUES) of missing or invalid environment variables.
    """
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    missing_files: List[str] = []
    missing_env_vars: List[str] = []

    # -------------------------------------------------------------------------
    # 1. Required Runtime Files
    # -------------------------------------------------------------------------
    # A. Store Policies Configuration (policies.yaml)
    policy_env = os.environ.get("POLICY_PATH") or os.environ.get("MOSS_POLICY_PATH")
    if policy_env:
        policy_candidates = [policy_env]
    else:
        policy_candidates = [
            os.path.join(repo_root, "config", "policies.yaml"),
            "/app/config/policies.yaml",
            os.path.abspath(os.path.join(os.getcwd(), "config", "policies.yaml")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "config", "policies.yaml")),
        ]
    policy_found, policy_target = resolve_candidate_path([c for c in policy_candidates if c])
    if not policy_found:
        expected = policy_env or "/app/config/policies.yaml"
        missing_files.append(f"Store Policies Config: 'config/policies.yaml' (Checked: {expected})")

    # B. Agent System Prompt (prompts/agent_system.md)
    prompt_env = os.environ.get("AGENT_PROMPT_PATH") or os.environ.get("PROMPT_PATH")
    if prompt_env:
        prompt_candidates = [prompt_env]
    else:
        prompt_candidates = [
            os.path.join(repo_root, "prompts", "agent_system.md"),
            "/app/prompts/agent_system.md",
            os.path.abspath(os.path.join(os.getcwd(), "prompts", "agent_system.md")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "prompts", "agent_system.md")),
        ]
    prompt_found, prompt_target = resolve_candidate_path([c for c in prompt_candidates if c])
    if not prompt_found:
        expected = prompt_env or "/app/prompts/agent_system.md"
        missing_files.append(f"Agent Prompt File: 'prompts/agent_system.md' (Checked: {expected})")

    # C. Database Migration Configuration (alembic.ini)
    alembic_env = os.environ.get("ALEMBIC_CONFIG_PATH")
    if alembic_env:
        alembic_candidates = [alembic_env]
    else:
        alembic_candidates = [
            os.path.join(repo_root, "alembic.ini"),
            "/app/alembic.ini",
            os.path.join(backend_dir, "alembic.ini"),
            "/app/backend/alembic.ini",
            os.path.abspath(os.path.join(os.getcwd(), "alembic.ini")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "alembic.ini")),
        ]
    alembic_found, alembic_target = resolve_candidate_path([c for c in alembic_candidates if c])

    if not alembic_found:
        expected = alembic_env or "/app/alembic.ini"
        missing_files.append(f"Database Migration Config: 'alembic.ini' (Checked: {expected})")

    # -------------------------------------------------------------------------
    # 2. Environment Variables Validation (Strictly Names Only, Never Values)
    # -------------------------------------------------------------------------
    app_env = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower().strip()
    is_production = app_env in ("production", "prod")

    # In production, secure JWT secret key is strictly required
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if is_production:
        if not jwt_secret or jwt_secret.strip() == "" or jwt_secret == "trovi_dev_fallback_secret_key_2026":
            missing_env_vars.append(
                "JWT_SECRET_KEY (Required in production: must be explicitly set and not use default development secret)"
            )

    # PORT validation if explicitly set
    port_str = os.getenv("PORT")
    if port_str is not None:
        try:
            port_val = int(port_str.strip())
            if port_val < 1 or port_val > 65535:
                missing_env_vars.append("PORT (Invalid: must be an integer between 1 and 65535)")
        except ValueError:
            missing_env_vars.append("PORT (Invalid: must be a numeric integer)")

    # 3. Production Demo Account Security Warning
    if is_production:
        check_production_demo_accounts()

    is_valid = (len(missing_files) == 0 and len(missing_env_vars) == 0)
    return is_valid, missing_files, missing_env_vars


def check_production_demo_accounts() -> List[str]:
    """
    Checks if known demo user accounts (e.g. admin@moss.internal, shopper@moss.internal)
    exist in the database when running in production mode.
    Logs and displays a high-visibility security warning.
    """
    found_emails: List[str] = []
    try:
        from backend.app.db.session import SessionLocal
        from backend.app.db.models import User
        db = SessionLocal()
        try:
            demo_emails = ["admin@moss.internal", "shopper@moss.internal"]
            found_users = db.query(User).filter(User.email.in_(demo_emails)).all()
            if found_users:
                found_emails = [u.email for u in found_users]
                warning_banner = (
                    "\n" + "!" * 80 + "\n"
                    f"[SECURITY WARNING] Known demo account(s) {found_emails} exist in the database "
                    "while running in PRODUCTION mode!\n"
                    "Demo accounts must be removed or deactivated in production to prevent security vulnerabilities.\n"
                    + "!" * 80 + "\n"
                )
                logger.warning(warning_banner)
                sys.stderr.write(warning_banner)
                sys.stderr.flush()
        finally:
            db.close()
    except Exception as exc:
        logger.debug(f"Demo accounts check skipped: {exc}")
    return found_emails



def build_failure_message(missing_files: List[str], missing_env_vars: List[str]) -> str:
    """Constructs a clear, professional diagnostic failure banner."""
    lines = [
        "",
        "=" * 80,
        "FATAL STARTUP SELF-CHECK FAILED",
        "=" * 80,
        "The application cannot start because required runtime files or environment",
        "variables are missing or invalid.",
        "",
    ]

    if missing_files:
        lines.append("[Missing Required Files]")
        for item in missing_files:
            lines.append(f"  • {item}")
        lines.append("")

    if missing_env_vars:
        lines.append("[Missing or Invalid Environment Variables (Names Only)]")
        for item in missing_env_vars:
            lines.append(f"  • {item}")
        lines.append("")

    lines.extend([
        "Remediation Guidance:",
        "  1. In Docker: Ensure Dockerfile contains:",
        "       COPY config/ ./config/",
        "       COPY prompts/ ./prompts/",
        "       COPY alembic.ini ./alembic.ini",
        "  2. In Render / Cloud: Configure required environment variables in your Dashboard.",
        "  3. For Local Testing: Run with:",
        "       docker build -t trovi . && docker run --rm -p 8000:8000 --env-file backend/.env trovi",
        "=" * 80,
        "",
    ])
    return "\n".join(lines)


def run_startup_self_check(exit_on_failure: bool = True, raise_exception: bool = False) -> bool:
    """
    Executes the startup self-check.
    If validation fails:
      - Writes diagnostic banner to sys.stderr
      - Logs critical error
      - Exits process with code 1 (if exit_on_failure=True)
      - Raises RuntimeError (if raise_exception=True)
    Returns True if passed.
    """
    is_valid, missing_files, missing_env_vars = check_startup_prerequisites()

    if not is_valid:
        error_msg = build_failure_message(missing_files, missing_env_vars)
        sys.stderr.write(error_msg + "\n")
        sys.stderr.flush()
        logger.critical(error_msg)

        if raise_exception:
            raise RuntimeError("Startup self-check failed. See stderr for details.")
        if exit_on_failure:
            sys.exit(1)
        return False

    logger.info("[Startup Self-Check] PASS: All required runtime files and configurations verified.")
    return True


if __name__ == "__main__":
    passed = run_startup_self_check(exit_on_failure=True)
    if passed:
        print("[Startup Self-Check] SUCCESS: All runtime prerequisites verified.")
