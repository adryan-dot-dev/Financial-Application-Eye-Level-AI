from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    """Validate that a Decimal value does not exceed max_digits total digits."""
    if v is not None:
        # Strip trailing zeros and count significant digits
        s = str(abs(v))
        # Remove decimal point for digit counting
        digits_only = s.replace('.', '')
        # Remove leading zeros
        digits_only = digits_only.lstrip('0') or '0'
        if len(digits_only) > max_digits:
            raise ValueError(f'Amount exceeds maximum precision ({max_digits} digits)')
    return v


class TransactionCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", max_length=3)
    type: str = Field(..., pattern="^(income|expense)$")
    category_id: UUID | None = None
    description: str | None = Field(None, max_length=500)
    date: date
    entry_pattern: str = Field(default="one_time", pattern="^(one_time|recurring|installment)$")
    notes: str | None = Field(None, max_length=2000)
    tags: list[str] | None = Field(None, max_length=20)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(None, gt=0, max_digits=15, decimal_places=2)
    currency: str | None = Field(None, max_length=3)
    type: str | None = Field(None, pattern="^(income|expense)$")
    category_id: UUID | None = None
    description: str | None = Field(None, max_length=500)
    date: date | None = None
    entry_pattern: str | None = Field(None, pattern="^(one_time|recurring|installment)$")
    notes: str | None = Field(None, max_length=2000)
    tags: list[str] | None = Field(None, max_length=20)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class TransactionResponse(BaseModel):
    id: UUID
    amount: Decimal
    currency: str
    type: str
    category_id: UUID | None
    description: str | None
    date: date
    entry_pattern: str
    is_recurring: bool
    recurring_source_id: UUID | None
    installment_id: UUID | None
    installment_number: int | None
    loan_id: UUID | None
    notes: str | None
    tags: list[str] | None

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    pages: int


class TransactionBulkCreate(BaseModel):
    transactions: list[TransactionCreate] = Field(..., max_length=500)


class TransactionBulkDelete(BaseModel):
    ids: list[UUID] = Field(..., max_length=1000)


class TransactionBulkUpdateCategory(BaseModel):
    ids: list[UUID] = Field(..., max_length=1000)
    category_id: UUID
