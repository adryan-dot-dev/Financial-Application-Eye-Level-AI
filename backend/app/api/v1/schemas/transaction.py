from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.utils import strip_tags


MAX_AMOUNT = Decimal("9999999999999.99")  # DECIMAL(15,2) max


def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    """Validate that a Decimal value does not exceed max_digits total digits."""
    if v is not None:
        if v > MAX_AMOUNT:
            raise ValueError(f"Amount exceeds maximum allowed value ({MAX_AMOUNT})")
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
    currency: str = Field(default="ILS", min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    type: str = Field(..., pattern="^(income|expense)$")
    category_id: Optional[UUID] = None
    description: Optional[str] = Field(None, max_length=500)
    date: date
    entry_pattern: str = Field(default="one_time", pattern="^(one_time|recurring|installment)$")
    notes: Optional[str] = Field(None, max_length=2000)
    tags: Optional[List[str]] = Field(None, max_length=20)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            sanitized = []
            for tag in v:
                tag = strip_tags(tag).strip()
                if len(tag) > 50:
                    raise ValueError("Each tag must be at most 50 characters")
                if not tag:
                    raise ValueError("Tags must not be empty or whitespace-only")
                sanitized.append(tag)
            return sanitized
        return v

    @field_validator('description', 'notes')
    @classmethod
    def strip_text_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = strip_tags(v)
            v = v.strip()
            if not v:
                return None
        return v


class TransactionUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0, max_digits=15, decimal_places=2)
    currency: Optional[str] = Field(None, min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    type: Optional[str] = Field(None, pattern="^(income|expense)$")
    category_id: Optional[UUID] = None
    description: Optional[str] = Field(None, max_length=500)
    date: Optional[date] = None
    entry_pattern: Optional[str] = Field(None, pattern="^(one_time|recurring|installment)$")
    notes: Optional[str] = Field(None, max_length=2000)
    tags: Optional[List[str]] = Field(None, max_length=20)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return _validate_decimal_precision(v)
        return v

    @field_validator('description', 'notes')
    @classmethod
    def strip_text_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = strip_tags(v)
            v = v.strip()
            if not v:
                return None
        return v

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            sanitized = []
            for tag in v:
                tag = strip_tags(tag).strip()
                if len(tag) > 50:
                    raise ValueError("Each tag must be at most 50 characters")
                if not tag:
                    raise ValueError("Tags must not be empty or whitespace-only")
                sanitized.append(tag)
            return sanitized
        return v


class TransactionResponse(BaseModel):
    id: UUID
    amount: Decimal
    currency: str
    type: str
    category_id: Optional[UUID]
    description: Optional[str]
    date: date
    entry_pattern: str
    is_recurring: bool
    recurring_source_id: Optional[UUID]
    installment_id: Optional[UUID]
    installment_number: Optional[int]
    loan_id: Optional[UUID]
    notes: Optional[str]
    tags: Optional[List[str]]

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    page_size: int
    pages: int


class TransactionBulkCreate(BaseModel):
    transactions: List[TransactionCreate] = Field(..., min_length=1, max_length=500)


class TransactionBulkDelete(BaseModel):
    ids: List[UUID] = Field(..., min_length=1, max_length=1000)


class TransactionBulkUpdateCategory(BaseModel):
    ids: List[UUID] = Field(..., min_length=1, max_length=1000)
    category_id: UUID
