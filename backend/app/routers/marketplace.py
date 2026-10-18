"""
FastAPI router for Farmer-to-Buyer Marketplace listings and offers.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.farmer import Farmer
from app.models.marketplace import Listing, Offer, MarketPriceRef
from app.schemas.all_schemas import (
    ListingCreate,
    ListingUpdate,
    ListingResponse,
    OfferCreate,
    OfferUpdate,
    OfferResponse,
    MarketPriceRefResponse,
)
from app.auth import ensure_owner, get_current_farmer

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


@router.post("/listings", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(listing_in: ListingCreate, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):

    listing = Listing(
        farmer_id=current.id,
        crop=listing_in.crop,
        quantity_kg=listing_in.quantity_kg,
        asking_price_per_kg=listing_in.asking_price_per_kg,
        unit=listing_in.unit,
        district=listing_in.district,
        description=listing_in.description,
        status="active",
    )
    session.add(listing)
    await session.commit()
    await session.refresh(listing)
    return listing


@router.get("/listings", response_model=List[ListingResponse])
async def list_listings(
    crop: Optional[str] = None,
    district: Optional[str] = None,
    status_filter: str = Query(default="active", alias="status"),
    session: AsyncSession = Depends(get_session)
):
    query = select(Listing).order_by(desc(Listing.created_at))
    if status_filter != "all":
        query = query.where(Listing.status == status_filter)
    if crop:
        query = query.where(Listing.crop.ilike(f"%{crop}%"))
    if district:
        query = query.where(Listing.district.ilike(f"%{district}%"))

    result = await session.execute(query)
    return result.scalars().all()


@router.post("/offers", response_model=OfferResponse, status_code=status.HTTP_201_CREATED)
async def make_offer(offer_in: OfferCreate, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    listing = await session.get(Listing, offer_in.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail=f"Listing with id {offer_in.listing_id} not found")
    if listing.status != "active":
        raise HTTPException(status_code=400, detail="Cannot make offer on a non-active listing")

    if listing.farmer_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot make an offer on your own listing")

    offer = Offer(
        listing_id=offer_in.listing_id,
        buyer_farmer_id=current.id,
        offered_price_per_kg=offer_in.offered_price_per_kg,
        quantity_kg=offer_in.quantity_kg,
        status="pending",
        message=offer_in.message,
    )
    session.add(offer)
    await session.commit()
    await session.refresh(offer)
    return offer


@router.get("/listings/{listing_id}/offers", response_model=List[OfferResponse])
async def get_listing_offers(listing_id: int, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    listing = await session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail=f"Listing with id {listing_id} not found")
    ensure_owner(listing.farmer_id, current)

    result = await session.execute(
        select(Offer).where(Offer.listing_id == listing_id).order_by(desc(Offer.created_at))
    )
    return result.scalars().all()


@router.get("/prices", response_model=List[MarketPriceRefResponse])
async def list_market_prices(
    crop: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve benchmark reference market prices.
    Simulated baseline data only (honest provenance).
    """
    query = select(MarketPriceRef).order_by(MarketPriceRef.crop)
    if crop:
        query = query.where(MarketPriceRef.crop.ilike(f"%{crop}%"))
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/listings/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: int, session: AsyncSession = Depends(get_session)):
    listing = await session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail=f"Listing with id {listing_id} not found")
    return listing


@router.patch("/listings/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: int,
    listing_update: ListingUpdate,
    session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)
):
    listing = await session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail=f"Listing with id {listing_id} not found")
    ensure_owner(listing.farmer_id, current)

    if listing_update.quantity_kg is not None:
        listing.quantity_kg = listing_update.quantity_kg
    if listing_update.asking_price_per_kg is not None:
        listing.asking_price_per_kg = listing_update.asking_price_per_kg
    if listing_update.description is not None:
        listing.description = listing_update.description
    if listing_update.status is not None:
        listing.status = listing_update.status

    await session.commit()
    await session.refresh(listing)
    return listing


@router.delete("/listings/{listing_id}", status_code=status.HTTP_200_OK)
async def delete_listing(listing_id: int, session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)):
    listing = await session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail=f"Listing with id {listing_id} not found")
    ensure_owner(listing.farmer_id, current)

    await session.delete(listing)
    await session.commit()
    return {"status": "deleted", "id": listing_id}


@router.patch("/offers/{offer_id}", response_model=OfferResponse)
async def update_offer(
    offer_id: int,
    offer_update: OfferUpdate,
    session: AsyncSession = Depends(get_session), current: Farmer = Depends(get_current_farmer)
):
    offer = await session.get(Offer, offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail=f"Offer with id {offer_id} not found")
    listing = await session.get(Listing, offer.listing_id)
    ensure_owner(listing.farmer_id, current)

    offer.status = offer_update.status
    await session.commit()
    await session.refresh(offer)
    return offer

