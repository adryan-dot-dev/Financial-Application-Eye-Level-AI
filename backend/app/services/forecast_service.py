from __future__ import annotations

import calendar
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    BankBalance,
    ExpectedIncome,
    FixedIncomeExpense,
    Installment,
    Loan,
    Transaction,
)


def _safe_day(year: int, month: int, day: int) -> date:
    """Handle day_of_month > days in month (e.g., 31 in April)."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


async def get_current_balance(db: AsyncSession, user_id: UUID) -> Decimal:
    """Get the user's current bank balance."""
    result = await db.execute(
        select(BankBalance).where(
            BankBalance.user_id == user_id,
            BankBalance.is_current == True,
        )
    )
    balance = result.scalar_one_or_none()
    return balance.balance if balance else Decimal("0")


async def _fetch_forecast_data(
    db: AsyncSession, user_id: UUID
) -> Tuple[list, list, list, dict]:
    """Fetch all data needed for forecast in parallel-ready queries.

    Returns (fixed_items, installments, loans, expected_incomes_dict).
    """
    # Fetch all active fixed income/expenses
    fixed_result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.user_id == user_id,
            FixedIncomeExpense.is_active == True,
        )
    )
    fixed_items = fixed_result.scalars().all()

    # Fetch all installments with remaining payments
    inst_result = await db.execute(
        select(Installment).where(
            Installment.user_id == user_id,
        )
    )
    installments = inst_result.scalars().all()

    # Fetch all active loans
    loan_result = await db.execute(
        select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == "active",
        )
    )
    loans = loan_result.scalars().all()

    # Fetch expected income entries
    ei_result = await db.execute(
        select(ExpectedIncome).where(
            ExpectedIncome.user_id == user_id,
        )
    )
    expected_incomes = {ei.month: ei.expected_amount for ei in ei_result.scalars().all()}

    return fixed_items, installments, loans, expected_incomes


