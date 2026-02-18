from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Set, Union

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# Token blacklist
#
# CURRENT: In-memory set (MVP).  Tokens are lost on process restart and not
# shared across workers.
#
# PRODUCTION MIGRATION PATH (Redis):
#   1. Add redis[hiredis] to requirements.txt
#   2. Create app/core/redis.py with an async Redis connection pool
#      (use REDIS_URL from app.config.settings)
#   3. Replace blacklist_token() with:
#        await redis.setex(f"blacklist:{jti}", ttl_seconds, "1")
#   4. Replace is_token_blacklisted() with:
#        return await redis.exists(f"blacklist:{jti}")
#   5. Set TTL = ACCESS_TOKEN_EXPIRE_MINUTES * 60 so entries auto-expire
#   6. Remove this in-memory set
#
# Benefits: survives restarts, shared across Uvicorn workers, auto-expiry.
# ---------------------------------------------------------------------------
_token_blacklist: Set[str] = set()


def blacklist_token(jti: str) -> None:
    """Add a token JTI to the blacklist."""
    _token_blacklist.add(jti)


def is_token_blacklisted(jti: str) -> bool:
    """Check if a token JTI has been blacklisted."""
    return jti in _token_blacklist


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: Union[str, "UUID"], extra: Optional[Dict[str, Any]] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    if extra:
        to_encode.update(extra)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Union[str, "UUID"]) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": now,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def is_token_issued_before_password_change(
    payload: Dict[str, Any],
    password_changed_at: Optional[datetime],
) -> bool:
    """Check if a token was issued before the user's last password change.

    Returns True if the token should be considered invalid (issued before
    the password was changed).
    """
    if password_changed_at is None:
        return False

    iat = payload.get("iat")
    if iat is None:
        # Tokens without iat are considered invalid after any password change
        return True

    # iat from jose is a Unix timestamp (int/float)
    if isinstance(iat, (int, float)):
        token_issued = datetime.fromtimestamp(iat, tz=timezone.utc)
    else:
        token_issued = iat

    # Ensure password_changed_at is timezone-aware
    if password_changed_at.tzinfo is None:
        password_changed_at = password_changed_at.replace(tzinfo=timezone.utc)

    return token_issued < password_changed_at
