import os
from typing import List


class Settings:
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Security & JWT
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "moss_super_secure_jwt_secret_key_2026_dev_env")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Database
    # Supports SQLite ("sqlite:///path") and PostgreSQL ("postgresql://user:pass@host:5432/db")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        os.getenv(
            "SHOPI_DB_PATH",
            f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'shopai.db'))}"
        )
    )

    # CORS
    @property
    def cors_origins(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
