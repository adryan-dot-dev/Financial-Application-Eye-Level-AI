from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False
    )
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
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    entry_pattern: Mapped[str] = mapped_column(
        String(20), default="one_time"
    )  # 'one_time', 'recurring', 'installment'
    is_recurring: Mapped[bool] = mapped_column(default=False)
    recurring_source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    installment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    installment_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    loan_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    credit_card_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_cards.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="positive_amount"),
        Index("ix_transactions_user_id", "user_id"),
        Index("ix_transactions_user_date", "user_id", "date"),
        Index("ix_transactions_user_type", "user_id", "type"),
        Index("ix_transactions_user_category", "user_id", "category_id"),
        Index("ix_transactions_user_entry_pattern", "user_id", "entry_pattern"),
        Index("ix_transactions_org_id", "organization_id"),
        Index("ix_transactions_org_date", "organization_id", "date"),
    )

    # Relationships
    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    credit_card = relationship("CreditCard")
