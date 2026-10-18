"""
SQLAlchemy declarative base and shared mixins.

All ORM models should:
  1. Inherit from Base (for table registration).
  2. Optionally include TimestampMixin for created_at / updated_at columns.

Example::

    from app.models.base import Base, TimestampMixin

    class MyModel(TimestampMixin, Base):
        __tablename__ = "my_table"
        id: Mapped[int] = mapped_column(primary_key=True)
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Project-wide SQLAlchemy declarative base."""


class TimestampMixin:
    """Adds auto-managed created_at and updated_at columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
