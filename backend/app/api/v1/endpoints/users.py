from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.api.v1.schemas.auth import UserAdminCreate, UserAdminUpdate, UserResponse
from app.core.exceptions import AlreadyExistsException, ForbiddenException, NotFoundException
from app.core.security import hash_password
from app.db.models.settings import Settings
from app.db.models.user import User
from app.db.session import get_db

router = APIRouter(prefix="/users", tags=["Users (Admin)"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserAdminCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise AlreadyExistsException("Username")

    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise AlreadyExistsException("Email")

    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        is_admin=data.is_admin,
    )
    db.add(user)
    await db.flush()

    settings_obj = Settings(user_id=user.id)
    db.add(settings_obj)

    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User")

    if data.username is not None:
        result = await db.execute(
            select(User).where(User.username == data.username, User.id != user_id)
        )
        if result.scalar_one_or_none():
            raise AlreadyExistsException("Username")
        user.username = data.username

    if data.email is not None:
        result = await db.execute(
            select(User).where(User.email == data.email, User.id != user_id)
        )
        if result.scalar_one_or_none():
            raise AlreadyExistsException("Email")
        user.email = data.email

    if data.is_active is not None:
        user.is_active = data.is_active

    if data.is_admin is not None:
        if user_id == _admin.id and not data.is_admin:
            raise ForbiddenException("Cannot remove your own admin status")
        user.is_admin = data.is_admin

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise ForbiddenException("Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User")

    await db.delete(user)
    await db.commit()
    return {"message": "User deleted successfully"}
