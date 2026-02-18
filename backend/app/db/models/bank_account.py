from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BankAccount(Base):
    __tablename__ = "bank_accounts"

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
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_last_digits: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    overdraft_limit: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0")
    )
    currency: Mapped[str] = mapped_column(String(3), default="ILS")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_bank_accounts_user_id", "user_id"),
        Index("ix_bank_accounts_org_id", "organization_id"),
    )

    # Relationships
    user = relationship("User", back_populates="bank_accounts")