async def _fetch_one_time_transactions_by_month(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> Dict[Tuple[int, int], Tuple[Decimal, Decimal]]:
    """Fetch all one-time transactions in the date range with a single query.

    Returns a dict of {(year, month): (income, expenses)}.
    """
    result = await db.execute(
        select(
            Transaction.type,
            Transaction.date,
            Transaction.amount,
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.entry_pattern == "one_time",
        )
    )

    buckets: Dict[Tuple[int, int], Tuple[Decimal, Decimal]] = {}
    for tx_type, tx_date, tx_amount in result.all():
        key = (tx_date.year, tx_date.month)
        income, expenses = buckets.get(key, (Decimal("0"), Decimal("0")))
        if tx_type == "income":
            income += tx_amount
        else:
            expenses += tx_amount
        buckets[key] = (income, expenses)

    return buckets


async def compute_monthly_forecast(
    db: AsyncSession, user_id: UUID, months: int = 6
) -> dict:
    """Compute monthly cash flow forecast."""
    today = date.today()
    current_balance = await get_current_balance(db, user_id)

    fixed_items, installments, loans, expected_incomes = await _fetch_forecast_data(
        db, user_id
    )

    # Compute the full date range for the forecast
    first_month_start = today.replace(day=1)
    last_month_start = first_month_start + relativedelta(months=months - 1)
    last_month_year = last_month_start.year
    last_month_num = last_month_start.month
    last_day = calendar.monthrange(last_month_year, last_month_num)[1]
    overall_end = date(last_month_year, last_month_num, last_day)

    # Single query: fetch ALL one-time transactions in the full forecast range
    tx_buckets = await _fetch_one_time_transactions_by_month(
        db, user_id, first_month_start, overall_end
    )

    forecast_months = []
    running_balance = current_balance
    has_negative = False
    first_negative_month = None

    for i in range(months):
        forecast_date = today.replace(day=1) + relativedelta(months=i)
        month_start = forecast_date
        month_year = month_start.year
        month_num = month_start.month
        last_day = calendar.monthrange(month_year, month_num)[1]
        month_end = date(month_year, month_num, last_day)

        opening_balance = running_balance

        # Fixed income/expenses for this month
        fixed_income = Decimal("0")
        fixed_expenses = Decimal("0")
        for f in fixed_items:
            # Check if this fixed entry applies to this month
            if f.start_date > month_end:
                continue
            if f.end_date and f.end_date < month_start:
                continue
            if f.type == "income":
                fixed_income += f.amount
            else:
                fixed_expenses += f.amount

        # Installment payments for this month (split by type)
        installment_income = Decimal("0")
        installment_expenses = Decimal("0")
        for inst in installments:
            remaining = inst.number_of_payments - inst.payments_completed
            if remaining <= 0:
                continue
            # Calculate which payment number this month is
            months_since_start = (month_year - inst.start_date.year) * 12 + (month_num - inst.start_date.month)
            if months_since_start < 0:
                continue
            payment_num = months_since_start + 1
            if payment_num > inst.number_of_payments:
                continue
            if payment_num > inst.payments_completed:
                if inst.type == "income":
                    installment_income += inst.monthly_amount
                else:
                    installment_expenses += inst.monthly_amount

        # Loan payments for this month
        loan_payments = Decimal("0")
        for loan in loans:
            remaining_payments = loan.total_payments - loan.payments_made
            if remaining_payments <= 0:
                continue
            months_since_start = (month_year - loan.start_date.year) * 12 + (month_num - loan.start_date.month)
            if months_since_start < 0:
                continue
            payment_num = months_since_start + 1
            if payment_num > loan.total_payments:
                continue
            if payment_num > loan.payments_made:
                loan_payments += loan.monthly_payment

        # Expected income for this month
        month_key = month_start
        ei_amount = expected_incomes.get(month_key, Decimal("0"))

        # One-time transactions from the pre-fetched bucket
        one_time_income, one_time_expenses = tx_buckets.get(
            (month_year, month_num), (Decimal("0"), Decimal("0"))
        )

        total_income = fixed_income + ei_amount + one_time_income + installment_income
        total_expenses = fixed_expenses + installment_expenses + loan_payments + one_time_expenses
        net_change = total_income - total_expenses
        closing_balance = opening_balance + net_change

        if closing_balance < 0 and not has_negative:
            has_negative = True
            first_negative_month = month_start

        forecast_months.append({
            "month": month_start,
            "opening_balance": opening_balance,
            "fixed_income": fixed_income,
            "fixed_expenses": fixed_expenses,
            "installment_income": installment_income,
            "installment_expenses": installment_expenses,
            "loan_payments": loan_payments,
            "expected_income": ei_amount,
            "one_time_income": one_time_income,
            "one_time_expenses": one_time_expenses,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_change": net_change,
            "closing_balance": closing_balance,
        })

        running_balance = closing_balance

    return {
        "current_balance": current_balance,
        "months": forecast_months,
        "has_negative_months": has_negative,
        "first_negative_month": first_negative_month,
    }


async def _fetch_one_time_transactions_by_date(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> Dict[date, Tuple[Decimal, Decimal]]:
    """Fetch all one-time transactions in the date range with a single query.

    Returns a dict of {date: (income, expenses)}.
    """
    result = await db.execute(
        select(
            Transaction.type,
            Transaction.date,
            Transaction.amount,
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.entry_pattern == "one_time",
        )
    )

    buckets: Dict[date, Tuple[Decimal, Decimal]] = {}
    for tx_type, tx_date, tx_amount in result.all():
        income, expenses = buckets.get(tx_date, (Decimal("0"), Decimal("0")))
        if tx_type == "income":
            income += tx_amount
        else:
            expenses += tx_amount
        buckets[tx_date] = (income, expenses)

    return buckets


async def compute_weekly_forecast(
    db: AsyncSession, user_id: UUID, weeks: int = 12
) -> dict:
    """Compute weekly cash flow forecast."""
    today = date.today()
    current_balance = await get_current_balance(db, user_id)

    # Get all fixed items
    fixed_result = await db.execute(
        select(FixedIncomeExpense).where(
            FixedIncomeExpense.user_id == user_id,
            FixedIncomeExpense.is_active == True,
        )
    )
    fixed_items = fixed_result.scalars().all()

    # Get installments
    inst_result = await db.execute(
        select(Installment).where(Installment.user_id == user_id)
    )
    installments = inst_result.scalars().all()

    # Get active loans
    loan_result = await db.execute(
        select(Loan).where(Loan.user_id == user_id, Loan.status == "active")
    )
    loans = loan_result.scalars().all()

    # Calculate start of current week (Sunday)
    # Python weekday(): Mon=0, Tue=1, ..., Sun=6
    # To get previous Sunday: subtract (weekday + 1) % 7
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = today - timedelta(days=days_since_sunday)

    overall_start = week_start
    overall_end = week_start + timedelta(weeks=weeks) - timedelta(days=1)

    # Single query: fetch ALL one-time transactions across the entire forecast range
    tx_by_date = await _fetch_one_time_transactions_by_date(
        db, user_id, overall_start, overall_end
    )

    weekly_items = []
    running_balance = current_balance

    for w in range(weeks):
        ws = week_start + timedelta(weeks=w)
        we = ws + timedelta(days=6)

        income = Decimal("0")
        expenses = Decimal("0")

        # Check fixed items that fall in this week
        for f in fixed_items:
            if f.start_date > we:
                continue
            if f.end_date and f.end_date < ws:
                continue
            # Check if the day_of_month falls in this week
            for d in range(7):
                check_date = ws + timedelta(days=d)
                if check_date.day == f.day_of_month or (
                    f.day_of_month > calendar.monthrange(check_date.year, check_date.month)[1]
                    and check_date.day == calendar.monthrange(check_date.year, check_date.month)[1]
                ):
                    if f.type == "income":
                        income += f.amount
                    else:
                        expenses += f.amount
                    break  # Only once per week

        # Installments falling in this week (split by type)
        for inst in installments:
            remaining = inst.number_of_payments - inst.payments_completed
            if remaining <= 0:
                continue
            for d in range(7):
                check_date = ws + timedelta(days=d)
                months_since = (check_date.year - inst.start_date.year) * 12 + (check_date.month - inst.start_date.month)
                if months_since < 0:
                    continue
                payment_num = months_since + 1
                if payment_num > inst.number_of_payments or payment_num <= inst.payments_completed:
                    continue
                if check_date.day == inst.day_of_month or (
                    inst.day_of_month > calendar.monthrange(check_date.year, check_date.month)[1]
                    and check_date.day == calendar.monthrange(check_date.year, check_date.month)[1]
                ):
                    if inst.type == "income":
                        income += inst.monthly_amount
                    else:
                        expenses += inst.monthly_amount
                    break

        # Loans falling in this week
        for loan in loans:
            if loan.payments_made >= loan.total_payments:
                continue
            for d in range(7):
                check_date = ws + timedelta(days=d)
                months_since = (check_date.year - loan.start_date.year) * 12 + (check_date.month - loan.start_date.month)
                if months_since < 0:
                    continue
                payment_num = months_since + 1
                if payment_num > loan.total_payments or payment_num <= loan.payments_made:
                    continue
                if check_date.day == loan.day_of_month or (
                    loan.day_of_month > calendar.monthrange(check_date.year, check_date.month)[1]
                    and check_date.day == calendar.monthrange(check_date.year, check_date.month)[1]
                ):
                    expenses += loan.monthly_payment
                    break

        # One-time transactions from the pre-fetched bucket (by date)
        for d in range(7):
            check_date = ws + timedelta(days=d)
            if check_date in tx_by_date:
                day_income, day_expenses = tx_by_date[check_date]
                income += day_income
                expenses += day_expenses

        net_change = income - expenses
        running_balance = running_balance + net_change

        weekly_items.append({
            "week_start": ws,
            "week_end": we,
            "income": income,
            "expenses": expenses,
            "net_change": net_change,
            "running_balance": running_balance,
        })

    return {
        "current_balance": current_balance,
        "weeks": weekly_items,
    }
