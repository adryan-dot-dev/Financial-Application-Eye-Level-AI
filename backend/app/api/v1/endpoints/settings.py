from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.settings import SettingsResponse, SettingsUpdate
from app.db.models.settings import Settings
from app.db.models.user import User
from app.db.session import get_db

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Settings).where(Settings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Auto-create settings if missing
        settings = Settings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


@router.put("", response_model=SettingsResponse)
async def update_settings(
    data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Settings).where(Settings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)
        await db.flush()

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)
    return settings
