from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FixedIncomeExpense, Installment, Loan, Transaction


async def _find_existing_loan_transaction(
    db: AsyncSession, user_id: UUID, loan_id: UUID, ref_date: date
) -> bool:
    """Check if a transaction already exists for this loan on this date."""
    result = await db.execute(
        select(Transaction.id).where(
            Transaction.user_id == user_id,
            Transaction.loan_id == loan_id,
            Transaction.date == ref_date,
            Transaction.is_recurring == True,
        )
    )
    return result.scalar_one_or_none() is not None


async def _find_existing_fixed_transaction(
    db: AsyncSession, user_id: UUID, source_id: UUID, ref_date: date
) -> bool:
    """Check if a transaction already exists for this fixed source on this date."""
    result = await db.execute(
        select(Transaction.id).where(
            Transaction.user_id == user_id,
            Transaction.recurring_source_id == source_id,
            Transaction.date == ref_date,
            Transaction.is_recurring == True,
        )
    )
    return result.scalar_one_or_none() is not None


async def _find_existing_installment_transaction(
    db: AsyncSession, user_id: UUID, installment_id: UUID, ref_date: date
) -> bool:
    """Check if a transaction already exists for this installment on this date."""
    result = await db.execute(
        select(Transaction.id).where(
            Transaction.user_id == user_id,
            Transaction.installment_id == installment_id,
            Transaction.date == ref_date,
            Transaction.is_recurring == True,
        )
    )
    return result.scalar_one_or_none() is not None


async def _process_loans(
    db: AsyncSession,
    user_id: UUID,
    reference_date: date,
    preview: bool = False,
) -> Dict[str, Any]:
    """Process loan auto-charges for the given date."""
    result = await db.execute(
        select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == "active",
            Loan.day_of_month == reference_date.day,
        ).with_for_update()
    )
    loans = result.scalars().all()

    charged = 0
    skipped = 0
    transactions: List[Dict[str, Any]] = []

    for loan in loans:
        # Skip if all payments already made
        if loan.payments_made >= loan.total_payments:
            skipped += 1
            continue

        # Idempotency check
        if await _find_existing_loan_transaction(db, user_id, loan.id, reference_date):
            skipped += 1
            continue

        tx_data = {
            "user_id": user_id,
            "amount": loan.monthly_payment,
            "currency": loan.currency,
            "type": "expense",
            "category_id": loan.category_id,
            "description": f"Loan payment: {loan.name}",
            "date": reference_date,
            "entry_pattern": "recurring",
            "is_recurring": True,
            "loan_id": loan.id,
        }

        transactions.append(tx_data)

        if not preview:
            transaction = Transaction(**tx_data)
            db.add(transaction)

            loan.payments_made += 1
            loan.remaining_balance = max(
                Decimal("0"), loan.remaining_balance - loan.monthly_payment
            )
            if loan.payments_made >= loan.total_payments:
                loan.status = "completed"
                loan.remaining_balance = Decimal("0")

        charged += 1

    return {"charged": charged, "skipped": skipped, "transactions": transactions}


async def _process_fixed(
    db: AsyncSession,
    user_id: UUID,
    reference_date: date,
    preview: bool = False,
) -> Dict[str, Any]:
    """Process fixed income/expense auto-charges for the given date."""
    result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.user_id == user_id,
            FixedIncomeExpense.is_active == True,
            FixedIncomeExpense.day_of_month == reference_date.day,
            FixedIncomeExpense.start_date <= reference_date,
        )
    )
    fixed_items = result.scalars().all()

    charged = 0
    skipped = 0
    transactions: List[Dict[str, Any]] = []

    for fixed in fixed_items:
        # Check end_date
        if fixed.end_date is not None and fixed.end_date < reference_date:
            skipped += 1
            continue

        # Idempotency check
        if await _find_existing_fixed_transaction(db, user_id, fixed.id, reference_date):
            skipped += 1
            continue

        tx_data = {
            "user_id": user_id,
            "amount": fixed.amount,
            "currency": fixed.currency,
            "type": fixed.type,
            "category_id": fixed.category_id,
            "description": f"Fixed {fixed.type}: {fixed.name}",
            "date": reference_date,
            "entry_pattern": "recurring",
            "is_recurring": True,
            "recurring_source_id": fixed.id,
        }

        transactions.append(tx_data)

        if not preview:
            transaction = Transaction(**tx_data)
            db.add(transaction)

        charged += 1

    return {"charged": charged, "skipped": skipped, "transactions": transactions}


