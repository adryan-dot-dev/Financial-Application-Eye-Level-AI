from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.fixed import FixedCreate, FixedResponse, FixedUpdate
from app.core.exceptions import NotFoundException
from app.db.models import Category, FixedIncomeExpense, User
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
    if data.category_id:
        cat = await db.get(Category, data.category_id)
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        if cat.type != data.type:
            raise HTTPException(
                status_code=400,
                detail=f"Category type '{cat.type}' does not match fixed type '{data.type}'",
            )

    # H-4: Validate date range
    if data.end_date and data.end_date < data.start_date:
        raise HTTPException(status_code=422, detail="end_date must be >= start_date")

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
    if "category_id" in update_data and update_data["category_id"]:
        cat = await db.get(Category, update_data["category_id"])
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        effective_type = update_data.get("type", fixed.type)
        if cat.type != effective_type:
            raise HTTPException(
                status_code=400,
                detail=f"Category type '{cat.type}' does not match fixed type '{effective_type}'",
            )

    for key, value in update_data.items():
        setattr(fixed, key, value)

    # Validate date range after applying updates
    if fixed.end_date and fixed.end_date < fixed.start_date:
        raise HTTPException(status_code=422, detail="end_date must be >= start_date")

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
    fixed.paused_at = datetime.now(timezone.utc)
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
    fixed.resumed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(fixed)
    return fixed
