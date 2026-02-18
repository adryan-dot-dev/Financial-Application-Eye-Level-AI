from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FixedIncomeExpense(Base):
    __tablename__ = "fixed_income_expenses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="ILS")
    original_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    original_currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    exchange_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 6), nullable=True
    )
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True
    )
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'income' or 'expense'
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    day_of_month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-31
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # NULL = no limit
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    paused_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    credit_card_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_cards.id", ondelete="SET NULL"), nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_fixed_user_id", "user_id"),
        Index("ix_fixed_user_active", "user_id", "is_active"),
        Index("ix_fixed_user_type", "user_id", "type"),
        Index("ix_fixed_org_id", "organization_id"),
        Index("ix_fixed_org_active", "organization_id", "is_active"),
    )

    # Relationships
    user = relationship("User", back_populates="fixed_income_expenses")
    category = relationship("Category")
    credit_card = relationship("CreditCard")
