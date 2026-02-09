from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.balance import (
    BalanceCreate,
    BalanceHistoryResponse,
    BalanceResponse,
    BalanceUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models import BankBalance, User
from app.db.session import get_db

router = APIRouter(prefix="/balance", tags=["Balance"])


@router.get("", response_model=BalanceResponse)
async def get_current_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankBalance).where(
            BankBalance.user_id == current_user.id,
            BankBalance.is_current == True,
        )
    )
    balance = result.scalar_one_or_none()
    if not balance:
        raise NotFoundException("No current balance set. Please create one first.")
    return balance


@router.put("", response_model=BalanceResponse)
async def update_balance(
    data: BalanceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankBalance).where(
            BankBalance.user_id == current_user.id,
            BankBalance.is_current == True,
        )
    )
    balance = result.scalar_one_or_none()
    if not balance:
        raise NotFoundException("No current balance. Use POST to create one.")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(balance, key, value)
    await db.commit()
    await db.refresh(balance)
    return balance


@router.post("", response_model=BalanceResponse, status_code=201)
async def create_balance(
    data: BalanceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Mark all existing as not current
    await db.execute(
        update(BankBalance)
        .where(
            BankBalance.user_id == current_user.id,
            BankBalance.is_current == True,
        )
        .values(is_current=False)
    )

    balance = BankBalance(
        user_id=current_user.id,
        balance=data.balance,
        effective_date=data.effective_date,
        is_current=True,
        notes=data.notes,
    )
    db.add(balance)
    await db.commit()
    await db.refresh(balance)
    return balance


@router.get("/history", response_model=BalanceHistoryResponse)
async def get_balance_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankBalance)
        .where(BankBalance.user_id == current_user.id)
        .order_by(BankBalance.effective_date.desc())
    )
    items = result.scalars().all()
    return BalanceHistoryResponse(items=items)
