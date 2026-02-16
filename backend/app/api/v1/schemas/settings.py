from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SettingsResponse(BaseModel):
    id: UUID
    currency: str
    language: str
    date_format: str
    theme: str
    notifications_enabled: bool
    forecast_months_default: int
    week_start_day: int
    onboarding_completed: bool

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    currency: Optional[str] = Field(None, max_length=3)
    language: Optional[str] = Field(None, max_length=2)
    date_format: Optional[str] = Field(None, max_length=20)
    theme: Optional[str] = Field(None, pattern="^(light|dark|system)$")
    notifications_enabled: Optional[bool] = None
    forecast_months_default: Optional[int] = Field(None, ge=1, le=24)
    week_start_day: Optional[int] = Field(None, ge=0, le=6)
    onboarding_completed: Optional[bool] = None
