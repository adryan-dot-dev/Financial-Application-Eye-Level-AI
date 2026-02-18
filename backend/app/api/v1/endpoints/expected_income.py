from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, DataContext
from app.api.v1.schemas.expected_income import (
    ExpectedIncomeCreate,
    ExpectedIncomeListResponse,
    ExpectedIncomeResponse,
    ExpectedIncomeUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models import ExpectedIncome, User
from app.db.session import get_db
from app.services.audit_service import log_action

router = APIRouter(prefix="/expected-income", tags=["Expected Income"])


@router.get("", response_model=ExpectedIncomeListResponse)
async def list_expected_income(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExpectedIncome)
        .where(ctx.ownership_filter(ExpectedIncome))
        .order_by(ExpectedIncome.month.asc())
    )
    items = result.scalars().all()
    return ExpectedIncomeListResponse(items=items)


@router.put("/{month}", response_model=ExpectedIncomeResponse)
async def set_expected_income(
    month: date,
    data: ExpectedIncomeUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    # Normalize to first day of month
    normalized_month = month.replace(day=1)

    result = await db.execute(
        select(ExpectedIncome).where(
            ctx.ownership_filter(ExpectedIncome),
            ExpectedIncome.month == normalized_month,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.expected_amount = data.expected_amount
        if data.notes is not None:
            existing.notes = data.notes
        await log_action(db, user_id=current_user.id, action="update", entity_type="expected_income", entity_id=str(existing.id), user_email=current_user.email, organization_id=ctx.organization_id)
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        new_entry = ExpectedIncome(
            **ctx.create_fields(),
            month=normalized_month,
            expected_amount=data.expected_amount,
            notes=data.notes,
        )
        db.add(new_entry)
        await log_action(db, user_id=current_user.id, action="create", entity_type="expected_income", entity_id=str(new_entry.id), user_email=current_user.email, organization_id=ctx.organization_id)
        await db.commit()
        await db.refresh(new_entry)
        return new_entry


@router.delete("/{month}")
async def delete_expected_income(
    month: date,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    normalized_month = month.replace(day=1)
    result = await db.execute(
        select(ExpectedIncome).where(
            ctx.ownership_filter(ExpectedIncome),
            ExpectedIncome.month == normalized_month,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise NotFoundException("Expected income entry not found")
    await db.delete(entry)
    await log_action(db, user_id=current_user.id, action="delete", entity_type="expected_income", entity_id=str(entry.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    return {"message": "Deleted successfully"}
