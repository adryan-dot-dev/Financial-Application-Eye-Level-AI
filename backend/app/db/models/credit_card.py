from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    last_four_digits: Mapped[str] = mapped_column(String(4), nullable=False)
    card_network: Mapped[str] = mapped_column(String(20), nullable=False)
    issuer: Mapped[str] = mapped_column(String(100), nullable=False)
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    billing_day: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="ILS")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[Optional[str]] = mapped_column(String(7), default="#6366F1")
    bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_credit_cards_user_id", "user_id"),
        Index("ix_credit_cards_org_id", "organization_id"),
        Index("ix_credit_cards_user_active", "user_id", "is_active"),
    )

    # Relationships
    user = relationship("User", back_populates="credit_cards")
    bank_account = relationship("BankAccount")