async def _process_installments(
    db: AsyncSession,
    user_id: UUID,
    reference_date: date,
    preview: bool = False,
) -> Dict[str, Any]:
    """Process installment auto-charges for the given date."""
    result = await db.execute(
        select(Installment).where(
            Installment.user_id == user_id,
            Installment.day_of_month == reference_date.day,
        ).with_for_update()
    )
    installments = result.scalars().all()

    charged = 0
    skipped = 0
    transactions: List[Dict[str, Any]] = []

    for inst in installments:
        # Skip if all payments completed
        if inst.payments_completed >= inst.number_of_payments:
            skipped += 1
            continue

        # Idempotency check
        if await _find_existing_installment_transaction(db, user_id, inst.id, reference_date):
            skipped += 1
            continue

        payment_number = inst.payments_completed + 1
        tx_data = {
            "user_id": user_id,
            "amount": inst.monthly_amount,
            "currency": inst.currency,
            "type": inst.type,
            "category_id": inst.category_id,
            "description": f"Installment: {inst.name} ({payment_number}/{inst.number_of_payments})",
            "date": reference_date,
            "entry_pattern": "installment",
            "is_recurring": True,
            "installment_id": inst.id,
            "installment_number": payment_number,
        }

        transactions.append(tx_data)

        if not preview:
            transaction = Transaction(**tx_data)
            db.add(transaction)

            inst.payments_completed += 1

        charged += 1

    return {"charged": charged, "skipped": skipped, "transactions": transactions}


async def process_recurring_charges(
    db: AsyncSession,
    user_id: UUID,
    reference_date: Optional[date] = None,
    preview: bool = False,
) -> Dict[str, Any]:
    """Process all recurring charges (loans, fixed, installments) for the given date.

    Args:
        db: Database session
        user_id: The user to process charges for
        reference_date: The date to process (defaults to today)
        preview: If True, don't commit changes - just return what would be created

    Returns:
        Summary dict with counts of charged and skipped items
    """
    if reference_date is None:
        reference_date = date.today()

    loan_result = await _process_loans(db, user_id, reference_date, preview=preview)
    fixed_result = await _process_fixed(db, user_id, reference_date, preview=preview)
    installment_result = await _process_installments(db, user_id, reference_date, preview=preview)

    if not preview:
        await db.commit()

    total_skipped = (
        loan_result["skipped"]
        + fixed_result["skipped"]
        + installment_result["skipped"]
    )

    summary: Dict[str, Any] = {
        "loans_charged": loan_result["charged"],
        "fixed_charged": fixed_result["charged"],
        "installments_charged": installment_result["charged"],
        "skipped": total_skipped,
    }

    if preview:
        all_transactions: List[Dict[str, Any]] = []
        for tx in loan_result["transactions"]:
            all_transactions.append({
                "source": "loan",
                "amount": str(tx["amount"]),
                "currency": tx["currency"],
                "type": tx["type"],
                "description": tx["description"],
                "date": str(tx["date"]),
                "category_id": str(tx["category_id"]) if tx["category_id"] else None,
            })
        for tx in fixed_result["transactions"]:
            all_transactions.append({
                "source": "fixed",
                "amount": str(tx["amount"]),
                "currency": tx["currency"],
                "type": tx["type"],
                "description": tx["description"],
                "date": str(tx["date"]),
                "category_id": str(tx["category_id"]) if tx["category_id"] else None,
            })
        for tx in installment_result["transactions"]:
            all_transactions.append({
                "source": "installment",
                "amount": str(tx["amount"]),
                "currency": tx["currency"],
                "type": tx["type"],
                "description": tx["description"],
                "date": str(tx["date"]),
                "category_id": str(tx["category_id"]) if tx["category_id"] else None,
            })
        summary["preview_transactions"] = all_transactions

    return summary
