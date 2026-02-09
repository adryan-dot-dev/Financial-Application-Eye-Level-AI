from __future__ import annotations

import calendar
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
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


async def compute_monthly_forecast(
    db: AsyncSession, user_id: UUID, months: int = 6
) -> dict:
    """Compute monthly cash flow forecast."""
    today = date.today()
    current_balance = await get_current_balance(db, user_id)

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

        # Installment payments for this month
        installment_payments = Decimal("0")
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
                installment_payments += inst.monthly_amount

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

        # One-time transactions already recorded for this month
        one_time_income = Decimal("0")
        one_time_expenses = Decimal("0")

        # Only count past/current month one-time transactions
        tx_result = await db.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.date >= month_start,
                Transaction.date <= month_end,
                Transaction.entry_pattern == "one_time",
            )
        )
        for tx in tx_result.scalars().all():
            if tx.type == "income":
                one_time_income += tx.amount
            else:
                one_time_expenses += tx.amount

        total_income = fixed_income + ei_amount + one_time_income
        total_expenses = fixed_expenses + installment_payments + loan_payments + one_time_expenses
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
            "installment_payments": installment_payments,
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
    week_start = today - timedelta(days=today.weekday() + 1)  # Go to previous Sunday
    if week_start > today:
        week_start -= timedelta(days=7)

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

        # Installments falling in this week
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

        # One-time transactions in this week
        tx_result = await db.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.date >= ws,
                Transaction.date <= we,
                Transaction.entry_pattern == "one_time",
            )
        )
        for tx in tx_result.scalars().all():
            if tx.type == "income":
                income += tx.amount
            else:
                expenses += tx.amount

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
