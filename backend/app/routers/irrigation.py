"""
FastAPI router for transparent, simulated irrigation recommendations and decision logs.
"""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.farmer import Farm
from app.models.sector import FarmSector
from app.models.sensor import SensorReading
from app.models.irrigation import IrrigationDecisionLog, IrrigationSchedule
from app.schemas.all_schemas import (
    IrrigationDecisionResponse,
    IrrigationOverrideRequest,
    IrrigationLogResponse,
    IrrigationScheduleCreate,
    IrrigationScheduleResponse,
)
from app.services.irrigation_engine import evaluate_irrigation
from app.auth import ensure_owner, get_current_farmer

router = APIRouter(prefix="/irrigation", tags=["Irrigation Engine"])


@router.get("/recommend/{sector_id}", response_model=IrrigationDecisionResponse)
async def get_irrigation_recommendation(
    sector_id: int,
    rain_chance: float = Query(default=0.10, ge=0.0, le=1.0),
    session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)
):
    """
    Evaluates current sensor telemetry against configured crop watering rules.
    Does NOT activate any hardware.
    """
    sector = await session.get(FarmSector, sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector with id {sector_id} not found")
    farm = await session.get(Farm, sector.farm_id)
    ensure_owner(farm.farmer_id, current)

    # Fetch latest sensor reading
    result = await session.execute(
        select(SensorReading)
        .where(SensorReading.sector_id == sector_id)
        .order_by(desc(SensorReading.recorded_at))
        .limit(1)
    )
    latest_reading = result.scalar_one_or_none()
    if not latest_reading:
        raise HTTPException(status_code=400, detail="Cannot evaluate irrigation: no sensor readings recorded for sector")

    decision = evaluate_irrigation(
        sector_id=sector.id,
        crop=sector.crop,
        moisture_pct=latest_reading.moisture_pct,
        reading_time=latest_reading.recorded_at,
        target_moisture_min=sector.target_moisture_min,
        forecast_rain_chance=rain_chance,
    )
    return decision


@router.post("/execute/{sector_id}", response_model=IrrigationLogResponse, status_code=status.HTTP_201_CREATED)
async def record_irrigation_event(
    sector_id: int,
    rain_chance: float = Query(default=0.10, ge=0.0, le=1.0),
    session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)
):
    """
    Evaluates rule engine and logs the decision event into the database.
    Simulated software action only.
    """
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
    latest_reading = result.scalar_one_or_none()
    if not latest_reading:
        raise HTTPException(status_code=400, detail="Cannot evaluate irrigation: no sensor readings found")

    eval_result = evaluate_irrigation(
        sector_id=sector.id,
        crop=sector.crop,
        moisture_pct=latest_reading.moisture_pct,
        reading_time=latest_reading.recorded_at,
        target_moisture_min=sector.target_moisture_min,
        forecast_rain_chance=rain_chance,
    )

    log_entry = IrrigationDecisionLog(
        sector_id=sector.id,
        decision=eval_result["decision"],
        reason_plain=eval_result["reason_plain"],
        rule_code=eval_result["rule_code"],
        duration_minutes=eval_result["duration_minutes"],
        moisture_at_decision=eval_result["moisture_at_decision"],
        is_simulated=True,
        triggered_at=datetime.now(timezone.utc),
    )
    session.add(log_entry)
    await session.commit()
    await session.refresh(log_entry)
    return log_entry


@router.post("/override", response_model=IrrigationLogResponse, status_code=status.HTTP_201_CREATED)
async def manual_irrigation_override(
    override_in: IrrigationOverrideRequest,
    session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)
):
    """
    Simulated manual override triggered by the farmer.
    """
    sector = await session.get(FarmSector, override_in.sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector with id {override_in.sector_id} not found")
    farm = await session.get(Farm, sector.farm_id)
    ensure_owner(farm.farmer_id, current)

    # Get latest moisture if available, or fallback
    result = await session.execute(
        select(SensorReading)
        .where(SensorReading.sector_id == override_in.sector_id)
        .order_by(desc(SensorReading.recorded_at))
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    moisture = latest.moisture_pct if latest else 40.0

    eval_result = evaluate_irrigation(
        sector_id=sector.id,
        crop=sector.crop,
        moisture_pct=moisture,
        reading_time=datetime.now(timezone.utc),
        is_manual_override=True,
        override_action=override_in.action,
    )

    duration = override_in.duration_minutes or eval_result["duration_minutes"]

    log_entry = IrrigationDecisionLog(
        sector_id=sector.id,
        decision=override_in.action,
        reason_plain=eval_result["reason_plain"],
        rule_code="R0_MANUAL_OVERRIDE",
        duration_minutes=duration,
        moisture_at_decision=moisture,
        is_simulated=True,
        triggered_at=datetime.now(timezone.utc),
    )
    session.add(log_entry)
    await session.commit()
    await session.refresh(log_entry)
    return log_entry


@router.get("/logs/{sector_id}", response_model=List[IrrigationLogResponse])
async def get_irrigation_logs(
    sector_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)
):
    sector = await session.get(FarmSector, sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail="Sector not found")
    farm = await session.get(Farm, sector.farm_id)
    ensure_owner(farm.farmer_id, current)
    result = await session.execute(
        select(IrrigationDecisionLog)
        .where(IrrigationDecisionLog.sector_id == sector_id)
        .order_by(desc(IrrigationDecisionLog.triggered_at))
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/schedules", response_model=IrrigationScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_irrigation_schedule(
    schedule_in: IrrigationScheduleCreate,
    session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)
):
    """
    Generate or record a daily simulated irrigation plan for a farm's sectors.
    Purely simulated schedule — no physical actuators.
    """
    farm = await session.get(Farm, schedule_in.farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm with id {schedule_in.farm_id} not found")
    ensure_owner(farm.farmer_id, current)

    sched = IrrigationSchedule(
        farm_id=schedule_in.farm_id,
        schedule_date=schedule_in.schedule_date,
        sector_plan=schedule_in.sector_plan,
        is_simulated=True,
    )
    session.add(sched)
    await session.commit()
    await session.refresh(sched)
    return sched


@router.get("/schedules/{farm_id}", response_model=List[IrrigationScheduleResponse])
async def get_farm_irrigation_schedules(
    farm_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    session: AsyncSession = Depends(get_session), current=Depends(get_current_farmer)
):
    """
    Retrieve past and upcoming simulated irrigation schedules for a farm.
    """
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm with id {farm_id} not found")
    ensure_owner(farm.farmer_id, current)

    result = await session.execute(
        select(IrrigationSchedule)
        .where(IrrigationSchedule.farm_id == farm_id)
        .order_by(desc(IrrigationSchedule.schedule_date))
        .limit(limit)
    )
    return result.scalars().all()

