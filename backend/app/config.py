from __future__ import annotations

import json
import os
import secrets
from typing import Any, List

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://cashflow:cashflow@localhost:5432/cashflow"

    # Security
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS - configurable via CORS_ORIGINS env variable
    # Accepts JSON array: '["http://localhost:5173","http://localhost:3000"]'
    # Or comma-separated: 'http://localhost:5173,http://localhost:3000'
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Admin
    ADMIN_DEFAULT_PASSWORD: str = ""

    # Backup
    BACKUP_DIR: str = "/backups"
    BACKUP_RETENTION_DAYS: int = 30

    # Debug
    DEBUG: bool = False

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """Transform postgresql:// → postgresql+asyncpg:// for Render compatibility."""
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or v == "change-me-in-production":
            if os.environ.get("RENDER"):
                raise ValueError(
                    "SECRET_KEY must be explicitly set in production. "
                    "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
            # Local dev: auto-generate (acceptable)
            return secrets.token_urlsafe(64)
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        """Parse CORS origins from env variable.

        Accepts:
        - A Python list (already parsed)
        - A JSON array string: '["http://localhost:5173"]'
        - A comma-separated string: 'http://localhost:5173,http://localhost:3000'
        """
        if isinstance(v, list):
            origins = v
        elif isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                try:
                    origins = json.loads(v)
                except json.JSONDecodeError:
                    raise ValueError(f"Invalid JSON for CORS_ORIGINS: {v}")
            else:
                origins = [origin.strip() for origin in v.split(",") if origin.strip()]
        else:
            raise ValueError(f"CORS_ORIGINS must be a list or string, got {type(v)}")

        # Security: never allow wildcard origin in CORS
        if "*" in origins:
            raise ValueError(
                "CORS_ORIGINS must not contain '*'. "
                "Specify explicit origins like 'http://localhost:5173'."
            )

        return origins

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
