from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


def _validate_decimal_precision(v: Decimal, max_digits: int = 15) -> Decimal:
    """Validate that a Decimal value does not exceed max_digits total digits."""
    if v is not None:
        s = str(abs(v))
        digits_only = s.replace('.', '').lstrip('0') or '0'
        if len(digits_only) > max_digits:
            raise ValueError(f'Amount exceeds maximum precision ({max_digits} digits)')
    return v


class FixedCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", max_length=3)
    type: str = Field(..., pattern="^(income|expense)$")
    category_id: UUID | None = None
    day_of_month: int = Field(..., ge=1, le=31)
    start_date: date
    end_date: date | None = None
    description: str | None = Field(None, max_length=1000)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be >= start_date")
        return self


class FixedUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    amount: Decimal | None = Field(None, gt=0, max_digits=15, decimal_places=2)
    currency: str | None = Field(None, max_length=3)
    type: str | None = Field(None, pattern="^(income|expense)$")
    category_id: UUID | None = None
    day_of_month: int | None = Field(None, ge=1, le=31)
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = Field(None, max_length=1000)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)


class FixedResponse(BaseModel):
    id: UUID
    name: str
    amount: Decimal
    currency: str
    type: str
    category_id: UUID | None
    day_of_month: int
    start_date: date
    end_date: date | None
    is_active: bool
    description: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
