from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: UUID
    alert_type: str
    severity: str
    title: str
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None
    related_month: Optional[date] = None
    is_read: bool
    is_dismissed: bool
    snoozed_until: Optional[datetime] = None
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    items: List[AlertResponse]
    unread_count: int


class AlertUnreadCount(BaseModel):
    count: int


class MarkAllReadResponse(BaseModel):
    marked_count: int


class SnoozeRequest(BaseModel):
    snooze_until: datetime
