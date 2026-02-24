from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.credit_card import CreditCard
from app.db.models.fixed_income_expense import FixedIncomeExpense
from app.db.models.installment import Installment
from app.db.models.subscription import Subscription
from app.db.models.transaction import Transaction

logger = logging.getLogger(__name__)

# Monthly equivalent factors for billing cycles (same as credit_card_service)
_CYCLE_MONTHLY_FACTOR = {
    "monthly": Decimal("1"),
    "quarterly": Decimal("1") / Decimal("3"),
    "semi_annual": Decimal("1") / Decimal("6"),
    "annual": Decimal("1") / Decimal("12"),
}


async def _sum_card_charges_for_month(
    db: AsyncSession,
    card: CreditCard,
    reference_date: date,
) -> Decimal:
    """Sum all charges for a credit card in the given month.

    Includes: transactions, installments, fixed expenses, and subscriptions
    linked to this card.
    """
    card_id = card.id
    total = Decimal("0")

    cycle_start = reference_date.replace(day=1)
    if reference_date.month == 12:
        cycle_end = date(reference_date.year + 1, 1, 1)
    else:
        cycle_end = date(reference_date.year, reference_date.month + 1, 1)

    # Transactions linked to this card in the billing month
    txn_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.credit_card_id == card_id,
            Transaction.date >= cycle_start,
            Transaction.date < cycle_end,
        )
    )
    total += Decimal(str(txn_result.scalar()))

    # Active installments linked to this card
    inst_result = await db.execute(
        select(func.coalesce(func.sum(Installment.monthly_amount), 0)).where(
            Installment.credit_card_id == card_id,
            Installment.payments_completed < Installment.number_of_payments,
        )
    )
    total += Decimal(str(inst_result.scalar()))

    # Active fixed expenses linked to this card
    fixed_result = await db.execute(
        select(func.coalesce(func.sum(FixedIncomeExpense.amount), 0)).where(
            FixedIncomeExpense.credit_card_id == card_id,
            FixedIncomeExpense.is_active == True,
            FixedIncomeExpense.type == "expense",
        )
    )
    total += Decimal(str(fixed_result.scalar()))

    # Active subscriptions linked to this card (monthly equivalent)
    sub_result = await db.execute(
        select(Subscription.amount, Subscription.billing_cycle).where(
            Subscription.credit_card_id == card_id,
            Subscription.is_active == True,
        )
    )
    for row in sub_result.all():
        factor = _CYCLE_MONTHLY_FACTOR.get(row.billing_cycle, Decimal("1"))
        total += Decimal(str(row.amount)) * factor

    return total


async def process_credit_card_billing(
    db: AsyncSession,
    reference_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Process credit card billing for all active cards where today == billing_day.

    For each qualifying card:
    1. Sum all charges for the month (transactions + installments + fixed + subscriptions)
    2. Create a single expense transaction on the linked bank_account
    3. Return summary of processed cards

    Args:
        db: Database session.
        reference_date: The date to check billing_day against. Defaults to today.

    Returns:
        Summary dict with processed cards count and details.
    """
    if reference_date is None:
        reference_date = date.today()

    billing_day = reference_date.day

    # Find all active credit cards where billing_day matches today
    result = await db.execute(
        select(CreditCard).where(
            CreditCard.is_active == True,
            CreditCard.billing_day == billing_day,
        )
    )
    cards = result.scalars().all()

    processed: List[Dict[str, Any]] = []
    skipped = 0

    for card in cards:
        try:
            total_charges = await _sum_card_charges_for_month(db, card, reference_date)

            if total_charges <= 0:
                skipped += 1
                continue

            if not card.bank_account_id:
                logger.warning(
                    "Credit card %s (%s) has no linked bank account, skipping billing",
                    card.name, card.id,
                )
                skipped += 1
                continue

            # Create a single expense transaction on the linked bank account
            last_four = card.last_four_digits or "****"
            billing_tx = Transaction(
                user_id=card.user_id,
                organization_id=card.organization_id,
                amount=total_charges,
                currency=card.currency,
                type="expense",
                description=f"Credit card billing - {card.name} ({last_four})",
                date=reference_date,
                entry_pattern="recurring",
                is_recurring=True,
                payment_method="bank_transfer",
                bank_account_id=card.bank_account_id,
                credit_card_id=card.id,
            )
            db.add(billing_tx)

            processed.append({
                "card_id": str(card.id),
                "card_name": card.name,
                "last_four": last_four,
                "total_charges": float(total_charges),
                "bank_account_id": str(card.bank_account_id),
            })

            logger.info(
                "Processed billing for card %s (%s): %.2f %s",
                card.name, card.id, total_charges, card.currency,
            )

        except Exception:
            logger.exception(
                "Failed to process billing for card %s (%s)",
                card.name, card.id,
            )

    await db.commit()

    summary: Dict[str, Any] = {
        "date": str(reference_date),
        "billing_day": billing_day,
        "cards_found": len(cards),
        "cards_processed": len(processed),
        "cards_skipped": skipped,
        "processed": processed,
    }

    logger.info(
        "Credit card billing complete: %d cards found, %d processed, %d skipped",
        len(cards), len(processed), skipped,
    )

    return summary
