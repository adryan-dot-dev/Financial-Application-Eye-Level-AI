from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field


class BalanceCreate(BaseModel):
    balance: Decimal = Field(..., max_digits=15, decimal_places=2)
    effective_date: date
    notes: str | None = Field(None, max_length=1000)


class BalanceUpdate(BaseModel):
    balance: Decimal = Field(..., max_digits=15, decimal_places=2)
    effective_date: date | None = None
    notes: str | None = Field(None, max_length=1000)


class BalanceResponse(BaseModel):
    id: UUID
    balance: Decimal
    effective_date: date
    is_current: bool
    notes: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class BalanceHistoryResponse(BaseModel):
    items: List[BalanceResponse]
