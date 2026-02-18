from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DataContext
from app.db.models.credit_card import CreditCard
from app.db.models.fixed_income_expense import FixedIncomeExpense
from app.db.models.installment import Installment
from app.db.models.subscription import Subscription

# Monthly equivalent factors for billing cycles
_CYCLE_MONTHLY_FACTOR = {
    "monthly": Decimal("1"),
    "quarterly": Decimal("1") / Decimal("3"),
    "semi_annual": Decimal("1") / Decimal("6"),
    "annual": Decimal("1") / Decimal("12"),
}


async def compute_card_utilization(
    db: AsyncSession, card: CreditCard, ctx: DataContext
) -> dict:
    """Compute utilization metrics for a single credit card."""
    card_id = card.id

    # Active installments linked to this card
    inst_result = await db.execute(
        select(
            func.coalesce(func.sum(Installment.monthly_amount), 0),
            func.count(Installment.id),
        ).where(
            Installment.credit_card_id == card_id,
            Installment.payments_completed < Installment.number_of_payments,
        )
    )
    inst_row = inst_result.one()
    inst_total = Decimal(str(inst_row[0]))
    inst_count = inst_row[1]

    # Active subscriptions linked to this card
    sub_result = await db.execute(
        select(Subscription.amount, Subscription.billing_cycle).where(
            Subscription.credit_card_id == card_id,
            Subscription.is_active == True,
        )
    )
    sub_rows = sub_result.all()
    sub_total = Decimal("0")
    for row in sub_rows:
        factor = _CYCLE_MONTHLY_FACTOR.get(row.billing_cycle, Decimal("1"))
        sub_total += Decimal(str(row.amount)) * factor
    sub_count = len(sub_rows)

    # Active fixed expenses linked to this card
    fixed_result = await db.execute(
        select(
            func.coalesce(func.sum(FixedIncomeExpense.amount), 0),
            func.count(FixedIncomeExpense.id),
        ).where(
            FixedIncomeExpense.credit_card_id == card_id,
            FixedIncomeExpense.is_active == True,
            FixedIncomeExpense.type == "expense",
        )
    )
    fixed_row = fixed_result.one()
    fixed_total = Decimal(str(fixed_row[0]))
    fixed_count = fixed_row[1]

    total = inst_total + sub_total + fixed_total
    limit = Decimal(str(card.credit_limit))
    pct = float((total / limit) * 100) if limit > 0 else 0.0
    available = limit - total

    return {
        "total_monthly_charges": total,
        "utilization_amount": total,
        "utilization_percentage": round(pct, 2),
        "available_credit": available,
        "linked_installments_count": inst_count,
        "linked_subscriptions_count": sub_count,
        "linked_fixed_count": fixed_count,
    }


async def get_card_charges(
    db: AsyncSession, card: CreditCard, ctx: DataContext
) -> list:
    """Get individual charge items linked to a credit card."""
    charges = []
    card_id = card.id

    # Installments
    result = await db.execute(
        select(Installment).where(
            Installment.credit_card_id == card_id,
            Installment.payments_completed < Installment.number_of_payments,
        )
    )
    for inst in result.scalars().all():
        charges.append({
            "source_type": "installment",
            "source_id": inst.id,
            "name": inst.name,
            "amount": inst.monthly_amount,
            "currency": inst.currency,
            "billing_cycle": None,
        })

    # Subscriptions
    result = await db.execute(
        select(Subscription).where(
            Subscription.credit_card_id == card_id,
            Subscription.is_active == True,
        )
    )
    for sub in result.scalars().all():
        factor = _CYCLE_MONTHLY_FACTOR.get(sub.billing_cycle, Decimal("1"))
        charges.append({
            "source_type": "subscription",
            "source_id": sub.id,
            "name": sub.name,
            "amount": sub.amount * factor,
            "currency": sub.currency,
            "billing_cycle": sub.billing_cycle,
        })

    # Fixed expenses
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.credit_card_id == card_id,
            FixedIncomeExpense.is_active == True,
            FixedIncomeExpense.type == "expense",
        )
    )
    for fixed in result.scalars().all():
        charges.append({
            "source_type": "fixed",
            "source_id": fixed.id,
            "name": fixed.name,
            "amount": fixed.amount,
            "currency": fixed.currency,
            "billing_cycle": None,
        })

    return charges


async def get_next_billing(
    db: AsyncSession, card: CreditCard, ctx: DataContext
) -> dict:
    """Compute next billing date and expected charges."""
    today = date.today()
    billing_day = card.billing_day

    if today.day < billing_day:
        next_billing = today.replace(day=billing_day)
    else:
        month = today.month + 1
        year = today.year
        if month > 12:
            month = 1
            year += 1
        next_billing = date(year, month, billing_day)

    charges = await get_card_charges(db, card, ctx)
    total = sum(Decimal(str(c["amount"])) for c in charges)
    limit = Decimal(str(card.credit_limit))
    remaining = limit - total

    return {
        "billing_date": next_billing,
        "charges": charges,
        "total_charge": total,
        "remaining_after_charge": remaining,
    }
