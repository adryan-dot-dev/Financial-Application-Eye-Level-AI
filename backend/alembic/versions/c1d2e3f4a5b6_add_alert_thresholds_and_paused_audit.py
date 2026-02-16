"""add alert thresholds to settings and paused_at/resumed_at to fixed

Revision ID: c1d2e3f4a5b6
Revises: b708280a0aad
Create Date: 2026-02-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1d2e3f4a5b6'
down_revision = 'b708280a0aad'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ORANGE-7: Alert thresholds in settings (user-configurable)
    op.add_column(
        'settings',
        sa.Column('alert_warning_threshold', sa.Numeric(15, 2), server_default='5000', nullable=False),
    )
    op.add_column(
        'settings',
        sa.Column('alert_critical_threshold', sa.Numeric(15, 2), server_default='1000', nullable=False),
    )

    # YELLOW-1: Audit trail for pause/resume on fixed income/expenses
    op.add_column(
        'fixed_income_expenses',
        sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'fixed_income_expenses',
        sa.Column('resumed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('fixed_income_expenses', 'resumed_at')
    op.drop_column('fixed_income_expenses', 'paused_at')
    op.drop_column('settings', 'alert_critical_threshold')
    op.drop_column('settings', 'alert_warning_threshold')
