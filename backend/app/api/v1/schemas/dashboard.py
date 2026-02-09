from __future__ import annotations

from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    current_balance: Decimal
    monthly_income: Decimal
    monthly_expenses: Decimal
    net_cashflow: Decimal
    balance_trend: Decimal
    income_trend: Decimal
    expense_trend: Decimal


class DashboardPeriodData(BaseModel):
    period: str
    income: Decimal
    expenses: Decimal
    net: Decimal
    balance: Decimal
