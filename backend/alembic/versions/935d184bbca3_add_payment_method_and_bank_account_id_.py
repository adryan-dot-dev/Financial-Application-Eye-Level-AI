"""Add payment_method and bank_account_id to transactions fixed installments and credit_cards

Revision ID: 935d184bbca3
Revises: 6b2079dbc63e
Create Date: 2026-02-23 20:01:01.379795

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '935d184bbca3'
down_revision: Union[str, None] = '6b2079dbc63e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add payment_method and bank_account_id to transactions
    op.add_column('transactions', sa.Column('payment_method', sa.String(length=20), server_default='cash', nullable=False))
    op.add_column('transactions', sa.Column('bank_account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_transactions_bank_account_id', 'transactions', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')

    # Add payment_method and bank_account_id to fixed_income_expenses
    op.add_column('fixed_income_expenses', sa.Column('payment_method', sa.String(length=20), server_default='cash', nullable=False))
    op.add_column('fixed_income_expenses', sa.Column('bank_account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_fixed_bank_account_id', 'fixed_income_expenses', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')

    # Add payment_method and bank_account_id to installments
    op.add_column('installments', sa.Column('payment_method', sa.String(length=20), server_default='cash', nullable=False))
    op.add_column('installments', sa.Column('bank_account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_installments_bank_account_id', 'installments', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')

    # Add bank_account_id to credit_cards (which bank account gets charged on billing day)
    op.add_column('credit_cards', sa.Column('bank_account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_credit_cards_bank_account_id', 'credit_cards', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')

    # Backfill: where credit_card_id is set, payment_method should be 'credit_card'
    op.execute("UPDATE transactions SET payment_method = 'credit_card' WHERE credit_card_id IS NOT NULL")
    op.execute("UPDATE fixed_income_expenses SET payment_method = 'credit_card' WHERE credit_card_id IS NOT NULL")
    op.execute("UPDATE installments SET payment_method = 'credit_card' WHERE credit_card_id IS NOT NULL")

    # Add indexes for payment_method queries
    op.create_index('ix_transactions_payment_method', 'transactions', ['user_id', 'payment_method'], unique=False)
    op.create_index('ix_transactions_bank_account_id', 'transactions', ['bank_account_id'], unique=False)
    op.create_index('ix_fixed_bank_account_id', 'fixed_income_expenses', ['bank_account_id'], unique=False)
    op.create_index('ix_installments_bank_account_id', 'installments', ['bank_account_id'], unique=False)
    op.create_index('ix_credit_cards_bank_account_id', 'credit_cards', ['bank_account_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_credit_cards_bank_account_id', table_name='credit_cards')
    op.drop_index('ix_installments_bank_account_id', table_name='installments')
    op.drop_index('ix_fixed_bank_account_id', table_name='fixed_income_expenses')
    op.drop_index('ix_transactions_bank_account_id', table_name='transactions')
    op.drop_index('ix_transactions_payment_method', table_name='transactions')

    op.drop_constraint('fk_credit_cards_bank_account_id', 'credit_cards', type_='foreignkey')
    op.drop_column('credit_cards', 'bank_account_id')

    op.drop_constraint('fk_installments_bank_account_id', 'installments', type_='foreignkey')
    op.drop_column('installments', 'bank_account_id')
    op.drop_column('installments', 'payment_method')

    op.drop_constraint('fk_fixed_bank_account_id', 'fixed_income_expenses', type_='foreignkey')
    op.drop_column('fixed_income_expenses', 'bank_account_id')
    op.drop_column('fixed_income_expenses', 'payment_method')

    op.drop_constraint('fk_transactions_bank_account_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'bank_account_id')
    op.drop_column('transactions', 'payment_method')
