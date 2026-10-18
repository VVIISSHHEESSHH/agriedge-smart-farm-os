"""
FastAPI router for Sensor Telemetry and deterministic simulation triggers.
"""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.sector import FarmSector
from app.models.sensor import SensorReading
from app.schemas.all_schemas import SensorReadingCreate, SensorReadingResponse
from app.services.simulation import simulate_reading_for_sector
from app.auth import ensure_owner, get_current_farmer
from app.models.farmer import Farm

router = APIRouter(prefix="/sensors", tags=["Sensors & Telemetry"])


@router.post("/simulate/{sector_id}", response_model=SensorReadingResponse, status_code=status.HTTP_201_CREATED)
async def trigger_simulated_reading(sector_id: int, session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)):
    """
    Generate a deterministic simulated sensor reading for a sector.
    Labels reading explicitly as is_simulated=True.
    """
    sector = await session.get(FarmSector, sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector with id {sector_id} not found")
    farm = await session.get(Farm, sector.farm_id)
    ensure_owner(farm.farmer_id, current)

    sim_data = simulate_reading_for_sector(
        sector_id=sector.id,
        crop=sector.crop,
        timestamp=datetime.now(timezone.utc),
    )

    reading = SensorReading(**sim_data)
    session.add(reading)

    # Dynamically update sector health status based on soil moisture
    if reading.moisture_pct < (sector.target_moisture_min - 5.0):
        sector.health_status = "alert"
    elif reading.moisture_pct < sector.target_moisture_min:
        sector.health_status = "watch"
    else:
        sector.health_status = "healthy"

    await session.commit()
    await session.refresh(reading)
    return reading


@router.post("", response_model=SensorReadingResponse, status_code=status.HTTP_201_CREATED)
async def create_sensor_reading(reading_in: SensorReadingCreate, session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)):
    """
    Submit a sensor reading manually (always marked simulated in prototype).
    """
    sector = await session.get(FarmSector, reading_in.sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector with id {reading_in.sector_id} not found")
    farm = await session.get(Farm, sector.farm_id)
    ensure_owner(farm.farmer_id, current)

    reading = SensorReading(
        sector_id=reading_in.sector_id,
        moisture_pct=reading_in.moisture_pct,
        temp_c=reading_in.temp_c,
        ph=reading_in.ph,
        nitrogen_ppm=reading_in.nitrogen_ppm,
        phosphorus_ppm=reading_in.phosphorus_ppm,
        potassium_ppm=reading_in.potassium_ppm,
        is_simulated=True,  # Mandatory honesty enforcement
        sim_seed=reading_in.sim_seed,
        recorded_at=datetime.now(timezone.utc),
    )
    session.add(reading)
    await session.commit()
    await session.refresh(reading)
    return reading


@router.get("/sector/{sector_id}/latest", response_model=SensorReadingResponse)
async def get_latest_sensor_reading(sector_id: int, session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)):
    sector = await session.get(FarmSector, sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector with id {sector_id} not found")
    farm = await session.get(Farm, sector.farm_id)
    ensure_owner(farm.farmer_id, current)

    result = await session.execute(
        select(SensorReading)
        .where(SensorReading.sector_id == sector_id)
        .order_by(desc(SensorReading.recorded_at))
        .limit(1)
    )
    reading = result.scalar_one_or_none()
    if not reading:
        raise HTTPException(status_code=404, detail=f"No sensor readings recorded for sector {sector_id}")
    return reading


@router.get("/sector/{sector_id}/history", response_model=List[SensorReadingResponse])
async def get_sensor_history(
    sector_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session)
    , current=Depends(get_current_farmer)
):
    sector = await session.get(FarmSector, sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector with id {sector_id} not found")
    farm = await session.get(Farm, sector.farm_id)
    ensure_owner(farm.farmer_id, current)

    result = await session.execute(
        select(SensorReading)
        .where(SensorReading.sector_id == sector_id)
        .order_by(desc(SensorReading.recorded_at))
        .limit(limit)
    )
    return result.scalars().all()
