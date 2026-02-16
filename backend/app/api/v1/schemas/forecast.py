from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class ForecastMonthItem(BaseModel):
    month: date
    opening_balance: Decimal
    fixed_income: Decimal
    fixed_expenses: Decimal
    installment_income: Decimal
    installment_expenses: Decimal
    loan_payments: Decimal
    expected_income: Decimal
    one_time_income: Decimal
    one_time_expenses: Decimal
    total_income: Decimal
    total_expenses: Decimal
    net_change: Decimal
    closing_balance: Decimal


class ForecastResponse(BaseModel):
    current_balance: Decimal
    months: List[ForecastMonthItem]
    has_negative_months: bool
    first_negative_month: Optional[date] = None


class ForecastWeekItem(BaseModel):
    week_start: date
    week_end: date
    income: Decimal
    expenses: Decimal
    net_change: Decimal
    running_balance: Decimal


class ForecastWeeklyResponse(BaseModel):
    current_balance: Decimal
    weeks: List[ForecastWeekItem]


class ForecastSummary(BaseModel):
    current_balance: Decimal
    forecast_months: int
    total_expected_income: Decimal
    total_expected_expenses: Decimal
    net_projected: Decimal
    end_balance: Decimal
    has_negative_months: bool
    alerts_count: int
