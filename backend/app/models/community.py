"""
SQLAlchemy ORM models for Community Disease Reports and Outbreak alerts.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Integer, Float, Date, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.farmer import Farmer


class DiseaseReport(Base):
    """
    Farmer-submitted or AgriSnap-logged disease event.
    Clustered by district and crop to generate Outbreak warnings.
    """
    __tablename__ = "disease_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farmer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("farmers.id", ondelete="SET NULL"), nullable=True, index=True)
    crop: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    disease_label: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="Maharashtra")
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")  # low, medium, high
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    farmer: Mapped[Optional["Farmer"]] = relationship("Farmer", back_populates="disease_reports")

    __table_args__ = (
        Index("ix_disease_reports_district_crop", "district", "crop"),
    )


class Outbreak(Base):
    """
    Synthesized disease cluster warning in a given district over a time window.
    """
    __tablename__ = "outbreaks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    crop: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    disease_label: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    report_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    severity_level: Mapped[str] = mapped_column(String(20), nullable=False, default="watch")  # watch, warning, alert
    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    window_end: Mapped[date] = mapped_column(Date, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_outbreaks_district_crop_window", "district", "crop", "window_start"),
    )
