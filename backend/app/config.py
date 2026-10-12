import os
import sys
import logging
from typing import List, Optional
from dotenv import load_dotenv

logger = logging.getLogger("trovi.config")

# Load environment variables from .env if present
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
env_path = os.path.join(root_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()


class Settings:
    # Environment (supports both APP_ENV and ENVIRONMENT)
    APP_ENV: str = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()
    ENVIRONMENT: str = APP_ENV

    PORT: int = int(os.getenv("PORT", "8000"))

    # Security & JWT
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "trovi_dev_fallback_secret_key_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        os.getenv(
            "SHOPI_DB_PATH",
            f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'shopai.db'))}"
        )
    )

    # Notifications & OTP Providers (SMTP, Twilio SMS & WhatsApp)
    SMTP_HOST: Optional[str] = os.getenv("SMTP_HOST")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: Optional[str] = os.getenv("SMTP_USER")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    SMTP_FROM: Optional[str] = os.getenv("SMTP_FROM")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

    TWILIO_ACCOUNT_SID: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_FROM_NUMBER: Optional[str] = os.getenv("TWILIO_FROM_NUMBER")
    TWILIO_WHATSAPP_FROM_NUMBER: Optional[str] = os.getenv("TWILIO_WHATSAPP_FROM_NUMBER")

    # CORS
    @property
    def cors_origins(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")
        origins = [o.strip() for o in raw.split(",") if o.strip()]
        # Guarantee local frontend dev origins are present
        for local_origin in ["http://localhost:5173", "http://127.0.0.1:5173"]:
            if local_origin not in origins:
                origins.append(local_origin)
        return origins

    def validate_environment(self) -> None:
        """
        Validates environment configuration on startup.
        Fails fast with readable message on missing required variables (name only, never value).
        """
        # In production environments, JWT_SECRET_KEY must be explicitly set and secure
        if self.ENVIRONMENT in ("production", "prod"):
            required_prod_vars = ["JWT_SECRET_KEY"]
            for var in required_prod_vars:
                val = os.getenv(var)
                if not val or val == "trovi_dev_fallback_secret_key_2026":
                    msg = f"Startup failed: Required environment variable '{var}' is missing or using default in production."
                    logger.critical(msg)
                    raise RuntimeError(msg)


settings = Settings()
