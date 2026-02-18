from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

ALLOWED_REPORT_TYPES = {"monthly", "quarterly", "annual"}


class ReportGenerateRequest(BaseModel):
    report_type: str = Field(...)
    period_start: date
    period_end: date

    @field_validator('report_type')
    @classmethod
    def validate_report_type(cls, v: str) -> str:
        if v not in ALLOWED_REPORT_TYPES:
            raise ValueError(f"report_type must be one of: {', '.join(sorted(ALLOWED_REPORT_TYPES))}")
        return v

    @field_validator('period_end')
    @classmethod
    def validate_period_end(cls, v: date, info) -> date:
        start = info.data.get('period_start')
        if start and v <= start:
            raise ValueError("period_end must be after period_start")
        return v


class ReportResponse(BaseModel):
    id: UUID
    organization_id: UUID
    report_type: str
    period_start: date
    period_end: date
    data: dict
    generated_by: UUID
    generated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    items: List[ReportResponse]
    total: int
