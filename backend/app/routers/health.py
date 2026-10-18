"""
Health-check router.

GET /health  →  liveness probe for load balancers, CI and the frontend status panel.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session

router = APIRouter(tags=["System"])


@router.get(
    "/health",
    summary="Liveness probe",
    response_description="Application and database status",
)
async def health_check(session: AsyncSession = Depends(get_session)) -> dict:
    """
    Returns the running status of the API and database connectivity.

    - **status**: always `"ok"` if the API process is alive.
    - **db**: `"connected"` if a round-trip query succeeds; `"error"` otherwise.
    - **version**: application version string from `config.py`.
    - **env**: current environment (`development` | `production`).
    """
    try:
        await session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:  # pragma: no cover
        db_status = f"error: {exc}"

    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "env": settings.env,
        "db": db_status,
    }
