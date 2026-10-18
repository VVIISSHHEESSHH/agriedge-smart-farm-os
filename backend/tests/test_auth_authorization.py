from httpx import AsyncClient
from app.config import settings
from app.models.farmer import Farm, Farmer


def registration(name: str, phone: str) -> dict:
    return {"name": name, "phone": phone, "password": "correct horse battery", "district": "Pune", "state": "Maharashtra"}


async def create_account(client: AsyncClient, name: str, phone: str) -> tuple[dict, dict]:
    response = await client.post("/auth/register", json=registration(name, phone))
    assert response.status_code == 201, response.text
    result = response.json()
    return result["farmer"], {"Authorization": f"Bearer {result['access_token']}"}


async def test_private_routes_require_auth_but_prices_and_health_are_public(unauthenticated_client: AsyncClient):
    assert (await unauthenticated_client.get("/health")).status_code == 200
    assert (await unauthenticated_client.get("/marketplace/prices")).status_code == 200
    assert (await unauthenticated_client.get("/farms/1")).status_code == 401
    assert (await unauthenticated_client.post("/marketplace/listings", json={"farmer_id": 1, "crop": "Tomato", "quantity_kg": 1, "asking_price_per_kg": 2, "district": "Pune"})).status_code == 401
    assert (await unauthenticated_client.post("/agrisnap/log", json={"farmer_id": 1, "model_version": "test", "crop_input": "tomato", "predicted_label": "Tomato: Healthy", "confidence": 0.5, "was_unclear": False})).status_code == 401


async def test_login_and_owner_scoped_farm_and_marketplace_workflow(unauthenticated_client: AsyncClient):
    seller, seller_headers = await create_account(unauthenticated_client, "Seller", "+91 98765 43210")
    buyer, buyer_headers = await create_account(unauthenticated_client, "Buyer", "+91 98765 43211")
    login = await unauthenticated_client.post("/auth/login", json={"phone": "919876543210", "password": "correct horse battery"})
    assert login.status_code == 200
    assert login.json()["farmer"]["id"] == seller["id"]

    farm = await unauthenticated_client.post("/farms", headers=seller_headers, json={"farmer_id": buyer["id"], "name": "Seller Farm", "area_hectares": 2})
    assert farm.status_code == 201
    farm_id = farm.json()["id"]
    assert farm.json()["farmer_id"] == seller["id"]
    assert (await unauthenticated_client.get(f"/farms/{farm_id}", headers=buyer_headers)).status_code == 404

    listing = await unauthenticated_client.post("/marketplace/listings", headers=seller_headers, json={"farmer_id": buyer["id"], "crop": "Tomato", "quantity_kg": 30, "asking_price_per_kg": 22, "district": "Pune"})
    assert listing.status_code == 201
    listing_id = listing.json()["id"]
    assert listing.json()["farmer_id"] == seller["id"]
    offer = await unauthenticated_client.post("/marketplace/offers", headers=buyer_headers, json={"listing_id": listing_id, "buyer_farmer_id": seller["id"], "offered_price_per_kg": 20, "quantity_kg": 10})
    assert offer.status_code == 201
    assert offer.json()["buyer_farmer_id"] == buyer["id"]
    assert (await unauthenticated_client.get(f"/marketplace/listings/{listing_id}/offers", headers=buyer_headers)).status_code == 404
    assert (await unauthenticated_client.patch(f"/marketplace/listings/{listing_id}", headers=buyer_headers, json={"status": "sold"})).status_code == 404
    offers = await unauthenticated_client.get(f"/marketplace/listings/{listing_id}/offers", headers=seller_headers)
    assert offers.status_code == 200 and offers.json()[0]["id"] == offer.json()["id"]
    accepted = await unauthenticated_client.patch(f"/marketplace/offers/{offer.json()['id']}", headers=seller_headers, json={"status": "accepted"})
    assert accepted.status_code == 200 and accepted.json()["status"] == "accepted"


async def test_demo_mode_is_read_only_and_limited_to_marked_demo_farmer(unauthenticated_client: AsyncClient, db_session, monkeypatch):
    monkeypatch.setattr(settings, "demo_read_only", True)
    monkeypatch.setattr(settings, "allow_registration", False)
    demo = Farmer(name="Judge Demo Farmer", phone_hash="demo-farmer-hash-001", district="Pune", is_demo=True)
    private = Farmer(name="Private Farmer", phone_hash="private-user-hash", district="Nashik", is_demo=False)
    db_session.add_all([demo, private])
    await db_session.flush()
    demo_farm = Farm(farmer_id=demo.id, name="Isolated Demo Farm", area_hectares=1)
    private_farm = Farm(farmer_id=private.id, name="Private Farm", area_hectares=1)
    db_session.add_all([demo_farm, private_farm])
    await db_session.commit()

    assert (await unauthenticated_client.get(f"/farms/{demo_farm.id}")).status_code == 200
    assert (await unauthenticated_client.get(f"/farms/{private_farm.id}")).status_code == 404
    assert (await unauthenticated_client.post("/farms", json={"farmer_id": demo.id, "name": "Guest Write", "area_hectares": 1})).status_code == 401
    assert (await unauthenticated_client.post("/marketplace/listings", json={"farmer_id": demo.id, "crop": "Tomato", "quantity_kg": 1, "asking_price_per_kg": 2, "district": "Pune"})).status_code == 401
    assert (await unauthenticated_client.post("/auth/register", json=registration("Guest", "+91 98765 40001"))).status_code == 403
