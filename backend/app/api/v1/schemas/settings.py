from __future__ import annotations

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

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    currency: str | None = Field(None, max_length=3)
    language: str | None = Field(None, max_length=2)
    date_format: str | None = Field(None, max_length=20)
    theme: str | None = Field(None, pattern="^(light|dark)$")
    notifications_enabled: bool | None = None
    forecast_months_default: int | None = Field(None, ge=1, le=24)
    week_start_day: int | None = Field(None, ge=0, le=6)
