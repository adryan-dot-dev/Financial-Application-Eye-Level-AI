from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.alert import AlertListResponse, AlertResponse, AlertUnreadCount
from app.core.exceptions import NotFoundException
from app.db.models import Alert, User
from app.db.session import get_db

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).where(
            Alert.user_id == current_user.id,
            Alert.is_dismissed == False,
        ).order_by(Alert.created_at.desc())
    )
    items = result.scalars().all()

    unread_count = sum(1 for a in items if not a.is_read)
    return AlertListResponse(items=items, unread_count=unread_count)


@router.get("/unread", response_model=AlertUnreadCount)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count(Alert.id)).where(
            Alert.user_id == current_user.id,
            Alert.is_read == False,
            Alert.is_dismissed == False,
        )
    )
    count = result.scalar()
    return AlertUnreadCount(count=count or 0)


@router.put("/{alert_id}/read", response_model=AlertResponse)
async def mark_as_read(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).where(
            Alert.id == alert_id,
            Alert.user_id == current_user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise NotFoundException("Alert not found")
    alert.is_read = True
    await db.commit()
    await db.refresh(alert)
    return alert


@router.put("/{alert_id}/dismiss", response_model=AlertResponse)
async def dismiss_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).where(
            Alert.id == alert_id,
            Alert.user_id == current_user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise NotFoundException("Alert not found")
    alert.is_dismissed = True
    await db.commit()
    await db.refresh(alert)
    return alert
