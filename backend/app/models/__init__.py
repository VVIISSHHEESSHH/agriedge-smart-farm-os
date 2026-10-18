"""
Models package for AgriEdge.

Imports all database model entities so that Base.metadata contains the complete
schema definitions prior to Alembic migrations or table initialization.
"""

from app.models.base import Base, TimestampMixin
from app.models.farmer import Farmer, Farm
from app.models.auth import AuthCredential
from app.models.sector import FarmSector
from app.models.sensor import SensorReading
from app.models.irrigation import IrrigationSchedule, IrrigationDecisionLog
from app.models.marketplace import Listing, Offer, MarketPriceRef
from app.models.community import DiseaseReport, Outbreak
from app.models.agrisnap import AgriSnapLog

__all__ = [
    "Base",
    "TimestampMixin",
    "Farmer",
    "AuthCredential",
    "Farm",
    "FarmSector",
    "SensorReading",
    "IrrigationSchedule",
    "IrrigationDecisionLog",
    "Listing",
    "Offer",
    "MarketPriceRef",
    "DiseaseReport",
    "Outbreak",
    "AgriSnapLog",
]
