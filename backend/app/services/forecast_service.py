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
    Settings,
    Subscription,
    Transaction,
)
from app.api.deps import DataContext
from app.services.exchange_rate_service import convert_amount as _convert_amount


def _ensure_ctx(user_id=None, ctx=None):
    if ctx is not None:
        return ctx
    if user_id is not None:
        return DataContext(user_id=user_id, organization_id=None, is_org_context=False)
    raise ValueError("Either user_id or ctx must be provided")


def _safe_day(year: int, month: int, day: int) -> date:
    """Handle day_of_month > days in month (e.g., 31 in April)."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


async def get_current_balance(
    db: AsyncSession, user_id: UUID = None, *, ctx: Optional[DataContext] = None,
) -> Decimal:
    """Get the user's current bank balance."""
    ctx = _ensure_ctx(user_id=user_id, ctx=ctx)
    result = await db.execute(
        select(BankBalance).where(
            ctx.ownership_filter(BankBalance),
            BankBalance.is_current == True,
        )
    )
    balance = result.scalar_one_or_none()
    return balance.balance if balance else Decimal("0")


async def _fetch_forecast_data(
    db: AsyncSession, user_id: UUID = None, *, ctx: Optional[DataContext] = None,
) -> Tuple[list, list, list, dict, list]:
    """Fetch all data needed for forecast in parallel-ready queries.

    Returns (fixed_items, installments, loans, expected_incomes_dict, subscriptions).
    """
    ctx = _ensure_ctx(user_id=user_id, ctx=ctx)

    # Fetch all active fixed income/expenses
    fixed_result = await db.execute(
        select(FixedIncomeExpense).where(
            ctx.ownership_filter(FixedIncomeExpense),
            FixedIncomeExpense.is_active == True,
        )
    )
    fixed_items = fixed_result.scalars().all()

    # Fetch all installments with remaining payments
    inst_result = await db.execute(
        select(Installment).where(
            ctx.ownership_filter(Installment),
        )
    )
    installments = inst_result.scalars().all()

    # Fetch all active loans
    loan_result = await db.execute(
        select(Loan).where(
            ctx.ownership_filter(Loan),
            Loan.status == "active",
        )
    )
    loans = loan_result.scalars().all()

    # Fetch expected income entries
    ei_result = await db.execute(
        select(ExpectedIncome).where(
            ctx.ownership_filter(ExpectedIncome),
        )
    )
    expected_incomes = {ei.month: ei.expected_amount for ei in ei_result.scalars().all()}

    # Fetch all active subscriptions
    sub_result = await db.execute(
        select(Subscription).where(
            ctx.ownership_filter(Subscription),
            Subscription.is_active == True,
        )
    )
    subscriptions = sub_result.scalars().all()

    return fixed_items, installments, loans, expected_incomes, subscriptions


# Billing cycle → period in months
_CYCLE_MONTHS = {
    "monthly": 1,
    "quarterly": 3,
    "semi_annual": 6,
    "annual": 12,
}


def _subscription_hits_month(sub_next_renewal: date, billing_cycle: str, month_start: date, month_end: date) -> bool:
    """Check whether a subscription renewal falls within the given month.

    Starting from next_renewal_date, renewals happen every N months where N
    depends on billing_cycle. We check if any renewal date lands in [month_start, month_end].
    """
    period = _CYCLE_MONTHS.get(billing_cycle, 1)
    renewal = sub_next_renewal

    # If the first renewal is already past the month, no hit
    if renewal > month_end:
        return False

    # Fast-forward renewals until we reach or pass month_start
    if renewal < month_start:
        # Calculate how many full periods we need to skip
        months_diff = (month_start.year - renewal.year) * 12 + (month_start.month - renewal.month)
        periods_to_skip = months_diff // period
        if periods_to_skip > 0:
            renewal_year = renewal.year + (renewal.month - 1 + periods_to_skip * period) // 12
            renewal_month = (renewal.month - 1 + periods_to_skip * period) % 12 + 1
            last_day = calendar.monthrange(renewal_year, renewal_month)[1]
            renewal = date(renewal_year, renewal_month, min(renewal.day, last_day))

    # Check a few periods around the target month
    for _ in range(3):
        if renewal < month_start:
            # Advance by one period
            renewal_year = renewal.year + (renewal.month - 1 + period) // 12
            renewal_month = (renewal.month - 1 + period) % 12 + 1
            last_day = calendar.monthrange(renewal_year, renewal_month)[1]
            renewal = date(renewal_year, renewal_month, min(renewal.day, last_day))
            continue
        if renewal > month_end:
            return False
        return True

    return False


