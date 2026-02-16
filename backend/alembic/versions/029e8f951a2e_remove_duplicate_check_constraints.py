"""remove duplicate check constraints

Revision ID: 029e8f951a2e
Revises: 225a281f1180
Create Date: 2026-02-16
"""
from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = '029e8f951a2e'
down_revision = '225a281f1180'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # fixed_income_expenses: drop duplicates, keep ck_fixed_amount and ck_fixed_day
    op.drop_constraint('ck_fixed_positive_amount', 'fixed_income_expenses', type_='check')
    op.drop_constraint('ck_fixed_day_of_month', 'fixed_income_expenses', type_='check')

    # installments: drop duplicates, keep ck_inst_day and ck_installments_payments
    # (ck_installment_positive_amount is unique - no duplicate, so keep it)
    op.drop_constraint('ck_installment_day_of_month', 'installments', type_='check')
    op.drop_constraint('ck_installment_payments', 'installments', type_='check')

    # loans: drop duplicates, keep ck_loan_day and ck_loans_payments
    # (ck_loan_positive_principal is unique - no duplicate, so keep it)
    op.drop_constraint('ck_loan_day_of_month', 'loans', type_='check')
    op.drop_constraint('ck_loan_payments', 'loans', type_='check')

    # transactions: drop duplicate, keep positive_amount
    op.drop_constraint('ck_transaction_amount', 'transactions', type_='check')


def downgrade() -> None:
    # Re-add the dropped constraints

    # fixed_income_expenses
    op.create_check_constraint(
        'ck_fixed_positive_amount',
        'fixed_income_expenses',
        'amount > 0'
    )
    op.create_check_constraint(
        'ck_fixed_day_of_month',
        'fixed_income_expenses',
        'day_of_month >= 1 AND day_of_month <= 31'
    )

    # installments
    op.create_check_constraint(
        'ck_installment_day_of_month',
        'installments',
        'day_of_month >= 1 AND day_of_month <= 31'
    )
    op.create_check_constraint(
        'ck_installment_payments',
        'installments',
        'payments_completed >= 0 AND payments_completed <= number_of_payments'
    )

    # loans
    op.create_check_constraint(
        'ck_loan_day_of_month',
        'loans',
        'day_of_month >= 1 AND day_of_month <= 31'
    )
    op.create_check_constraint(
        'ck_loan_payments',
        'loans',
        'payments_made >= 0 AND payments_made <= total_payments'
    )

    # transactions
    op.create_check_constraint(
        'ck_transaction_amount',
        'transactions',
        'amount > 0'
    )
