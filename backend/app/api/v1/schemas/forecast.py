from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


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


# --- What-If ---

class WhatIfParams(BaseModel):
    added_income: Decimal = Field(default=Decimal("0"), ge=0)
    added_expense: Decimal = Field(default=Decimal("0"), ge=0)
    balance_adjustment: Decimal = Decimal("0")


class WhatIfRequest(BaseModel):
    params: WhatIfParams
    months: int = Field(default=6, ge=1, le=24)


class WhatIfResponse(BaseModel):
    current_balance: Decimal
    adjusted_balance: Decimal
    months: List[ForecastMonthItem]
    has_negative_months: bool
    first_negative_month: Optional[date] = None
    params: WhatIfParams


# --- Scenarios ---

class ScenarioCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    params: WhatIfParams
    months: int = Field(default=6, ge=1, le=24)


class ScenarioUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    params: Optional[WhatIfParams] = None
    months: Optional[int] = Field(None, ge=1, le=24)


class ScenarioResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    params: WhatIfParams
    months: int
    is_baseline: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Compare ---

class ScenarioRef(BaseModel):
    """Reference to a scenario: either an ID or inline params or 'base'."""
    scenario_id: Optional[UUID] = None
    inline_params: Optional[WhatIfParams] = None
    is_baseline: bool = False


class CompareRequest(BaseModel):
    scenario_a: ScenarioRef
    scenario_b: ScenarioRef
    months: int = Field(default=6, ge=1, le=24)


class CompareMonthDelta(BaseModel):
    month: date
    closing_a: Decimal
    closing_b: Decimal
    delta: Decimal


class CompareResponse(BaseModel):
    scenario_a: ForecastResponse
    scenario_b: ForecastResponse
    deltas: List[CompareMonthDelta]
