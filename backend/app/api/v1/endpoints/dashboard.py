from __future__ import annotations

import calendar
import logging
import math
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.dashboard import (
    CategoryBreakdownItem,
    CategoryBreakdownResponse,
    DashboardPeriodData,
    DashboardSummary,
    FinancialHealthResponse,
    HealthFactor,
    InstallmentsSummaryResponse,
    InstallmentSummaryItem,
    LoansSummaryResponse,
    LoanSummaryItem,
    TopExpenseItem,
    TopExpensesResponse,
    UpcomingPaymentItem,
    UpcomingPaymentsResponse,
)
from app.db.models import (
    Alert,
    BankBalance,
    Category,
    FixedIncomeExpense,
    Installment,
    Loan,
    Transaction,
    User,
)
from app.db.session import get_db
from app.services.alert_service import generate_alerts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

ZERO = Decimal("0")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_current_balance(db: AsyncSession, user_id: UUID) -> Decimal:
    """Return the user's current bank balance, or 0 if none set."""
    result = await db.execute(
        select(BankBalance.balance).where(
            BankBalance.user_id == user_id,
            BankBalance.is_current == True,
        )
    )
    val = result.scalar_one_or_none()
    return val if val is not None else ZERO


async def _sum_transactions(
    db: AsyncSession,
    user_id: UUID,
    start: date,
    end: date,
) -> tuple:
    """Return (total_income, total_expenses) for the given date range."""
    result = await db.execute(
        select(
            Transaction.type,
            func.coalesce(func.sum(Transaction.amount), ZERO),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Transaction.type)
    )
    totals = {row[0]: row[1] for row in result.all()}
    return (
        totals.get("income", ZERO),
        totals.get("expense", ZERO),
    )


async def _sum_transactions_range(
    db: AsyncSession,
    user_id: UUID,
    start: date,
    end: date,
) -> List[Tuple]:
    """Fetch all (type, date, amount) rows in a date range with one query.

    Returns a list of (type, date, amount) tuples.
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
        )
    )
    return result.all()


def _pct_change(current: Decimal, previous: Decimal) -> Decimal:
    """Calculate percentage change.  Returns 0 when previous is 0."""
    if previous == ZERO:
        if current == ZERO:
            return ZERO
        return Decimal("100")  # went from 0 to something -> 100 %
    return ((current - previous) / abs(previous) * 100).quantize(Decimal("0.01"))


async def _active_alerts_count(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(func.count(Alert.id)).where(
            Alert.user_id == user_id,
            Alert.is_dismissed == False,
        )
    )
    return result.scalar() or 0


# ---------------------------------------------------------------------------
# GET /dashboard/summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Aggregate dashboard KPI data:
    - current balance
    - this month income / expenses / net
    - trends vs last month (percentage change)
    """
    today = date.today()

    # Current month boundaries
    this_month_start = today.replace(day=1)
    this_month_end = today.replace(
        day=calendar.monthrange(today.year, today.month)[1]
    )

    # Previous month boundaries
    prev_month_end = this_month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    current_balance = await _get_current_balance(db, current_user.id)

    # Single query: fetch both months of aggregated data at once
    result = await db.execute(
        select(
            Transaction.type,
            func.coalesce(func.sum(Transaction.amount), ZERO),
            # Use a case expression to bucket by month
            (Transaction.date >= this_month_start).label("is_current_month"),
        )
        .where(
            Transaction.user_id == current_user.id,
            Transaction.date >= prev_month_start,
            Transaction.date <= this_month_end,
        )
        .group_by(Transaction.type, "is_current_month")
    )
    rows = result.all()

    this_income = ZERO
    this_expenses = ZERO
    prev_income = ZERO
    prev_expenses = ZERO

    for tx_type, total, is_current in rows:
        if is_current:
            if tx_type == "income":
                this_income = total
            else:
                this_expenses = total
        else:
            if tx_type == "income":
                prev_income = total
            else:
                prev_expenses = total

    net_cashflow = this_income - this_expenses
    prev_net = prev_income - prev_expenses

    balance_trend = _pct_change(net_cashflow, prev_net)
    income_trend = _pct_change(this_income, prev_income)
    expense_trend = _pct_change(this_expenses, prev_expenses)

    # Generate/refresh alerts so the dashboard always reflects the latest forecast.
    # Wrapped in try/except so the dashboard always returns data even if alert
    # generation encounters a transient issue (e.g. pending migration).
    try:
        await generate_alerts(db, current_user.id)
    except Exception as exc:
        logger.warning("Failed to generate alerts during dashboard load: %s", exc)
        await db.rollback()

    return DashboardSummary(
        current_balance=current_balance,
        monthly_income=this_income,
        monthly_expenses=this_expenses,
        net_cashflow=net_cashflow,
        balance_trend=balance_trend,
        income_trend=income_trend,
        expense_trend=expense_trend,
    )


