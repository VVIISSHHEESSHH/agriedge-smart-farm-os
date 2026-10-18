"""
Tests for GET /health.

Verifies:
  - Returns HTTP 200.
  - Response body contains all expected fields.
  - Database reports "connected" when using the test in-memory engine.
  - App name matches the configured value.
"""

from __future__ import annotations

from httpx import AsyncClient


async def test_health_returns_200(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200


async def test_health_status_is_ok(client: AsyncClient) -> None:
    data = response = await client.get("/health")
    data = response.json()
    assert data["status"] == "ok"


async def test_health_db_connected(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.json()["db"] == "connected"


async def test_health_contains_version(client: AsyncClient) -> None:
    response = await client.get("/health")
    data = response.json()
    assert "version" in data
    assert data["version"]  # non-empty


async def test_health_app_name(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.json()["app"] == "AgriEdge Smart Farm OS"


async def test_health_env_field_present(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.json()["env"] in {"development", "test", "production"}


async def test_cors_allows_vite_preview_ip_origin(client: AsyncClient) -> None:
    response = await client.options(
        "/health",
        headers={
            "Origin": "http://127.0.0.1:4173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:4173"
