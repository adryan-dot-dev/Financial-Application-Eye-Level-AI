from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, DataContext
from app.api.v1.schemas.balance import (
    BalanceCreate,
    BalanceHistoryResponse,
    BalanceResponse,
    BalanceUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models import BankBalance, User
from app.db.models.bank_account import BankAccount
from app.db.session import get_db
from app.services.audit_service import log_action

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/balance", tags=["Balance"])


@router.get("", response_model=BalanceResponse)
async def get_current_balance(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankBalance).where(
            ctx.ownership_filter(BankBalance),
            BankBalance.is_current == True,
        )
    )
    balance = result.scalars().first()
    if not balance:
        raise NotFoundException("No current balance set. Please create one first.")
    return balance


@router.put("", response_model=BalanceResponse)
async def update_balance(
    data: BalanceUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    # Lock existing current balance rows with FOR UPDATE to prevent race conditions
    result = await db.execute(
        select(BankBalance)
        .where(
            ctx.ownership_filter(BankBalance),
            BankBalance.is_current == True,
        )
        .with_for_update()
    )
    old_balance = result.scalar_one_or_none()
    if not old_balance:
        raise NotFoundException("No current balance. Use POST to create one.")

    update_data = data.model_dump(exclude_unset=True)
    new_effective_date = update_data.get("effective_date", old_balance.effective_date)

    # Validate bank_account_id if provided
    new_bank_account_id = update_data.get("bank_account_id")
    if new_bank_account_id:
        ba_result = await db.execute(
            select(BankAccount).where(BankAccount.id == new_bank_account_id, ctx.ownership_filter(BankAccount))
        )
        if not ba_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Bank account not found or does not belong to you")

    # If the effective_date is not changing, update the existing record in place
    if new_effective_date == old_balance.effective_date:
        old_balance.balance = update_data.get("balance", old_balance.balance)
        if "notes" in update_data:
            old_balance.notes = update_data["notes"]
        if "bank_account_id" in update_data:
            old_balance.bank_account_id = update_data["bank_account_id"]
        await log_action(db, user_id=current_user.id, action="update", entity_type="balance", entity_id=str(old_balance.id), user_email=current_user.email, organization_id=ctx.organization_id)
        await db.commit()
        await db.refresh(old_balance)
        logger.info("User %s updated balance %s", current_user.id, old_balance.id)
        return old_balance

    # Effective date is changing: create a new entry and archive the old one
    old_balance.is_current = False

    new_balance_value = update_data.get("balance", old_balance.balance)
    new_notes = update_data.get("notes", old_balance.notes)
    new_ba_id = update_data.get("bank_account_id", old_balance.bank_account_id)

    new_entry = BankBalance(
        **ctx.create_fields(),
        balance=new_balance_value,
        effective_date=new_effective_date,
        is_current=True,
        notes=new_notes,
        bank_account_id=new_ba_id,
    )
    db.add(new_entry)
    await log_action(db, user_id=current_user.id, action="update", entity_type="balance", entity_id=None, user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(new_entry)
    logger.info("User %s updated balance %s", current_user.id, new_entry.id)
    return new_entry


@router.post("", response_model=BalanceResponse, status_code=201)
async def create_balance(
    data: BalanceCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    # Lock existing current balance rows with FOR UPDATE to prevent race conditions
    result = await db.execute(
        select(BankBalance)
        .where(
            ctx.ownership_filter(BankBalance),
            BankBalance.is_current == True,
        )
        .with_for_update()
    )
    existing_current = result.scalars().all()
    for existing in existing_current:
        existing.is_current = False

    if data.bank_account_id:
        ba_result = await db.execute(
            select(BankAccount).where(BankAccount.id == data.bank_account_id, ctx.ownership_filter(BankAccount))
        )
        if not ba_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Bank account not found or does not belong to you")

    balance = BankBalance(
        **ctx.create_fields(),
        balance=data.balance,
        effective_date=data.effective_date,
        is_current=True,
        notes=data.notes,
        bank_account_id=data.bank_account_id,
    )
    db.add(balance)
    await log_action(db, user_id=current_user.id, action="create", entity_type="balance", entity_id=str(balance.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(balance)
    logger.info("User %s created balance %s", current_user.id, balance.id)
    return balance


@router.get("/history", response_model=BalanceHistoryResponse)
async def get_balance_history(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankBalance)
        .where(ctx.ownership_filter(BankBalance))
        .order_by(BankBalance.effective_date.desc())
    )
    items = result.scalars().all()
    return BalanceHistoryResponse(items=items)
