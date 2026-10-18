"""
Pydantic v2 validation schemas for request bodies and response models.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ── Farm & Sector Schemas ──────────────────────────────────────────────

class SectorBase(BaseModel):
    name: str = Field(..., max_length=100)
    crop: str = Field(..., max_length=100)
    area_hectares: float = Field(..., gt=0)
    target_moisture_min: float = Field(default=35.0, ge=5.0, le=90.0)
    target_moisture_max: float = Field(default=70.0, ge=10.0, le=100.0)


class SectorCreate(SectorBase):
    pass


class SectorResponse(SectorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farm_id: int
    health_status: str
    created_at: datetime
    updated_at: datetime


class FarmBase(BaseModel):
    name: str = Field(..., max_length=120)
    area_hectares: float = Field(default=1.0, gt=0)
    location_desc: Optional[str] = Field(default=None, max_length=255)


class FarmCreate(FarmBase):
    farmer_id: int


class FarmResponse(FarmBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: int
    created_at: datetime
    sectors: List[SectorResponse] = []


# ── Sensor Telemetry Schemas ──────────────────────────────────────────

class SensorReadingBase(BaseModel):
    moisture_pct: float = Field(..., ge=0.0, le=100.0)
    temp_c: float = Field(..., ge=-10.0, le=60.0)
    ph: float = Field(..., ge=0.0, le=14.0)
    nitrogen_ppm: float = Field(..., ge=0.0)
    phosphorus_ppm: float = Field(..., ge=0.0)
    potassium_ppm: float = Field(..., ge=0.0)


class SensorReadingCreate(SensorReadingBase):
    sector_id: int
    is_simulated: bool = True
    sim_seed: str = "custom-manual"


class SensorReadingResponse(SensorReadingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sector_id: int
    is_simulated: bool
    sim_seed: str
    recorded_at: datetime


# ── Irrigation Schemas ────────────────────────────────────────────────

class IrrigationDecisionResponse(BaseModel):
    decision: str
    reason_plain: str
    rule_code: str
    duration_minutes: int
    moisture_at_decision: float
    is_simulated: bool
    sensor_stale: bool


class IrrigationOverrideRequest(BaseModel):
    sector_id: int
    action: str = Field(..., pattern="^(irrigate|skip|delay)$")
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=180)


class IrrigationLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sector_id: int
    decision: str
    reason_plain: str
    rule_code: str
    duration_minutes: int
    moisture_at_decision: float
    is_simulated: bool
    triggered_at: datetime


class IrrigationScheduleCreate(BaseModel):
    farm_id: int
    schedule_date: date
    sector_plan: Dict[str, Any] = Field(default_factory=dict)
    is_simulated: bool = True


class IrrigationScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farm_id: int
    schedule_date: date
    sector_plan: Dict[str, Any]
    is_simulated: bool
    created_at: datetime


# ── Marketplace Schemas ───────────────────────────────────────────────

class ListingCreate(BaseModel):
    farmer_id: int
    crop: str = Field(..., min_length=2, max_length=100)
    quantity_kg: float = Field(..., gt=0)
    asking_price_per_kg: float = Field(..., gt=0)
    unit: str = Field(default="kg", max_length=20)
    district: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)


class ListingUpdate(BaseModel):
    quantity_kg: Optional[float] = Field(default=None, gt=0)
    asking_price_per_kg: Optional[float] = Field(default=None, gt=0)
    description: Optional[str] = Field(default=None, max_length=500)
    status: Optional[str] = Field(default=None, pattern="^(active|sold|cancelled)$")


class ListingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: int
    crop: str
    quantity_kg: float
    asking_price_per_kg: float
    unit: str
    district: str
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime


class OfferCreate(BaseModel):
    listing_id: int
    buyer_farmer_id: int
    offered_price_per_kg: float = Field(..., gt=0)
    quantity_kg: float = Field(..., gt=0)
    message: Optional[str] = Field(default=None, max_length=255)


class OfferUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|accepted|declined)$")


class OfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    listing_id: int
    buyer_farmer_id: int
    offered_price_per_kg: float
    quantity_kg: float
    status: str
    message: Optional[str]
    created_at: datetime


class MarketPriceRefResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crop: str
    min_price_per_kg: float
    max_price_per_kg: float
    avg_price_per_kg: float
    source_note: str
    reference_date: date
    is_simulated: bool


# ── Disease Report & Outbreak Schemas ─────────────────────────────────

class DiseaseReportCreate(BaseModel):
    farmer_id: Optional[int] = None
    crop: str = Field(..., min_length=2, max_length=100)
    disease_label: str = Field(..., min_length=2, max_length=120)
    district: str = Field(..., min_length=2, max_length=100)
    state: str = Field(default="Maharashtra", max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    severity: str = Field(default="medium", pattern="^(low|medium|high)$")
    notes: Optional[str] = None


class DiseaseReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: Optional[int]
    crop: str
    disease_label: str
    district: str
    state: str
    latitude: Optional[float]
    longitude: Optional[float]
    severity: str
    notes: Optional[str]
    reported_at: datetime


class OutbreakResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crop: str
    disease_label: str
    district: str
    report_count: int
    severity_level: str
    window_start: date
    window_end: date
    detected_at: datetime


# ── AgriSnap Log Schemas ──────────────────────────────────────────────

class AgriSnapLogCreate(BaseModel):
    farmer_id: Optional[int] = None
    model_version: str = Field(default="cropnet_v1", max_length=50)
    crop_input: str = Field(..., min_length=2, max_length=100)
    predicted_label: str = Field(..., min_length=2, max_length=120)
    confidence: float = Field(..., ge=0.0, le=1.0)
    was_unclear: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AgriSnapLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: Optional[int]
    model_version: str
    crop_input: str
    predicted_label: str
    confidence: float
    was_unclear: bool
    latitude: Optional[float]
    longitude: Optional[float]
    scanned_at: datetime
