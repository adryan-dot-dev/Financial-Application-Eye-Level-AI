from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.utils import strip_tags

MAX_AMOUNT = Decimal("9999999999999.99")

ALLOWED_NETWORKS = {"visa", "mastercard", "amex", "isracard", "diners"}

def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    if v is not None:
        if v > MAX_AMOUNT:
            raise ValueError(f"Amount exceeds maximum allowed value ({MAX_AMOUNT})")
        s = str(abs(v))
        digits_only = s.replace('.', '').lstrip('0') or '0'
        if len(digits_only) > max_digits:
            raise ValueError(f'Amount exceeds maximum precision ({max_digits} digits)')
    return v


class CreditCardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    last_four_digits: str = Field(..., min_length=4, max_length=4, pattern="^[0-9]{4}$")
    card_network: str = Field(...)
    issuer: str = Field(..., min_length=1, max_length=100)
    credit_limit: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    billing_day: int = Field(..., ge=1, le=28)
    currency: str = Field(default="ILS", min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    notes: Optional[str] = Field(None, max_length=1000)
    bank_account_id: Optional[UUID] = None

    @field_validator('credit_limit')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)

    @field_validator('card_network')
    @classmethod
    def validate_network(cls, v: str) -> str:
        if v not in ALLOWED_NETWORKS:
            raise ValueError(f"card_network must be one of: {', '.join(sorted(ALLOWED_NETWORKS))}")
        return v

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty or whitespace-only")
        return v

    @field_validator('issuer')
    @classmethod
    def sanitize_issuer(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Issuer must not be empty")
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


class CreditCardUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    issuer: Optional[str] = Field(None, min_length=1, max_length=100)
    credit_limit: Optional[Decimal] = Field(None, gt=0, max_digits=15, decimal_places=2)
    billing_day: Optional[int] = Field(None, ge=1, le=28)
    is_active: Optional[bool] = None
    color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    notes: Optional[str] = Field(None, max_length=1000)
    bank_account_id: Optional[UUID] = None

    @field_validator('credit_limit')
    @classmethod
    def validate_amount_precision(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return _validate_decimal_precision(v)
        return v


class CreditCardResponse(BaseModel):
    id: UUID
    name: str
    last_four_digits: str
    card_network: str
    issuer: str
    credit_limit: Decimal
    billing_day: int
    currency: str
    is_active: bool
    color: Optional[str] = None
    bank_account_id: Optional[UUID] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Computed fields
    total_monthly_charges: Decimal = Decimal("0")
    utilization_amount: Decimal = Decimal("0")
    utilization_percentage: float = 0.0
    available_credit: Decimal = Decimal("0")
    linked_installments_count: int = 0
    linked_subscriptions_count: int = 0
    linked_fixed_count: int = 0
    linked_transactions_count: int = 0

    model_config = {"from_attributes": True}


class CreditCardSummaryResponse(BaseModel):
    cards: List[CreditCardResponse]
    total_credit_limit: Decimal
    total_utilization: Decimal
    total_available: Decimal
    average_utilization_pct: float


class CardChargeItem(BaseModel):
    source_type: str  # 'installment', 'subscription', 'fixed', 'transaction'
    source_id: UUID
    name: str
    amount: Decimal
    currency: str
    billing_cycle: Optional[str] = None


class CardMonthlyBillingResponse(BaseModel):
    card: CreditCardResponse
    billing_date: date
    charges: List[CardChargeItem]
    total_charge: Decimal
    remaining_after_charge: Decimal
