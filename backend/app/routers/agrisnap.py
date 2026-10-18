"""
FastAPI router for AgriSnap AI scan audit history.
"""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.agrisnap import AgriSnapLog
from app.schemas.all_schemas import AgriSnapLogCreate, AgriSnapLogResponse
from app.auth import ensure_owner, get_current_farmer
from app.models.farmer import Farmer

router = APIRouter(prefix="/agrisnap", tags=["AgriSnap AI"])


@router.post("/log", response_model=AgriSnapLogResponse, status_code=status.HTTP_201_CREATED)
async def log_agrisnap_scan(log_in: AgriSnapLogCreate, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    """
    Log client-side TensorFlow.js disease detection inference metadata.
    Does not transmit raw images to preserve bandwidth and privacy.
    """
    log_entry = AgriSnapLog(
        farmer_id=current.id,
        model_version=log_in.model_version,
        crop_input=log_in.crop_input,
        predicted_label=log_in.predicted_label,
        confidence=log_in.confidence,
        was_unclear=log_in.was_unclear,
        latitude=log_in.latitude,
        longitude=log_in.longitude,
        scanned_at=datetime.now(timezone.utc),
    )
    session.add(log_entry)
    await session.commit()
    await session.refresh(log_entry)
    return log_entry


@router.get("/history/{farmer_id}", response_model=List[AgriSnapLogResponse])
async def get_farmer_scan_history(
    farmer_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)
):
    ensure_owner(farmer_id, current)
    result = await session.execute(
        select(AgriSnapLog)
        .where(AgriSnapLog.farmer_id == farmer_id)
        .order_by(desc(AgriSnapLog.scanned_at))
        .limit(limit)
    )
    return result.scalars().all()
