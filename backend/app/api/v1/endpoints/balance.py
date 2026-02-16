from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
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
    # Lock existing current balance rows with FOR UPDATE to prevent race conditions
    result = await db.execute(
        select(BankBalance)
        .where(
            BankBalance.user_id == current_user.id,
            BankBalance.is_current == True,
        )
        .with_for_update()
    )
    old_balance = result.scalar_one_or_none()
    if not old_balance:
        raise NotFoundException("No current balance. Use POST to create one.")

    update_data = data.model_dump(exclude_unset=True)
    new_effective_date = update_data.get("effective_date", old_balance.effective_date)

    # If the effective_date is not changing, update the existing record in place
    if new_effective_date == old_balance.effective_date:
        old_balance.balance = update_data.get("balance", old_balance.balance)
        if "notes" in update_data:
            old_balance.notes = update_data["notes"]
        await db.commit()
        await db.refresh(old_balance)
        return old_balance

    # Effective date is changing: create a new entry and archive the old one
    old_balance.is_current = False

    new_balance_value = update_data.get("balance", old_balance.balance)
    new_notes = update_data.get("notes", old_balance.notes)

    new_entry = BankBalance(
        user_id=current_user.id,
        balance=new_balance_value,
        effective_date=new_effective_date,
        is_current=True,
        notes=new_notes,
    )
    db.add(new_entry)
    await db.commit()
    await db.refresh(new_entry)
    return new_entry


@router.post("", response_model=BalanceResponse, status_code=201)
async def create_balance(
    data: BalanceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Lock existing current balance rows with FOR UPDATE to prevent race conditions
    result = await db.execute(
        select(BankBalance)
        .where(
            BankBalance.user_id == current_user.id,
            BankBalance.is_current == True,
        )
        .with_for_update()
    )
    existing_current = result.scalars().all()
    for existing in existing_current:
        existing.is_current = False

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
