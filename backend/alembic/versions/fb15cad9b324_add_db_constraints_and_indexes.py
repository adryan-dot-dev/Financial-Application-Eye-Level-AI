"""add db constraints and indexes

Revision ID: fb15cad9b324
Revises: c418f49cdb52
Create Date: 2026-02-16 13:14:40.762193

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb15cad9b324'
down_revision: Union[str, None] = 'c418f49cdb52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add CHECK constraints
    op.create_check_constraint(
        'ck_installments_payments',
        'installments',
        'payments_completed <= number_of_payments'
    )
    op.create_check_constraint(
        'ck_loans_payments',
        'loans',
        'payments_made <= total_payments'
    )
    op.create_check_constraint(
        'ck_fixed_day',
        'fixed_income_expenses',
        'day_of_month >= 1 AND day_of_month <= 31'
    )
    op.create_check_constraint(
        'ck_inst_day',
        'installments',
        'day_of_month >= 1 AND day_of_month <= 31'
    )
    op.create_check_constraint(
        'ck_loan_day',
        'loans',
        'day_of_month >= 1 AND day_of_month <= 31'
    )
    op.create_check_constraint(
        'ck_transaction_amount',
        'transactions',
        'amount > 0'
    )
    op.create_check_constraint(
        'ck_fixed_amount',
        'fixed_income_expenses',
        'amount > 0'
    )
    # Partial unique index: only one current balance per user
    op.create_index(
        'uq_balance_current',
        'bank_balances',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text('is_current = true')
    )


def downgrade() -> None:
    op.drop_index('uq_balance_current', table_name='bank_balances')
    op.drop_constraint('ck_fixed_amount', 'fixed_income_expenses', type_='check')
    op.drop_constraint('ck_transaction_amount', 'transactions', type_='check')
    op.drop_constraint('ck_loan_day', 'loans', type_='check')
    op.drop_constraint('ck_inst_day', 'installments', type_='check')
    op.drop_constraint('ck_fixed_day', 'fixed_income_expenses', type_='check')
    op.drop_constraint('ck_loans_payments', 'loans', type_='check')
    op.drop_constraint('ck_installments_payments', 'installments', type_='check')
