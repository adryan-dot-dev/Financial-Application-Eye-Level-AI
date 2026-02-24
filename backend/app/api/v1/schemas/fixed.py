from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

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


class FixedCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    type: str = Field(..., pattern="^(income|expense)$")
    category_id: Optional[UUID] = None
    day_of_month: int = Field(..., ge=1, le=31)
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = Field(None, max_length=1000)
    payment_method: str = Field(default="cash", pattern="^(cash|credit_card|bank_transfer)$")
    credit_card_id: Optional[UUID] = None
    bank_account_id: Optional[UUID] = None

    @field_validator('amount')
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

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be >= start_date")
        return self


class FixedUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(None, gt=0, max_digits=15, decimal_places=2)
    currency: Optional[str] = Field(None, min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    type: Optional[str] = Field(None, pattern="^(income|expense)$")
    category_id: Optional[UUID] = None
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = Field(None, max_length=1000)
    payment_method: Optional[str] = Field(None, pattern="^(cash|credit_card|bank_transfer)$")
    credit_card_id: Optional[UUID] = None
    bank_account_id: Optional[UUID] = None

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return _validate_decimal_precision(v)
        return v


class FixedResponse(BaseModel):
    id: UUID
    name: str
    amount: Decimal
    currency: str
    original_amount: Optional[Decimal] = None
    original_currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    type: str
    category_id: Optional[UUID]
    day_of_month: int
    start_date: date
    end_date: Optional[date]
    is_active: bool
    description: Optional[str]
    payment_method: str = "cash"
    credit_card_id: Optional[UUID] = None
    bank_account_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
