"""
Unit tests for the Trovi Startup Self-Check system.
Validates file detection, environment validation, sensitive value non-leakage, and exit handling.
"""

import os
import sys
import pytest
from backend.app.startup_check import (
    check_startup_prerequisites,
    build_failure_message,
    run_startup_self_check,
)


def test_startup_check_passes_in_default_workspace(monkeypatch):
    """Under normal dev environment with files present, prerequisites check must pass."""
    monkeypatch.delenv("POLICY_PATH", raising=False)
    monkeypatch.delenv("AGENT_PROMPT_PATH", raising=False)
    monkeypatch.delenv("ALEMBIC_CONFIG_PATH", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")

    is_valid, missing_files, missing_env = check_startup_prerequisites()
    assert is_valid is True
    assert len(missing_files) == 0
    assert len(missing_env) == 0


def test_startup_check_detects_missing_policy_file(monkeypatch):
    """When POLICY_PATH points to a non-existent file, it must be reported in missing_files."""
    non_existent = "/nonexistent/path/to/policies.yaml"
    monkeypatch.setenv("POLICY_PATH", non_existent)

    is_valid, missing_files, _ = check_startup_prerequisites()
    assert is_valid is False
    assert any("policies.yaml" in f and non_existent in f for f in missing_files)


def test_startup_check_detects_missing_prompt_file(monkeypatch):
    """When AGENT_PROMPT_PATH points to a non-existent file, it must be reported in missing_files."""
    non_existent = "/nonexistent/path/to/agent_prompt.md"
    monkeypatch.setenv("AGENT_PROMPT_PATH", non_existent)

    is_valid, missing_files, _ = check_startup_prerequisites()
    assert is_valid is False
    assert any("agent_system.md" in f and non_existent in f for f in missing_files)


def test_startup_check_detects_missing_alembic_file(monkeypatch):
    """When ALEMBIC_CONFIG_PATH points to a non-existent file, it must be reported in missing_files."""
    non_existent = "/nonexistent/path/to/alembic.ini"
    monkeypatch.setenv("ALEMBIC_CONFIG_PATH", non_existent)

    is_valid, missing_files, _ = check_startup_prerequisites()
    assert is_valid is False
    assert any("alembic.ini" in f and non_existent in f for f in missing_files)


def test_startup_check_production_requires_explicit_jwt_secret(monkeypatch):
    """In production, missing JWT_SECRET_KEY must fail validation and report the variable by name."""
    monkeypatch.delenv("POLICY_PATH", raising=False)
    monkeypatch.delenv("AGENT_PROMPT_PATH", raising=False)
    monkeypatch.delenv("ALEMBIC_CONFIG_PATH", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    is_valid, _, missing_env = check_startup_prerequisites()
    assert is_valid is False
    assert any("JWT_SECRET_KEY" in env for env in missing_env)


def test_startup_check_production_rejects_default_dev_secret(monkeypatch):
    """In production, using the default development secret must fail validation."""
    monkeypatch.delenv("POLICY_PATH", raising=False)
    monkeypatch.delenv("AGENT_PROMPT_PATH", raising=False)
    monkeypatch.delenv("ALEMBIC_CONFIG_PATH", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "trovi_dev_fallback_secret_key_2026")

    is_valid, _, missing_env = check_startup_prerequisites()
    assert is_valid is False
    assert any("JWT_SECRET_KEY" in env for env in missing_env)


def test_startup_check_production_passes_with_strong_secret(monkeypatch):
    """In production, with a strong custom secret, validation passes."""
    monkeypatch.delenv("POLICY_PATH", raising=False)
    monkeypatch.delenv("AGENT_PROMPT_PATH", raising=False)
    monkeypatch.delenv("ALEMBIC_CONFIG_PATH", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "super_secure_random_key_production_trovi_2026_x991")

    is_valid, missing_files, missing_env = check_startup_prerequisites()
    assert is_valid is True
    assert len(missing_files) == 0
    assert len(missing_env) == 0


def test_startup_check_never_leaks_secret_values(monkeypatch):
    """Ensures that environment variable values are strictly never included in failure messages."""
    secret_value = "VERY_CONFIDENTIAL_SECRET_VALUE_DO_NOT_LEAK"
    monkeypatch.setenv("JWT_SECRET_KEY", secret_value)
    monkeypatch.setenv("ENVIRONMENT", "production")
    # Force another error so failure message is generated
    monkeypatch.setenv("PORT", "invalid-port-string")

    is_valid, missing_files, missing_env = check_startup_prerequisites()
    assert is_valid is False

    msg = build_failure_message(missing_files, missing_env)
    assert secret_value not in msg
    assert "PORT" in msg


def test_run_startup_self_check_raises_runtime_error_when_configured(monkeypatch):
    """Ensures raise_exception=True throws RuntimeError on check failure."""
    monkeypatch.setenv("POLICY_PATH", "/nonexistent/test.yaml")
    with pytest.raises(RuntimeError) as exc_info:
        run_startup_self_check(exit_on_failure=False, raise_exception=True)
    assert "Startup self-check failed" in str(exc_info.value)


def test_startup_check_production_warns_on_demo_account(monkeypatch, test_db_path):
    """When running in production mode and a known demo account exists in the DB, a warning is logged and returned."""
    from backend.app.startup_check import check_production_demo_accounts
    from backend.app.db.session import SessionLocal
    from backend.app.db.models import User
    from backend.app.auth.security import hash_password

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin@moss.internal").first()
        if not user:
            user = User(
                email="admin@moss.internal",
                hashed_password=hash_password("DummyHash123!"),
                full_name="Demo Admin",
                role="admin",
                is_active=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()

    monkeypatch.setenv("APP_ENV", "production")
    detected = check_production_demo_accounts()
    assert "admin@moss.internal" in detected