async def _get_user_base_currency(db: AsyncSession, user_id: UUID) -> str:
    """Return the user's preferred currency from settings, defaulting to ILS."""
    result = await db.execute(
        select(Settings.currency).where(Settings.user_id == user_id)
    )
    currency = result.scalar_one_or_none()
    return currency if currency else "ILS"


async def _fetch_one_time_transactions_by_month(
    db: AsyncSession, user_id: UUID = None, start: date = None, end: date = None,
    base_currency: Optional[str] = None,
    ctx: Optional[DataContext] = None,
) -> Dict[Tuple[int, int], Tuple[Decimal, Decimal]]:
    """Fetch all one-time transactions in the date range with a single query.

    Returns a dict of {(year, month): (income, expenses)}.
    If base_currency is provided, amounts are converted before bucketing.
    """
    ctx = _ensure_ctx(user_id=user_id, ctx=ctx)
    result = await db.execute(
        select(
            Transaction.type,
            Transaction.date,
            Transaction.amount,
            Transaction.currency,
        )
        .where(
            ctx.ownership_filter(Transaction),
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.entry_pattern == "one_time",
        )
    )

    buckets: Dict[Tuple[int, int], Tuple[Decimal, Decimal]] = {}
    for tx_type, tx_date, tx_amount, tx_currency in result.all():
        if base_currency:
            tx_amount = await _convert_amount(tx_amount, tx_currency or "ILS", base_currency)
        key = (tx_date.year, tx_date.month)
        income, expenses = buckets.get(key, (Decimal("0"), Decimal("0")))
        if tx_type == "income":
            income += tx_amount
        else:
            expenses += tx_amount
        buckets[key] = (income, expenses)

    return buckets


