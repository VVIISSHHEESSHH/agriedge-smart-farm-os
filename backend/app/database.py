"""
Async SQLAlchemy engine, session factory and startup helper.

Usage in FastAPI route::

    from app.database import get_session
    from sqlalchemy.ext.asyncio import AsyncSession
    from fastapi import Depends

    @router.get("/example")
    async def example(session: AsyncSession = Depends(get_session)):
        ...

Note: create_db_and_tables() is called in main.py lifespan for dev convenience.
      In production, use `alembic upgrade head` instead.
"""

from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
# Import models package so all model classes register with Base.metadata
import app.models  # noqa: F401
from app.models.base import Base


engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    # SQLite-specific: allow concurrent async usage without threading errors
    connect_args={"check_same_thread": False}
    if "sqlite" in settings.database_url
    else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
)


async def create_db_and_tables() -> None:
    """
    Create all registered tables on startup.

    ⚠️  Development convenience only.
        Use `alembic upgrade head` for production / staging deployments.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a database session per request."""
    async with AsyncSessionLocal() as session:
        yield session
