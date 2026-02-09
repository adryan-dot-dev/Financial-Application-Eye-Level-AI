from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field


class InstallmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    total_amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    number_of_payments: int = Field(..., ge=1, le=360)
    currency: str = Field(default="ILS", max_length=3)
    type: str = Field(..., pattern="^(income|expense)$")
    category_id: UUID | None = None
    start_date: date
    day_of_month: int = Field(..., ge=1, le=31)
    description: str | None = None


class InstallmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    category_id: UUID | None = None
    description: str | None = None


class InstallmentResponse(BaseModel):
    id: UUID
    name: str
    total_amount: Decimal
    monthly_amount: Decimal
    currency: str
    number_of_payments: int
    type: str
    category_id: UUID | None
    start_date: date
    day_of_month: int
    payments_completed: int
    description: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaymentScheduleItem(BaseModel):
    payment_number: int
    date: date
    amount: Decimal
    status: str  # 'completed', 'upcoming', 'future'


class InstallmentDetailResponse(BaseModel):
    installment: InstallmentResponse
    schedule: List[PaymentScheduleItem]
