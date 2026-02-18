from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, DataContext
from app.api.v1.schemas.credit_card import (
    CardChargeItem,
    CardMonthlyBillingResponse,
    CreditCardCreate,
    CreditCardResponse,
    CreditCardSummaryResponse,
    CreditCardUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models import CreditCard, User
from app.db.session import get_db
from app.services.audit_service import log_action
from app.services.credit_card_service import (
    compute_card_utilization,
    get_card_charges,
    get_next_billing,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/credit-cards", tags=["Credit Cards"])


@router.post("", response_model=CreditCardResponse, status_code=201)
async def create_credit_card(
    data: CreditCardCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    card = CreditCard(
        **ctx.create_fields(),
        name=data.name,
        last_four_digits=data.last_four_digits,
        card_network=data.card_network,
        issuer=data.issuer,
        credit_limit=data.credit_limit,
        billing_day=data.billing_day,
        currency=data.currency,
        color=data.color or "#6366F1",
        notes=data.notes,
    )
    db.add(card)
    await log_action(db, user_id=current_user.id, action="create", entity_type="credit_card", entity_id=str(card.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(card)
    logger.info("User %s created credit card %s", current_user.id, card.id)

    util = await compute_card_utilization(db, card, ctx)
    response = CreditCardResponse.model_validate(card)
    for k, v in util.items():
        setattr(response, k, v)
    return response


@router.get("", response_model=list)
async def list_credit_cards(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard)
        .where(ctx.ownership_filter(CreditCard))
        .order_by(CreditCard.created_at.desc())
    )
    cards = result.scalars().all()

    response_cards = []
    for card in cards:
        util = await compute_card_utilization(db, card, ctx)
        resp = CreditCardResponse.model_validate(card)
        for k, v in util.items():
            setattr(resp, k, v)
        response_cards.append(resp)

    return response_cards


@router.get("/summary", response_model=CreditCardSummaryResponse)
async def get_credit_card_summary(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(
            ctx.ownership_filter(CreditCard),
            CreditCard.is_active == True,
        )
    )
    cards = result.scalars().all()

    response_cards = []
    total_limit = Decimal("0")
    total_util = Decimal("0")

    for card in cards:
        util = await compute_card_utilization(db, card, ctx)
        resp = CreditCardResponse.model_validate(card)
        for k, v in util.items():
            setattr(resp, k, v)
        response_cards.append(resp)
        total_limit += Decimal(str(card.credit_limit))
        total_util += util["utilization_amount"]

    total_available = total_limit - total_util
    avg_pct = float((total_util / total_limit) * 100) if total_limit > 0 else 0.0

    return CreditCardSummaryResponse(
        cards=response_cards,
        total_credit_limit=total_limit,
        total_utilization=total_util,
        total_available=total_available,
        average_utilization_pct=round(avg_pct, 2),
    )


@router.get("/{credit_card_id}", response_model=CreditCardResponse)
async def get_credit_card(
    credit_card_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == credit_card_id,
            ctx.ownership_filter(CreditCard),
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise NotFoundException("Credit card not found")

    util = await compute_card_utilization(db, card, ctx)
    response = CreditCardResponse.model_validate(card)
    for k, v in util.items():
        setattr(response, k, v)
    return response


@router.put("/{credit_card_id}", response_model=CreditCardResponse)
async def update_credit_card(
    credit_card_id: UUID,
    data: CreditCardUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == credit_card_id,
            ctx.ownership_filter(CreditCard),
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise NotFoundException("Credit card not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(card, key, value)

    await log_action(db, user_id=current_user.id, action="update", entity_type="credit_card", entity_id=str(card.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(card)
    logger.info("User %s updated credit card %s", current_user.id, card.id)

    util = await compute_card_utilization(db, card, ctx)
    response = CreditCardResponse.model_validate(card)
    for k, v in util.items():
        setattr(response, k, v)
    return response


@router.delete("/{credit_card_id}")
async def delete_credit_card(
    credit_card_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == credit_card_id,
            ctx.ownership_filter(CreditCard),
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise NotFoundException("Credit card not found")

    await log_action(db, user_id=current_user.id, action="delete", entity_type="credit_card", entity_id=str(card.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.delete(card)
    await db.commit()
    logger.info("User %s deleted credit card %s", current_user.id, credit_card_id)
    return {"detail": "Credit card deleted"}


@router.get("/{credit_card_id}/charges", response_model=list)
async def get_credit_card_charges(
    credit_card_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == credit_card_id,
            ctx.ownership_filter(CreditCard),
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise NotFoundException("Credit card not found")

    charges = await get_card_charges(db, card, ctx)
    return [CardChargeItem(**c) for c in charges]


@router.get("/{credit_card_id}/next-billing", response_model=CardMonthlyBillingResponse)
async def get_credit_card_next_billing(
    credit_card_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == credit_card_id,
            ctx.ownership_filter(CreditCard),
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise NotFoundException("Credit card not found")

    billing_data = await get_next_billing(db, card, ctx)

    util = await compute_card_utilization(db, card, ctx)
    card_resp = CreditCardResponse.model_validate(card)
    for k, v in util.items():
        setattr(card_resp, k, v)

    return CardMonthlyBillingResponse(
        card=card_resp,
        billing_date=billing_data["billing_date"],
        charges=[CardChargeItem(**c) for c in billing_data["charges"]],
        total_charge=billing_data["total_charge"],
        remaining_after_charge=billing_data["remaining_after_charge"],
    )
