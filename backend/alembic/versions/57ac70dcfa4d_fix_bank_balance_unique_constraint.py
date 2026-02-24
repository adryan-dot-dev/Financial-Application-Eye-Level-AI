"""fix_bank_balance_unique_constraint

Revision ID: 57ac70dcfa4d
Revises: 935d184bbca3
Create Date: 2026-02-24 13:21:00.961769

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '57ac70dcfa4d'
down_revision: Union[str, None] = '935d184bbca3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old unique constraint that prevents per-account balances on same day
    op.drop_constraint('uq_bank_balance_user_date', 'bank_balances', type_='unique')

    # Drop the old unique index that only allows ONE is_current=true per user
    op.drop_index('uq_balance_current', table_name='bank_balances',
                  postgresql_where='(is_current = true)')

    # New unique constraint: per user + date + account (allows multiple accounts same day)
    op.create_unique_constraint(
        'uq_bank_balance_user_date_account', 'bank_balances',
        ['user_id', 'effective_date', 'bank_account_id']
    )

    # New unique partial index: one current balance per user per account
    # For balances WITH bank_account_id
    op.execute(sa.text(
        "CREATE UNIQUE INDEX uq_balance_current_per_account "
        "ON bank_balances (user_id, bank_account_id) "
        "WHERE is_current = true AND bank_account_id IS NOT NULL"
    ))

    # For global balances (no bank_account_id)
    op.execute(sa.text(
        "CREATE UNIQUE INDEX uq_balance_current_global "
        "ON bank_balances (user_id) "
        "WHERE is_current = true AND bank_account_id IS NULL"
    ))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS uq_balance_current_global"))
    op.execute(sa.text("DROP INDEX IF EXISTS uq_balance_current_per_account"))
    op.drop_constraint('uq_bank_balance_user_date_account', 'bank_balances', type_='unique')
    op.create_index('uq_balance_current', 'bank_balances', ['user_id'],
                    unique=True, postgresql_where='(is_current = true)')
    op.create_unique_constraint('uq_bank_balance_user_date', 'bank_balances',
                                ['user_id', 'effective_date'])
