from __future__ import annotations

from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DataContext
from app.db.models.org_budget import OrgBudget
from app.db.models.transaction import Transaction


def _get_period_dates(budget: OrgBudget) -> tuple:
    """Determine the current period start and end dates for a budget."""
    today = date.today()
    start = budget.start_date

    if budget.period_type == "monthly":
        # Find which month we're in
        while start + relativedelta(months=1) <= today:
            start = start + relativedelta(months=1)
        period_end = start + relativedelta(months=1) - relativedelta(days=1)
    elif budget.period_type == "quarterly":
        while start + relativedelta(months=3) <= today:
            start = start + relativedelta(months=3)
        period_end = start + relativedelta(months=3) - relativedelta(days=1)
    else:  # annual
        while start + relativedelta(years=1) <= today:
            start = start + relativedelta(years=1)
        period_end = start + relativedelta(years=1) - relativedelta(days=1)

    # Respect end_date if set
    if budget.end_date and period_end > budget.end_date:
        period_end = budget.end_date

    return start, period_end


async def compute_budget_actuals(
    db: AsyncSession, budget: OrgBudget, ctx: DataContext
) -> dict:
    """Compute actual spending against a budget for the current period."""
    period_start, period_end = _get_period_dates(budget)
    today = date.today()

    # Sum expenses for this category in the current period
    result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            ctx.ownership_filter(Transaction),
            Transaction.category_id == budget.category_id,
            Transaction.type == "expense",
            Transaction.date >= period_start,
            Transaction.date <= period_end,
        )
    )
    actual = Decimal(str(result.scalar()))
    budget_amount = Decimal(str(budget.amount))
    remaining = budget_amount - actual
    pct = float((actual / budget_amount) * 100) if budget_amount > 0 else 0.0
    is_over = actual > budget_amount

    # Forecast to end of period based on daily spending rate
    days_elapsed = max((today - period_start).days, 1)
    total_days = max((period_end - period_start).days, 1)
    daily_rate = actual / Decimal(str(days_elapsed))
    forecast_eop = daily_rate * Decimal(str(total_days))

    return {
        "actual_amount": actual,
        "remaining": remaining,
        "usage_percentage": round(pct, 2),
        "is_over_budget": is_over,
        "forecast_end_of_period": forecast_eop.quantize(Decimal("0.01")),
    }
