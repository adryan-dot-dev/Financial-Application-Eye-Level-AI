from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.fixed import FixedCreate, FixedResponse, FixedUpdate
from app.core.exceptions import NotFoundException
from app.db.models import FixedIncomeExpense, User
from app.db.session import get_db

router = APIRouter(prefix="/fixed", tags=["Fixed Income/Expenses"])


@router.get("", response_model=List[FixedResponse])
async def list_fixed(
    type: Optional[str] = Query(None, pattern="^(income|expense)$"),
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(FixedIncomeExpense).where(
        FixedIncomeExpense.user_id == current_user.id
    )
    if type:
        query = query.where(FixedIncomeExpense.type == type)
    if is_active is not None:
        query = query.where(FixedIncomeExpense.is_active == is_active)
    query = query.order_by(FixedIncomeExpense.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=FixedResponse, status_code=201)
async def create_fixed(
    data: FixedCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    fixed = FixedIncomeExpense(
        user_id=current_user.id,
        **data.model_dump(),
        is_active=True,
    )
    db.add(fixed)
    await db.commit()
    await db.refresh(fixed)
    return fixed


@router.get("/{fixed_id}", response_model=FixedResponse)
async def get_fixed(
    fixed_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            FixedIncomeExpense.user_id == current_user.id,
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")
    return fixed


@router.put("/{fixed_id}", response_model=FixedResponse)
async def update_fixed(
    fixed_id: UUID,
    data: FixedUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            FixedIncomeExpense.user_id == current_user.id,
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(fixed, key, value)
    await db.commit()
    await db.refresh(fixed)
    return fixed


@router.delete("/{fixed_id}")
async def delete_fixed(
    fixed_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            FixedIncomeExpense.user_id == current_user.id,
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")
    await db.delete(fixed)
    await db.commit()
    return {"message": "Deleted successfully"}


@router.post("/{fixed_id}/pause", response_model=FixedResponse)
async def pause_fixed(
    fixed_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            FixedIncomeExpense.user_id == current_user.id,
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")
    fixed.is_active = False
    await db.commit()
    await db.refresh(fixed)
    return fixed


@router.post("/{fixed_id}/resume", response_model=FixedResponse)
async def resume_fixed(
    fixed_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            FixedIncomeExpense.user_id == current_user.id,
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")
    fixed.is_active = True
    await db.commit()
    await db.refresh(fixed)
    return fixed
