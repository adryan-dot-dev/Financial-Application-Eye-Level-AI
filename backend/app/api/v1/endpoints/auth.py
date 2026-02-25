from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.auth import (
    PasswordChange,
    TokenRefresh,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)
from app.core.exceptions import AlreadyExistsException, NotFoundException, UnauthorizedException
from app.core.security import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    is_token_blacklisted,
    is_token_issued_before_password_change,
    verify_password,
)
from app.core.rate_limit import limiter
from app.db.models.settings import Settings
from app.db.models.user import User
from app.db.session import get_db
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("3/minute")
async def register(request: Request, data: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check username
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise AlreadyExistsException("Username")

    # Check email
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise AlreadyExistsException("Email")

    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.flush()

    # Create default settings for user
    settings_obj = Settings(user_id=user.id)
    db.add(settings_obj)

    await log_action(db, user_id=user.id, action="register", entity_type="user", entity_id=str(user.id), request=request)
    await db.commit()
    await db.refresh(user)

    # Return tokens so the user is automatically logged in after registration
    return TokenResponse(
        access_token=create_access_token(user.id, {"is_admin": user.is_admin}),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    # Accept either username or email in the username field
    result = await db.execute(
        select(User).where(
            or_(User.username == data.username, User.email == data.username)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise UnauthorizedException("Invalid username or password")

    if not user.is_active:
        raise UnauthorizedException("Account is inactive")

    # Update last login via direct SQL to avoid StaleDataError
    # in async session contexts (ORM object tracking can become stale)
    await db.execute(
        update(User).where(User.id == user.id).values(
            last_login_at=datetime.now(timezone.utc)
        )
    )

    await log_action(db, user_id=user.id, action="login", entity_type="user", entity_id=str(user.id), request=request)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, {"is_admin": user.is_admin}),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
async def refresh_token(request: Request, data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise UnauthorizedException("Invalid refresh token")

    # Bug 2 fix: Check if this refresh token has already been used (race condition)
    jti = payload.get("jti")
    if jti and is_token_blacklisted(jti):
        raise UnauthorizedException("Refresh token has already been used")

    # Atomically blacklist the old refresh token BEFORE issuing new tokens
    # This prevents concurrent requests from both succeeding
    if jti:
        blacklist_token(jti)

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise UnauthorizedException("User not found or inactive")

    # Bug 1 fix: Check if token was issued before the last password change
    if is_token_issued_before_password_change(payload, user.password_changed_at):
        raise UnauthorizedException("Token invalidated by password change")

    return TokenResponse(
        access_token=create_access_token(user.id, {"is_admin": user.is_admin}),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ORANGE-9: Blacklist the current access token
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = decode_token(token)
        if payload and payload.get("jti"):
            blacklist_token(payload["jti"])
    await log_action(db, user_id=current_user.id, action="logout", entity_type="user", entity_id=str(current_user.id), request=request)
    await db.commit()
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    request: Request,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    changed_fields = []

    if data.username is not None:
        result = await db.execute(
            select(User).where(User.username == data.username, User.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise AlreadyExistsException("Username")
        current_user.username = data.username
        changed_fields.append("username")

    if data.email is not None:
        result = await db.execute(
            select(User).where(User.email == data.email, User.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise AlreadyExistsException("Email")
        current_user.email = data.email
        changed_fields.append("email")

    if data.full_name is not None:
        current_user.full_name = data.full_name
        changed_fields.append("full_name")

    if data.phone_number is not None:
        current_user.phone_number = data.phone_number
        changed_fields.append("phone_number")

    await log_action(
        db,
        user_id=current_user.id,
        action="update_profile",
        entity_type="user",
        entity_id=str(current_user.id),
        details=f"fields changed: {', '.join(changed_fields)}" if changed_fields else None,
        request=request,
        user_email=current_user.email,
    )
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise UnauthorizedException("Current password is incorrect")

    now = datetime.now(timezone.utc)
    current_user.password_hash = hash_password(data.new_password)
    current_user.password_changed_at = now

    # Blacklist the current access token so it cannot be reused
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = decode_token(token)
        if payload and payload.get("jti"):
            blacklist_token(payload["jti"])

    await log_action(db, user_id=current_user.id, action="password_change", entity_type="user", entity_id=str(current_user.id), request=request)
    await db.commit()
    return {"message": "Password updated successfully"}
