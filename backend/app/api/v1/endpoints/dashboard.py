from __future__ import annotations

import calendar
import logging
import math
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, DataContext
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
    SubscriptionSummaryItem,
    SubscriptionsSummaryResponse,
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
    Settings,
    Subscription,
    Transaction,
    User,
)
from app.db.session import get_db
from app.services.alert_service import generate_alerts
from app.core.cache import set_cache_headers
from app.services.financial_aggregator import (
    get_aggregated_totals,
    get_aggregated_transactions_range,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

ZERO = Decimal("0")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_current_balance(db: AsyncSession, ctx: DataContext) -> Decimal:
    """Return the current bank balance for this data context, or 0 if none set."""
    result = await db.execute(
        select(func.coalesce(func.sum(BankBalance.balance), ZERO)).where(
            ctx.ownership_filter(BankBalance),
            BankBalance.is_current == True,
        )
    )
    val = result.scalar_one_or_none()
    return val if val is not None else ZERO


async def _get_user_base_currency(db: AsyncSession, user_id: UUID) -> str:
    """Return the user's preferred currency from settings, defaulting to ILS."""
    result = await db.execute(
        select(Settings.currency).where(Settings.user_id == user_id)
    )
    currency = result.scalar_one_or_none()
    return currency if currency else "ILS"


async def _sum_transactions(
    db: AsyncSession,
    ctx: DataContext,
    start: date,
    end: date,
    base_currency: Optional[str] = None,
) -> tuple:
    """Return (total_income, total_expenses) for the given date range.

    Includes actual transactions + projected recurring items (fixed entries,
    installments, loans), deduplicated against already-materialized transactions.

    If *base_currency* is provided, amounts are converted before summing.
    """
    return await get_aggregated_totals(db, ctx.user_id, start, end, base_currency=base_currency, ctx=ctx)


async def _sum_transactions_range(
    db: AsyncSession,
    ctx: DataContext,
    start: date,
    end: date,
    base_currency: Optional[str] = None,
) -> List[Tuple]:
    """Fetch all (type, date, amount) rows in a date range.

    Includes actual transactions + projected recurring items (fixed entries,
    installments, loans), deduplicated against already-materialized transactions.

    If *base_currency* is provided, amounts are converted before returning.
    """
    return await get_aggregated_transactions_range(db, ctx.user_id, start, end, base_currency=base_currency, ctx=ctx)


def _pct_change(current: Decimal, previous: Decimal) -> Decimal:
    """Calculate percentage change.  Returns 0 when previous is 0."""
    if previous == ZERO:
        if current == ZERO:
            return ZERO
        return Decimal("100")  # went from 0 to something -> 100 %
    return ((current - previous) / abs(previous) * 100).quantize(Decimal("0.01"))


async def _active_alerts_count(db: AsyncSession, ctx: DataContext) -> int:
    result = await db.execute(
        select(func.count(Alert.id)).where(
            ctx.ownership_filter(Alert),
            Alert.is_dismissed == False,
        )
    )
    return result.scalar() or 0


# ---------------------------------------------------------------------------
# GET /dashboard/summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    response: Response,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    set_cache_headers(response, max_age=60)
    """
    Aggregate dashboard KPI data:
    - current balance
    - this month income / expenses / net
    - trends vs last month (percentage change)

    All amounts are converted to the user's preferred currency (from settings).
    The ``base_currency`` field in the response indicates which currency the
    totals are denominated in.

    Accepts optional ``start_date`` and ``end_date`` query parameters to
    override the default "current month" range.  When a custom range is
    provided, the "previous period" used for trend calculations is an
    equal-length period immediately preceding ``start_date``.

    When in organization context, aggregates data across all org members.
    """
    today = date.today()

    # Determine the user's preferred (base) currency
    base_currency = await _get_user_base_currency(db, current_user.id)

    # Use provided date range or default to current month
    if start_date and end_date:
        if start_date > end_date:
            raise HTTPException(status_code=422, detail="start_date must be <= end_date")
        this_month_start = start_date
        this_month_end = end_date
        # Previous period of equal length
        period_days = (end_date - start_date).days
        prev_month_end = start_date - timedelta(days=1)
        prev_month_start = prev_month_end - timedelta(days=period_days)
    else:
        # Default: current month
        this_month_start = today.replace(day=1)
        this_month_end = today.replace(
            day=calendar.monthrange(today.year, today.month)[1]
        )
        prev_month_end = this_month_start - timedelta(days=1)
        prev_month_start = prev_month_end.replace(day=1)

    # Aggregate balance and transactions using data context
    current_balance = await _get_current_balance(db, ctx)
    this_income, this_expenses = await _sum_transactions(
        db, ctx, this_month_start, this_month_end,
        base_currency=base_currency,
    )
    prev_income, prev_expenses = await _sum_transactions(
        db, ctx, prev_month_start, prev_month_end,
        base_currency=base_currency,
    )

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
        base_currency=base_currency,
    )


