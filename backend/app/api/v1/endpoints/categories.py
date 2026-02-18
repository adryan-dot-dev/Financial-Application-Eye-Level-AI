from __future__ import annotations

import logging
from typing import Optional

from uuid import UUID

import math

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.api.deps import get_current_user, get_data_context, DataContext
from app.api.v1.schemas.category import (
    CategoryCreate,
    CategoryListResponse,
    CategoryReorder,
    CategoryResponse,
    CategoryUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models.category import Category
from app.db.models.transaction import Transaction
from app.db.models.user import User
from app.core.cache import set_cache_headers
from app.db.session import get_db
from app.services.audit_service import log_action

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=CategoryListResponse)
async def list_categories(
    response: Response,
    type: Optional[str] = Query(None, pattern="^(income|expense)$"),
    include_archived: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    set_cache_headers(response, max_age=300)
    query = select(Category).where(ctx.ownership_filter(Category))

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
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    from app.core.exceptions import AlreadyExistsException
    existing = await db.execute(
        select(Category).where(
            ctx.ownership_filter(Category),
            Category.name == data.name,
            Category.type == data.type,
            Category.is_archived == False,
        )
    )
    if existing.scalar_one_or_none():
        raise AlreadyExistsException("Category with this name and type")

    category = Category(
        **ctx.create_fields(),
        **data.model_dump(),
    )
    db.add(category)
    await log_action(db, user_id=current_user.id, action="create", entity_type="category", entity_id=str(category.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(category)
    logger.info("User %s created category %s", current_user.id, category.id)
    return category


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, ctx.ownership_filter(Category)
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
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, ctx.ownership_filter(Category)
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundException("Category")

    update_data = data.model_dump(exclude_unset=True)

    # RED-7: Check for circular parent-child references
    if "parent_id" in update_data and update_data["parent_id"] is not None:
        new_parent_id = update_data["parent_id"]
        visited: set = set()
        current = new_parent_id
        while current is not None:
            if current == category_id:
                raise HTTPException(
                    status_code=400, detail="Circular reference detected"
                )
            if current in visited:
                break
            visited.add(current)
            parent = await db.get(Category, current)
            current = parent.parent_id if parent else None

    # ORANGE-5: Prevent type change when category has existing transactions
    if "type" in update_data and update_data["type"] != category.type:
        tx_count = await db.scalar(
            select(func.count()).where(
                Transaction.category_id == category_id
            )
        )
        if tx_count and tx_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot change type: category has existing transactions",
            )

    for field, value in update_data.items():
        setattr(category, field, value)

    await log_action(db, user_id=current_user.id, action="update", entity_type="category", entity_id=str(category_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}")
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, ctx.ownership_filter(Category)
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundException("Category")

    # Soft delete - archive instead of delete
    category.is_archived = True
    await log_action(db, user_id=current_user.id, action="archive", entity_type="category", entity_id=str(category_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    return {"message": "Category archived successfully"}


@router.post("/reorder")
async def reorder_categories(
    data: CategoryReorder,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    # Single UPDATE with CASE expression instead of N separate UPDATE queries
    if data.ordered_ids:
        order_mapping = {cat_id: idx for idx, cat_id in enumerate(data.ordered_ids)}
        await db.execute(
            update(Category)
            .where(
                Category.id.in_(data.ordered_ids),
                ctx.ownership_filter(Category),
            )
            .values(
                display_order=case(
                    *[(Category.id == cat_id, idx) for cat_id, idx in order_mapping.items()],
                    else_=Category.display_order,
                )
            )
        )

    await log_action(db, user_id=current_user.id, action="reorder", entity_type="category", user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    return {"message": "Categories reordered successfully"}
