from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SettingsResponse(BaseModel):
    id: UUID
    currency: str
    language: str
    date_format: str
    theme: str
    notifications_enabled: bool
    forecast_months_default: int
    week_start_day: int
    alert_warning_threshold: Decimal
    alert_critical_threshold: Decimal
    onboarding_completed: bool

    model_config = {"from_attributes": True}


_SUPPORTED_CURRENCIES = {"ILS", "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD"}


class SettingsUpdate(BaseModel):
    currency: Optional[str] = Field(None, pattern=r"^[A-Z]{3}$")
    language: Optional[str] = Field(None, pattern=r"^(he|en)$")
    date_format: Optional[str] = Field(None, pattern=r"^(DD/MM/YYYY|MM/DD/YYYY|YYYY-MM-DD)$")
    theme: Optional[str] = Field(None, pattern=r"^(light|dark|system)$")
    notifications_enabled: Optional[bool] = None
    forecast_months_default: Optional[int] = Field(None, ge=1, le=24)
    week_start_day: Optional[int] = Field(None, ge=0, le=6)
    alert_warning_threshold: Optional[Decimal] = Field(None, gt=0, max_digits=15, decimal_places=2)
    alert_critical_threshold: Optional[Decimal] = Field(None, gt=0, max_digits=15, decimal_places=2)
    onboarding_completed: Optional[bool] = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _SUPPORTED_CURRENCIES:
            raise ValueError(f"Unsupported currency: {v}. Supported: {', '.join(sorted(_SUPPORTED_CURRENCIES))}")
        return v
