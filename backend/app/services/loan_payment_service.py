from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.loan import Loan
from app.db.models.transaction import Transaction

logger = logging.getLogger(__name__)


async def _find_existing_loan_transaction(
    db: AsyncSession, loan: Loan, ref_date: date
) -> bool:
    """Check if a transaction already exists for this loan on this date (idempotency)."""
    result = await db.execute(
        select(Transaction.id).where(
            Transaction.user_id == loan.user_id,
            Transaction.loan_id == loan.id,
            Transaction.date == ref_date,
            Transaction.is_recurring == True,
        )
    )
    return result.scalar_one_or_none() is not None


async def process_daily_loan_payments(
    db: AsyncSession,
    reference_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Auto-execute loan payments for all users where today matches day_of_month.

    Iterates over all active loans where today is the payment day,
    increments payments_made, decreases remaining_balance, creates
    a Transaction record, and marks the loan as completed if done.

    Args:
        db: Database session.
        reference_date: The date to process. Defaults to today.

    Returns:
        Summary dict with counts of processed, skipped, and failed loans.
    """
    if reference_date is None:
        reference_date = date.today()

    day = reference_date.day

    # Query all active loans where today matches the payment day
    result = await db.execute(
        select(Loan).where(
            Loan.status != "completed",
            Loan.day_of_month == day,
        ).with_for_update()
    )
    loans = result.scalars().all()

    processed = 0
    skipped = 0
    failed = 0
    details: List[Dict[str, Any]] = []

    for loan in loans:
        try:
            # Skip if all payments already made
            if loan.payments_made >= loan.total_payments:
                skipped += 1
                continue

            # Idempotency: skip if transaction already exists for today
            if await _find_existing_loan_transaction(db, loan, reference_date):
                skipped += 1
                continue

            # Increment payments
            loan.payments_made += 1
            loan.remaining_balance = max(
                Decimal("0"), loan.remaining_balance - loan.monthly_payment
            )

            # Check completion
            if loan.payments_made >= loan.total_payments or loan.remaining_balance <= 0:
                loan.status = "completed"
                loan.remaining_balance = Decimal("0")

            # Create transaction record
            tx = Transaction(
                user_id=loan.user_id,
                organization_id=loan.organization_id,
                amount=loan.monthly_payment,
                currency=loan.currency,
                type="expense",
                category_id=loan.category_id,
                description=f"\u05ea\u05e9\u05dc\u05d5\u05dd \u05d4\u05dc\u05d5\u05d5\u05d0\u05d4 - {loan.name}",
                date=reference_date,
                entry_pattern="recurring",
                is_recurring=True,
                loan_id=loan.id,
                payment_method="bank_transfer" if loan.bank_account_id else "cash",
                bank_account_id=loan.bank_account_id,
            )
            db.add(tx)

            processed += 1
            details.append({
                "loan_id": str(loan.id),
                "loan_name": loan.name,
                "user_id": str(loan.user_id),
                "amount": float(loan.monthly_payment),
                "payments_made": loan.payments_made,
                "total_payments": loan.total_payments,
                "status": loan.status,
            })

            logger.info(
                "Auto-paid loan '%s' (id=%s, user=%s): payment %d/%d, amount=%.2f %s",
                loan.name, loan.id, loan.user_id,
                loan.payments_made, loan.total_payments,
                loan.monthly_payment, loan.currency,
            )

        except Exception:
            failed += 1
            logger.exception(
                "Failed to auto-pay loan '%s' (id=%s, user=%s)",
                loan.name, loan.id, loan.user_id,
            )

    await db.commit()

    summary: Dict[str, Any] = {
        "date": str(reference_date),
        "loans_found": len(loans),
        "loans_processed": processed,
        "loans_skipped": skipped,
        "loans_failed": failed,
        "details": details,
    }

    logger.info(
        "Daily loan payments complete: %d found, %d processed, %d skipped, %d failed",
        len(loans), processed, skipped, failed,
    )

    return summary
