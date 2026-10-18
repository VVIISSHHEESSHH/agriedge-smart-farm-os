"""File-backed persistence coverage across separate API request sessions."""

from __future__ import annotations

from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_session
from app.main import app
from app.models.farmer import Farmer
from app.auth import issue_access_token


async def test_core_records_persist_across_requests(tmp_path) -> None:
    database_path = tmp_path / "agriedge-persistence.sqlite3"
    engine = create_async_engine(
        URL.create("sqlite+aiosqlite", database=str(database_path)),
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        seller = Farmer(name="Disk Seller", phone_hash="disk-seller", district="Pune")
        buyer = Farmer(name="Disk Buyer", phone_hash="disk-buyer", district="Pune")
        session.add_all([seller, buyer])
        await session.commit()
        seller_id, buyer_id = seller.id, buyer.id
    seller_headers = {"Authorization": f"Bearer {issue_access_token(seller_id)}"}
    buyer_headers = {"Authorization": f"Bearer {issue_access_token(buyer_id)}"}

    async def override_session():
        async with session_factory() as session:
            yield session

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_session] = override_session
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            farm_response = await client.post(
                "/farms",
                headers=seller_headers,
                json={"farmer_id": seller_id, "name": "Disk Farm", "area_hectares": 1.5},
            )
            assert farm_response.status_code == 201
            farm_id = farm_response.json()["id"]
            assert (await client.get(f"/farms/{farm_id}", headers=seller_headers)).json()["name"] == "Disk Farm"

            sector_response = await client.post(
                f"/farms/{farm_id}/sectors",
                headers=seller_headers,
                json={"name": "Tomato Plot", "crop": "Tomato", "area_hectares": 1.0},
            )
            assert sector_response.status_code == 201
            sector_id = sector_response.json()["id"]
            assert (await client.post(f"/sensors/simulate/{sector_id}", headers=seller_headers)).status_code == 201

            irrigation = await client.post(f"/irrigation/execute/{sector_id}", headers=seller_headers)
            assert irrigation.status_code == 201
            logs = await client.get(f"/irrigation/logs/{sector_id}", headers=seller_headers)
            assert logs.status_code == 200
            assert logs.json()[0]["id"] == irrigation.json()["id"]
            assert logs.json()[0]["is_simulated"] is True

            schedule = await client.post(
                "/irrigation/schedules",
                headers=seller_headers,
                json={
                    "farm_id": farm_id,
                    "schedule_date": date.today().isoformat(),
                    "sector_plan": {str(sector_id): {"action": "review"}},
                },
            )
            assert schedule.status_code == 201
            schedules = await client.get(f"/irrigation/schedules/{farm_id}", headers=seller_headers)
            assert schedules.status_code == 200
            assert schedules.json()[0]["id"] == schedule.json()["id"]

            listing = await client.post(
                "/marketplace/listings",
                headers=seller_headers,
                json={
                    "farmer_id": seller_id,
                    "crop": "Tomato",
                    "quantity_kg": 80,
                    "asking_price_per_kg": 24,
                    "district": "Pune",
                },
            )
            assert listing.status_code == 201
            listing_id = listing.json()["id"]
            assert any(
                row["id"] == listing_id
                for row in (await client.get("/marketplace/listings")).json()
            )

            offer = await client.post(
                "/marketplace/offers",
                headers=buyer_headers,
                json={
                    "listing_id": listing_id,
                    "buyer_farmer_id": buyer_id,
                    "offered_price_per_kg": 22,
                    "quantity_kg": 50,
                },
            )
            assert offer.status_code == 201
            offers = await client.get(f"/marketplace/listings/{listing_id}/offers", headers=seller_headers)
            assert offers.status_code == 200
            assert offers.json()[0]["id"] == offer.json()["id"]

            scan = await client.post(
                "/agrisnap/log",
                headers=seller_headers,
                json={
                    "farmer_id": seller_id,
                    "model_version": "test-model",
                    "crop_input": "Tomato",
                    "predicted_label": "Test audit record",
                    "confidence": 0.5,
                    "was_unclear": True,
                },
            )
            assert scan.status_code == 201
            history = await client.get(f"/agrisnap/history/{seller_id}", headers=seller_headers)
            assert history.status_code == 200
            assert history.json()[0]["id"] == scan.json()["id"]

        # Re-open the file-backed database once more, independently of API sessions.
        async with session_factory() as session:
            persisted_seller = await session.scalar(
                select(Farmer).where(Farmer.id == seller_id)
            )
            assert persisted_seller is not None
            assert persisted_seller.name == "Disk Seller"
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        await engine.dispose()
