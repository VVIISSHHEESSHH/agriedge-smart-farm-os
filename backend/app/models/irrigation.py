"""
SQLAlchemy ORM models for IrrigationSchedule and IrrigationDecisionLog.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import TYPE_CHECKING, Dict, Any, Optional
from sqlalchemy import String, Float, Integer, Boolean, Date, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.farmer import Farm
    from app.models.sector import FarmSector


class IrrigationSchedule(TimestampMixin, Base):
    """
    Generated irrigation plan for a farm's sectors on a given date.
    Purely simulated schedule — no physical actuators.
    """
    __tablename__ = "irrigation_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    sector_plan: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    farm: Mapped["Farm"] = relationship("Farm", back_populates="irrigation_schedules")


class IrrigationDecisionLog(Base):
    """
    Transparent audit log of why an irrigation action was recommended or executed.
    Clearly marks simulation status and provides rule rationale.
    """
    __tablename__ = "irrigation_decision_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sector_id: Mapped[int] = mapped_column(ForeignKey("farm_sectors.id", ondelete="CASCADE"), nullable=False, index=True)
    decision: Mapped[str] = mapped_column(String(30), nullable=False)  # irrigate, skip, delay, manual_override
    reason_plain: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_code: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    moisture_at_decision: Mapped[float] = mapped_column(Float, nullable=False)
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # Relationships
    sector: Mapped["FarmSector"] = relationship("FarmSector", back_populates="irrigation_logs")

    __table_args__ = (
        Index("ix_irrigation_logs_sector_triggered", "sector_id", "triggered_at"),
    )
