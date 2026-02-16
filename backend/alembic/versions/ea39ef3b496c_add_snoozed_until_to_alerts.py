"""add snoozed_until to alerts

Revision ID: ea39ef3b496c
Revises: fb15cad9b324
Create Date: 2026-02-16 18:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea39ef3b496c'
down_revision: Union[str, None] = 'fb15cad9b324'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'alerts',
        sa.Column('snoozed_until', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('alerts', 'snoozed_until')
