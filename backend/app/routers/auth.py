"""Registration, login, and authenticated profile endpoints."""
from __future__ import annotations

import hashlib
import hmac
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_farmer, hash_password, issue_access_token, verify_password
from app.config import settings
from app.database import get_session
from app.models.auth import AuthCredential
from app.models.farmer import Farmer

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=12, max_length=256)
    district: str = Field(min_length=2, max_length=100)
    state: str = Field(default="Maharashtra", max_length=100)
    lang_pref: str = Field(default="en", pattern="^(en|hi)$")


class LoginRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=1, max_length=256)


def phone_hash(phone: str) -> str:
    normalized = re.sub(r"\D", "", phone)
    if not 8 <= len(normalized) <= 15:
        raise HTTPException(status_code=422, detail="Phone must contain 8 to 15 digits")
    return hmac.new(settings.phone_hash_secret.encode(), normalized.encode(), hashlib.sha256).hexdigest()


def auth_response(farmer: Farmer) -> dict:
    return {"access_token": issue_access_token(farmer.id), "token_type": "bearer", "farmer": {"id": farmer.id, "name": farmer.name, "district": farmer.district, "state": farmer.state, "lang_pref": farmer.lang_pref}}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    if not settings.allow_registration:
        raise HTTPException(status_code=403, detail="Registration is disabled")
    hashed_phone = phone_hash(body.phone)
    if await session.scalar(select(Farmer.id).where(Farmer.phone_hash == hashed_phone)):
        raise HTTPException(status_code=409, detail="An account with this phone already exists")
    farmer = Farmer(name=body.name.strip(), phone_hash=hashed_phone, district=body.district.strip(), state=body.state.strip(), lang_pref=body.lang_pref, is_demo=False)
    session.add(farmer)
    await session.flush()
    session.add(AuthCredential(farmer_id=farmer.id, password_hash=hash_password(body.password)))
    await session.commit()
    await session.refresh(farmer)
    return auth_response(farmer)


@router.post("/login")
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    try:
        hashed_phone = phone_hash(body.phone)
    except HTTPException:
        hashed_phone = "invalid"
    result = await session.execute(select(Farmer, AuthCredential).join(AuthCredential, AuthCredential.farmer_id == Farmer.id).where(Farmer.phone_hash == hashed_phone))
    pair = result.first()
    if not pair or not verify_password(body.password, pair.AuthCredential.password_hash):
        raise HTTPException(status_code=401, detail="Invalid phone or password", headers={"WWW-Authenticate": "Bearer"})
    return auth_response(pair.Farmer)


@router.get("/me")
async def me(farmer: Farmer = Depends(get_current_farmer)):
    return {"id": farmer.id, "name": farmer.name, "district": farmer.district, "state": farmer.state, "lang_pref": farmer.lang_pref}
