"""add_credit_banking_budgets_approvals_reports

Revision ID: 6b2079dbc63e
Revises: 7c6dc9126131
Create Date: 2026-02-18 15:22:58.172636

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6b2079dbc63e'
down_revision: Union[str, None] = '7c6dc9126131'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New tables ──────────────────────────────────────────────

    # 1. bank_accounts
    op.create_table('bank_accounts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('bank_name', sa.String(length=100), nullable=False),
        sa.Column('account_last_digits', sa.String(length=4), nullable=True),
        sa.Column('overdraft_limit', sa.Numeric(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='ILS', nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('overdraft_limit >= 0', name='ck_bank_accounts_positive_overdraft'),
    )
    op.create_index('ix_bank_accounts_org_id', 'bank_accounts', ['organization_id'])
    op.create_index('ix_bank_accounts_user_id', 'bank_accounts', ['user_id'])

    # 2. credit_cards
    op.create_table('credit_cards',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('last_four_digits', sa.String(length=4), nullable=False),
        sa.Column('card_network', sa.String(length=20), nullable=False),
        sa.Column('issuer', sa.String(length=100), nullable=False),
        sa.Column('credit_limit', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('billing_day', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='ILS', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('color', sa.String(length=7), server_default='#6366F1', nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('billing_day >= 1 AND billing_day <= 28', name='ck_credit_cards_billing_day'),
        sa.CheckConstraint('credit_limit > 0', name='ck_credit_cards_positive_limit'),
    )
    op.create_index('ix_credit_cards_org_id', 'credit_cards', ['organization_id'])
    op.create_index('ix_credit_cards_user_active', 'credit_cards', ['user_id', 'is_active'])
    op.create_index('ix_credit_cards_user_id', 'credit_cards', ['user_id'])

    # 3. org_reports
    op.create_table('org_reports',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('report_type', sa.String(length=20), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('generated_by', sa.UUID(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['generated_by'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_org_reports_generated_by', 'org_reports', ['generated_by'])
    op.create_index('ix_org_reports_org_id', 'org_reports', ['organization_id'])

    # 4. org_budgets
    op.create_table('org_budgets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('category_id', sa.UUID(), nullable=False),
        sa.Column('period_type', sa.String(length=20), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='ILS', nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('alert_at_percentage', sa.Integer(), server_default='80', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('amount > 0', name='ck_org_budgets_positive_amount'),
        sa.CheckConstraint('alert_at_percentage >= 1 AND alert_at_percentage <= 100', name='ck_org_budgets_alert_pct'),
    )
    op.create_index('ix_org_budgets_category_id', 'org_budgets', ['category_id'])
    op.create_index('ix_org_budgets_org_id', 'org_budgets', ['organization_id'])
    op.create_index('ix_org_budgets_user_id', 'org_budgets', ['user_id'])

    # 5. expense_approvals
    op.create_table('expense_approvals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('transaction_id', sa.UUID(), nullable=True),
        sa.Column('requested_by', sa.UUID(), nullable=False),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='ILS', nullable=False),
        sa.Column('category_id', sa.UUID(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_expense_approvals_status'),
        sa.CheckConstraint('amount > 0', name='ck_expense_approvals_positive_amount'),
    )
    op.create_index('ix_expense_approvals_org_id', 'expense_approvals', ['organization_id'])
    op.create_index('ix_expense_approvals_org_status', 'expense_approvals', ['organization_id', 'status'])
    op.create_index('ix_expense_approvals_requested_by', 'expense_approvals', ['requested_by'])
    op.create_index('ix_expense_approvals_status', 'expense_approvals', ['status'])

    # ── FK additions to existing tables ─────────────────────────

    # credit_card_id on 4 tables
    op.add_column('transactions', sa.Column('credit_card_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_transactions_credit_card_id', 'transactions', 'credit_cards', ['credit_card_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_transactions_credit_card_id', 'transactions', ['credit_card_id'])

    op.add_column('installments', sa.Column('credit_card_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_installments_credit_card_id', 'installments', 'credit_cards', ['credit_card_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_installments_credit_card_id', 'installments', ['credit_card_id'])

    op.add_column('subscriptions', sa.Column('credit_card_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_subscriptions_credit_card_id', 'subscriptions', 'credit_cards', ['credit_card_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_subscriptions_credit_card_id', 'subscriptions', ['credit_card_id'])

    op.add_column('fixed_income_expenses', sa.Column('credit_card_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_fixed_income_expenses_credit_card_id', 'fixed_income_expenses', 'credit_cards', ['credit_card_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_fixed_credit_card_id', 'fixed_income_expenses', ['credit_card_id'])

    # bank_account_id on 2 tables
    op.add_column('bank_balances', sa.Column('bank_account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_bank_balances_bank_account_id', 'bank_balances', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_bank_balances_bank_account_id', 'bank_balances', ['bank_account_id'])

    op.add_column('loans', sa.Column('bank_account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_loans_bank_account_id', 'loans', 'bank_accounts', ['bank_account_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_loans_bank_account_id', 'loans', ['bank_account_id'])


def downgrade() -> None:
    # ── Remove FK columns from existing tables ──────────────────
    op.drop_index('ix_loans_bank_account_id', table_name='loans')
    op.drop_constraint('fk_loans_bank_account_id', 'loans', type_='foreignkey')
    op.drop_column('loans', 'bank_account_id')

    op.drop_index('ix_bank_balances_bank_account_id', table_name='bank_balances')
    op.drop_constraint('fk_bank_balances_bank_account_id', 'bank_balances', type_='foreignkey')
    op.drop_column('bank_balances', 'bank_account_id')

    op.drop_index('ix_fixed_credit_card_id', table_name='fixed_income_expenses')
    op.drop_constraint('fk_fixed_income_expenses_credit_card_id', 'fixed_income_expenses', type_='foreignkey')
    op.drop_column('fixed_income_expenses', 'credit_card_id')

    op.drop_index('ix_subscriptions_credit_card_id', table_name='subscriptions')
    op.drop_constraint('fk_subscriptions_credit_card_id', 'subscriptions', type_='foreignkey')
    op.drop_column('subscriptions', 'credit_card_id')

    op.drop_index('ix_installments_credit_card_id', table_name='installments')
    op.drop_constraint('fk_installments_credit_card_id', 'installments', type_='foreignkey')
    op.drop_column('installments', 'credit_card_id')

    op.drop_index('ix_transactions_credit_card_id', table_name='transactions')
    op.drop_constraint('fk_transactions_credit_card_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'credit_card_id')

    # ── Drop new tables ─────────────────────────────────────────
    op.drop_index('ix_expense_approvals_status', table_name='expense_approvals')
    op.drop_index('ix_expense_approvals_requested_by', table_name='expense_approvals')
    op.drop_index('ix_expense_approvals_org_status', table_name='expense_approvals')
    op.drop_index('ix_expense_approvals_org_id', table_name='expense_approvals')
    op.drop_table('expense_approvals')

    op.drop_index('ix_org_budgets_user_id', table_name='org_budgets')
    op.drop_index('ix_org_budgets_org_id', table_name='org_budgets')
    op.drop_index('ix_org_budgets_category_id', table_name='org_budgets')
    op.drop_table('org_budgets')

    op.drop_index('ix_org_reports_org_id', table_name='org_reports')
    op.drop_index('ix_org_reports_generated_by', table_name='org_reports')
    op.drop_table('org_reports')

    op.drop_index('ix_credit_cards_user_id', table_name='credit_cards')
    op.drop_index('ix_credit_cards_user_active', table_name='credit_cards')
    op.drop_index('ix_credit_cards_org_id', table_name='credit_cards')
    op.drop_table('credit_cards')

    op.drop_index('ix_bank_accounts_user_id', table_name='bank_accounts')
    op.drop_index('ix_bank_accounts_org_id', table_name='bank_accounts')
    op.drop_table('bank_accounts')
