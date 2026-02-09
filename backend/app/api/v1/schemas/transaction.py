from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", max_length=3)
    type: str = Field(..., pattern="^(income|expense)$")
    category_id: UUID | None = None
    description: str | None = None
    date: date
    entry_pattern: str = Field(default="one_time", pattern="^(one_time|recurring|installment)$")
    notes: str | None = None
    tags: list[str] | None = None


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(None, gt=0, max_digits=15, decimal_places=2)
    currency: str | None = Field(None, max_length=3)
    type: str | None = Field(None, pattern="^(income|expense)$")
    category_id: UUID | None = None
    description: str | None = None
    date: date | None = None
    entry_pattern: str | None = Field(None, pattern="^(one_time|recurring|installment)$")
    notes: str | None = None
    tags: list[str] | None = None


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
    transactions: list[TransactionCreate]


class TransactionBulkDelete(BaseModel):
    ids: list[UUID]


class TransactionBulkUpdateCategory(BaseModel):
    ids: list[UUID]
    category_id: UUID
