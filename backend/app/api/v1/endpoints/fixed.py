from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, get_base_currency, DataContext
from app.api.v1.schemas.fixed import FixedCreate, FixedResponse, FixedUpdate
from app.core.exceptions import NotFoundException
from app.db.models import Category, FixedIncomeExpense, User
from app.db.models.bank_account import BankAccount
from app.db.models.credit_card import CreditCard
from app.db.session import get_db
from app.services.audit_service import log_action
from app.services.exchange_rate_service import prepare_currency_fields

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fixed", tags=["Fixed Income/Expenses"])


@router.get("", response_model=List[FixedResponse])
async def list_fixed(
    type: Optional[str] = Query(None, pattern="^(income|expense)$"),
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    query = select(FixedIncomeExpense).where(
        ctx.ownership_filter(FixedIncomeExpense)
    )
    if type:
        query = query.where(FixedIncomeExpense.type == type)
    if is_active is not None:
        query = query.where(FixedIncomeExpense.is_active == is_active)
    query = query.order_by(FixedIncomeExpense.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=FixedResponse, status_code=201)
async def create_fixed(
    data: FixedCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    base_currency: str = Depends(get_base_currency),
    db: AsyncSession = Depends(get_db),
):
    if data.category_id:
        cat_result = await db.execute(
            select(Category).where(Category.id == data.category_id, ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        if cat.type != data.type:
            raise HTTPException(
                status_code=400,
                detail=f"Category type '{cat.type}' does not match fixed type '{data.type}'",
            )

    # Payment method consistency validation
    if data.payment_method == "credit_card" and not data.credit_card_id:
        raise HTTPException(
            status_code=422,
            detail="credit_card_id is required when payment_method is 'credit_card'"
        )
    if data.payment_method == "bank_transfer" and not data.bank_account_id:
        raise HTTPException(
            status_code=422,
            detail="bank_account_id is required when payment_method is 'bank_transfer'"
        )

    if data.credit_card_id:
        cc_result = await db.execute(
            select(CreditCard).where(CreditCard.id == data.credit_card_id, ctx.ownership_filter(CreditCard))
        )
        if not cc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Credit card not found or does not belong to you")

    if data.bank_account_id:
        ba_result = await db.execute(
            select(BankAccount).where(BankAccount.id == data.bank_account_id, ctx.ownership_filter(BankAccount))
        )
        if not ba_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Bank account not found or does not belong to you")

    if data.end_date and data.end_date < data.start_date:
        raise HTTPException(status_code=422, detail="end_date must be >= start_date")

    data_dict = data.model_dump()
    conv = await prepare_currency_fields(data.amount, data.currency, base_currency)
    data_dict["amount"] = conv["converted_amount"]
    data_dict["currency"] = base_currency
    data_dict["original_amount"] = conv["original_amount"]
    data_dict["original_currency"] = conv["original_currency"]
    data_dict["exchange_rate"] = conv["exchange_rate"]

    fixed = FixedIncomeExpense(
        **ctx.create_fields(),
        **data_dict,
        is_active=True,
    )
    db.add(fixed)
    await log_action(db, user_id=current_user.id, action="create", entity_type="fixed", entity_id=str(fixed.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(fixed)
    logger.info("User %s created fixed income/expense %s", current_user.id, fixed.id)
    return fixed


@router.get("/{fixed_id}", response_model=FixedResponse)
async def get_fixed(
    fixed_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            ctx.ownership_filter(FixedIncomeExpense),
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
    ctx: DataContext = Depends(get_data_context),
    base_currency: str = Depends(get_base_currency),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            ctx.ownership_filter(FixedIncomeExpense),
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")

    update_data = data.model_dump(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"]:
        cat_result = await db.execute(
            select(Category).where(Category.id == update_data["category_id"], ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        effective_type = update_data.get("type", fixed.type)
        if cat.type != effective_type:
            raise HTTPException(
                status_code=400,
                detail=f"Category type '{cat.type}' does not match fixed type '{effective_type}'",
            )

    # Payment method consistency validation on update
    effective_payment_method = update_data.get("payment_method", fixed.payment_method)
    effective_cc_id = update_data.get("credit_card_id", fixed.credit_card_id)
    effective_ba_id = update_data.get("bank_account_id", fixed.bank_account_id)
    if effective_payment_method == "credit_card" and not effective_cc_id:
        raise HTTPException(
            status_code=422,
            detail="credit_card_id is required when payment_method is 'credit_card'"
        )
    if effective_payment_method == "bank_transfer" and not effective_ba_id:
        raise HTTPException(
            status_code=422,
            detail="bank_account_id is required when payment_method is 'bank_transfer'"
        )

    if update_data.get("credit_card_id"):
        cc_result = await db.execute(
            select(CreditCard).where(CreditCard.id == update_data["credit_card_id"], ctx.ownership_filter(CreditCard))
        )
        if not cc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Credit card not found or does not belong to you")

    if update_data.get("bank_account_id"):
        ba_result = await db.execute(
            select(BankAccount).where(BankAccount.id == update_data["bank_account_id"], ctx.ownership_filter(BankAccount))
        )
        if not ba_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Bank account not found or does not belong to you")

    # Multi-currency: re-convert if amount or currency changed
    if "amount" in update_data or "currency" in update_data:
        new_amount = update_data.get("amount", fixed.original_amount or fixed.amount)
        new_currency = update_data.get("currency", fixed.original_currency or fixed.currency)
        conv = await prepare_currency_fields(new_amount, new_currency, base_currency)
        update_data["amount"] = conv["converted_amount"]
        update_data["currency"] = base_currency
        update_data["original_amount"] = conv["original_amount"]
        update_data["original_currency"] = conv["original_currency"]
        update_data["exchange_rate"] = conv["exchange_rate"]

    for key, value in update_data.items():
        setattr(fixed, key, value)

    if fixed.end_date and fixed.end_date < fixed.start_date:
        raise HTTPException(status_code=422, detail="end_date must be >= start_date")

    await log_action(db, user_id=current_user.id, action="update", entity_type="fixed", entity_id=str(fixed_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(fixed)
    logger.info("User %s updated fixed income/expense %s", current_user.id, fixed.id)
    return fixed


@router.delete("/{fixed_id}")
async def delete_fixed(
    fixed_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            ctx.ownership_filter(FixedIncomeExpense),
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")
    await db.delete(fixed)
    await log_action(db, user_id=current_user.id, action="delete", entity_type="fixed", entity_id=str(fixed_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    logger.info("User %s deleted fixed income/expense %s", current_user.id, fixed_id)
    return {"message": "Deleted successfully"}


@router.post("/{fixed_id}/pause", response_model=FixedResponse)
async def pause_fixed(
    fixed_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            ctx.ownership_filter(FixedIncomeExpense),
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")
    fixed.is_active = False
    fixed.paused_at = datetime.now(timezone.utc)
    await log_action(db, user_id=current_user.id, action="pause", entity_type="fixed", entity_id=str(fixed_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(fixed)
    logger.info("User %s paused fixed income/expense %s", current_user.id, fixed.id)
    return fixed


@router.post("/{fixed_id}/resume", response_model=FixedResponse)
async def resume_fixed(
    fixed_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.id == fixed_id,
            ctx.ownership_filter(FixedIncomeExpense),
        )
    )
    fixed = result.scalar_one_or_none()
    if not fixed:
        raise NotFoundException("Fixed income/expense not found")
    fixed.is_active = True
    fixed.resumed_at = datetime.now(timezone.utc)
    await log_action(db, user_id=current_user.id, action="resume", entity_type="fixed", entity_id=str(fixed_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(fixed)
    logger.info("User %s resumed fixed income/expense %s", current_user.id, fixed.id)
    return fixed