async def compute_monthly_forecast(
    db: AsyncSession, user_id: UUID = None, months: int = 6,
    base_currency: Optional[str] = None,
    ctx: Optional[DataContext] = None,
    what_if: Optional[dict] = None,
) -> dict:
    """Compute monthly cash flow forecast.

    If *base_currency* is provided, every amount is converted to that currency
    before summing. If not provided, the user's preferred currency from settings
    is used automatically.

    If *what_if* is provided, it should contain:
    - added_income: extra monthly income (Decimal)
    - added_expense: extra monthly expense (Decimal)
    - balance_adjustment: one-time balance change (Decimal)
    """
    ctx = _ensure_ctx(user_id=user_id, ctx=ctx)
    today = date.today()
    current_balance = await get_current_balance(db, ctx=ctx)

    # Apply what-if balance adjustment
    wi_income = Decimal("0")
    wi_expense = Decimal("0")
    original_balance = current_balance
    if what_if:
        current_balance += Decimal(str(what_if.get("balance_adjustment", 0)))
        wi_income = Decimal(str(what_if.get("added_income", 0)))
        wi_expense = Decimal(str(what_if.get("added_expense", 0)))

    # Determine the target currency
    if base_currency is None:
        base_currency = await _get_user_base_currency(db, ctx.user_id)

    fixed_items, installments, loans, expected_incomes, subscriptions = await _fetch_forecast_data(
        db, ctx=ctx
    )

    # Compute the full date range for the forecast
    first_month_start = today.replace(day=1)
    last_month_start = first_month_start + relativedelta(months=months - 1)
    last_month_year = last_month_start.year
    last_month_num = last_month_start.month
    last_day = calendar.monthrange(last_month_year, last_month_num)[1]
    overall_end = date(last_month_year, last_month_num, last_day)

    # Single query: fetch ALL one-time transactions in the full forecast range
    # (already converted to base_currency)
    tx_buckets = await _fetch_one_time_transactions_by_month(
        db, start=first_month_start, end=overall_end,
        base_currency=base_currency,
        ctx=ctx,
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

        # Fixed income/expenses for this month (with currency conversion)
        fixed_income = Decimal("0")
        fixed_expenses = Decimal("0")
        for f in fixed_items:
            # Check if this fixed entry applies to this month
            if f.start_date > month_end:
                continue
            if f.end_date and f.end_date < month_start:
                continue
            f_currency = getattr(f, "currency", "ILS") or "ILS"
            amount = await _convert_amount(f.amount, f_currency, base_currency)
            if f.type == "income":
                fixed_income += amount
            else:
                fixed_expenses += amount

        # Installment payments for this month (split by type, with conversion)
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
                inst_currency = getattr(inst, "currency", "ILS") or "ILS"
                amount = await _convert_amount(inst.monthly_amount, inst_currency, base_currency)
                if inst.type == "income":
                    installment_income += amount
                else:
                    installment_expenses += amount

        # Loan payments for this month (with conversion)
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
                loan_currency = getattr(loan, "currency", "ILS") or "ILS"
                amount = await _convert_amount(loan.monthly_payment, loan_currency, base_currency)
                loan_payments += amount

        # Subscription costs for this month (with conversion)
        subscription_expenses = Decimal("0")
        for sub in subscriptions:
            if _subscription_hits_month(sub.next_renewal_date, sub.billing_cycle, month_start, month_end):
                sub_currency = getattr(sub, "currency", "ILS") or "ILS"
                amount = await _convert_amount(sub.amount, sub_currency, base_currency)
                subscription_expenses += amount

        # Expected income for this month
        month_key = month_start
        ei_amount = expected_incomes.get(month_key, Decimal("0"))
        # Expected income doesn't have a currency field; assume base currency

        # One-time transactions from the pre-fetched bucket (already converted)
        one_time_income, one_time_expenses = tx_buckets.get(
            (month_year, month_num), (Decimal("0"), Decimal("0"))
        )

        total_income = fixed_income + ei_amount + one_time_income + installment_income + wi_income
        total_expenses = fixed_expenses + installment_expenses + loan_payments + subscription_expenses + one_time_expenses + wi_expense
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
            "subscription_expenses": subscription_expenses,
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
        "original_balance": original_balance if what_if else current_balance,
        "base_currency": base_currency,
        "months": forecast_months,
        "has_negative_months": has_negative,
        "first_negative_month": first_negative_month,
    }


async def _fetch_one_time_transactions_by_date(
    db: AsyncSession, user_id: UUID = None, start: date = None, end: date = None,
    base_currency: Optional[str] = None,
    ctx: Optional[DataContext] = None,
) -> Dict[date, Tuple[Decimal, Decimal]]:
    """Fetch all one-time transactions in the date range with a single query.

    Returns a dict of {date: (income, expenses)}.
    If base_currency is provided, amounts are converted before bucketing.
    """
    ctx = _ensure_ctx(user_id=user_id, ctx=ctx)
    result = await db.execute(
        select(
            Transaction.type,
            Transaction.date,
            Transaction.amount,
            Transaction.currency,
        )
        .where(
            ctx.ownership_filter(Transaction),
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.entry_pattern == "one_time",
        )
    )

    buckets: Dict[date, Tuple[Decimal, Decimal]] = {}
    for tx_type, tx_date, tx_amount, tx_currency in result.all():
        if base_currency:
            tx_amount = await _convert_amount(tx_amount, tx_currency or "ILS", base_currency)
        income, expenses = buckets.get(tx_date, (Decimal("0"), Decimal("0")))
        if tx_type == "income":
            income += tx_amount
        else:
            expenses += tx_amount
        buckets[tx_date] = (income, expenses)

    return buckets


