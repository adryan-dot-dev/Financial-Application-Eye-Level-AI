from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.utils import strip_tags


MAX_AMOUNT = Decimal("9999999999999.99")


def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    """Validate that a Decimal value does not exceed max_digits total digits."""
    if v is not None:
        if v > MAX_AMOUNT:
            raise ValueError(f"Amount exceeds maximum allowed value ({MAX_AMOUNT})")
        s = str(abs(v))
        digits_only = s.replace('.', '').lstrip('0') or '0'
        if len(digits_only) > max_digits:
            raise ValueError(f'Amount exceeds maximum precision ({max_digits} digits)')
    return v


class LoanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    original_amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    monthly_payment: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    interest_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, max_digits=5, decimal_places=2)
    category_id: Optional[UUID] = None
    start_date: date
    day_of_month: int = Field(..., ge=1, le=31)
    total_payments: int = Field(..., ge=1, le=600)
    description: Optional[str] = Field(None, max_length=1000)
    first_payment_made: bool = False
    bank_account_id: Optional[UUID] = None
    # credit_card_id: not applicable for loans -- Loan model has no credit_card_id column (BUG-03 checked 2026-02-24)

    @field_validator('original_amount', 'monthly_payment')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty or whitespace-only")
        return v

    @field_validator('description')
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = strip_tags(v)
            v = v.strip()
            if not v:
                return None
        return v


class LoanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    monthly_payment: Optional[Decimal] = Field(None, gt=0, max_digits=15, decimal_places=2)
    category_id: Optional[UUID] = None
    status: Optional[str] = Field(None, pattern="^(active|completed|paused)$")
    description: Optional[str] = Field(None, max_length=1000)
    bank_account_id: Optional[UUID] = None

    @field_validator('monthly_payment')
    @classmethod
    def validate_amount_precision(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return _validate_decimal_precision(v)
        return v


class LoanResponse(BaseModel):
    id: UUID
    name: str
    original_amount: Decimal
    monthly_payment: Decimal
    currency: str
    original_currency_amount: Optional[Decimal] = None
    original_currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    interest_rate: Decimal
    category_id: Optional[UUID]
    start_date: date
    day_of_month: int
    total_payments: int
    payments_made: int
    remaining_balance: Decimal
    status: str
    description: Optional[str]
    bank_account_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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
    status: str  # 'paid', 'overdue', 'due', 'future'


class LoanDetailResponse(BaseModel):
    loan: LoanResponse
    amortization: List[AmortizationItem]
