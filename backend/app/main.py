"""
AgriEdge FastAPI application factory.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_db_and_tables
from app.routers import (
    auth,
    health,
    farms,
    sensors,
    irrigation,
    marketplace,
    community,
    agrisnap,
)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — runs once at startup and once at shutdown."""
    if settings.env != "production":
        await create_db_and_tables()
    yield


def create_application() -> FastAPI:
    """Construct and configure the FastAPI application."""
    application = FastAPI(
        title=settings.app_name,
        description=(
            "AgriEdge Smart Farm OS — a full-stack agricultural platform with "
            "client-side tomato disease screening using a bundled TFLite artifact "
            "whose provenance and field accuracy are not independently verified, "
            "smart sensor simulation, farmer-to-buyer marketplace, and offline-capable PWA.\n\n"
            "⚠️ **Demo mode**: all sensor data is simulated. "
            "Market prices are reference-only and not connected to live data."
        ),
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── Middleware ─────────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ────────────────────────────────────────────────────────────────
    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(farms.router)
    application.include_router(sensors.router)
    application.include_router(irrigation.router)
    application.include_router(marketplace.router)
    application.include_router(community.router)
    application.include_router(agrisnap.router)

    return application


app = create_application()
