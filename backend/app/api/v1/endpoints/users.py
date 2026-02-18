from __future__ import annotations

import math
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.api.v1.schemas.auth import (
    AdminPasswordReset,
    UserAdminCreate,
    UserAdminUpdate,
    UserListResponse,
    UserResponse,
)
from app.core.exceptions import AlreadyExistsException, ForbiddenException, NotFoundException
from app.core.security import hash_password
from app.db.models.settings import Settings
from app.db.models.user import User
from app.db.session import get_db
from app.services.audit_service import log_action

router = APIRouter(prefix="/users", tags=["Users (Admin)"])


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=200),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    base_query = select(User)

    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        base_query = base_query.where(
            or_(User.username.ilike(pattern), User.email.ilike(pattern))
        )

    # Count total
    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0

    # Fetch page
    offset = (page - 1) * page_size
    result = await db.execute(
        base_query.order_by(User.created_at).offset(offset).limit(page_size)
    )
    users = result.scalars().all()

    return UserListResponse(
        items=users,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


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

    await log_action(db, user_id=_admin.id, action="admin_create_user", entity_type="user", entity_id=str(user.id), details=f"Created user {data.username}")
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

    # Super-admin cannot be modified by non-super-admins
    if user.is_super_admin and not _admin.is_super_admin:
        raise ForbiddenException("Cannot modify super admin")

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
        if user.is_super_admin:
            raise ForbiddenException("Cannot deactivate super admin")
        user.is_active = data.is_active

    if data.is_admin is not None:
        if user_id == _admin.id and not data.is_admin:
            raise ForbiddenException("Cannot remove your own admin status")
        if user.is_super_admin and not data.is_admin:
            raise ForbiddenException("Cannot demote super admin")
        # Only super-admin can promote/demote admin status
        if not _admin.is_super_admin and user.is_admin != data.is_admin:
            raise ForbiddenException("Only super admin can change admin status")
        user.is_admin = data.is_admin

    await log_action(db, user_id=_admin.id, action="admin_update_user", entity_type="user", entity_id=str(user_id))
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

    if user.is_super_admin:
        raise ForbiddenException("Cannot delete super admin")

    await db.delete(user)
    await log_action(db, user_id=admin.id, action="admin_delete_user", entity_type="user", entity_id=str(user_id), details=f"Deleted user {user.username}")
    await db.commit()
    return {"message": "User deleted successfully"}


@router.post("/{user_id}/reset-password")
async def admin_reset_user_password(
    user_id: UUID,
    data: AdminPasswordReset,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin resets another user's password."""
    if user_id == admin.id:
        raise ForbiddenException("Use /auth/password to change your own password")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User")

    # Only super-admin can reset admin users' passwords
    if user.is_admin and not admin.is_super_admin:
        raise ForbiddenException("Only super admin can reset admin passwords")

    user.password_hash = hash_password(data.new_password)
    await log_action(db, user_id=admin.id, action="admin_reset_password", entity_type="user", entity_id=str(user_id))
    await db.commit()
    return {"message": "Password reset successfully"}
