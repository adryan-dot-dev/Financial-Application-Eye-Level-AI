from __future__ import annotations

import math
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
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
from app.db.models.transaction import Transaction
from app.db.models.user import User
from app.db.session import get_db

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
    db: AsyncSession = Depends(get_db),
):
    query = select(Transaction).where(Transaction.user_id == current_user.id)

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
    db: AsyncSession = Depends(get_db),
):
    if data.category_id:
        cat = await db.get(Category, data.category_id)
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        if cat.is_archived:
            raise HTTPException(status_code=422, detail="Cannot assign an archived category")
        if cat.type != data.type:
            raise HTTPException(
                status_code=422,
                detail=f"Category type '{cat.type}' does not match transaction type '{data.type}'"
            )

    if data.category_id is None and hasattr(data, 'date') and data.date is not None:
        pass  # date validation is handled by Pydantic

    transaction = Transaction(
        user_id=current_user.id,
        **data.model_dump(),
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == current_user.id
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
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == current_user.id
        )
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise NotFoundException("Transaction")

    update_data = data.model_dump(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"]:
        cat = await db.get(Category, update_data["category_id"])
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        # RED-6: Reject archived categories on update
        if cat.is_archived:
            raise HTTPException(status_code=422, detail="Cannot assign an archived category")
        # Determine the effective transaction type (updated or existing)
        effective_type = update_data.get("type", transaction.type)
        if cat.type != effective_type:
            raise HTTPException(
                status_code=422,
                detail=f"Category type '{cat.type}' does not match transaction type '{effective_type}'"
            )

    for field, value in update_data.items():
        setattr(transaction, field, value)

    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == current_user.id
        )
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise NotFoundException("Transaction")

    await db.delete(transaction)
    await db.commit()
    return {"message": "Transaction deleted successfully"}


@router.post("/{transaction_id}/duplicate", response_model=TransactionResponse, status_code=201)
async def duplicate_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == current_user.id
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise NotFoundException("Transaction")

    new_transaction = Transaction(
        user_id=current_user.id,
        amount=original.amount,
        currency=original.currency,
        type=original.type,
        category_id=original.category_id,
        description=original.description,
        date=original.date,
        entry_pattern="one_time",
        notes=original.notes,
        tags=original.tags,
    )
    db.add(new_transaction)
    await db.commit()
    await db.refresh(new_transaction)
    return new_transaction


@router.post("/bulk", response_model=List[TransactionResponse], status_code=201)
async def bulk_create_transactions(
    data: TransactionBulkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate category ownership for all category_ids
    category_ids = {item.category_id for item in data.transactions if item.category_id}
    if category_ids:
        result = await db.execute(
            select(Category.id).where(
                Category.id.in_(category_ids),
                Category.user_id == current_user.id,
            )
        )
        valid_ids = set(result.scalars().all())
        invalid_ids = category_ids - valid_ids
        if invalid_ids:
            raise HTTPException(status_code=422, detail="One or more categories not found or do not belong to you")

    transactions = []
    for item in data.transactions:
        transaction = Transaction(
            user_id=current_user.id,
            **item.model_dump(),
        )
        db.add(transaction)
        transactions.append(transaction)

    await db.commit()
    for t in transactions:
        await db.refresh(t)
    return transactions


@router.post("/bulk-delete")
async def bulk_delete_transactions(
    data: TransactionBulkDelete,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Single DELETE query instead of N SELECT + DELETE queries
    result = await db.execute(
        delete(Transaction).where(
            Transaction.id.in_(data.ids),
            Transaction.user_id == current_user.id,
        )
    )
    await db.commit()
    deleted_count = result.rowcount
    return {"message": f"Deleted {deleted_count} transactions"}


@router.put("/bulk-update")
async def bulk_update_category(
    data: TransactionBulkUpdateCategory,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate category ownership
    if data.category_id:
        cat = await db.get(Category, data.category_id)
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")

    await db.execute(
        update(Transaction)
        .where(Transaction.id.in_(data.ids), Transaction.user_id == current_user.id)
        .values(category_id=data.category_id)
    )
    await db.commit()
    return {"message": f"Updated {len(data.ids)} transactions"}
