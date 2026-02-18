from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal
from typing import List, Optional, Set, Tuple, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DataContext
from app.db.models import (
    FixedIncomeExpense,
    Installment,
    Loan,
    Transaction,
)
from app.services.exchange_rate_service import convert_amount

ZERO = Decimal("0")


def _ensure_ctx(user_id: Optional[UUID] = None, ctx: Optional[DataContext] = None) -> DataContext:
    """Backward-compat helper: build a DataContext from user_id if ctx is not given."""
    if ctx is not None:
        return ctx
    if user_id is not None:
        return DataContext(user_id=user_id, organization_id=None, is_org_context=False)
    raise ValueError("Either user_id or ctx must be provided")


def _months_in_range(start: date, end: date) -> List[Tuple[int, int]]:
    """Return list of (year, month) tuples covering the date range."""
    months: List[Tuple[int, int]] = []
    current = start.replace(day=1)
    while current <= end:
        months.append((current.year, current.month))
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    return months


async def _get_materialized_ids(
    db: AsyncSession,
    user_id: UUID,
    start: date,
    end: date,
    ctx: Optional[DataContext] = None,
) -> Tuple[Set, Set, Set]:
    """Find which recurring sources already have materialized transactions.

    Returns (fixed_set, installment_set, loan_set) where each set contains
    (source_id, year, month) tuples.
    """
    resolved = _ensure_ctx(user_id, ctx)
    mat_result = await db.execute(
        select(
            Transaction.recurring_source_id,
            Transaction.installment_id,
            Transaction.loan_id,
            Transaction.date,
        )
        .where(
            resolved.ownership_filter(Transaction),
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )

    mat_fixed: Set[Tuple] = set()
    mat_installment: Set[Tuple] = set()
    mat_loan: Set[Tuple] = set()

    for rec_src_id, inst_id, loan_id, tx_date in mat_result.all():
        if rec_src_id:
            mat_fixed.add((rec_src_id, tx_date.year, tx_date.month))
        if inst_id:
            mat_installment.add((inst_id, tx_date.year, tx_date.month))
        if loan_id:
            mat_loan.add((loan_id, tx_date.year, tx_date.month))

    return mat_fixed, mat_installment, mat_loan


def _project_fixed_entries(
    fixed_items: list,
    start: date,
    end: date,
    materialized: Set[Tuple],
) -> List[Tuple[str, date, Decimal]]:
    """Project active fixed entries into virtual transactions for the date range.

    Returns (type, date, amount) tuples (legacy format, no currency).
    """
    result: List[Tuple[str, date, Decimal]] = []
    months = _months_in_range(start, end)

    for entry in fixed_items:
        for year, month in months:
            if (entry.id, year, month) in materialized:
                continue
            month_start_d = date(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            month_end_d = date(year, month, last_day)
            if entry.start_date > month_end_d:
                continue
            if entry.end_date and entry.end_date < month_start_d:
                continue
            actual_day = min(entry.day_of_month, last_day)
            entry_date = date(year, month, actual_day)
            if entry_date < start or entry_date > end:
                continue
            result.append((entry.type, entry_date, entry.amount))
    return result


def _project_fixed_entries_with_currency(
    fixed_items: list,
    start: date,
    end: date,
    materialized: Set[Tuple],
) -> List[Tuple[str, date, Decimal, str]]:
    """Project active fixed entries with currency info.

    Returns (type, date, amount, currency) tuples.
    """
    result: List[Tuple[str, date, Decimal, str]] = []
    months = _months_in_range(start, end)

    for entry in fixed_items:
        entry_currency = getattr(entry, "currency", "ILS") or "ILS"
        for year, month in months:
            if (entry.id, year, month) in materialized:
                continue
            month_start_d = date(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            month_end_d = date(year, month, last_day)
            if entry.start_date > month_end_d:
                continue
            if entry.end_date and entry.end_date < month_start_d:
                continue
            actual_day = min(entry.day_of_month, last_day)
            entry_date = date(year, month, actual_day)
            if entry_date < start or entry_date > end:
                continue
            result.append((entry.type, entry_date, entry.amount, entry_currency))
    return result


def _project_installments(
    installments: list,
    start: date,
    end: date,
    materialized: Set[Tuple],
) -> List[Tuple[str, date, Decimal]]:
    """Project installment payments into virtual transactions for the date range."""
    result: List[Tuple[str, date, Decimal]] = []
    months = _months_in_range(start, end)

    for inst in installments:
        for year, month in months:
            if (inst.id, year, month) in materialized:
                continue
            months_since = (year - inst.start_date.year) * 12 + (month - inst.start_date.month)
            if months_since < 0:
                continue
            payment_num = months_since + 1
            if payment_num > inst.number_of_payments:
                continue
            if payment_num <= inst.payments_completed:
                continue
            last_day = calendar.monthrange(year, month)[1]
            actual_day = min(inst.day_of_month, last_day)
            entry_date = date(year, month, actual_day)
            if entry_date < start or entry_date > end:
                continue
            result.append((inst.type, entry_date, inst.monthly_amount))
    return result


def _project_installments_with_currency(
    installments: list,
    start: date,
    end: date,
    materialized: Set[Tuple],
) -> List[Tuple[str, date, Decimal, str]]:
    """Project installment payments with currency info."""
    result: List[Tuple[str, date, Decimal, str]] = []
    months = _months_in_range(start, end)

    for inst in installments:
        inst_currency = getattr(inst, "currency", "ILS") or "ILS"
        for year, month in months:
            if (inst.id, year, month) in materialized:
                continue
            months_since = (year - inst.start_date.year) * 12 + (month - inst.start_date.month)
            if months_since < 0:
                continue
            payment_num = months_since + 1
            if payment_num > inst.number_of_payments:
                continue
            if payment_num <= inst.payments_completed:
                continue
            last_day = calendar.monthrange(year, month)[1]
            actual_day = min(inst.day_of_month, last_day)
            entry_date = date(year, month, actual_day)
            if entry_date < start or entry_date > end:
                continue
            result.append((inst.type, entry_date, inst.monthly_amount, inst_currency))
    return result


def _project_loans(
    loans: list,
    start: date,
    end: date,
    materialized: Set[Tuple],
) -> List[Tuple[str, date, Decimal]]:
    """Project loan payments into virtual transactions for the date range."""
    result: List[Tuple[str, date, Decimal]] = []
    months = _months_in_range(start, end)

    for loan in loans:
        for year, month in months:
            if (loan.id, year, month) in materialized:
                continue
            months_since = (year - loan.start_date.year) * 12 + (month - loan.start_date.month)
            if months_since < 0:
                continue
            payment_num = months_since + 1
            if payment_num > loan.total_payments:
                continue
            if payment_num <= loan.payments_made:
                continue
            last_day = calendar.monthrange(year, month)[1]
            actual_day = min(loan.day_of_month, last_day)
            entry_date = date(year, month, actual_day)
            if entry_date < start or entry_date > end:
                continue
            result.append(("expense", entry_date, loan.monthly_payment))
    return result


def _project_loans_with_currency(
    loans: list,
    start: date,
    end: date,
    materialized: Set[Tuple],
) -> List[Tuple[str, date, Decimal, str]]:
    """Project loan payments with currency info."""
    result: List[Tuple[str, date, Decimal, str]] = []
    months = _months_in_range(start, end)

    for loan in loans:
        loan_currency = getattr(loan, "currency", "ILS") or "ILS"
        for year, month in months:
            if (loan.id, year, month) in materialized:
                continue
            months_since = (year - loan.start_date.year) * 12 + (month - loan.start_date.month)
            if months_since < 0:
                continue
            payment_num = months_since + 1
            if payment_num > loan.total_payments:
                continue
            if payment_num <= loan.payments_made:
                continue
            last_day = calendar.monthrange(year, month)[1]
            actual_day = min(loan.day_of_month, last_day)
            entry_date = date(year, month, actual_day)
            if entry_date < start or entry_date > end:
                continue
            result.append(("expense", entry_date, loan.monthly_payment, loan_currency))
    return result


async def _fetch_recurring_data(
    db: AsyncSession,
    user_id: UUID,
    ctx: Optional[DataContext] = None,
) -> Tuple[list, list, list]:
    """Fetch all active recurring financial items."""
    resolved = _ensure_ctx(user_id, ctx)

    fixed_result = await db.execute(
        select(FixedIncomeExpense).where(
            resolved.ownership_filter(FixedIncomeExpense),
            FixedIncomeExpense.is_active == True,
        )
    )
    fixed_items = fixed_result.scalars().all()

    inst_result = await db.execute(
        select(Installment).where(resolved.ownership_filter(Installment))
    )
    installments = inst_result.scalars().all()

    loan_result = await db.execute(
        select(Loan).where(resolved.ownership_filter(Loan), Loan.status == "active")
    )
    loans = loan_result.scalars().all()

    return fixed_items, installments, loans


async def get_aggregated_totals(
    db: AsyncSession,
    user_id: UUID,
    start: date,
    end: date,
    base_currency: Optional[str] = None,
    ctx: Optional[DataContext] = None,
) -> Tuple[Decimal, Decimal]:
    """Get total (income, expenses) including actual transactions + projected recurring.

    Deduplicates items already materialized as transactions by the scheduler.

    If *base_currency* is provided, all amounts are converted to that currency
    before summing. Otherwise amounts are summed as-is (legacy behaviour).
    """
    from sqlalchemy import func

    resolved = _ensure_ctx(user_id, ctx)
    income = ZERO
    expenses = ZERO

    if base_currency:
        # ------ currency-aware path: fetch individual rows ------
        tx_result = await db.execute(
            select(
                Transaction.type,
                Transaction.amount,
                Transaction.currency,
            )
            .where(
                resolved.ownership_filter(Transaction),
                Transaction.date >= start,
                Transaction.date <= end,
            )
        )
        for tx_type, tx_amount, tx_currency in tx_result.all():
            converted = await convert_amount(tx_amount, tx_currency or "ILS", base_currency)
            if tx_type == "income":
                income += converted
            else:
                expenses += converted
    else:
        # ------ legacy path: server-side SUM (no conversion) ------
        tx_result = await db.execute(
            select(
                Transaction.type,
                func.coalesce(func.sum(Transaction.amount), ZERO),
            )
            .where(
                resolved.ownership_filter(Transaction),
                Transaction.date >= start,
                Transaction.date <= end,
            )
            .group_by(Transaction.type)
        )
        tx_totals = {row[0]: row[1] for row in tx_result.all()}
        income = tx_totals.get("income", ZERO)
        expenses = tx_totals.get("expense", ZERO)

    # 2. Get materialized IDs to avoid double-counting
    mat_fixed, mat_inst, mat_loan = await _get_materialized_ids(db, user_id, start, end, ctx=resolved)

    # 3. Fetch recurring data
    fixed_items, installments, loans = await _fetch_recurring_data(db, user_id, ctx=resolved)

    if base_currency:
        # 4a. Project with currency info and convert
        for tx_type, _, amount, currency in _project_fixed_entries_with_currency(
            fixed_items, start, end, mat_fixed
        ):
            converted = await convert_amount(amount, currency, base_currency)
            if tx_type == "income":
                income += converted
            else:
                expenses += converted

        for tx_type, _, amount, currency in _project_installments_with_currency(
            installments, start, end, mat_inst
        ):
            converted = await convert_amount(amount, currency, base_currency)
            if tx_type == "income":
                income += converted
            else:
                expenses += converted

        for _, _, amount, currency in _project_loans_with_currency(
            loans, start, end, mat_loan
        ):
            converted = await convert_amount(amount, currency, base_currency)
            expenses += converted
    else:
        # 4b. Legacy path: no conversion
        for tx_type, _, amount in _project_fixed_entries(fixed_items, start, end, mat_fixed):
            if tx_type == "income":
                income += amount
            else:
                expenses += amount

        for tx_type, _, amount in _project_installments(installments, start, end, mat_inst):
            if tx_type == "income":
                income += amount
            else:
                expenses += amount

        for _, _, amount in _project_loans(loans, start, end, mat_loan):
            expenses += amount

    return income, expenses


async def get_aggregated_transactions_range(
    db: AsyncSession,
    user_id: UUID,
    start: date,
    end: date,
    base_currency: Optional[str] = None,
    ctx: Optional[DataContext] = None,
) -> List[Tuple]:
    """Get all financial activity as (type, date, amount) tuples.

    Includes actual transactions + projected recurring items, deduplicated.

    If *base_currency* is provided, amounts are converted before returning.
    """
    resolved = _ensure_ctx(user_id, ctx)

    # 1. Fetch actual transactions
    tx_result = await db.execute(
        select(
            Transaction.type,
            Transaction.date,
            Transaction.amount,
            Transaction.currency,
            Transaction.recurring_source_id,
            Transaction.installment_id,
            Transaction.loan_id,
        )
        .where(
            resolved.ownership_filter(Transaction),
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    rows = tx_result.all()

    result: List[Tuple] = []
    for r in rows:
        tx_type, tx_date, tx_amount, tx_currency = r[0], r[1], r[2], r[3]
        if base_currency:
            tx_amount = await convert_amount(tx_amount, tx_currency or "ILS", base_currency)
        result.append((tx_type, tx_date, tx_amount))

    # Track materialized entries for deduplication
    mat_fixed: Set[Tuple] = set()
    mat_inst: Set[Tuple] = set()
    mat_loan: Set[Tuple] = set()
    for r in rows:
        if r[4]:
            mat_fixed.add((r[4], r[1].year, r[1].month))
        if r[5]:
            mat_inst.add((r[5], r[1].year, r[1].month))
        if r[6]:
            mat_loan.add((r[6], r[1].year, r[1].month))

    # 2. Fetch recurring data & project
    fixed_items, installments, loans = await _fetch_recurring_data(db, user_id, ctx=resolved)

    if base_currency:
        for tx_type, entry_date, amount, currency in _project_fixed_entries_with_currency(
            fixed_items, start, end, mat_fixed
        ):
            converted = await convert_amount(amount, currency, base_currency)
            result.append((tx_type, entry_date, converted))

        for tx_type, entry_date, amount, currency in _project_installments_with_currency(
            installments, start, end, mat_inst
        ):
            converted = await convert_amount(amount, currency, base_currency)
            result.append((tx_type, entry_date, converted))

        for tx_type, entry_date, amount, currency in _project_loans_with_currency(
            loans, start, end, mat_loan
        ):
            converted = await convert_amount(amount, currency, base_currency)
            result.append((tx_type, entry_date, converted))
    else:
        result.extend(_project_fixed_entries(fixed_items, start, end, mat_fixed))
        result.extend(_project_installments(installments, start, end, mat_inst))
        result.extend(_project_loans(loans, start, end, mat_loan))

    return result
