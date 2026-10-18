"""
SQLAlchemy ORM models for Marketplace (Listing, Offer, MarketPriceRef).
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Float, Boolean, Date, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.farmer import Farmer


class Listing(TimestampMixin, Base):
    """
    Produce listing posted by a farmer.
    """
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False, index=True)
    crop: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    asking_price_per_kg: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="kg")
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)  # active, sold, cancelled

    # Relationships
    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="listings")
    offers: Mapped[List["Offer"]] = relationship("Offer", back_populates="listing", cascade="all, delete-orphan")


class Offer(TimestampMixin, Base):
    """
    Purchase offer made on a listing by a buyer (represented by a farmer/user id).
    """
    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    buyer_farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), nullable=False, index=True)
    offered_price_per_kg: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_kg: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)  # pending, accepted, declined
    message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    listing: Mapped["Listing"] = relationship("Listing", back_populates="offers")
    buyer: Mapped["Farmer"] = relationship("Farmer")


class MarketPriceRef(Base):
    """
    Simulated baseline reference prices for crops.
    Explicitly flagged as simulated reference only — NOT real live AGMARKNET.
    """
    __tablename__ = "market_price_refs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    crop: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    min_price_per_kg: Mapped[float] = mapped_column(Float, nullable=False)
    max_price_per_kg: Mapped[float] = mapped_column(Float, nullable=False)
    avg_price_per_kg: Mapped[float] = mapped_column(Float, nullable=False)
    source_note: Mapped[str] = mapped_column(String(255), nullable=False, default="SIMULATED REFERENCE ONLY")
    reference_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
