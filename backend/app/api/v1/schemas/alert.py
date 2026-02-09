from __future__ import annotations

from datetime import date, datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: UUID
    alert_type: str
    severity: str
    title: str
    message: str
    related_entity_type: str | None
    related_entity_id: UUID | None
    related_month: date | None
    is_read: bool
    is_dismissed: bool
    created_at: datetime | None = None
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    items: List[AlertResponse]
    unread_count: int


class AlertUnreadCount(BaseModel):
    count: int
