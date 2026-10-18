"""
SQLAlchemy ORM model for FarmSector.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.farmer import Farm
    from app.models.sensor import SensorReading
    from app.models.irrigation import IrrigationDecisionLog


class FarmSector(TimestampMixin, Base):
    """
    Sub-divided parcel of a Farm allocated to a specific crop.
    Hosts simulated sensor telemetry and irrigation rules.
    """
    __tablename__ = "farm_sectors"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    crop: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    area_hectares: Mapped[float] = mapped_column(Float, nullable=False, default=0.25)
    health_status: Mapped[str] = mapped_column(String(20), nullable=False, default="healthy")  # healthy, watch, alert
    target_moisture_min: Mapped[float] = mapped_column(Float, nullable=False, default=35.0)
    target_moisture_max: Mapped[float] = mapped_column(Float, nullable=False, default=70.0)

    # Relationships
    farm: Mapped["Farm"] = relationship("Farm", back_populates="sectors")
    sensor_readings: Mapped[List["SensorReading"]] = relationship("SensorReading", back_populates="sector", cascade="all, delete-orphan", order_by="desc(SensorReading.recorded_at)")
    irrigation_logs: Mapped[List["IrrigationDecisionLog"]] = relationship("IrrigationDecisionLog", back_populates="sector", cascade="all, delete-orphan", order_by="desc(IrrigationDecisionLog.triggered_at)")
