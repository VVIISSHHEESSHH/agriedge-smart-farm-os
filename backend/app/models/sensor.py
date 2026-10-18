"""
SQLAlchemy ORM model for SensorReading.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Float, Boolean, String, ForeignKey, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.sector import FarmSector


class SensorReading(Base):
    """
    Time-series environmental and soil telemetry for a sector.
    All readings generated in this prototype are labelled simulated.
    """
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sector_id: Mapped[int] = mapped_column(ForeignKey("farm_sectors.id", ondelete="CASCADE"), nullable=False, index=True)
    moisture_pct: Mapped[float] = mapped_column(Float, nullable=False)
    temp_c: Mapped[float] = mapped_column(Float, nullable=False)
    ph: Mapped[float] = mapped_column(Float, nullable=False)
    nitrogen_ppm: Mapped[float] = mapped_column(Float, nullable=False)
    phosphorus_ppm: Mapped[float] = mapped_column(Float, nullable=False)
    potassium_ppm: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Non-negotiable honesty flag
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sim_seed: Mapped[str] = mapped_column(String(64), nullable=False, default="seed-default")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # Relationships
    sector: Mapped["FarmSector"] = relationship("FarmSector", back_populates="sensor_readings")

    __table_args__ = (
        Index("ix_sensor_readings_sector_recorded", "sector_id", "recorded_at"),
    )
