from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
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


class ApprovalSubmitRequest(BaseModel):
    amount: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    currency: str = Field(default="ILS", min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    category_id: Optional[UUID] = None
    description: str = Field(..., min_length=1, max_length=2000)

    @field_validator('amount')
    @classmethod
    def validate_amount_precision(cls, v: Decimal) -> Decimal:
        return _validate_decimal_precision(v)

    @field_validator('description')
    @classmethod
    def sanitize_description(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Description must not be empty")
        return v


class ApprovalRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=1, max_length=1000)

    @field_validator('rejection_reason')
    @classmethod
    def sanitize_reason(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Rejection reason must not be empty")
        return v


class ApprovalResponse(BaseModel):
    id: UUID
    organization_id: UUID
    transaction_id: Optional[UUID] = None
    requested_by: UUID
    approved_by: Optional[UUID] = None
    status: str
    amount: Decimal
    currency: str
    category_id: Optional[UUID] = None
    description: Optional[str] = None
    rejection_reason: Optional[str] = None
    requested_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    requester_email: Optional[str] = None
    approver_email: Optional[str] = None

    model_config = {"from_attributes": True}


class ApprovalListResponse(BaseModel):
    items: List[ApprovalResponse]
    total: int
    page: int
    per_page: int


class PendingApprovalsResponse(BaseModel):
    count: int
    items: List[ApprovalResponse]
