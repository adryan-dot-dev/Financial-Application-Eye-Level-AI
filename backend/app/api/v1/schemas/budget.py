from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

MAX_AMOUNT = Decimal("9999999999999.99")

ALLOWED_PERIOD_TYPES = {"monthly", "quarterly", "annual"}

def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    if v is not None:
        if v > MAX_AMOUNT:
            raise ValueError(f"Amount exceeds maximum allowed value ({MAX_AMOUNT})")
        s = str(abs(v))
        digits_only = s.replace('.', '').lstrip('0') or '0'
        if len(digits_only) > max_digits:
            raise ValueError(f'Amount exceeds maximum precision ({max_digits} digits)')
    return v


class BudgetCreate(BaseModel):
    category_id: UUID
    period_type: str = Field(...)
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    start_date: date
    end_date: Optional[date] = None
    alert_at_percentage: int = Field(default=80, ge=1, le=100)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)

    @field_validator('period_type')
    @classmethod
    def validate_period_type(cls, v: str) -> str:
        if v not in ALLOWED_PERIOD_TYPES:
            raise ValueError(f"period_type must be one of: {', '.join(sorted(ALLOWED_PERIOD_TYPES))}")
        return v


class BudgetUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0, max_digits=15, decimal_places=2)
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    alert_at_percentage: Optional[int] = Field(None, ge=1, le=100)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return _validate_decimal_precision(v)
        return v


class BudgetResponse(BaseModel):
    id: UUID
    user_id: UUID
    organization_id: Optional[UUID] = None
    category_id: UUID
    period_type: str
    amount: Decimal
    currency: str
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    alert_at_percentage: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Computed fields
    actual_amount: Decimal = Decimal("0")
    remaining: Decimal = Decimal("0")
    usage_percentage: float = 0.0
    is_over_budget: bool = False
    forecast_end_of_period: Decimal = Decimal("0")
    category_name: Optional[str] = None

    model_config = {"from_attributes": True}


class BudgetSummaryResponse(BaseModel):
    budgets: List[BudgetResponse]
    total_budgeted: Decimal
    total_actual: Decimal
    over_budget_count: int
