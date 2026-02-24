from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.installment import Installment
from app.db.models.transaction import Transaction

logger = logging.getLogger(__name__)


async def _find_existing_installment_transaction(
    db: AsyncSession, inst: Installment, ref_date: date
) -> bool:
    """Check if a transaction already exists for this installment on this date (idempotency)."""
    result = await db.execute(
        select(Transaction.id).where(
            Transaction.user_id == inst.user_id,
            Transaction.installment_id == inst.id,
            Transaction.date == ref_date,
            Transaction.is_recurring == True,
        )
    )
    return result.scalar_one_or_none() is not None


async def process_daily_installment_payments(
    db: AsyncSession,
    reference_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Auto-execute installment payments for all users where today matches day_of_month.

    Iterates over all incomplete installments where today is the payment day,
    increments payments_completed, creates a Transaction record.

    Args:
        db: Database session.
        reference_date: The date to process. Defaults to today.

    Returns:
        Summary dict with counts of processed, skipped, and failed installments.
    """
    if reference_date is None:
        reference_date = date.today()

    day = reference_date.day

    # Query all incomplete installments where today matches the payment day
    result = await db.execute(
        select(Installment).where(
            Installment.payments_completed < Installment.number_of_payments,
            Installment.day_of_month == day,
        ).with_for_update()
    )
    installments = result.scalars().all()

    processed = 0
    skipped = 0
    failed = 0
    details: List[Dict[str, Any]] = []

    for inst in installments:
        try:
            # Idempotency: skip if transaction already exists for today
            if await _find_existing_installment_transaction(db, inst, reference_date):
                skipped += 1
                continue

            # Increment payments
            inst.payments_completed += 1
            payment_number = inst.payments_completed

            # Rounding correction: last payment absorbs the difference
            if payment_number == inst.number_of_payments:
                actual_amount = inst.total_amount - (
                    inst.monthly_amount * (inst.number_of_payments - 1)
                )
            else:
                actual_amount = inst.monthly_amount

            # Create transaction record
            tx = Transaction(
                user_id=inst.user_id,
                organization_id=inst.organization_id,
                amount=actual_amount,
                currency=inst.currency,
                type=inst.type,
                category_id=inst.category_id,
                description=f"\u05ea\u05e9\u05dc\u05d5\u05dd - {inst.name} ({payment_number}/{inst.number_of_payments})",
                date=reference_date,
                entry_pattern="installment",
                is_recurring=True,
                installment_id=inst.id,
                installment_number=payment_number,
                payment_method=inst.payment_method or "cash",
                credit_card_id=inst.credit_card_id,
                bank_account_id=inst.bank_account_id,
            )
            db.add(tx)

            processed += 1
            is_completed = inst.payments_completed >= inst.number_of_payments
            details.append({
                "installment_id": str(inst.id),
                "installment_name": inst.name,
                "user_id": str(inst.user_id),
                "amount": float(actual_amount),
                "payment_number": payment_number,
                "total_payments": inst.number_of_payments,
                "completed": is_completed,
            })

            logger.info(
                "Auto-paid installment '%s' (id=%s, user=%s): payment %d/%d, amount=%.2f %s%s",
                inst.name, inst.id, inst.user_id,
                payment_number, inst.number_of_payments,
                actual_amount, inst.currency,
                " [COMPLETED]" if is_completed else "",
            )

        except Exception:
            failed += 1
            logger.exception(
                "Failed to auto-pay installment '%s' (id=%s, user=%s)",
                inst.name, inst.id, inst.user_id,
            )

    await db.commit()

    summary: Dict[str, Any] = {
        "date": str(reference_date),
        "installments_found": len(installments),
        "installments_processed": processed,
        "installments_skipped": skipped,
        "installments_failed": failed,
        "details": details,
    }

    logger.info(
        "Daily installment payments complete: %d found, %d processed, %d skipped, %d failed",
        len(installments), processed, skipped, failed,
    )

    return summary
