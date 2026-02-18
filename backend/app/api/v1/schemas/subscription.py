from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.utils import strip_tags


MAX_AMOUNT = Decimal("9999999999999.99")

ALLOWED_BILLING_CYCLES = {"monthly", "quarterly", "semi_annual", "annual"}


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


class SubscriptionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    category_id: Optional[UUID] = None
    billing_cycle: str = Field(...)
    next_renewal_date: date
    last_renewal_date: Optional[date] = None
    auto_renew: bool = True
    provider: Optional[str] = Field(None, max_length=200)
    provider_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    credit_card_id: Optional[UUID] = None

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)

    @field_validator('billing_cycle')
    @classmethod
    def validate_billing_cycle(cls, v: str) -> str:
        if v not in ALLOWED_BILLING_CYCLES:
            raise ValueError(
                f"billing_cycle must be one of: {', '.join(sorted(ALLOWED_BILLING_CYCLES))}"
            )
        return v

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty or whitespace-only")
        return v

    @field_validator('provider')
    @classmethod
    def sanitize_provider(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = strip_tags(v)
            v = v.strip()
            if not v:
                return None
        return v

    @field_validator('notes')
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = strip_tags(v)
            v = v.strip()
            if not v:
                return None
        return v


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(None, gt=0, max_digits=15, decimal_places=2)
    currency: Optional[str] = Field(None, min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    category_id: Optional[UUID] = None
    billing_cycle: Optional[str] = None
    next_renewal_date: Optional[date] = None
    last_renewal_date: Optional[date] = None
    auto_renew: Optional[bool] = None
    provider: Optional[str] = Field(None, max_length=200)
    provider_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    credit_card_id: Optional[UUID] = None

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return _validate_decimal_precision(v)
        return v

    @field_validator('billing_cycle')
    @classmethod
    def validate_billing_cycle(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_BILLING_CYCLES:
            raise ValueError(
                f"billing_cycle must be one of: {', '.join(sorted(ALLOWED_BILLING_CYCLES))}"
            )
        return v


class SubscriptionResponse(BaseModel):
    id: UUID
    name: str
    amount: Decimal
    currency: str
    original_amount: Optional[Decimal] = None
    original_currency: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    category_id: Optional[UUID]
    billing_cycle: str
    next_renewal_date: date
    last_renewal_date: Optional[date]
    auto_renew: bool
    is_active: bool
    paused_at: Optional[datetime] = None
    resumed_at: Optional[datetime] = None
    provider: Optional[str]
    provider_url: Optional[str]
    notes: Optional[str]
    credit_card_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
