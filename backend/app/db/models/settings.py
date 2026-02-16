from __future__ import annotations

import uuid
from datetime import datetime

from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), default="ILS")
    language: Mapped[str] = mapped_column(String(2), default="he")
    date_format: Mapped[str] = mapped_column(String(20), default="DD/MM/YYYY")
    theme: Mapped[str] = mapped_column(String(10), default="light")
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    forecast_months_default: Mapped[int] = mapped_column(Integer, default=6)
    week_start_day: Mapped[int] = mapped_column(Integer, default=0)  # 0=Sunday
    alert_warning_threshold: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("5000"), server_default="5000"
    )
    alert_critical_threshold: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("1000"), server_default="1000"
    )
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="settings")
