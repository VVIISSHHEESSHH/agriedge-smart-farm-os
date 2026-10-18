"""
FastAPI router for Farms and Sectors.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.farmer import Farm, Farmer
from app.models.sector import FarmSector
from app.schemas.all_schemas import FarmCreate, FarmResponse, SectorCreate, SectorResponse
from app.auth import ensure_owner, get_current_farmer

router = APIRouter(prefix="/farms", tags=["Farms & Sectors"])


@router.get("/mine", response_model=List[FarmResponse])
async def list_my_farms(session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    result = await session.execute(
        select(Farm).options(selectinload(Farm.sectors)).where(Farm.farmer_id == current.id).order_by(Farm.id)
    )
    return result.scalars().all()


@router.post("", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
async def create_farm(farm_in: FarmCreate, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):

    farm = Farm(
        farmer_id=current.id,
        name=farm_in.name,
        area_hectares=farm_in.area_hectares,
        location_desc=farm_in.location_desc,
    )
    session.add(farm)
    await session.commit()
    await session.refresh(farm)
    
    # Reload with empty sectors list for clean response
    result = await session.execute(
        select(Farm).options(selectinload(Farm.sectors)).where(Farm.id == farm.id)
    )
    return result.scalar_one()


@router.get("/{farm_id}", response_model=FarmResponse)
async def get_farm(farm_id: int, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    result = await session.execute(
        select(Farm).options(selectinload(Farm.sectors)).where(Farm.id == farm_id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm with id {farm_id} not found")
    ensure_owner(farm.farmer_id, current)
    return farm


@router.post("/{farm_id}/sectors", response_model=SectorResponse, status_code=status.HTTP_201_CREATED)
async def create_sector(farm_id: int, sector_in: SectorCreate, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm with id {farm_id} not found")
    ensure_owner(farm.farmer_id, current)

    sector = FarmSector(
        farm_id=farm_id,
        name=sector_in.name,
        crop=sector_in.crop,
        area_hectares=sector_in.area_hectares,
        target_moisture_min=sector_in.target_moisture_min,
        target_moisture_max=sector_in.target_moisture_max,
        health_status="healthy",
    )
    session.add(sector)
    await session.commit()
    await session.refresh(sector)
    return sector


@router.get("/{farm_id}/sectors", response_model=List[SectorResponse])
async def list_sectors(farm_id: int, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm with id {farm_id} not found")
    ensure_owner(farm.farmer_id, current)

    result = await session.execute(select(FarmSector).where(FarmSector.farm_id == farm_id))
    return result.scalars().all()
