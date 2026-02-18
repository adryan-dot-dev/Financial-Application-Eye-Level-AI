from __future__ import annotations

import logging
import math
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select, update

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_data_context, get_base_currency, DataContext
from app.api.v1.schemas.transaction import (
    TransactionBulkCreate,
    TransactionBulkDelete,
    TransactionBulkUpdateCategory,
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models.category import Category
from app.db.models.credit_card import CreditCard
from app.db.models.transaction import Transaction
from app.db.models.user import User
from app.db.session import get_db
from app.services.audit_service import log_action
from app.services.exchange_rate_service import prepare_currency_fields

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_id: Optional[UUID] = None,
    type: Optional[str] = Query(None, pattern="^(income|expense)$"),
    min_amount: Optional[Decimal] = None,
    max_amount: Optional[Decimal] = None,
    search: Optional[str] = Query(None, max_length=200),
    sort_by: str = Query("date", pattern="^(date|amount|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    query = select(Transaction).where(ctx.ownership_filter(Transaction))

    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be <= end_date")
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)
    if category_id:
        query = query.where(Transaction.category_id == category_id)
    if type:
        query = query.where(Transaction.type == type)
    if min_amount is not None:
        query = query.where(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.where(Transaction.amount <= max_amount)
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Transaction.description.ilike(f"%{escaped}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Sort
    sort_column = getattr(Transaction, sort_by)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Eager load category to avoid N+1 queries
    query = query.options(selectinload(Transaction.category))

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    return TransactionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    data: TransactionCreate,
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
        if cat.is_archived:
            raise HTTPException(status_code=422, detail="Cannot assign an archived category")
        if cat.type != data.type:
            raise HTTPException(
                status_code=422,
                detail=f"Category type '{cat.type}' does not match transaction type '{data.type}'"
            )

    if data.credit_card_id:
        cc_result = await db.execute(
            select(CreditCard).where(CreditCard.id == data.credit_card_id, ctx.ownership_filter(CreditCard))
        )
        if not cc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Credit card not found or does not belong to you")

    data_dict = data.model_dump()

    # Multi-currency conversion
    conv = await prepare_currency_fields(data.amount, data.currency, base_currency)
    data_dict["amount"] = conv["converted_amount"]
    data_dict["currency"] = base_currency
    data_dict["original_amount"] = conv["original_amount"]
    data_dict["original_currency"] = conv["original_currency"]
    data_dict["exchange_rate"] = conv["exchange_rate"]

    transaction = Transaction(
        **ctx.create_fields(),
        **data_dict,
    )
    db.add(transaction)
    await log_action(db, user_id=current_user.id, action="create", entity_type="transaction", entity_id=str(transaction.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(transaction)
    logger.info("User %s created transaction %s", current_user.id, transaction.id)
    return transaction


@router.put("/bulk-update")
async def bulk_update_category(
    data: TransactionBulkUpdateCategory,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    # Validate category ownership
    if data.category_id:
        cat_result = await db.execute(
            select(Category).where(Category.id == data.category_id, ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")

    await db.execute(
        update(Transaction)
        .where(Transaction.id.in_(data.ids), ctx.ownership_filter(Transaction))
        .values(category_id=data.category_id)
    )
    await log_action(db, user_id=current_user.id, action="bulk_update", entity_type="transaction", details=f"updated category for {len(data.ids)} transactions", user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    return {"message": f"Updated {len(data.ids)} transactions"}


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, ctx.ownership_filter(Transaction)
        )
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise NotFoundException("Transaction")
    return transaction


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: UUID,
    data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    base_currency: str = Depends(get_base_currency),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, ctx.ownership_filter(Transaction)
        )
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise NotFoundException("Transaction")

    update_data = data.model_dump(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"]:
        cat_result = await db.execute(
            select(Category).where(Category.id == update_data["category_id"], ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        if cat.is_archived:
            raise HTTPException(status_code=422, detail="Cannot assign an archived category")
        effective_type = update_data.get("type", transaction.type)
        if cat.type != effective_type:
            raise HTTPException(
                status_code=422,
                detail=f"Category type '{cat.type}' does not match transaction type '{effective_type}'"
            )

    if "credit_card_id" in update_data and update_data["credit_card_id"]:
        cc_result = await db.execute(
            select(CreditCard).where(CreditCard.id == update_data["credit_card_id"], ctx.ownership_filter(CreditCard))
        )
        if not cc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Credit card not found or does not belong to you")

    # Multi-currency: re-convert if amount or currency changed
    if "amount" in update_data or "currency" in update_data:
        new_amount = update_data.get("amount", transaction.original_amount or transaction.amount)
        new_currency = update_data.get("currency", transaction.original_currency or transaction.currency)
        conv = await prepare_currency_fields(new_amount, new_currency, base_currency)
        update_data["amount"] = conv["converted_amount"]
        update_data["currency"] = base_currency
        update_data["original_amount"] = conv["original_amount"]
        update_data["original_currency"] = conv["original_currency"]
        update_data["exchange_rate"] = conv["exchange_rate"]

    for field, value in update_data.items():
        setattr(transaction, field, value)

    await log_action(db, user_id=current_user.id, action="update", entity_type="transaction", entity_id=str(transaction_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(transaction)
    logger.info("User %s updated transaction %s", current_user.id, transaction.id)
    return transaction


@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, ctx.ownership_filter(Transaction)
        )
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise NotFoundException("Transaction")

    await db.delete(transaction)
    await log_action(db, user_id=current_user.id, action="delete", entity_type="transaction", entity_id=str(transaction_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    logger.info("User %s deleted transaction %s", current_user.id, transaction_id)
    return {"message": "Transaction deleted successfully"}


@router.post("/{transaction_id}/duplicate", response_model=TransactionResponse, status_code=201)
async def duplicate_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, ctx.ownership_filter(Transaction)
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise NotFoundException("Transaction")

    new_transaction = Transaction(
        **ctx.create_fields(),
        amount=original.amount,
        currency=original.currency,
        original_amount=original.original_amount,
        original_currency=original.original_currency,
        exchange_rate=original.exchange_rate,
        type=original.type,
        category_id=original.category_id,
        description=original.description,
        date=original.date,
        entry_pattern="one_time",
        notes=original.notes,
        tags=original.tags,
    )
    db.add(new_transaction)
    await log_action(db, user_id=current_user.id, action="duplicate", entity_type="transaction", entity_id=str(new_transaction.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(new_transaction)
    return new_transaction


@router.post("/bulk", response_model=List[TransactionResponse], status_code=201)
async def bulk_create_transactions(
    data: TransactionBulkCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    base_currency: str = Depends(get_base_currency),
    db: AsyncSession = Depends(get_db),
):
    # Validate category ownership for all category_ids
    category_ids = {item.category_id for item in data.transactions if item.category_id}
    if category_ids:
        result = await db.execute(
            select(Category.id).where(
                Category.id.in_(category_ids),
                ctx.ownership_filter(Category),
            )
        )
        valid_ids = set(result.scalars().all())
        invalid_ids = category_ids - valid_ids
        if invalid_ids:
            raise HTTPException(status_code=422, detail="One or more categories not found or do not belong to you")

    transactions = []
    for item in data.transactions:
        item_dict = item.model_dump()
        conv = await prepare_currency_fields(item.amount, item.currency, base_currency)
        item_dict["amount"] = conv["converted_amount"]
        item_dict["currency"] = base_currency
        item_dict["original_amount"] = conv["original_amount"]
        item_dict["original_currency"] = conv["original_currency"]
        item_dict["exchange_rate"] = conv["exchange_rate"]
        transaction = Transaction(
            **ctx.create_fields(),
            **item_dict,
        )
        db.add(transaction)
        transactions.append(transaction)

    await log_action(db, user_id=current_user.id, action="bulk_create", entity_type="transaction", details=f"created {len(data.transactions)} transactions", user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    for t in transactions:
        await db.refresh(t)
    return transactions


@router.post("/bulk-delete")
async def bulk_delete_transactions(
    data: TransactionBulkDelete,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    # Single DELETE query instead of N SELECT + DELETE queries
    result = await db.execute(
        delete(Transaction).where(
            Transaction.id.in_(data.ids),
            ctx.ownership_filter(Transaction),
        )
    )
    deleted_count = result.rowcount
    await log_action(db, user_id=current_user.id, action="bulk_delete", entity_type="transaction", details=f"deleted {deleted_count} transactions", user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    return {"message": f"Deleted {deleted_count} transactions"}
