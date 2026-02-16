from __future__ import annotations

from typing import Optional

from uuid import UUID

import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.category import (
    CategoryCreate,
    CategoryListResponse,
    CategoryReorder,
    CategoryResponse,
    CategoryUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models.category import Category
from app.db.models.user import User
from app.db.session import get_db

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=CategoryListResponse)
async def list_categories(
    type: Optional[str] = Query(None, pattern="^(income|expense)$"),
    include_archived: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Category).where(Category.user_id == current_user.id)

    if type:
        query = query.where(Category.type == type)

    if not include_archived:
        query = query.where(Category.is_archived == False)  # noqa: E712

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Category.display_order, Category.created_at)

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    return CategoryListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.core.exceptions import AlreadyExistsException
    existing = await db.execute(
        select(Category).where(
            Category.user_id == current_user.id,
            Category.name == data.name,
            Category.type == data.type,
            Category.is_archived == False,
        )
    )
    if existing.scalar_one_or_none():
        raise AlreadyExistsException("Category with this name and type")

    category = Category(
        user_id=current_user.id,
        **data.model_dump(),
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.user_id == current_user.id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundException("Category")
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.user_id == current_user.id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundException("Category")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}")
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.user_id == current_user.id
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundException("Category")

    # Soft delete - archive instead of delete
    category.is_archived = True
    await db.commit()
    return {"message": "Category archived successfully"}


@router.post("/reorder")
async def reorder_categories(
    data: CategoryReorder,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Single UPDATE with CASE expression instead of N separate UPDATE queries
    if data.ordered_ids:
        order_mapping = {cat_id: idx for idx, cat_id in enumerate(data.ordered_ids)}
        await db.execute(
            update(Category)
            .where(
                Category.id.in_(data.ordered_ids),
                Category.user_id == current_user.id,
            )
            .values(
                display_order=case(
                    *[(Category.id == cat_id, idx) for cat_id, idx in order_mapping.items()],
                    else_=Category.display_order,
                )
            )
        )

    await db.commit()
    return {"message": "Categories reordered successfully"}
