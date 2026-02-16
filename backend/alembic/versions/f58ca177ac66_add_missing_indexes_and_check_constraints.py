"""add missing indexes and check constraints

Revision ID: f58ca177ac66
Revises: 3206c4eef440
Create Date: 2026-02-09 22:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f58ca177ac66'
down_revision: Union[str, None] = '3206c4eef440'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- Missing indexes from models ----

    # transactions indexes
    op.create_index('ix_transactions_user_id', 'transactions', ['user_id'])
    op.create_index('ix_transactions_user_date', 'transactions', ['user_id', 'date'])
    op.create_index('ix_transactions_user_type', 'transactions', ['user_id', 'type'])
    op.create_index('ix_transactions_user_category', 'transactions', ['user_id', 'category_id'])
    op.create_index('ix_transactions_user_entry_pattern', 'transactions', ['user_id', 'entry_pattern'])

    # categories indexes
    op.create_index('ix_categories_user_id', 'categories', ['user_id'])
    op.create_index('ix_categories_user_type', 'categories', ['user_id', 'type'])
    op.create_index('ix_categories_user_archived', 'categories', ['user_id', 'is_archived'])

    # fixed_income_expenses indexes
    op.create_index('ix_fixed_user_id', 'fixed_income_expenses', ['user_id'])
    op.create_index('ix_fixed_user_active', 'fixed_income_expenses', ['user_id', 'is_active'])
    op.create_index('ix_fixed_user_type', 'fixed_income_expenses', ['user_id', 'type'])

    # installments indexes
    op.create_index('ix_installments_user_id', 'installments', ['user_id'])

    # loans indexes
    op.create_index('ix_loans_user_id', 'loans', ['user_id'])
    op.create_index('ix_loans_user_status', 'loans', ['user_id', 'status'])

    # bank_balances indexes
    op.create_index('ix_bank_balances_user_id', 'bank_balances', ['user_id'])
    op.create_index('ix_bank_balances_user_current', 'bank_balances', ['user_id', 'is_current'])
    op.create_index('ix_bank_balances_user_date', 'bank_balances', ['user_id', 'effective_date'])

    # expected_income indexes
    op.create_index('ix_expected_income_user_id', 'expected_income', ['user_id'])

    # alerts indexes
    op.create_index('ix_alerts_user_id', 'alerts', ['user_id'])
    op.create_index('ix_alerts_user_dismissed', 'alerts', ['user_id', 'is_dismissed'])
    op.create_index('ix_alerts_user_read_dismissed', 'alerts', ['user_id', 'is_read', 'is_dismissed'])
    op.create_index('ix_alerts_user_type', 'alerts', ['user_id', 'alert_type'])

    # ---- CHECK constraints ----

    # day_of_month constraints
    op.create_check_constraint(
        'ck_fixed_day_of_month', 'fixed_income_expenses',
        'day_of_month >= 1 AND day_of_month <= 31'
    )
    op.create_check_constraint(
        'ck_installment_day_of_month', 'installments',
        'day_of_month >= 1 AND day_of_month <= 31'
    )
    op.create_check_constraint(
        'ck_loan_day_of_month', 'loans',
        'day_of_month >= 1 AND day_of_month <= 31'
    )

    # positive amount constraints
    op.create_check_constraint(
        'ck_fixed_positive_amount', 'fixed_income_expenses',
        'amount > 0'
    )
    op.create_check_constraint(
        'ck_installment_positive_amount', 'installments',
        'total_amount > 0'
    )
    op.create_check_constraint(
        'ck_loan_positive_principal', 'loans',
        'original_amount > 0'
    )

    # payment count constraints
    op.create_check_constraint(
        'ck_installment_payments', 'installments',
        'payments_completed >= 0 AND payments_completed <= number_of_payments'
    )
    op.create_check_constraint(
        'ck_loan_payments', 'loans',
        'payments_made >= 0 AND payments_made <= total_payments'
    )


def downgrade() -> None:
    # ---- Drop CHECK constraints ----
    op.drop_constraint('ck_loan_payments', 'loans', type_='check')
    op.drop_constraint('ck_installment_payments', 'installments', type_='check')
    op.drop_constraint('ck_loan_positive_principal', 'loans', type_='check')
    op.drop_constraint('ck_installment_positive_amount', 'installments', type_='check')
    op.drop_constraint('ck_fixed_positive_amount', 'fixed_income_expenses', type_='check')
    op.drop_constraint('ck_loan_day_of_month', 'loans', type_='check')
    op.drop_constraint('ck_installment_day_of_month', 'installments', type_='check')
    op.drop_constraint('ck_fixed_day_of_month', 'fixed_income_expenses', type_='check')

    # ---- Drop indexes ----
    op.drop_index('ix_alerts_user_type', 'alerts')
    op.drop_index('ix_alerts_user_read_dismissed', 'alerts')
    op.drop_index('ix_alerts_user_dismissed', 'alerts')
    op.drop_index('ix_alerts_user_id', 'alerts')

    op.drop_index('ix_expected_income_user_id', 'expected_income')

    op.drop_index('ix_bank_balances_user_date', 'bank_balances')
    op.drop_index('ix_bank_balances_user_current', 'bank_balances')
    op.drop_index('ix_bank_balances_user_id', 'bank_balances')

    op.drop_index('ix_loans_user_status', 'loans')
    op.drop_index('ix_loans_user_id', 'loans')

    op.drop_index('ix_installments_user_id', 'installments')

    op.drop_index('ix_fixed_user_type', 'fixed_income_expenses')
    op.drop_index('ix_fixed_user_active', 'fixed_income_expenses')
    op.drop_index('ix_fixed_user_id', 'fixed_income_expenses')

    op.drop_index('ix_categories_user_archived', 'categories')
    op.drop_index('ix_categories_user_type', 'categories')
    op.drop_index('ix_categories_user_id', 'categories')

    op.drop_index('ix_transactions_user_entry_pattern', 'transactions')
    op.drop_index('ix_transactions_user_category', 'transactions')
    op.drop_index('ix_transactions_user_type', 'transactions')
    op.drop_index('ix_transactions_user_date', 'transactions')
    op.drop_index('ix_transactions_user_id', 'transactions')
