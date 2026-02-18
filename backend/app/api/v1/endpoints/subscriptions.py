from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, get_base_currency, DataContext
from app.api.v1.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models import Category, User
from app.db.models.credit_card import CreditCard
from app.db.models.subscription import Subscription
from app.db.session import get_db
from app.services.audit_service import log_action
from app.services.exchange_rate_service import prepare_currency_fields

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("/upcoming", response_model=List[SubscriptionResponse])
async def list_upcoming_renewals(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """List active subscriptions with next_renewal_date within the given number of days."""
    today = date.today()
    cutoff = today + timedelta(days=days)
    query = (
        select(Subscription)
        .where(
            ctx.ownership_filter(Subscription),
            Subscription.is_active == True,
            Subscription.next_renewal_date >= today,
            Subscription.next_renewal_date <= cutoff,
        )
        .order_by(Subscription.next_renewal_date.asc())
        .limit(100)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("", response_model=List[SubscriptionResponse])
async def list_subscriptions(
    status: Optional[str] = Query(None, pattern="^(active|paused)$"),
    billing_cycle: Optional[str] = Query(
        None, pattern="^(monthly|quarterly|semi_annual|annual)$"
    ),
    sort_by: Optional[str] = Query(
        None, pattern="^(name|amount|next_renewal_date|created_at)$"
    ),
    sort_order: Optional[str] = Query(None, pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """List subscriptions with optional filters and sorting."""
    query = select(Subscription).where(
        ctx.ownership_filter(Subscription)
    )

    # Filter by status
    if status == "active":
        query = query.where(Subscription.is_active == True)
    elif status == "paused":
        query = query.where(Subscription.is_active == False)

    # Filter by billing_cycle
    if billing_cycle:
        query = query.where(Subscription.billing_cycle == billing_cycle)

    # Sorting
    sort_column = Subscription.created_at  # default
    if sort_by == "name":
        sort_column = Subscription.name
    elif sort_by == "amount":
        sort_column = Subscription.amount
    elif sort_by == "next_renewal_date":
        sort_column = Subscription.next_renewal_date
    elif sort_by == "created_at":
        sort_column = Subscription.created_at

    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(
    data: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    base_currency: str = Depends(get_base_currency),
    db: AsyncSession = Depends(get_db),
):
    """Create a new subscription."""
    if data.category_id:
        cat_result = await db.execute(
            select(Category).where(Category.id == data.category_id, ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(
                status_code=422,
                detail="Category not found or does not belong to you",
            )

    if data.credit_card_id:
        cc_result = await db.execute(
            select(CreditCard).where(CreditCard.id == data.credit_card_id, ctx.ownership_filter(CreditCard))
        )
        if not cc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Credit card not found or does not belong to you")

    data_dict = data.model_dump()
    conv = await prepare_currency_fields(data.amount, data.currency, base_currency)
    data_dict["amount"] = conv["converted_amount"]
    data_dict["currency"] = base_currency
    data_dict["original_amount"] = conv["original_amount"]
    data_dict["original_currency"] = conv["original_currency"]
    data_dict["exchange_rate"] = conv["exchange_rate"]

    subscription = Subscription(
        **ctx.create_fields(),
        **data_dict,
        is_active=True,
    )
    db.add(subscription)
    await log_action(db, user_id=current_user.id, action="create", entity_type="subscription", entity_id=str(subscription.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(subscription)
    logger.info("User %s created subscription %s", current_user.id, subscription.id)
    return subscription


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Get a single subscription by ID."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            ctx.ownership_filter(Subscription),
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise NotFoundException("Subscription not found")
    return subscription


@router.put("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: UUID,
    data: SubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    base_currency: str = Depends(get_base_currency),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing subscription."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            ctx.ownership_filter(Subscription),
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise NotFoundException("Subscription not found")

    update_data = data.model_dump(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"]:
        cat_result = await db.execute(
            select(Category).where(Category.id == update_data["category_id"], ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(
                status_code=422,
                detail="Category not found or does not belong to you",
            )

    if update_data.get("credit_card_id"):
        cc_result = await db.execute(
            select(CreditCard).where(CreditCard.id == update_data["credit_card_id"], ctx.ownership_filter(CreditCard))
        )
        if not cc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Credit card not found or does not belong to you")

    # Multi-currency: re-convert if amount or currency changed
    if "amount" in update_data or "currency" in update_data:
        new_amount = update_data.get("amount", subscription.original_amount or subscription.amount)
        new_currency = update_data.get("currency", subscription.original_currency or subscription.currency)
        conv = await prepare_currency_fields(new_amount, new_currency, base_currency)
        update_data["amount"] = conv["converted_amount"]
        update_data["currency"] = base_currency
        update_data["original_amount"] = conv["original_amount"]
        update_data["original_currency"] = conv["original_currency"]
        update_data["exchange_rate"] = conv["exchange_rate"]

    for key, value in update_data.items():
        setattr(subscription, key, value)

    await log_action(db, user_id=current_user.id, action="update", entity_type="subscription", entity_id=str(subscription_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(subscription)
    logger.info("User %s updated subscription %s", current_user.id, subscription.id)
    return subscription


@router.delete("/{subscription_id}")
async def delete_subscription(
    subscription_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Delete a subscription."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            ctx.ownership_filter(Subscription),
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise NotFoundException("Subscription not found")
    await db.delete(subscription)
    await log_action(db, user_id=current_user.id, action="delete", entity_type="subscription", entity_id=str(subscription_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    logger.info("User %s deleted subscription %s", current_user.id, subscription_id)
    return {"message": "Deleted successfully"}


@router.post("/{subscription_id}/pause", response_model=SubscriptionResponse)
async def pause_subscription(
    subscription_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Pause a subscription (set paused_at, is_active=False)."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            ctx.ownership_filter(Subscription),
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise NotFoundException("Subscription not found")
    subscription.is_active = False
    subscription.paused_at = datetime.now(timezone.utc)
    await log_action(db, user_id=current_user.id, action="pause", entity_type="subscription", entity_id=str(subscription_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(subscription)
    logger.info("User %s paused subscription %s", current_user.id, subscription.id)
    return subscription


@router.post("/{subscription_id}/resume", response_model=SubscriptionResponse)
async def resume_subscription(
    subscription_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Resume a paused subscription (set resumed_at, is_active=True, clear paused_at)."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            ctx.ownership_filter(Subscription),
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise NotFoundException("Subscription not found")
    subscription.is_active = True
    subscription.resumed_at = datetime.now(timezone.utc)
    subscription.paused_at = None
    await log_action(db, user_id=current_user.id, action="resume", entity_type="subscription", entity_id=str(subscription_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(subscription)
    logger.info("User %s resumed subscription %s", current_user.id, subscription.id)
    return subscription