# ---------------------------------------------------------------------------
# GET /dashboard/weekly   - last 12 weeks
# ---------------------------------------------------------------------------

@router.get("/weekly", response_model=List[DashboardPeriodData])
async def get_dashboard_weekly(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Return income / expenses / net / running balance for the last 12 weeks."""
    today = date.today()
    current_balance = await _get_current_balance(db, ctx)

    # ORANGE-10: Read week_start_day from user settings (0=Sunday, 1=Monday, ...)
    settings_result = await db.execute(
        select(Settings).where(Settings.user_id == current_user.id)
    )
    user_settings = settings_result.scalar_one_or_none()
    week_start_day = user_settings.week_start_day if user_settings else 0

    # Align to start of week based on user preference
    # Python weekday(): Monday=0 .. Sunday=6; our setting: 0=Sunday,1=Monday..6=Saturday
    # Convert our setting to Python weekday: (week_start_day - 1) % 7
    py_week_start = (week_start_day - 1) % 7  # 0=Sun->6, 1=Mon->0, etc.
    days_since_start = (today.weekday() - py_week_start) % 7
    current_week_start = today - timedelta(days=days_since_start)
    first_week_start = current_week_start - timedelta(weeks=11)
    last_week_end = current_week_start + timedelta(days=6)

    # Single query: fetch all transactions in the full 12-week range
    all_tx = await _sum_transactions_range(
        db, ctx, first_week_start, last_week_end,
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
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Return income / expenses / net / running balance for the last 12 months."""
    today = date.today()
    current_balance = await _get_current_balance(db, ctx)

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
        db, ctx, overall_start, overall_end,
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
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Return income / expenses / net / running balance for the last 8 quarters."""
    today = date.today()
    current_balance = await _get_current_balance(db, ctx)

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
        db, ctx, overall_start, overall_end,
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
    ctx: DataContext = Depends(get_data_context),
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
            ctx.ownership_filter(Transaction),
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
    ctx: DataContext = Depends(get_data_context),
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
            ctx.ownership_filter(FixedIncomeExpense),
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
            ctx.ownership_filter(Installment),
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
            ctx.ownership_filter(Loan),
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

    # ------------------------------------------------------------------
    # 4. Subscriptions
    # ------------------------------------------------------------------
    end_date = today + timedelta(days=days)
    subscription_result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.category))
        .where(
            ctx.ownership_filter(Subscription),
            Subscription.is_active == True,
            Subscription.next_renewal_date >= today,
            Subscription.next_renewal_date <= end_date,
        )
    )
    for entry in subscription_result.scalars().all():
        cat = entry.category
        items.append(UpcomingPaymentItem(
            id=str(entry.id),
            name=entry.name,
            amount=entry.amount,
            currency=entry.currency,
            source_type="subscription",
            type="expense",
            due_date=entry.next_renewal_date,
            days_until_due=(entry.next_renewal_date - today).days,
            category_name=cat.name if cat else None,
            category_color=cat.color if cat else None,
            installment_info=entry.billing_cycle,
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
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a financial health score (0-100) based on five weighted factors:
    savings ratio, debt ratio, balance trend, expense stability, emergency fund.

    When in organization context, aggregates data across all org members.
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

    # ---- Aggregate transactions using data context ----
    month_buckets: Dict[Tuple[int, int], Tuple[Decimal, Decimal]] = {}
    all_tx = await _sum_transactions_range(
        db, ctx, three_months_ago_start, this_month_end,
    )
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

    # ---- Monthly loan + installment payments using data context ----
    loan_payment_result = await db.execute(
        select(func.coalesce(func.sum(Loan.monthly_payment), ZERO)).where(
            ctx.ownership_filter(Loan),
            Loan.status == "active",
        )
    )
    total_loan_payments = loan_payment_result.scalar() or ZERO

    installment_payment_result = await db.execute(
        select(func.coalesce(func.sum(Installment.monthly_amount), ZERO)).where(
            ctx.ownership_filter(Installment),
            Installment.type == "expense",
            Installment.payments_completed < Installment.number_of_payments,
        )
    )
    total_installment_payments = installment_payment_result.scalar() or ZERO

    total_debt_payments = total_loan_payments + total_installment_payments

    # ---- Current balance using data context ----
    current_balance = await _get_current_balance(db, ctx)

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

    if this_income > ZERO:
        _savings_pct = ((this_income - this_expenses) / this_income * 100).quantize(Decimal("0.1"))
        savings_desc = f"Savings ratio: {_savings_pct}%"
    else:
        savings_desc = "No income recorded this month"

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

    if this_income > ZERO:
        _debt_pct = (total_debt_payments / this_income * 100).quantize(Decimal("0.1"))
        debt_desc = f"Debt payments are {_debt_pct}% of income"
    elif total_debt_payments == ZERO:
        debt_desc = "No debt payments"
    else:
        debt_desc = "Debt payments with no income"

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
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a summary of all active installments (payments_completed < number_of_payments).
    """
    today = date.today()

    result = await db.execute(
        select(Installment).where(
            ctx.ownership_filter(Installment),
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
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a summary of all active loans.
    """
    today = date.today()

    result = await db.execute(
        select(Loan).where(
            ctx.ownership_filter(Loan),
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
    ctx: DataContext = Depends(get_data_context),
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
            ctx.ownership_filter(Transaction),
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


# ---------------------------------------------------------------------------
# Billing-cycle → monthly multiplier map
# ---------------------------------------------------------------------------

_CYCLE_TO_MONTHLY: Dict[str, Decimal] = {
    "monthly": Decimal("1"),
    "quarterly": Decimal("1") / Decimal("3"),
    "semi_annual": Decimal("1") / Decimal("6"),
    "annual": Decimal("1") / Decimal("12"),
}


def _monthly_equivalent(amount: Decimal, billing_cycle: str) -> Decimal:
    """Normalize a subscription amount to a monthly cost."""
    multiplier = _CYCLE_TO_MONTHLY.get(billing_cycle, Decimal("1"))
    return (amount * multiplier).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# GET /dashboard/subscriptions-summary
# ---------------------------------------------------------------------------

@router.get("/subscriptions-summary", response_model=SubscriptionsSummaryResponse)
async def get_subscriptions_summary(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a summary of subscriptions:
    - total monthly cost (all active subs normalized to monthly)
    - upcoming renewals in the next 7 days
    - count of active subscriptions
    """
    today = date.today()
    seven_days = today + timedelta(days=7)

    # Fetch all active subscriptions
    result = await db.execute(
        select(Subscription).where(
            ctx.ownership_filter(Subscription),
            Subscription.is_active == True,
        )
    )
    subscriptions = result.scalars().all()

    total_monthly_cost = ZERO
    upcoming_renewals_count = 0
    items: List[SubscriptionSummaryItem] = []

    for sub in subscriptions:
        monthly_eq = _monthly_equivalent(sub.amount, sub.billing_cycle)
        total_monthly_cost += monthly_eq

        if sub.next_renewal_date and today <= sub.next_renewal_date <= seven_days:
            upcoming_renewals_count += 1

        items.append(SubscriptionSummaryItem(
            id=str(sub.id),
            name=sub.name,
            amount=sub.amount,
            currency=sub.currency,
            billing_cycle=sub.billing_cycle,
            monthly_equivalent=monthly_eq,
            next_renewal_date=sub.next_renewal_date,
            provider=sub.provider,
            is_active=sub.is_active,
        ))

    return SubscriptionsSummaryResponse(
        active_subscriptions_count=len(subscriptions),
        total_monthly_subscription_cost=total_monthly_cost,
        upcoming_renewals_count=upcoming_renewals_count,
        items=items,
    )
