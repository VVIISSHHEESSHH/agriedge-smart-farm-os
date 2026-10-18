"""
SQLAlchemy ORM model for AgriSnap AI scan audit history.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.farmer import Farmer


class AgriSnapLog(Base):
    """
    Metadata record of an in-browser TensorFlow.js disease detection scan.
    Raw image bytes are never transmitted to backend; only diagnostic metadata.
    """
    __tablename__ = "agrisnap_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farmer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("farmers.id", ondelete="SET NULL"), nullable=True, index=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="cropnet_v1")
    crop_input: Mapped[str] = mapped_column(String(100), nullable=False)
    predicted_label: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    was_unclear: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    farmer: Mapped[Optional["Farmer"]] = relationship("Farmer", back_populates="agrisnap_logs")

    __table_args__ = (
        Index("ix_agrisnap_farmer_scanned", "farmer_id", "scanned_at"),
    )
