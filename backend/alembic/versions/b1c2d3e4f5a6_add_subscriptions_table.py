"""add_subscriptions_table

Revision ID: b1c2d3e4f5a6
Revises: a9c1f2b3d4e5
Create Date: 2026-02-17 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a9c1f2b3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='ILS'),
        sa.Column(
            'category_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('categories.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('billing_cycle', sa.String(20), nullable=False),
        sa.Column('next_renewal_date', sa.Date(), nullable=False),
        sa.Column('last_renewal_date', sa.Date(), nullable=True),
        sa.Column('auto_renew', sa.Boolean(), server_default='true'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('provider', sa.String(200), nullable=True),
        sa.Column('provider_url', sa.String(500), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Create indexes
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'])
    op.create_index('ix_subscriptions_is_active', 'subscriptions', ['is_active'])
    op.create_index('ix_subscriptions_next_renewal_date', 'subscriptions', ['next_renewal_date'])
    op.create_index('ix_subscriptions_category_id', 'subscriptions', ['category_id'])


def downgrade() -> None:
    op.drop_index('ix_subscriptions_category_id', table_name='subscriptions')
    op.drop_index('ix_subscriptions_next_renewal_date', table_name='subscriptions')
    op.drop_index('ix_subscriptions_is_active', table_name='subscriptions')
    op.drop_index('ix_subscriptions_user_id', table_name='subscriptions')
    op.drop_table('subscriptions')
