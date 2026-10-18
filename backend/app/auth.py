"""Password authentication and short-lived signed bearer tokens."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.models.farmer import Farmer

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$" + base64.urlsafe_b64encode(salt + digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, encoded = stored.split("$", 1)
        raw = base64.urlsafe_b64decode(encoded.encode())
        salt, expected = raw[:16], raw[16:]
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        return scheme == "scrypt" and hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def issue_access_token(farmer_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(farmer_id), "iat": now, "exp": now + timedelta(minutes=settings.access_token_expire_minutes)}, settings.secret_key, algorithm=settings.algorithm)


async def get_current_farmer(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> Farmer:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None and settings.demo_read_only and request.method in {"GET", "HEAD"}:
        demo_farmer = await session.scalar(
            select(Farmer).where(
                Farmer.phone_hash == "demo-farmer-hash-001",
                Farmer.is_demo.is_(True),
            )
        )
        if demo_farmer is not None:
            return demo_farmer
    if credentials is None:
        raise unauthorized
    try:
        claims = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[settings.algorithm])
        farmer_id = int(claims["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        raise unauthorized
    farmer = await session.get(Farmer, farmer_id)
    if farmer is None:
        raise unauthorized
    return farmer


def ensure_owner(owner_id: int, farmer: Farmer) -> None:
    if owner_id != farmer.id:
        raise HTTPException(status_code=404, detail="Resource not found")
