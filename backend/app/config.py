"""
AgriEdge application settings.

Values are read from environment variables or from a .env file.
See .env.example at the repository root for all available variables.

Development defaults are not production credentials. Production settings validation
requires independent generated signing and phone-hash secrets.
"""

from __future__ import annotations

from typing import List
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(value: str) -> str:
    """Adapt provider PostgreSQL URLs and Neon TLS options for SQLAlchemy asyncpg."""
    if not isinstance(value, str):
        return value

    try:
        parts = urlsplit(value)
    except ValueError:
        return value
    scheme = parts.scheme
    if scheme in {"postgres", "postgresql"}:
        scheme = "postgresql+asyncpg"
    elif scheme == "postgresql+asyncpg":
        pass
    else:
        return value

    query = parse_qsl(parts.query, keep_blank_values=True)
    normalized_query = []
    sslmode = None
    for key, item in query:
        if key == "sslmode":
            sslmode = item
        elif key != "channel_binding":
            normalized_query.append((key, item))
    if sslmode and not any(key == "ssl" for key, _ in normalized_query):
        normalized_query.append(("ssl", sslmode))

    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(normalized_query), parts.fragment))


def production_configuration_errors(settings: "Settings") -> list[str]:
    """Return names of unsafe/missing production settings without echoing values."""
    errors = []
    if settings.debug:
        errors.append("DEBUG must be false")
    if len(settings.secret_key) < 32 or settings.secret_key == "demo-secret-key-CHANGE-BEFORE-PRODUCTION":
        errors.append("SECRET_KEY must be a generated value of at least 32 characters")
    if len(settings.phone_hash_secret) < 32:
        errors.append("PHONE_HASH_SECRET must be a generated value of at least 32 characters")
    if settings.demo_read_only and settings.allow_registration:
        errors.append("ALLOW_REGISTRATION must be false when DEMO_READ_ONLY is enabled")
    if not settings.database_url.startswith("postgresql+asyncpg://"):
        errors.append("DATABASE_URL must use PostgreSQL with asyncpg")
    try:
        invalid_origins = any(
            not origin.startswith("https://") or not urlsplit(origin).netloc
            or urlsplit(origin).path not in {"", "/"}
            or urlsplit(origin).query or urlsplit(origin).fragment
            for origin in settings.cors_origins
        )
    except ValueError:
        invalid_origins = True
    if not settings.cors_origins or invalid_origins:
        errors.append("CORS_ORIGINS must contain only HTTPS origins")
    return errors


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        enable_decoding=False,
    )

    # ── Application ───────────────────────────────────────────────────────────
    app_name: str = "AgriEdge Smart Farm OS"
    app_version: str = "0.1.0"
    env: str = "development"  # development | test | production
    debug: bool = True

    # ── Database ──────────────────────────────────────────────────────────────
    # Use sqlite+aiosqlite for dev/demo; postgresql+asyncpg for production.
    database_url: str = "sqlite+aiosqlite:///./agriedge.db"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url_setting(cls, value: str) -> str:
        return normalize_database_url(value)

    # ── Authentication secrets ────────────────────────────────────────────────
    secret_key: str = "demo-secret-key-CHANGE-BEFORE-PRODUCTION"
    phone_hash_secret: str = "development-phone-hash-key-change-before-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    demo_read_only: bool = False
    allow_registration: bool = True

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: List[str] = [
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",   # Vite dev server (IP origin)
        "http://localhost:4173",   # Vite preview
        "http://127.0.0.1:4173",   # Vite preview (IP origin)
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: object) -> List[str]:
        """Allow CORS_ORIGINS to be a comma-separated string in the env file."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v  # type: ignore[return-value]


# Singleton settings instance — import this throughout the app.
settings = Settings()

if settings.env == "production":
    _production_errors = production_configuration_errors(settings)
    if _production_errors:
        raise RuntimeError("Invalid production configuration: " + "; ".join(_production_errors))
