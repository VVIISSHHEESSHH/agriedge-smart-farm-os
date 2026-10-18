"""
SQLAlchemy ORM models for Farmer and Farm.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Float, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.sector import FarmSector
    from app.models.marketplace import Listing
    from app.models.community import DiseaseReport
    from app.models.agrisnap import AgriSnapLog
    from app.models.irrigation import IrrigationSchedule


class Farmer(TimestampMixin, Base):
    """
    Farmer entity representing a user in the AgriEdge OS.
    Can be a demo persona or real account in future extensions.
    """
    __tablename__ = "farmers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    phone_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="Maharashtra")
    lang_pref: Mapped[str] = mapped_column(String(10), nullable=False, default="en")  # 'en' or 'hi'
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    farms: Mapped[List["Farm"]] = relationship("Farm", back_populates="farmer", cascade="all, delete-orphan")
    listings: Mapped[List["Listing"]] = relationship("Listing", back_populates="farmer", cascade="all, delete-orphan")
    disease_reports: Mapped[List["DiseaseReport"]] = relationship("DiseaseReport", back_populates="farmer")
    agrisnap_logs: Mapped[List["AgriSnapLog"]] = relationship("AgriSnapLog", back_populates="farmer")


class Farm(TimestampMixin, Base):
    """
    Agricultural property owned by a Farmer, divided into sectors.
    """
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    area_hectares: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    location_desc: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="farms")
    sectors: Mapped[List["FarmSector"]] = relationship("FarmSector", back_populates="farm", cascade="all, delete-orphan")
    irrigation_schedules: Mapped[List["IrrigationSchedule"]] = relationship("IrrigationSchedule", back_populates="farm", cascade="all, delete-orphan")
