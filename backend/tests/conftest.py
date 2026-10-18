"""
Shared test fixtures for the AgriEdge backend test suite.

Uses an in-memory SQLite database so tests are:
  - Fast (no disk I/O)
  - Isolated (fresh schema per engine fixture)
  - Safe (never touch the dev database)

Fixtures available to all tests:
  test_engine  — async engine with schema already created
  db_session   — one async session per test (function scope)
  client       — httpx.AsyncClient wired to the FastAPI app via ASGITransport

pytest.ini sets asyncio_mode = auto, so no @pytest.mark.asyncio needed.
"""

from __future__ import annotations

import pytest
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.database import Base, get_session
from app.main import app
from app.auth import get_current_farmer
from app.models.farmer import Farmer
from sqlalchemy import select

# ── Test database ─────────────────────────────────────────────────────────────
_TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture()
async def test_engine():
    """Async engine backed by in-memory SQLite for test isolation."""
    engine = create_async_engine(_TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture()
async def db_session(test_engine) -> AsyncSession:
    """Function-scoped database session — each test gets a clean connection."""
    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture()
async def client(db_session: AsyncSession) -> AsyncClient:
    """
    Async HTTP test client.

    Overrides the ``get_session`` dependency so all route handlers use the
    same in-memory test session instead of the real database.
    """

    async def _override_get_session():
        yield db_session

    async def _test_farmer(request: Request):
        # Existing feature tests exercise route behavior with an explicit test identity.
        test_farmer_id = request.headers.get("x-test-farmer-id")
        query = select(Farmer).order_by(Farmer.id).limit(1)
        if test_farmer_id and test_farmer_id.isdigit():
            query = select(Farmer).where(Farmer.id == int(test_farmer_id))
        result = await db_session.execute(query)
        farmer = result.scalar_one_or_none()
        if farmer is None:
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Test farmer not seeded")
        return farmer

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_current_farmer] = _test_farmer
    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture()
async def unauthenticated_client(db_session: AsyncSession) -> AsyncClient:
    """Client that uses the real bearer dependency for auth regression tests."""
    async def _override_get_session():
        yield db_session
    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides.pop(get_current_farmer, None)
    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
