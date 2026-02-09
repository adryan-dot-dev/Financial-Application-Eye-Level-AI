from __future__ import annotations

import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import List
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.dashboard import DashboardPeriodData, DashboardSummary
from app.db.models import Alert, BankBalance, Transaction, User
from app.db.session import get_db

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


def _pct_change(current: Decimal, previous: Decimal) -> Decimal:
    """Calculate percentage change.  Returns 0 when previous is 0."""
    if previous == ZERO:
        if current == ZERO:
            return ZERO
        return Decimal("100")  # went from 0 to something → 100 %
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

    this_income, this_expenses = await _sum_transactions(
        db, current_user.id, this_month_start, this_month_end,
    )
    prev_income, prev_expenses = await _sum_transactions(
        db, current_user.id, prev_month_start, prev_month_end,
    )

    net_cashflow = this_income - this_expenses
    prev_net = prev_income - prev_expenses

    balance_trend = _pct_change(net_cashflow, prev_net)
    income_trend = _pct_change(this_income, prev_income)
    expense_trend = _pct_change(this_expenses, prev_expenses)

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
# GET /dashboard/weekly   – last 12 weeks
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

    # First, get all transactions in the full range to compute running balance
    # We need the balance at the start of the 12-week window.
    # Approach: current_balance is "now", so we work backwards from the last
    # week to compute the running balance going forward.

    weeks: List[DashboardPeriodData] = []

    # Gather per-week aggregates
    week_data = []
    for i in range(12):
        ws = first_week_start + timedelta(weeks=i)
        we = ws + timedelta(days=6)
        income, expenses = await _sum_transactions(
            db, current_user.id, ws, we,
        )
        net = income - expenses
        week_data.append((ws, we, income, expenses, net))

    # Calculate the total net across all 12 weeks so we can derive the
    # opening balance at the start of the window from the current balance.
    total_net = sum(wd[4] for wd in week_data)

    # Sum of transactions from end of last week to today that are NOT
    # within the 12-week window.  Because the current balance is "now",
    # we assume running balance at end of last period equals current balance
    # minus the net of periods after that period.
    # Simplification: running balance at end of week 12 == current_balance
    # So opening balance = current_balance - total_net of all 12 weeks
    running = current_balance - total_net

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
# GET /dashboard/monthly  – last 12 months
# ---------------------------------------------------------------------------

@router.get("/monthly", response_model=List[DashboardPeriodData])
async def get_dashboard_monthly(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return income / expenses / net / running balance for the last 12 months."""
    today = date.today()
    current_balance = await _get_current_balance(db, current_user.id)

    month_data = []
    for i in range(11, -1, -1):
        # i=11 is 11 months ago, i=0 is this month
        m_date = today.replace(day=1) - relativedelta(months=i)
        m_start = m_date
        m_end = m_date.replace(
            day=calendar.monthrange(m_date.year, m_date.month)[1],
        )
        income, expenses = await _sum_transactions(
            db, current_user.id, m_start, m_end,
        )
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
# GET /dashboard/quarterly  – last 8 quarters
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

    quarter_data = []
    for i in range(7, -1, -1):
        # i=7 is 7 quarters ago, i=0 is current quarter
        q_start = current_q_start - relativedelta(months=i * 3)
        q_end_month = q_start + relativedelta(months=2)
        q_end = q_end_month.replace(
            day=calendar.monthrange(q_end_month.year, q_end_month.month)[1],
        )
        income, expenses = await _sum_transactions(
            db, current_user.id, q_start, q_end,
        )
        net = income - expenses
        # Label like "2025-Q1"
        q_num = (q_start.month - 1) // 3 + 1
        label = f"{q_start.year}-Q{q_num}"
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
