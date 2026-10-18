"""
Deterministic, idempotent demonstration data seeder for AgriEdge.

Seeds:
- 1 Demo Farmer (Ramesh Patil, Pune)
- 1 Demo Buyer (Kisan Fresh Mandi)
- 1 Farm (Surya Farm OS, 2.5 Hectares)
- 4 Sectors (Tomato, Rice, Cotton, Cassava)
- Initial simulated sensor telemetry for all 4 sectors
- Sample produce listings in marketplace
- Baseline simulated reference market prices
- Initial community disease report

Safe to rerun repeatedly without creating duplicate records.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone, date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.farmer import Farmer, Farm
from app.models.sector import FarmSector
from app.models.sensor import SensorReading
from app.models.marketplace import Listing, MarketPriceRef
from app.models.community import DiseaseReport
from app.services.simulation import simulate_reading_for_sector


async def seed_data(session: AsyncSession) -> None:
    print("[SEED] Checking and seeding demonstration farm data...")

    # 1. Farmer persona
    res = await session.execute(select(Farmer).where(Farmer.phone_hash == "demo-farmer-hash-001"))
    demo_farmer = res.scalar_one_or_none()
    if not demo_farmer:
        demo_farmer = Farmer(
            name="Ramesh Patil (Demo Farmer)",
            phone_hash="demo-farmer-hash-001",
            district="Pune",
            state="Maharashtra",
            lang_pref="en",
            is_demo=True,
        )
        session.add(demo_farmer)
        await session.flush()
        print(" -> Created Demo Farmer persona")

    # 2. Buyer persona
    res_b = await session.execute(select(Farmer).where(Farmer.phone_hash == "demo-buyer-hash-002"))
    demo_buyer = res_b.scalar_one_or_none()
    if not demo_buyer:
        demo_buyer = Farmer(
            name="Kisan Fresh Mandi (Demo Buyer)",
            phone_hash="demo-buyer-hash-002",
            district="Pune",
            state="Maharashtra",
            lang_pref="hi",
            is_demo=True,
        )
        session.add(demo_buyer)
        await session.flush()
        print(" -> Created Demo Buyer persona")

    # 3. Farm
    res_f = await session.execute(select(Farm).where(Farm.farmer_id == demo_farmer.id))
    demo_farm = res_f.scalar_one_or_none()
    if not demo_farm:
        demo_farm = Farm(
            farmer_id=demo_farmer.id,
            name="Surya AgriEdge Model Farm",
            area_hectares=2.5,
            location_desc="Haveli Taluka, Pune, Maharashtra",
        )
        session.add(demo_farm)
        await session.flush()
        print(" -> Created Demo Farm")

    # 4. Sectors
    sectors_config = [
        {"name": "North Field - Tomatoes", "crop": "Tomato", "area_hectares": 0.75, "target_min": 35.0, "target_max": 65.0},
        {"name": "East Basin - Rice", "crop": "Rice", "area_hectares": 0.80, "target_min": 60.0, "target_max": 85.0},
        {"name": "South Plateau - Cotton", "crop": "Cotton", "area_hectares": 0.50, "target_min": 30.0, "target_max": 60.0},
        {"name": "West Terrace - Cassava", "crop": "Cassava", "area_hectares": 0.45, "target_min": 25.0, "target_max": 50.0},
    ]

    for sec_spec in sectors_config:
        res_s = await session.execute(
            select(FarmSector).where(FarmSector.farm_id == demo_farm.id).where(FarmSector.name == sec_spec["name"])
        )
        sector = res_s.scalar_one_or_none()
        if not sector:
            sector = FarmSector(
                farm_id=demo_farm.id,
                name=sec_spec["name"],
                crop=sec_spec["crop"],
                area_hectares=sec_spec["area_hectares"],
                health_status="healthy",
                target_moisture_min=sec_spec["target_min"],
                target_moisture_max=sec_spec["target_max"],
            )
            session.add(sector)
            await session.flush()
            print(f" -> Created Sector: {sec_spec['name']}")

        # Seed initial sensor reading if none exist
        res_read = await session.execute(select(SensorReading).where(SensorReading.sector_id == sector.id))
        if not res_read.scalar_one_or_none():
            sim_reading = simulate_reading_for_sector(
                sector_id=sector.id,
                crop=sector.crop,
                timestamp=datetime.now(timezone.utc),
            )
            reading_obj = SensorReading(**sim_reading)
            session.add(reading_obj)
            print(f"    -> Added initial [SIMULATED] sensor reading for {sector.name}")

    # 5. Marketplace Listings
    res_list = await session.execute(select(Listing).where(Listing.farmer_id == demo_farmer.id))
    if not res_list.scalars().first():
        l1 = Listing(
            farmer_id=demo_farmer.id,
            crop="Tomato (Roma Grade A)",
            quantity_kg=500.0,
            asking_price_per_kg=28.0,
            unit="kg",
            district="Pune",
            description="Freshly harvested Roma tomatoes, pesticide-free, suitable for retail or sauce processing.",
            status="active",
        )
        l2 = Listing(
            farmer_id=demo_farmer.id,
            crop="Basmati Rice (Sharbati)",
            quantity_kg=1200.0,
            asking_price_per_kg=62.0,
            unit="kg",
            district="Pune",
            description="Cleaned, sorted aromatic grain. Ready for immediate wholesale dispatch.",
            status="active",
        )
        session.add_all([l1, l2])
        print(" -> Seeded Demo Marketplace Listings")

    # 6. Baseline Reference Market Prices (Explicitly flagged simulated)
    res_pr = await session.execute(select(MarketPriceRef))
    if not res_pr.scalars().first():
        today = date.today()
        p1 = MarketPriceRef(crop="Tomato", min_price_per_kg=22.0, max_price_per_kg=32.0, avg_price_per_kg=27.5, reference_date=today, is_simulated=True)
        p2 = MarketPriceRef(crop="Rice", min_price_per_kg=55.0, max_price_per_kg=70.0, avg_price_per_kg=63.0, reference_date=today, is_simulated=True)
        p3 = MarketPriceRef(crop="Cotton", min_price_per_kg=68.0, max_price_per_kg=85.0, avg_price_per_kg=76.0, reference_date=today, is_simulated=True)
        p4 = MarketPriceRef(crop="Cassava", min_price_per_kg=18.0, max_price_per_kg=26.0, avg_price_per_kg=22.0, reference_date=today, is_simulated=True)
        session.add_all([p1, p2, p3, p4])
        print(" -> Seeded [SIMULATED] Market Reference Prices")

    # 7. Disease Report sample
    res_rep = await session.execute(select(DiseaseReport).where(DiseaseReport.farmer_id == demo_farmer.id))
    if not res_rep.scalars().first():
        d_report = DiseaseReport(
            farmer_id=demo_farmer.id,
            crop="Tomato",
            disease_label="Tomato Early Blight",
            district="Pune",
            state="Maharashtra",
            severity="medium",
            notes="Small brown lesions observed on lower leaves. Sample flagged for monitoring.",
            reported_at=datetime.now(timezone.utc),
        )
        session.add(d_report)
        print(" -> Seeded Demo Disease Report")

    await session.commit()
    print("[SUCCESS] Demo seeding completed successfully. Safe to rerun at any time.")


async def main():
    async with AsyncSessionLocal() as session:
        await seed_data(session)


if __name__ == "__main__":
    asyncio.run(main())
