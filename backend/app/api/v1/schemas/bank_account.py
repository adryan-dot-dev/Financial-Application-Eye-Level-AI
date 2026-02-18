from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.utils import strip_tags

MAX_AMOUNT = Decimal("9999999999999.99")

def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    if v is not None:
        if v > MAX_AMOUNT:
            raise ValueError(f"Amount exceeds maximum allowed value ({MAX_AMOUNT})")
        s = str(abs(v))
        digits_only = s.replace('.', '').lstrip('0') or '0'
        if len(digits_only) > max_digits:
            raise ValueError(f'Amount exceeds maximum precision ({max_digits} digits)')
    return v


class BankAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    bank_name: str = Field(..., min_length=1, max_length=100)
    account_last_digits: Optional[str] = Field(None, min_length=4, max_length=4, pattern="^[0-9]{4}$")
    overdraft_limit: Decimal = Field(default=Decimal("0"), ge=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    is_primary: bool = False
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator('overdraft_limit')
    @classmethod
    def validate_overdraft_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty or whitespace-only")
        return v

    @field_validator('bank_name')
    @classmethod
    def sanitize_bank_name(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Bank name must not be empty")
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


class BankAccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    bank_name: Optional[str] = Field(None, min_length=1, max_length=100)
    account_last_digits: Optional[str] = Field(None, min_length=4, max_length=4, pattern="^[0-9]{4}$")
    overdraft_limit: Optional[Decimal] = Field(None, ge=0, max_digits=15, decimal_places=2)
    is_primary: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator('overdraft_limit')
    @classmethod
    def validate_overdraft_precision(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return _validate_decimal_precision(v)
        return v


class BankAccountResponse(BaseModel):
    id: UUID
    name: str
    bank_name: str
    account_last_digits: Optional[str] = None
    overdraft_limit: Decimal
    currency: str
    is_primary: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    current_balance: Optional[Decimal] = None

    model_config = {"from_attributes": True}
