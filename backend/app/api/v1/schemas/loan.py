from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    """Validate that a Decimal value does not exceed max_digits total digits."""
    if v is not None:
        s = str(abs(v))
        digits_only = s.replace('.', '').lstrip('0') or '0'
        if len(digits_only) > max_digits:
            raise ValueError(f'Amount exceeds maximum precision ({max_digits} digits)')
    return v


class LoanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    original_amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    monthly_payment: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", max_length=3)
    interest_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, max_digits=5, decimal_places=2)
    category_id: UUID | None = None
    start_date: date
    day_of_month: int = Field(..., ge=1, le=31)
    total_payments: int = Field(..., ge=1, le=600)
    description: str | None = Field(None, max_length=1000)

    @field_validator('original_amount', 'monthly_payment')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class LoanUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    monthly_payment: Decimal | None = Field(None, gt=0, max_digits=15, decimal_places=2)
    category_id: UUID | None = None
    status: str | None = Field(None, pattern="^(active|completed|paused)$")
    description: str | None = Field(None, max_length=1000)

    @field_validator('monthly_payment')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class LoanResponse(BaseModel):
    id: UUID
    name: str
    original_amount: Decimal
    monthly_payment: Decimal
    currency: str
    interest_rate: Decimal
    category_id: UUID | None
    start_date: date
    day_of_month: int
    total_payments: int
    payments_made: int
    remaining_balance: Decimal
    status: str
    description: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class LoanPaymentRecord(BaseModel):
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class AmortizationItem(BaseModel):
    payment_number: int
    date: date
    payment_amount: Decimal
    principal: Decimal
    interest: Decimal
    remaining_balance: Decimal
    status: str  # 'paid', 'upcoming', 'future'


class LoanDetailResponse(BaseModel):
    loan: LoanResponse
    amortization: List[AmortizationItem]
