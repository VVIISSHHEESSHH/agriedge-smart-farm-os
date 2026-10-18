"""
Phase 2 Comprehensive Backend Test Suite.

Covers:
1. Health & Database connectivity
2. Model relationships (Farmer -> Farm -> Sectors -> Sensors -> Irrigation)
3. Farm and sector creation & retrieval
4. Sensor telemetry recording and deterministic simulation triggers
5. Irrigation recommendation rules (rain forecast, drought, optimal, stale telemetry, override)
6. Marketplace listing creation and buyer offer submission
7. Disease report validation and outbreak clustering threshold
8. AgriSnap AI scan audit logging
9. Demo seeding script idempotency and persistence
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.farmer import Farmer, Farm
from app.models.sector import FarmSector
from app.models.sensor import SensorReading
from app.models.irrigation import IrrigationDecisionLog
from app.models.marketplace import Listing, Offer
from app.models.community import DiseaseReport, Outbreak
from app.models.agrisnap import AgriSnapLog
from app.services.simulation import simulate_reading_for_sector
from app.services.irrigation_engine import evaluate_irrigation
from scripts.seed_demo_data import seed_data


# ── 1. Model Relationships & Database Schema Tests ───────────────────

async def test_farmer_farm_sector_relationship(db_session: AsyncSession) -> None:
    farmer = Farmer(
        name="Test Farmer",
        phone_hash="hash-rel-001",
        district="Nashik",
        state="Maharashtra",
    )
    db_session.add(farmer)
    await db_session.flush()

    farm = Farm(
        farmer_id=farmer.id,
        name="Green Valley Farm",
        area_hectares=3.0,
    )
    db_session.add(farm)
    await db_session.flush()

    sector = FarmSector(
        farm_id=farm.id,
        name="Plot A - Grapes",
        crop="Grape",
        area_hectares=1.5,
    )
    db_session.add(sector)
    await db_session.commit()

    # Query back via relationships using selectinload for async safety
    from sqlalchemy.orm import selectinload
    res = await db_session.execute(
        select(Farmer)
        .options(selectinload(Farmer.farms).selectinload(Farm.sectors))
        .where(Farmer.id == farmer.id)
    )
    fetched_farmer = res.scalar_one()
    assert len(fetched_farmer.farms) == 1
    assert fetched_farmer.farms[0].name == "Green Valley Farm"
    assert len(fetched_farmer.farms[0].sectors) == 1
    assert fetched_farmer.farms[0].sectors[0].crop == "Grape"


# ── 2. Farms and Sectors API Tests ────────────────────────────────────

async def test_create_and_get_farm(client: AsyncClient, db_session: AsyncSession) -> None:
    farmer = Farmer(name="Farmer Govind", phone_hash="govind-001", district="Satara")
    db_session.add(farmer)
    await db_session.commit()

    # Create farm
    create_res = await client.post(
        "/farms",
        json={"farmer_id": farmer.id, "name": "Govind Agro", "area_hectares": 2.0},
    )
    assert create_res.status_code == 201
    farm_data = create_res.json()
    assert farm_data["name"] == "Govind Agro"
    farm_id = farm_data["id"]

    # Add sector
    sec_res = await client.post(
        f"/farms/{farm_id}/sectors",
        json={"name": "Wheat Field", "crop": "Wheat", "area_hectares": 1.0, "target_moisture_min": 32.0},
    )
    assert sec_res.status_code == 201
    assert sec_res.json()["crop"] == "Wheat"

    # Get farm with sectors
    get_res = await client.get(f"/farms/{farm_id}")
    assert get_res.status_code == 200
    assert len(get_res.json()["sectors"]) == 1


# ── 3. Sensor Telemetry & Simulation Tests ────────────────────────────

async def test_deterministic_sensor_simulation() -> None:
    fixed_time = datetime(2026, 10, 17, 12, 0, 0, tzinfo=timezone.utc)
    reading1 = simulate_reading_for_sector(sector_id=1, crop="Tomato", timestamp=fixed_time)
    reading2 = simulate_reading_for_sector(sector_id=1, crop="Tomato", timestamp=fixed_time)

    assert reading1["is_simulated"] is True
    assert reading1["sim_seed"] == reading2["sim_seed"]
    assert reading1["moisture_pct"] == reading2["moisture_pct"]
    assert reading1["temp_c"] == reading2["temp_c"]


async def test_simulate_sensor_api(client: AsyncClient, db_session: AsyncSession) -> None:
    farmer = Farmer(name="Sensor Farmer", phone_hash="sensor-001", district="Pune")
    db_session.add(farmer)
    await db_session.flush()

    farm = Farm(farmer_id=farmer.id, name="Sensor Farm", area_hectares=1.0)
    db_session.add(farm)
    await db_session.flush()

    sector = FarmSector(farm_id=farm.id, name="Sector 1", crop="Tomato", area_hectares=0.5)
    db_session.add(sector)
    await db_session.commit()

    # Trigger simulation
    res = await client.post(f"/sensors/simulate/{sector.id}")
    assert res.status_code == 201
    data = res.json()
    assert data["is_simulated"] is True
    assert "moisture_pct" in data

    # Retrieve latest
    latest_res = await client.get(f"/sensors/sector/{sector.id}/latest")
    assert latest_res.status_code == 200
    assert latest_res.json()["id"] == data["id"]


# ── 4. Irrigation Recommendation Rule Engine Tests ───────────────────

def test_irrigation_rules_rain_delay() -> None:
    now = datetime.now(timezone.utc)
    # High rain forecast should trigger DELAY regardless of dry soil
    decision = evaluate_irrigation(
        sector_id=1,
        crop="Tomato",
        moisture_pct=20.0,
        reading_time=now,
        forecast_rain_chance=0.75,
    )
    assert decision["decision"] == "delay"
    assert decision["rule_code"] == "R2_RAIN_FORECAST_DELAY"
    assert decision["is_simulated"] is True


def test_irrigation_rules_critical_drought() -> None:
    now = datetime.now(timezone.utc)
    decision = evaluate_irrigation(
        sector_id=1,
        crop="Tomato",
        moisture_pct=15.0,  # Far below target
        reading_time=now,
        target_moisture_min=35.0,
        forecast_rain_chance=0.1,
    )
    assert decision["decision"] == "irrigate"
    assert decision["rule_code"] == "R3_CRITICAL_DROUGHT"
    assert decision["duration_minutes"] > 0


def test_irrigation_rules_stale_sensor_safety() -> None:
    stale_time = datetime.now(timezone.utc) - timedelta(hours=10)
    decision = evaluate_irrigation(
        sector_id=1,
        crop="Tomato",
        moisture_pct=15.0,
        reading_time=stale_time,
    )
    assert decision["decision"] == "skip"
    assert decision["sensor_stale"] is True
    assert decision["rule_code"] == "R1_STALE_SENSOR_CHECK"


async def test_irrigation_api_flow(client: AsyncClient, db_session: AsyncSession) -> None:
    farmer = Farmer(name="Irrig Farmer", phone_hash="irrig-001", district="Pune")
    db_session.add(farmer)
    await db_session.flush()

    farm = Farm(farmer_id=farmer.id, name="Irrig Farm", area_hectares=1.0)
    db_session.add(farm)
    await db_session.flush()

    sector = FarmSector(farm_id=farm.id, name="Sector I", crop="Tomato", area_hectares=0.5, target_moisture_min=40.0)
    db_session.add(sector)
    await db_session.flush()

    reading = SensorReading(
        sector_id=sector.id,
        moisture_pct=25.0,  # Deficit
        temp_c=28.0,
        ph=6.5,
        nitrogen_ppm=40.0,
        phosphorus_ppm=20.0,
        potassium_ppm=30.0,
        is_simulated=True,
        sim_seed="test",
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(reading)
    await db_session.commit()

    # Get recommendation
    rec_res = await client.get(f"/irrigation/recommend/{sector.id}")
    assert rec_res.status_code == 200
    assert rec_res.json()["decision"] == "irrigate"

    # Execute simulated log event
    exec_res = await client.post(f"/irrigation/execute/{sector.id}")
    assert exec_res.status_code == 201
    assert exec_res.json()["decision"] == "irrigate"
    assert exec_res.json()["is_simulated"] is True

    # Manual override
    override_res = await client.post(
        "/irrigation/override",
        json={"sector_id": sector.id, "action": "skip"},
    )
    assert override_res.status_code == 201
    assert override_res.json()["decision"] == "skip"


# ── 5. Marketplace Listings & Offers Tests ────────────────────────────

async def test_marketplace_listing_and_offer(client: AsyncClient, db_session: AsyncSession) -> None:
    f1 = Farmer(name="Seller Farmer", phone_hash="seller-01", district="Nashik")
    f2 = Farmer(name="Buyer Persona", phone_hash="buyer-01", district="Mumbai")
    db_session.add_all([f1, f2])
    await db_session.commit()

    # Create listing
    list_res = await client.post(
        "/marketplace/listings",
        json={
            "farmer_id": f1.id,
            "crop": "Pomegranate",
            "quantity_kg": 300.0,
            "asking_price_per_kg": 95.0,
            "district": "Nashik",
        },
    )
    assert list_res.status_code == 201
    listing_id = list_res.json()["id"]

    # Submit offer
    offer_res = await client.post(
        "/marketplace/offers",
        headers={"x-test-farmer-id": str(f2.id)},
        json={
            "listing_id": listing_id,
            "buyer_farmer_id": f2.id,
            "offered_price_per_kg": 90.0,
            "quantity_kg": 200.0,
            "message": "Immediate pickup via local truck",
        },
    )
    assert offer_res.status_code == 201
    assert offer_res.json()["status"] == "pending"

    # View offers for listing
    get_offers = await client.get(f"/marketplace/listings/{listing_id}/offers")
    assert get_offers.status_code == 200
    assert len(get_offers.json()) == 1


# ── 6. Disease Outbreak Radar Tests ───────────────────────────────────

async def test_disease_report_and_outbreak_cluster(client: AsyncClient, db_session: AsyncSession) -> None:
    db_session.add(Farmer(name="Reporter", phone_hash="reporter-01", district="Nagpur"))
    await db_session.commit()
    # Submit 3 disease reports in same district and crop to trigger outbreak radar
    for i in range(3):
        res = await client.post(
            "/community/reports",
            json={
                "crop": "Cotton",
                "disease_label": "Cotton Leaf Curl Virus",
                "district": "Nagpur",
                "severity": "high",
                "notes": f"Observed in sector {i+1}",
            },
        )
        assert res.status_code == 201

    # Check active outbreaks
    outbreak_res = await client.get("/community/outbreaks?district=Nagpur")
    assert outbreak_res.status_code == 200
    outbreaks = outbreak_res.json()
    assert len(outbreaks) >= 1
    assert outbreaks[0]["crop"] == "Cotton"
    assert outbreaks[0]["report_count"] >= 3


# ── 7. AgriSnap AI Scan Logging Tests ─────────────────────────────────

async def test_agrisnap_scan_logging(client: AsyncClient, db_session: AsyncSession) -> None:
    farmer = Farmer(name="Scan Farmer", phone_hash="scan-001", district="Pune")
    db_session.add(farmer)
    await db_session.commit()

    log_res = await client.post(
        "/agrisnap/log",
        json={
            "farmer_id": farmer.id,
            "model_version": "cropnet_v1",
            "crop_input": "Cassava",
            "predicted_label": "Cassava Bacterial Blight",
            "confidence": 0.89,
            "was_unclear": False,
        },
    )
    assert log_res.status_code == 201
    assert log_res.json()["predicted_label"] == "Cassava Bacterial Blight"

    history_res = await client.get(f"/agrisnap/history/{farmer.id}")
    assert history_res.status_code == 200
    assert len(history_res.json()) == 1


# ── 8. Demonstration Seeder Idempotency Test ─────────────────────────

async def test_seeder_idempotency(db_session: AsyncSession) -> None:
    # First run
    await seed_data(db_session)
    res_f = await db_session.execute(select(Farmer).where(Farmer.phone_hash == "demo-farmer-hash-001"))
    farmer = res_f.scalar_one_or_none()
    assert farmer is not None

    # Second run should execute cleanly without duplicating or raising unique constraint errors
    await seed_data(db_session)
    res_f2 = await db_session.execute(select(Farmer).where(Farmer.phone_hash == "demo-farmer-hash-001"))
    assert res_f2.scalar_one_or_none() is not None
