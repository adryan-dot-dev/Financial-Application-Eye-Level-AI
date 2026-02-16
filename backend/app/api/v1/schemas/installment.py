from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
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


class InstallmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    total_amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    number_of_payments: int = Field(..., ge=1, le=360)
    currency: str = Field(default="ILS", max_length=3)
    type: str = Field(..., pattern="^(income|expense)$")
    category_id: Optional[UUID] = None
    start_date: date
    day_of_month: int = Field(..., ge=1, le=31)
    description: Optional[str] = Field(None, max_length=1000)

    @field_validator('total_amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class InstallmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category_id: Optional[UUID] = None
    description: Optional[str] = Field(None, max_length=1000)


class InstallmentResponse(BaseModel):
    id: UUID
    name: str
    total_amount: Decimal
    monthly_amount: Decimal
    currency: str
    number_of_payments: int
    type: str
    category_id: Optional[UUID] = None
    start_date: date
    day_of_month: int
    payments_completed: int
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Computed fields - auto-synced with time
    status: str = "active"  # "pending", "active", "completed", "overdue"
    expected_payments_by_now: int = 0
    is_on_track: bool = True
    next_payment_date: Optional[date] = None
    end_date: Optional[date] = None
    remaining_amount: Decimal = Decimal("0")
    progress_percentage: float = 0.0

    model_config = {"from_attributes": True}


class PaymentScheduleItem(BaseModel):
    payment_number: int
    date: date
    amount: Decimal
    status: str  # 'completed', 'upcoming', 'future'


class InstallmentDetailResponse(BaseModel):
    installment: InstallmentResponse
    schedule: List[PaymentScheduleItem]
