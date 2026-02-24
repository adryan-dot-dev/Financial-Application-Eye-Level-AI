"""phase5a_indexes_and_constraints

Revision ID: phase5a_fixes
Revises: 57ac70dcfa4d
Create Date: 2026-02-24 15:59:46.660626

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'phase5a_fixes'
down_revision: Union[str, None] = '57ac70dcfa4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # BUG-02: The unique indexes uq_balance_current_per_account and
    # uq_balance_current_global were already created in migration 57ac70dcfa4d.
    # No additional DB constraint changes needed for BUG-02.

    # BUG-05: Add missing performance indexes using IF NOT EXISTS guards.
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_credit_cards_billing_day "
        "ON credit_cards (billing_day)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_subscriptions_billing_cycle "
        "ON subscriptions (billing_cycle)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_transactions_installment_id "
        "ON transactions (installment_id) WHERE installment_id IS NOT NULL"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_bank_balances_account_current "
        "ON bank_balances (bank_account_id, is_current) WHERE bank_account_id IS NOT NULL"
    ))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_bank_balances_account_current"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_transactions_installment_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_subscriptions_billing_cycle"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_credit_cards_billing_day"))
