from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


MAX_AMOUNT = Decimal("9999999999999.99")
MIN_AMOUNT = Decimal("-9999999999999.99")


def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    """Validate that a Decimal value does not exceed max_digits total digits."""
    if v is not None:
        if v > MAX_AMOUNT or v < MIN_AMOUNT:
            raise ValueError(f"Balance exceeds allowed range ({MIN_AMOUNT} to {MAX_AMOUNT})")
        s = str(abs(v))
        digits_only = s.replace('.', '').lstrip('0') or '0'
        if len(digits_only) > max_digits:
            raise ValueError(f'Balance exceeds maximum precision ({max_digits} digits)')
    return v


class BalanceCreate(BaseModel):
    balance: Decimal = Field(..., max_digits=15, decimal_places=2)
    effective_date: date
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator('balance')
    @classmethod
    def validate_balance_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class BalanceUpdate(BaseModel):
    balance: Decimal = Field(..., max_digits=15, decimal_places=2)
    effective_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator('balance')
    @classmethod
    def validate_balance_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class BalanceResponse(BaseModel):
    id: UUID
    balance: Decimal
    effective_date: date
    is_current: bool
    notes: Optional[str]
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BalanceHistoryResponse(BaseModel):
    items: List[BalanceResponse]
