from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field


class ExpectedIncomeCreate(BaseModel):
    month: date  # First day of the month
    expected_amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    notes: str | None = None


class ExpectedIncomeUpdate(BaseModel):
    expected_amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    notes: str | None = None


class ExpectedIncomeResponse(BaseModel):
    id: UUID
    month: date
    expected_amount: Decimal
    notes: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ExpectedIncomeListResponse(BaseModel):
    items: List[ExpectedIncomeResponse]