async def compute_weekly_forecast(
    db: AsyncSession, user_id: UUID = None, weeks: int = 12,
    base_currency: Optional[str] = None,
    ctx: Optional[DataContext] = None,
) -> dict:
    """Compute weekly cash flow forecast.

    If *base_currency* is provided, every amount is converted to that currency
    before summing. If not provided, the user's preferred currency from settings
    is used automatically.
    """
    ctx = _ensure_ctx(user_id=user_id, ctx=ctx)
    today = date.today()
    current_balance = await get_current_balance(db, ctx=ctx)

    # Determine the target currency
    if base_currency is None:
        base_currency = await _get_user_base_currency(db, ctx.user_id)

    # Get all fixed items
    fixed_result = await db.execute(
        select(FixedIncomeExpense).where(
            ctx.ownership_filter(FixedIncomeExpense),
            FixedIncomeExpense.is_active == True,
        )
    )
    fixed_items = fixed_result.scalars().all()

    # Get installments
    inst_result = await db.execute(
        select(Installment).where(ctx.ownership_filter(Installment))
    )
    installments = inst_result.scalars().all()

    # Get active loans
    loan_result = await db.execute(
        select(Loan).where(ctx.ownership_filter(Loan), Loan.status == "active")
    )
    loans = loan_result.scalars().all()

    # Get active subscriptions
    sub_result = await db.execute(
        select(Subscription).where(
            ctx.ownership_filter(Subscription),
            Subscription.is_active == True,
        )
    )
    subscriptions = sub_result.scalars().all()

    # Calculate start of current week (Sunday)
    # Python weekday(): Mon=0, Tue=1, ..., Sun=6
    # To get previous Sunday: subtract (weekday + 1) % 7
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = today - timedelta(days=days_since_sunday)

    overall_start = week_start
    overall_end = week_start + timedelta(weeks=weeks) - timedelta(days=1)

    # Single query: fetch ALL one-time transactions across the entire forecast range
    # (already converted to base_currency)
    tx_by_date = await _fetch_one_time_transactions_by_date(
        db, start=overall_start, end=overall_end,
        base_currency=base_currency,
        ctx=ctx,
    )

    weekly_items = []
    running_balance = current_balance

    for w in range(weeks):
        ws = week_start + timedelta(weeks=w)
        we = ws + timedelta(days=6)

        income = Decimal("0")
        expenses = Decimal("0")

        # Check fixed items that fall in this week (with conversion)
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
                    f_currency = getattr(f, "currency", "ILS") or "ILS"
                    amount = await _convert_amount(f.amount, f_currency, base_currency)
                    if f.type == "income":
                        income += amount
                    else:
                        expenses += amount
                    break  # Only once per week

        # Installments falling in this week (split by type, with conversion)
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
                    inst_currency = getattr(inst, "currency", "ILS") or "ILS"
                    amount = await _convert_amount(inst.monthly_amount, inst_currency, base_currency)
                    if inst.type == "income":
                        income += amount
                    else:
                        expenses += amount
                    break

        # Loans falling in this week (with conversion)
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
                    loan_currency = getattr(loan, "currency", "ILS") or "ILS"
                    amount = await _convert_amount(loan.monthly_payment, loan_currency, base_currency)
                    expenses += amount
                    break

        # Subscriptions falling in this week (with conversion)
        for sub in subscriptions:
            period = _CYCLE_MONTHS.get(sub.billing_cycle, 1)
            renewal = sub.next_renewal_date
            # Check if any renewal of this subscription falls in this week [ws, we]
            if renewal <= we:
                # Fast-forward if needed
                while renewal < ws:
                    renewal_year = renewal.year + (renewal.month - 1 + period) // 12
                    renewal_month = (renewal.month - 1 + period) % 12 + 1
                    last_day_of_month = calendar.monthrange(renewal_year, renewal_month)[1]
                    renewal = date(renewal_year, renewal_month, min(renewal.day, last_day_of_month))
                if ws <= renewal <= we:
                    sub_currency = getattr(sub, "currency", "ILS") or "ILS"
                    amount = await _convert_amount(sub.amount, sub_currency, base_currency)
                    expenses += amount

        # One-time transactions from the pre-fetched bucket (already converted)
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
        "base_currency": base_currency,
        "weeks": weekly_items,
    }
