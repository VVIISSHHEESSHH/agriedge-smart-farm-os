from app.config import Settings, normalize_database_url, production_configuration_errors


def test_neon_connection_url_is_normalized_for_asyncpg():
    url = (
        "postgresql://user:secret@ep-example.neon.tech/farm"
        "?sslmode=require&channel_binding=require&application_name=agriedge"
    )

    assert normalize_database_url(url) == (
        "postgresql+asyncpg://user:secret@ep-example.neon.tech/farm"
        "?application_name=agriedge&ssl=require"
    )


def test_sqlite_and_existing_asyncpg_urls_are_preserved():
    assert normalize_database_url("sqlite+aiosqlite:///./agriedge.db") == "sqlite+aiosqlite:///./agriedge.db"
    url = "postgresql+asyncpg://user:secret@db.example/farm?ssl=require"
    assert normalize_database_url(url) == url


def test_production_configuration_accepts_safe_render_settings():
    config = Settings(
        env="production",
        debug=False,
        secret_key="generated-test-key-that-is-over-32-chars",
        phone_hash_secret="generated-phone-hash-key-over-32-characters",
        database_url="postgresql://user:secret@db.example/farm?sslmode=require",
        cors_origins="https://agriedge-frontend.onrender.com",
    )

    assert production_configuration_errors(config) == []


def test_production_configuration_names_unsafe_fields_without_echoing_values():
    private_test_value = "short-test-value"
    config = Settings(
        env="production",
        debug=True,
        secret_key=private_test_value,
        database_url="sqlite+aiosqlite:///./agriedge.db",
        cors_origins="http://localhost:5173",
    )

    errors = production_configuration_errors(config)
    message = "; ".join(errors)
    assert "DEBUG" in message
    assert "SECRET_KEY" in message
    assert "DATABASE_URL" in message
    assert "CORS_ORIGINS" in message
    assert private_test_value not in message


def test_comma_separated_cors_environment_value_is_supported(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://farm.example,https://preview.example")
    config = Settings(_env_file=None)

    assert config.cors_origins == ["https://farm.example", "https://preview.example"]
