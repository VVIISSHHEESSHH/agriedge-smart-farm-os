"""
FastAPI router for Disease Reports and Outbreak summaries.
"""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.community import DiseaseReport, Outbreak
from app.schemas.all_schemas import (
    DiseaseReportCreate,
    DiseaseReportResponse,
    OutbreakResponse,
)
from app.auth import get_current_farmer
from app.models.farmer import Farmer

router = APIRouter(prefix="/community", tags=["Community Disease Outbreak Radar"])


@router.post("/reports", response_model=DiseaseReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_disease_report(report_in: DiseaseReportCreate, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    report = DiseaseReport(
        farmer_id=current.id,
        crop=report_in.crop,
        disease_label=report_in.disease_label,
        district=report_in.district,
        state=report_in.state,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        severity=report_in.severity,
        notes=report_in.notes,
        reported_at=datetime.now(timezone.utc),
    )
    session.add(report)
    await session.commit()
    await session.refresh(report)

    # Simple outbreak cluster check: if >= 3 reports in same district & crop within last 7 days
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    count_res = await session.execute(
        select(func.count(DiseaseReport.id))
        .where(DiseaseReport.district == report.district)
        .where(DiseaseReport.crop == report.crop)
        .where(DiseaseReport.reported_at >= seven_days_ago)
    )
    report_count = count_res.scalar() or 1

    if report_count >= 3:
        # Check if active outbreak record exists
        existing_outbreak = await session.execute(
            select(Outbreak)
            .where(Outbreak.district == report.district)
            .where(Outbreak.crop == report.crop)
            .where(Outbreak.disease_label == report.disease_label)
        )
        outbreak = existing_outbreak.scalars().first()
        if not outbreak:
            outbreak = Outbreak(
                crop=report.crop,
                disease_label=report.disease_label,
                district=report.district,
                report_count=report_count,
                severity_level="warning" if report_count < 6 else "alert",
                window_start=seven_days_ago.date(),
                window_end=datetime.now(timezone.utc).date(),
                detected_at=datetime.now(timezone.utc),
            )
            session.add(outbreak)
            await session.commit()

    return report


@router.get("/reports", response_model=List[DiseaseReportResponse])
async def list_disease_reports(
    district: Optional[str] = None,
    crop: Optional[str] = None,
    limit: int = Query(default=30, ge=1, le=100),
    session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)
):
    query = select(DiseaseReport).order_by(desc(DiseaseReport.reported_at)).limit(limit)
    if district:
        query = query.where(DiseaseReport.district.ilike(f"%{district}%"))
    if crop:
        query = query.where(DiseaseReport.crop.ilike(f"%{crop}%"))
    query = query.where(DiseaseReport.farmer_id == current.id)

    result = await session.execute(query)
    return result.scalars().all()


@router.get("/outbreaks", response_model=List[OutbreakResponse])
async def list_active_outbreaks(
    district: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    query = select(Outbreak).order_by(desc(Outbreak.detected_at))
    if district:
        query = query.where(Outbreak.district.ilike(f"%{district}%"))

    result = await session.execute(query)
    return result.scalars().all()
