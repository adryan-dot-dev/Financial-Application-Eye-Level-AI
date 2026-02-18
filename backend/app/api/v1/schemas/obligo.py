from __future__ import annotations

from decimal import Decimal
from typing import List

from pydantic import BaseModel


class ObligoSummaryResponse(BaseModel):
    total_credit_card_limits: Decimal
    total_credit_utilization: Decimal
    total_loan_outstanding: Decimal
    total_overdraft_limits: Decimal
    total_obligo: Decimal
    total_available_credit: Decimal
    obligo_utilization_pct: float


class ObligoDetailItem(BaseModel):
    type: str  # 'credit_card', 'loan', 'overdraft'
    name: str
    limit: Decimal
    utilized: Decimal
    available: Decimal


class ObligoDetailsResponse(BaseModel):
    items: List[ObligoDetailItem]
    summary: ObligoSummaryResponse
