from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.audit_log import AuditLogListResponse, AuditLogResponse
from app.db.models.audit_log import AuditLog
from app.db.models.user import User
from app.db.session import get_db

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    user_id: Optional[UUID] = Query(None, description="Filter by user ID (admins only)"),
    entity_type: Optional[str] = Query(None, description="e.g. transaction, loan, user, backup"),
    action: Optional[str] = Query(None, description="e.g. create, update, delete, login, export"),
    start_date: Optional[date] = Query(None, description="Filter from this date (inclusive)"),
    end_date: Optional[date] = Query(None, description="Filter up to this date (inclusive)"),
    per_page: int = Query(default=50, ge=1, le=200),
    page: int = Query(default=1, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuditLogListResponse:
    """Query the audit log.

    - Regular users see only their own activity.
    - Admins can filter by any user_id to inspect any user's activity.
    """
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)

    # Access control: non-admins are always restricted to their own logs
    if not current_user.is_admin:
        query = query.where(AuditLog.user_id == current_user.id)
        count_query = count_query.where(AuditLog.user_id == current_user.id)
    elif user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)

    if start_date:
        dt_from = datetime.combine(start_date, time.min)
        query = query.where(AuditLog.created_at >= dt_from)
        count_query = count_query.where(AuditLog.created_at >= dt_from)

    if end_date:
        dt_to = datetime.combine(end_date, time.max)
        query = query.where(AuditLog.created_at <= dt_to)
        count_query = count_query.where(AuditLog.created_at <= dt_to)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * per_page
    query = query.order_by(AuditLog.created_at.desc()).limit(per_page).offset(offset)

    result = await db.execute(query)
    items = result.scalars().all()

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        per_page=per_page,
    )
