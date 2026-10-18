"""
Regression and CRUD test suite for Marketplace and Irrigation Schedule operations.
"""

from __future__ import annotations

import pytest
from datetime import date, datetime, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.farmer import Farmer, Farm
from app.models.marketplace import Listing, Offer, MarketPriceRef
from app.models.irrigation import IrrigationSchedule


async def test_marketplace_prices_endpoint(client: AsyncClient, db_session: AsyncSession) -> None:
    today = date.today()
    p1 = MarketPriceRef(
        crop="Tomato",
        min_price_per_kg=20.0,
        max_price_per_kg=30.0,
        avg_price_per_kg=25.0,
        source_note="SIMULATED REFERENCE ONLY",
        reference_date=today,
        is_simulated=True,
    )
    p2 = MarketPriceRef(
        crop="Onion",
        min_price_per_kg=15.0,
        max_price_per_kg=22.0,
        avg_price_per_kg=18.0,
        source_note="SIMULATED REFERENCE ONLY",
        reference_date=today,
        is_simulated=True,
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    # Fetch all prices
    res = await client.get("/marketplace/prices")
    assert res.status_code == 200
    prices = res.json()
    assert len(prices) >= 2
    for p in prices:
        assert p["is_simulated"] is True
        assert "SIMULATED" in p["source_note"]

    # Filter by crop
    res_crop = await client.get("/marketplace/prices?crop=Tomato")
    assert res_crop.status_code == 200
    filtered = res_crop.json()
    assert len(filtered) >= 1
    assert filtered[0]["crop"] == "Tomato"


async def test_marketplace_listing_full_crud(client: AsyncClient, db_session: AsyncSession) -> None:
    farmer = Farmer(name="CRUD Farmer", phone_hash="crud-farmer-01", district="Nashik")
    db_session.add(farmer)
    await db_session.commit()

    # 1. Create Listing
    create_res = await client.post(
        "/marketplace/listings",
        json={
            "farmer_id": farmer.id,
            "crop": "Organic Grapes",
            "quantity_kg": 1500.0,
            "asking_price_per_kg": 65.0,
            "unit": "kg",
            "district": "Nashik",
            "description": "Export quality Thomson seedless grapes",
        },
    )
    assert create_res.status_code == 201
    listing = create_res.json()
    listing_id = listing["id"]
    assert listing["crop"] == "Organic Grapes"
    assert listing["status"] == "active"

    # 2. Get Single Listing
    get_res = await client.get(f"/marketplace/listings/{listing_id}")
    assert get_res.status_code == 200
    assert get_res.json()["quantity_kg"] == 1500.0

    # 3. Update Listing
    patch_res = await client.patch(
        f"/marketplace/listings/{listing_id}",
        json={
            "asking_price_per_kg": 60.0,
            "status": "sold",
        },
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["asking_price_per_kg"] == 60.0
    assert updated["status"] == "sold"

    # 4. Delete Listing
    del_res = await client.delete(f"/marketplace/listings/{listing_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # 5. Verify 404 after deletion
    get_after = await client.get(f"/marketplace/listings/{listing_id}")
    assert get_after.status_code == 404


async def test_marketplace_offer_lifecycle_and_validation(client: AsyncClient, db_session: AsyncSession) -> None:
    f1 = Farmer(name="Seller Patil", phone_hash="seller-patil", district="Pune")
    f2 = Farmer(name="Buyer Mandi", phone_hash="buyer-mandi", district="Pune")
    db_session.add_all([f1, f2])
    await db_session.commit()

    # Create active listing
    list_res = await client.post(
        "/marketplace/listings",
        json={
            "farmer_id": f1.id,
            "crop": "Roma Tomatoes",
            "quantity_kg": 800.0,
            "asking_price_per_kg": 25.0,
            "district": "Pune",
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
            "offered_price_per_kg": 24.0,
            "quantity_kg": 500.0,
            "message": "Direct farmgate pickup tomorrow morning",
        },
    )
    assert offer_res.status_code == 201
    offer_id = offer_res.json()["id"]
    assert offer_res.json()["status"] == "pending"

    persisted_offers = await client.get(f"/marketplace/listings/{listing_id}/offers")
    assert persisted_offers.status_code == 200
    assert any(offer["id"] == offer_id and offer["buyer_farmer_id"] == f2.id for offer in persisted_offers.json())

    # Accept offer
    update_res = await client.patch(
        f"/marketplace/offers/{offer_id}",
        json={"status": "accepted"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "accepted"

    # Mark listing sold
    await client.patch(f"/marketplace/listings/{listing_id}", json={"status": "sold"})

    # Reject submitting offer on non-active listing
    bad_offer = await client.post(
        "/marketplace/offers",
        json={
            "listing_id": listing_id,
            "buyer_farmer_id": f2.id,
            "offered_price_per_kg": 20.0,
            "quantity_kg": 100.0,
        },
    )
    assert bad_offer.status_code == 400


async def test_irrigation_schedule_crud(client: AsyncClient, db_session: AsyncSession) -> None:
    farmer = Farmer(name="Schedule Farmer", phone_hash="sched-farmer", district="Solapur")
    db_session.add(farmer)
    await db_session.flush()

    farm = Farm(farmer_id=farmer.id, name="Solapur Farm", area_hectares=4.0)
    db_session.add(farm)
    await db_session.commit()

    today = date.today()
    plan_data = {
        "sector_1": {"action": "irrigate", "duration_minutes": 30, "reason": "Low moisture"},
        "sector_2": {"action": "skip", "duration_minutes": 0, "reason": "Adequate moisture"},
    }

    # 1. Create schedule
    create_res = await client.post(
        "/irrigation/schedules",
        json={
            "farm_id": farm.id,
            "schedule_date": today.isoformat(),
            "sector_plan": plan_data,
            "is_simulated": True,
        },
    )
    assert create_res.status_code == 201
    schedule = create_res.json()
    assert schedule["farm_id"] == farm.id
    assert schedule["is_simulated"] is True
    assert schedule["sector_plan"]["sector_1"]["duration_minutes"] == 30

    # 2. Get farm schedules
    get_res = await client.get(f"/irrigation/schedules/{farm.id}")
    assert get_res.status_code == 200
    schedules = get_res.json()
    assert len(schedules) >= 1
    assert schedules[0]["farm_id"] == farm.id

    # 3. Schedule for non-existent farm should 404
    bad_res = await client.post(
        "/irrigation/schedules",
        json={
            "farm_id": 99999,
            "schedule_date": today.isoformat(),
            "sector_plan": {},
        },
    )
    assert bad_res.status_code == 404