# ---------------------------------------------------------------------------
# GET /dashboard/weekly   - last 12 weeks
# ---------------------------------------------------------------------------

@router.get("/weekly", response_model=List[DashboardPeriodData])
async def get_dashboard_weekly(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return income / expenses / net / running balance for the last 12 weeks."""
    today = date.today()
    current_balance = await _get_current_balance(db, current_user.id)

    # Start from 11 weeks ago (12 weeks total including current)
    # Align to start of week (Sunday)
    days_since_sunday = (today.weekday() + 1) % 7
    current_week_start = today - timedelta(days=days_since_sunday)
    first_week_start = current_week_start - timedelta(weeks=11)
    last_week_end = current_week_start + timedelta(days=6)

    # Single query: fetch all transactions in the full 12-week range
    all_tx = await _sum_transactions_range(
        db, current_user.id, first_week_start, last_week_end,
    )

    # Bucket transactions into weeks
    # week_index = (tx_date - first_week_start).days // 7
    week_buckets: Dict[int, Tuple[Decimal, Decimal]] = {}
    for tx_type, tx_date, tx_amount in all_tx:
        week_idx = (tx_date - first_week_start).days // 7
        if week_idx < 0 or week_idx >= 12:
            continue
        income, expenses = week_buckets.get(week_idx, (ZERO, ZERO))
        if tx_type == "income":
            income += tx_amount
        else:
            expenses += tx_amount
        week_buckets[week_idx] = (income, expenses)

    # Build week_data list
    week_data = []
    for i in range(12):
        ws = first_week_start + timedelta(weeks=i)
        we = ws + timedelta(days=6)
        income, expenses = week_buckets.get(i, (ZERO, ZERO))
        net = income - expenses
        week_data.append((ws, we, income, expenses, net))

    total_net = sum(wd[4] for wd in week_data)
    running = current_balance - total_net

    weeks: List[DashboardPeriodData] = []
    for ws, we, income, expenses, net in week_data:
        running += net
        period_label = ws.strftime("%Y-%m-%d")
        weeks.append(DashboardPeriodData(
            period=period_label,
            income=income,
            expenses=expenses,
            net=net,
            balance=running,
        ))

    return weeks


# ---------------------------------------------------------------------------
# GET /dashboard/monthly  - last 12 months
# ---------------------------------------------------------------------------

@router.get("/monthly", response_model=List[DashboardPeriodData])
async def get_dashboard_monthly(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return income / expenses / net / running balance for the last 12 months."""
    today = date.today()
    current_balance = await _get_current_balance(db, current_user.id)

    # Build month boundaries
    month_boundaries = []
    for i in range(11, -1, -1):
        m_date = today.replace(day=1) - relativedelta(months=i)
        m_end = m_date.replace(
            day=calendar.monthrange(m_date.year, m_date.month)[1],
        )
        month_boundaries.append((m_date, m_end))

    overall_start = month_boundaries[0][0]
    overall_end = month_boundaries[-1][1]

    # Single query: fetch all transactions in the full 12-month range
    all_tx = await _sum_transactions_range(
        db, current_user.id, overall_start, overall_end,
    )

    # Bucket transactions into months by (year, month)
    month_buckets: Dict[Tuple[int, int], Tuple[Decimal, Decimal]] = {}
    for tx_type, tx_date, tx_amount in all_tx:
        key = (tx_date.year, tx_date.month)
        income, expenses = month_buckets.get(key, (ZERO, ZERO))
        if tx_type == "income":
            income += tx_amount
        else:
            expenses += tx_amount
        month_buckets[key] = (income, expenses)

    # Build month_data list
    month_data = []
    for m_start, m_end in month_boundaries:
        key = (m_start.year, m_start.month)
        income, expenses = month_buckets.get(key, (ZERO, ZERO))
        net = income - expenses
        month_data.append((m_start, income, expenses, net))

    total_net = sum(md[3] for md in month_data)
    running = current_balance - total_net

    periods: List[DashboardPeriodData] = []
    for m_start, income, expenses, net in month_data:
        running += net
        periods.append(DashboardPeriodData(
            period=m_start.strftime("%Y-%m"),
            income=income,
            expenses=expenses,
            net=net,
            balance=running,
        ))

    return periods


# ---------------------------------------------------------------------------
# GET /dashboard/quarterly  - last 8 quarters
# ---------------------------------------------------------------------------

@router.get("/quarterly", response_model=List[DashboardPeriodData])
async def get_dashboard_quarterly(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return income / expenses / net / running balance for the last 8 quarters."""
    today = date.today()
    current_balance = await _get_current_balance(db, current_user.id)

    # Determine current quarter start
    current_q_month = ((today.month - 1) // 3) * 3 + 1
    current_q_start = date(today.year, current_q_month, 1)

    # Build quarter boundaries
    quarter_boundaries = []
    for i in range(7, -1, -1):
        q_start = current_q_start - relativedelta(months=i * 3)
        q_end_month = q_start + relativedelta(months=2)
        q_end = q_end_month.replace(
            day=calendar.monthrange(q_end_month.year, q_end_month.month)[1],
        )
        q_num = (q_start.month - 1) // 3 + 1
        label = f"{q_start.year}-Q{q_num}"
        quarter_boundaries.append((label, q_start, q_end))

    overall_start = quarter_boundaries[0][1]
    overall_end = quarter_boundaries[-1][2]

    # Single query: fetch all transactions in the full range
    all_tx = await _sum_transactions_range(
        db, current_user.id, overall_start, overall_end,
    )

    # Bucket transactions into quarters
    # Quarter key: (year, quarter_number)
    quarter_buckets: Dict[Tuple[int, int], Tuple[Decimal, Decimal]] = {}
    for tx_type, tx_date, tx_amount in all_tx:
        q_num = (tx_date.month - 1) // 3 + 1
        key = (tx_date.year, q_num)
        income, expenses = quarter_buckets.get(key, (ZERO, ZERO))
        if tx_type == "income":
            income += tx_amount
        else:
            expenses += tx_amount
        quarter_buckets[key] = (income, expenses)

    # Build quarter_data list
    quarter_data = []
    for label, q_start, q_end in quarter_boundaries:
        q_num = (q_start.month - 1) // 3 + 1
        key = (q_start.year, q_num)
        income, expenses = quarter_buckets.get(key, (ZERO, ZERO))
        net = income - expenses
        quarter_data.append((label, income, expenses, net))

    total_net = sum(qd[3] for qd in quarter_data)
    running = current_balance - total_net

    periods: List[DashboardPeriodData] = []
    for label, income, expenses, net in quarter_data:
        running += net
        periods.append(DashboardPeriodData(
            period=label,
            income=income,
            expenses=expenses,
            net=net,
            balance=running,
        ))

    return periods


# ---------------------------------------------------------------------------
# Helper: compute next occurrence of a day_of_month on or after today
# ---------------------------------------------------------------------------

def _next_occurrence(day_of_month: int, today: date, max_days: int) -> Optional[date]:
    """Find the next date with the given day_of_month within max_days from today.

    Handles months with fewer days (e.g. day_of_month=31 in February uses last
    day of that month).  Returns None if no occurrence falls within the window.
    """
    for month_offset in range(0, (max_days // 28) + 3):
        year = today.year + (today.month - 1 + month_offset) // 12
        month = (today.month - 1 + month_offset) % 12 + 1
        last_day = calendar.monthrange(year, month)[1]
        actual_day = min(day_of_month, last_day)
        candidate = date(year, month, actual_day)
        if candidate < today:
            continue
        if (candidate - today).days > max_days:
            return None
        return candidate
    return None


# ---------------------------------------------------------------------------
# GET /dashboard/category-breakdown
# ---------------------------------------------------------------------------

@router.get("/category-breakdown", response_model=CategoryBreakdownResponse)
async def get_category_breakdown(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return expense breakdown by category for the current month.
    Each item includes category details, total amount, percentage, and count.
    """
    today = date.today()
    month_start = today.replace(day=1)
    month_end = today.replace(day=calendar.monthrange(today.year, today.month)[1])

    # Query expense transactions grouped by category, with a LEFT JOIN to categories
    stmt = (
        select(
            Transaction.category_id,
            Category.name,
            Category.name_he,
            Category.color,
            Category.icon,
            func.coalesce(func.sum(Transaction.amount), ZERO).label("total_amount"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.date >= month_start,
            Transaction.date <= month_end,
        )
        .group_by(
            Transaction.category_id,
            Category.name,
            Category.name_he,
            Category.color,
            Category.icon,
        )
        .order_by(func.sum(Transaction.amount).desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Calculate total expenses for percentage computation
    total_expenses = sum(row.total_amount for row in rows) if rows else ZERO

    items: List[CategoryBreakdownItem] = []
    for row in rows:
        pct = (
            (row.total_amount / total_expenses * 100).quantize(Decimal("0.01"))
            if total_expenses > ZERO
            else ZERO
        )
        items.append(CategoryBreakdownItem(
            category_id=str(row.category_id) if row.category_id else None,
            category_name=row[1] if row[1] else "Uncategorized",
            category_name_he=row[2] if row[2] else "\u05dc\u05dc\u05d0 \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4",
            category_color=row[3] if row[3] else "#6B7280",
            category_icon=row[4] if row[4] else "help-circle",
            total_amount=row.total_amount,
            percentage=pct,
            transaction_count=row.transaction_count,
        ))

    return CategoryBreakdownResponse(
        items=items,
        total_expenses=total_expenses,
        period=today.strftime("%Y-%m"),
    )


# ---------------------------------------------------------------------------
# GET /dashboard/upcoming-payments
# ---------------------------------------------------------------------------

@router.get("/upcoming-payments", response_model=UpcomingPaymentsResponse)
async def get_upcoming_payments(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Collect upcoming payments from fixed entries, installments, and loans
    within the next N days. Returns them sorted by due date.
    """
    today = date.today()
    items: List[UpcomingPaymentItem] = []

    # ------------------------------------------------------------------
    # 1. Fixed income/expenses
    # ------------------------------------------------------------------
    fixed_result = await db.execute(
        select(FixedIncomeExpense)
        .options(selectinload(FixedIncomeExpense.category))
        .where(
            FixedIncomeExpense.user_id == current_user.id,
            FixedIncomeExpense.is_active == True,
        )
    )
    for entry in fixed_result.scalars().all():
        next_date = _next_occurrence(entry.day_of_month, today, days)
        if next_date is None:
            continue
        # Validate against start_date / end_date
        if entry.start_date > next_date:
            continue
        if entry.end_date is not None and entry.end_date < next_date:
            continue

        cat = entry.category
        items.append(UpcomingPaymentItem(
            id=str(entry.id),
            name=entry.name,
            amount=entry.amount,
            currency=entry.currency,
            source_type="fixed",
            type=entry.type,
            due_date=next_date,
            days_until_due=(next_date - today).days,
            category_name=cat.name if cat else None,
            category_color=cat.color if cat else None,
            installment_info=None,
        ))

    # ------------------------------------------------------------------
    # 2. Installments
    # ------------------------------------------------------------------
    installment_result = await db.execute(
        select(Installment)
        .options(selectinload(Installment.category))
        .where(
            Installment.user_id == current_user.id,
            Installment.payments_completed < Installment.number_of_payments,
        )
    )
    for entry in installment_result.scalars().all():
        next_date = _next_occurrence(entry.day_of_month, today, days)
        if next_date is None:
            continue

        cat = entry.category
        items.append(UpcomingPaymentItem(
            id=str(entry.id),
            name=entry.name,
            amount=entry.monthly_amount,
            currency=entry.currency,
            source_type="installment",
            type=entry.type,
            due_date=next_date,
            days_until_due=(next_date - today).days,
            category_name=cat.name if cat else None,
            category_color=cat.color if cat else None,
            installment_info=f"{entry.payments_completed + 1}/{entry.number_of_payments}",
        ))

    # ------------------------------------------------------------------
    # 3. Loans
    # ------------------------------------------------------------------
    loan_result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.category))
        .where(
            Loan.user_id == current_user.id,
            Loan.status == "active",
        )
    )
    for entry in loan_result.scalars().all():
        next_date = _next_occurrence(entry.day_of_month, today, days)
        if next_date is None:
            continue

        cat = entry.category
        items.append(UpcomingPaymentItem(
            id=str(entry.id),
            name=entry.name,
            amount=entry.monthly_payment,
            currency=entry.currency,
            source_type="loan",
            type="expense",
            due_date=next_date,
            days_until_due=(next_date - today).days,
            category_name=cat.name if cat else None,
            category_color=cat.color if cat else None,
            installment_info=f"{entry.payments_made + 1}/{entry.total_payments}",
        ))

    # Sort by due_date ascending
    items.sort(key=lambda x: x.due_date)

    total_upcoming_expenses = sum(
        item.amount for item in items if item.type == "expense"
    )
    total_upcoming_income = sum(
        item.amount for item in items if item.type == "income"
    )

    return UpcomingPaymentsResponse(
        items=items,
        total_upcoming_expenses=total_upcoming_expenses,
        total_upcoming_income=total_upcoming_income,
        days_ahead=days,
    )


# ---------------------------------------------------------------------------
# GET /dashboard/financial-health
# ---------------------------------------------------------------------------

@router.get("/financial-health", response_model=FinancialHealthResponse)
async def get_financial_health(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a financial health score (0-100) based on five weighted factors:
    savings ratio, debt ratio, balance trend, expense stability, emergency fund.
    """
    today = date.today()

    # ---- Date boundaries ----
    this_month_start = today.replace(day=1)
    this_month_end = today.replace(
        day=calendar.monthrange(today.year, today.month)[1]
    )
    prev_month_end = this_month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)

    # 3 months back for expense stability
    three_months_ago_start = (
        this_month_start - relativedelta(months=2)
    )  # includes current month

    # ---- Single query: transactions for the last 3 months ----
    all_tx = await _sum_transactions_range(
        db, current_user.id, three_months_ago_start, this_month_end,
    )

    # Bucket by (year, month) and type
    month_buckets: Dict[Tuple[int, int], Tuple[Decimal, Decimal]] = {}
    for tx_type, tx_date, tx_amount in all_tx:
        key = (tx_date.year, tx_date.month)
        income, expenses = month_buckets.get(key, (ZERO, ZERO))
        if tx_type == "income":
            income += tx_amount
        else:
            expenses += tx_amount
        month_buckets[key] = (income, expenses)

    this_key = (today.year, today.month)
    prev_key = (prev_month_start.year, prev_month_start.month)
    this_income, this_expenses = month_buckets.get(this_key, (ZERO, ZERO))
    prev_income, prev_expenses = month_buckets.get(prev_key, (ZERO, ZERO))

    # ---- Monthly loan + installment payments (single query each) ----
    loan_payment_result = await db.execute(
        select(func.coalesce(func.sum(Loan.monthly_payment), ZERO)).where(
            Loan.user_id == current_user.id,
            Loan.status == "active",
        )
    )
    total_loan_payments = loan_payment_result.scalar() or ZERO

    installment_payment_result = await db.execute(
        select(func.coalesce(func.sum(Installment.monthly_amount), ZERO)).where(
            Installment.user_id == current_user.id,
            Installment.type == "expense",
            Installment.payments_completed < Installment.number_of_payments,
        )
    )
    total_installment_payments = installment_payment_result.scalar() or ZERO

    total_debt_payments = total_loan_payments + total_installment_payments

    # ---- Current balance ----
    current_balance = await _get_current_balance(db, current_user.id)

    # =====================================================================
    # Factor 1: Savings Ratio (30% weight)
    # =====================================================================
    if this_income > ZERO:
        savings_ratio = (this_income - this_expenses) / this_income
        if savings_ratio >= Decimal("0.20"):
            savings_score = 100
        elif savings_ratio >= Decimal("0.10"):
            savings_score = 75
        elif savings_ratio >= ZERO:
            savings_score = 50
        else:
            savings_score = 0
    else:
        savings_score = 0 if this_expenses > ZERO else 50  # no data

    savings_desc = (
        f"Savings ratio: {((this_income - this_expenses) / this_income * 100).quantize(Decimal('0.1'))}%"
        if this_income > ZERO
        else "No income recorded this month"
    )

    # =====================================================================
    # Factor 2: Debt Ratio (25% weight)
    # =====================================================================
    if this_income > ZERO:
        debt_ratio = total_debt_payments / this_income
        if debt_ratio < Decimal("0.30"):
            debt_score = 100
        elif debt_ratio <= Decimal("0.50"):
            debt_score = 60
        else:
            debt_score = 20
    else:
        debt_score = 100 if total_debt_payments == ZERO else 0

    debt_desc = (
        f"Debt payments are {(total_debt_payments / this_income * 100).quantize(Decimal('0.1'))}% of income"
        if this_income > ZERO
        else ("No debt payments" if total_debt_payments == ZERO else "Debt payments with no income")
    )

    # =====================================================================
    # Factor 3: Balance Trend (20% weight)
    # =====================================================================
    this_net = this_income - this_expenses
    prev_net = prev_income - prev_expenses
    if this_net > prev_net:
        trend_score = 100
        trend_desc = "Balance trend is improving"
    elif this_net == prev_net:
        trend_score = 70
        trend_desc = "Balance trend is stable"
    else:
        trend_score = 30
        trend_desc = "Balance trend is declining"

    # =====================================================================
    # Factor 4: Expense Stability (15% weight)
    # =====================================================================
    # Collect monthly expense totals for last 3 months
    expense_values: List[Decimal] = []
    m_date = three_months_ago_start
    for _ in range(3):
        key = (m_date.year, m_date.month)
        _, exp = month_buckets.get(key, (ZERO, ZERO))
        expense_values.append(exp)
        m_date = m_date + relativedelta(months=1)

    if any(v > ZERO for v in expense_values):
        avg_exp = sum(expense_values) / len(expense_values)
        if avg_exp > ZERO:
            variance = sum((v - avg_exp) ** 2 for v in expense_values) / len(expense_values)
            std_dev = Decimal(str(math.sqrt(float(variance))))
            cv = std_dev / avg_exp  # coefficient of variation
            if cv < Decimal("0.15"):
                stability_score = 100
            elif cv < Decimal("0.30"):
                stability_score = 70
            else:
                stability_score = 30
            stability_desc = f"Expense variability (CV): {(cv * 100).quantize(Decimal('0.1'))}%"
        else:
            stability_score = 100
            stability_desc = "No expenses in the last 3 months"
    else:
        stability_score = 100
        stability_desc = "No expenses in the last 3 months"

    # =====================================================================
    # Factor 5: Emergency Fund (10% weight)
    # =====================================================================
    if this_expenses > ZERO:
        months_covered = current_balance / this_expenses
        if months_covered >= Decimal("3"):
            emergency_score = 100
        elif months_covered >= Decimal("1"):
            emergency_score = 60
        else:
            emergency_score = 20
        emergency_desc = f"Balance covers {months_covered.quantize(Decimal('0.1'))} months of expenses"
    else:
        emergency_score = 100 if current_balance > ZERO else 50
        emergency_desc = (
            "No expenses to compare against"
            if current_balance > ZERO
            else "No balance and no expenses data"
        )

    # =====================================================================
    # Compute weighted total
    # =====================================================================
    factors = [
        HealthFactor(
            name="savings_ratio",
            score=savings_score,
            weight=Decimal("0.30"),
            description=savings_desc,
        ),
        HealthFactor(
            name="debt_ratio",
            score=debt_score,
            weight=Decimal("0.25"),
            description=debt_desc,
        ),
        HealthFactor(
            name="balance_trend",
            score=trend_score,
            weight=Decimal("0.20"),
            description=trend_desc,
        ),
        HealthFactor(
            name="expense_stability",
            score=stability_score,
            weight=Decimal("0.15"),
            description=stability_desc,
        ),
        HealthFactor(
            name="emergency_fund",
            score=emergency_score,
            weight=Decimal("0.10"),
            description=emergency_desc,
        ),
    ]

    total_score = sum(
        Decimal(str(f.score)) * f.weight for f in factors
    )
    score = int(total_score.quantize(Decimal("1")))

    if score >= 80:
        grade = "excellent"
    elif score >= 60:
        grade = "good"
    elif score >= 40:
        grade = "fair"
    elif score >= 20:
        grade = "poor"
    else:
        grade = "critical"

    return FinancialHealthResponse(score=score, grade=grade, factors=factors)


# ---------------------------------------------------------------------------
# GET /dashboard/installments-summary
# ---------------------------------------------------------------------------

@router.get("/installments-summary", response_model=InstallmentsSummaryResponse)
async def get_installments_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a summary of all active installments (payments_completed < number_of_payments).
    """
    today = date.today()

    result = await db.execute(
        select(Installment).where(
            Installment.user_id == current_user.id,
            Installment.payments_completed < Installment.number_of_payments,
        )
    )
    installments = result.scalars().all()

    total_monthly_expense = ZERO
    total_monthly_income = ZERO
    total_remaining = ZERO
    items: List[InstallmentSummaryItem] = []

    for inst in installments:
        remaining_payments = inst.number_of_payments - inst.payments_completed
        remaining_amount = inst.monthly_amount * remaining_payments
        progress = (
            (Decimal(str(inst.payments_completed)) / Decimal(str(inst.number_of_payments)) * 100)
            .quantize(Decimal("0.01"))
            if inst.number_of_payments > 0
            else ZERO
        )

        next_date = _next_occurrence(inst.day_of_month, today, 365)

        if inst.type == "expense":
            total_monthly_expense += inst.monthly_amount
        else:
            total_monthly_income += inst.monthly_amount
        total_remaining += remaining_amount

        items.append(InstallmentSummaryItem(
            id=str(inst.id),
            name=inst.name,
            monthly_amount=inst.monthly_amount,
            currency=inst.currency,
            type=inst.type,
            payments_completed=inst.payments_completed,
            total_payments=inst.number_of_payments,
            progress_pct=progress,
            remaining_amount=remaining_amount,
            next_payment_date=next_date,
        ))

    return InstallmentsSummaryResponse(
        active_count=len(items),
        total_monthly_expense=total_monthly_expense,
        total_monthly_income=total_monthly_income,
        total_remaining=total_remaining,
        items=items,
    )


# ---------------------------------------------------------------------------
# GET /dashboard/loans-summary
# ---------------------------------------------------------------------------

@router.get("/loans-summary", response_model=LoansSummaryResponse)
async def get_loans_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a summary of all active loans.
    """
    today = date.today()

    result = await db.execute(
        select(Loan).where(
            Loan.user_id == current_user.id,
            Loan.status == "active",
        )
    )
    loans = result.scalars().all()

    total_monthly_payments = ZERO
    total_remaining_balance = ZERO
    total_original_amount = ZERO
    items: List[LoanSummaryItem] = []

    for loan in loans:
        progress = (
            (Decimal(str(loan.payments_made)) / Decimal(str(loan.total_payments)) * 100)
            .quantize(Decimal("0.01"))
            if loan.total_payments > 0
            else ZERO
        )

        next_date = _next_occurrence(loan.day_of_month, today, 365)

        total_monthly_payments += loan.monthly_payment
        total_remaining_balance += loan.remaining_balance
        total_original_amount += loan.original_amount

        items.append(LoanSummaryItem(
            id=str(loan.id),
            name=loan.name,
            monthly_payment=loan.monthly_payment,
            currency=loan.currency,
            original_amount=loan.original_amount,
            remaining_balance=loan.remaining_balance,
            payments_made=loan.payments_made,
            total_payments=loan.total_payments,
            progress_pct=progress,
            interest_rate=loan.interest_rate,
            next_payment_date=next_date,
        ))

    overall_progress = (
        ((total_original_amount - total_remaining_balance) / total_original_amount * 100)
        .quantize(Decimal("0.01"))
        if total_original_amount > ZERO
        else ZERO
    )

    return LoansSummaryResponse(
        active_count=len(items),
        total_monthly_payments=total_monthly_payments,
        total_remaining_balance=total_remaining_balance,
        total_original_amount=total_original_amount,
        overall_progress_pct=overall_progress,
        items=items,
    )


# ---------------------------------------------------------------------------
# GET /dashboard/top-expenses
# ---------------------------------------------------------------------------

@router.get("/top-expenses", response_model=TopExpensesResponse)
async def get_top_expenses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the top 5 individual expenses for the current month,
    with category details when available.
    """
    today = date.today()
    month_start = today.replace(day=1)
    month_end = today.replace(day=calendar.monthrange(today.year, today.month)[1])

    stmt = (
        select(
            Transaction.id,
            Transaction.description,
            Transaction.amount,
            Transaction.currency,
            Transaction.date,
            Category.name.label("cat_name"),
            Category.name_he.label("cat_name_he"),
            Category.color.label("cat_color"),
            Category.icon.label("cat_icon"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.date >= month_start,
            Transaction.date <= month_end,
        )
        .order_by(Transaction.amount.desc())
        .limit(5)
    )

    result = await db.execute(stmt)
    rows = result.all()

    items: List[TopExpenseItem] = []
    for row in rows:
        items.append(TopExpenseItem(
            id=str(row.id),
            description=row.description or "",
            amount=row.amount,
            currency=row.currency,
            date=row.date,
            category_name=row.cat_name,
            category_name_he=row.cat_name_he,
            category_color=row.cat_color,
            category_icon=row.cat_icon,
        ))

    return TopExpensesResponse(
        items=items,
        period=today.strftime("%Y-%m"),
    )
