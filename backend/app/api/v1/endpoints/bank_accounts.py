from __future__ import annotations

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, DataContext
from app.api.v1.schemas.bank_account import (
    BankAccountCreate,
    BankAccountResponse,
    BankAccountUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models import BankAccount, BankBalance, User
from app.db.session import get_db
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bank-accounts", tags=["Bank Accounts"])


@router.post("", response_model=BankAccountResponse, status_code=201)
async def create_bank_account(
    data: BankAccountCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    # If setting as primary, unset any existing primary
    if data.is_primary:
        result = await db.execute(
            select(BankAccount).where(
                ctx.ownership_filter(BankAccount),
                BankAccount.is_primary == True,
            )
        )
        for existing in result.scalars().all():
            existing.is_primary = False

    account = BankAccount(
        **ctx.create_fields(),
        name=data.name,
        bank_name=data.bank_name,
        account_last_digits=data.account_last_digits,
        overdraft_limit=data.overdraft_limit,
        currency=data.currency,
        is_primary=data.is_primary,
        notes=data.notes,
    )
    db.add(account)
    await log_action(db, user_id=current_user.id, action="create", entity_type="bank_account", entity_id=str(account.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(account)
    logger.info("User %s created bank account %s", current_user.id, account.id)
    return account


@router.get("", response_model=List[BankAccountResponse])
async def list_bank_accounts(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankAccount)
        .where(ctx.ownership_filter(BankAccount))
        .order_by(BankAccount.created_at.desc())
    )
    accounts = result.scalars().all()

    responses = []
    for acct in accounts:
        resp = BankAccountResponse.model_validate(acct)
        # Fetch current balance linked to this account
        bal_result = await db.execute(
            select(BankBalance.balance).where(
                BankBalance.bank_account_id == acct.id,
                BankBalance.is_current == True,
            )
        )
        bal = bal_result.scalar_one_or_none()
        resp.current_balance = bal
        responses.append(resp)

    return responses


@router.get("/{account_id}", response_model=BankAccountResponse)
async def get_bank_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == account_id,
            ctx.ownership_filter(BankAccount),
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundException("Bank account not found")

    resp = BankAccountResponse.model_validate(account)
    bal_result = await db.execute(
        select(BankBalance.balance).where(
            BankBalance.bank_account_id == account.id,
            BankBalance.is_current == True,
        )
    )
    resp.current_balance = bal_result.scalar_one_or_none()
    return resp


@router.put("/{account_id}", response_model=BankAccountResponse)
async def update_bank_account(
    account_id: UUID,
    data: BankAccountUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == account_id,
            ctx.ownership_filter(BankAccount),
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundException("Bank account not found")

    update_data = data.model_dump(exclude_unset=True)

    # If setting as primary, unset existing primary
    if update_data.get("is_primary"):
        res = await db.execute(
            select(BankAccount).where(
                ctx.ownership_filter(BankAccount),
                BankAccount.is_primary == True,
                BankAccount.id != account_id,
            )
        )
        for existing in res.scalars().all():
            existing.is_primary = False

    for key, value in update_data.items():
        setattr(account, key, value)

    await log_action(db, user_id=current_user.id, action="update", entity_type="bank_account", entity_id=str(account.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(account)
    logger.info("User %s updated bank account %s", current_user.id, account.id)
    return account


@router.delete("/{account_id}")
async def delete_bank_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == account_id,
            ctx.ownership_filter(BankAccount),
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundException("Bank account not found")

    await log_action(db, user_id=current_user.id, action="delete", entity_type="bank_account", entity_id=str(account.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.delete(account)
    await db.commit()
    logger.info("User %s deleted bank account %s", current_user.id, account_id)
    return {"detail": "Bank account deleted"}
