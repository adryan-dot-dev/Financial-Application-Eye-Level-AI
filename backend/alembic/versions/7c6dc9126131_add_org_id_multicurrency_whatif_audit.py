"""add_org_id_multicurrency_whatif_audit

Revision ID: 7c6dc9126131
Revises: 3ff79e0f3942
Create Date: 2026-02-17 17:25:10.747101

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7c6dc9126131'
down_revision: Union[str, None] = '3ff79e0f3942'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 1. New tables
    # -----------------------------------------------------------------------
    op.create_table(
        'organization_settings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='ILS', nullable=False),
        sa.Column('date_format', sa.String(length=20), server_default='DD/MM/YYYY', nullable=False),
        sa.Column('notifications_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('forecast_months_default', sa.Integer(), server_default='6', nullable=False),
        sa.Column('week_start_day', sa.Integer(), server_default='0', nullable=False),
        sa.Column('alert_warning_threshold', sa.Numeric(precision=15, scale=2), server_default='5000', nullable=False),
        sa.Column('alert_critical_threshold', sa.Numeric(precision=15, scale=2), server_default='1000', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id'),
    )

    op.create_table(
        'forecast_scenarios',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('params', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('months', sa.Integer(), server_default='6', nullable=False),
        sa.Column('is_baseline', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_forecast_scenarios_user_id', 'forecast_scenarios', ['user_id'])
    op.create_index('ix_forecast_scenarios_org_id', 'forecast_scenarios', ['organization_id'])

    # -----------------------------------------------------------------------
    # 2. Add organization_id to all financial tables
    # -----------------------------------------------------------------------
    _org_tables = [
        'transactions', 'fixed_income_expenses', 'installments', 'loans',
        'bank_balances', 'categories', 'subscriptions', 'expected_income',
        'alerts',
    ]
    for table in _org_tables:
        op.add_column(table, sa.Column('organization_id', sa.UUID(), nullable=True))
        op.create_index(f'ix_{table}_organization_id', table, ['organization_id'])
        op.create_foreign_key(
            f'fk_{table}_organization_id', table, 'organizations',
            ['organization_id'], ['id'], ondelete='CASCADE',
        )

    # Extra composite indexes for frequently queried patterns
    op.create_index('ix_transactions_org_date', 'transactions', ['organization_id', 'date'])
    op.create_index('ix_bank_balances_org_current', 'bank_balances', ['organization_id', 'is_current'])
    op.create_index('ix_fixed_org_active', 'fixed_income_expenses', ['organization_id', 'is_active'])

    # -----------------------------------------------------------------------
    # 3. Multi-currency columns on financial models
    # -----------------------------------------------------------------------
    _currency_tables = ['transactions', 'fixed_income_expenses', 'installments', 'subscriptions']
    for table in _currency_tables:
        op.add_column(table, sa.Column('original_amount', sa.Numeric(precision=15, scale=2), nullable=True))
        op.add_column(table, sa.Column('original_currency', sa.String(length=3), nullable=True))
        op.add_column(table, sa.Column('exchange_rate', sa.Numeric(precision=15, scale=6), nullable=True))

    # Loans: use original_currency_amount to avoid collision with existing original_amount (principal)
    op.add_column('loans', sa.Column('original_currency_amount', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('loans', sa.Column('original_currency', sa.String(length=3), nullable=True))
    op.add_column('loans', sa.Column('exchange_rate', sa.Numeric(precision=15, scale=6), nullable=True))

    # ExpectedIncome: add missing currency field
    op.add_column('expected_income', sa.Column('currency', sa.String(length=3), server_default='ILS', nullable=False))

    # -----------------------------------------------------------------------
    # 4. Audit trail enhancement
    # -----------------------------------------------------------------------
    op.add_column('audit_logs', sa.Column('user_email', sa.String(length=255), nullable=True))
    op.add_column('audit_logs', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.create_index('ix_audit_logs_org_id', 'audit_logs', ['organization_id'])

    # -----------------------------------------------------------------------
    # 5. Backfill existing data (original_amount = amount, exchange_rate = 1)
    # -----------------------------------------------------------------------
    for table in ['transactions', 'fixed_income_expenses', 'subscriptions']:
        op.execute(
            f"UPDATE {table} SET original_amount = amount, "
            f"original_currency = currency, exchange_rate = 1.000000 "
            f"WHERE original_amount IS NULL"
        )
    # Installments uses total_amount, not amount
    op.execute(
        "UPDATE installments SET original_amount = total_amount, "
        "original_currency = currency, exchange_rate = 1.000000 "
        "WHERE original_amount IS NULL"
    )
    op.execute(
        "UPDATE loans SET original_currency_amount = original_amount, "
        "original_currency = currency, exchange_rate = 1.000000 "
        "WHERE original_currency_amount IS NULL"
    )


def downgrade() -> None:
    # Audit trail
    op.drop_index('ix_audit_logs_org_id', table_name='audit_logs')
    op.drop_column('audit_logs', 'organization_id')
    op.drop_column('audit_logs', 'user_email')

    # Multi-currency
    op.drop_column('expected_income', 'currency')
    for table in ['transactions', 'fixed_income_expenses', 'installments', 'subscriptions']:
        op.drop_column(table, 'exchange_rate')
        op.drop_column(table, 'original_currency')
        op.drop_column(table, 'original_amount')
    op.drop_column('loans', 'exchange_rate')
    op.drop_column('loans', 'original_currency')
    op.drop_column('loans', 'original_currency_amount')

    # Organization composite indexes
    op.drop_index('ix_fixed_org_active', table_name='fixed_income_expenses')
    op.drop_index('ix_bank_balances_org_current', table_name='bank_balances')
    op.drop_index('ix_transactions_org_date', table_name='transactions')

    # Organization_id from all tables
    _org_tables = [
        'alerts', 'expected_income', 'subscriptions', 'categories',
        'bank_balances', 'loans', 'installments', 'fixed_income_expenses',
        'transactions',
    ]
    for table in _org_tables:
        op.drop_constraint(f'fk_{table}_organization_id', table, type_='foreignkey')
        op.drop_index(f'ix_{table}_organization_id', table_name=table)
        op.drop_column(table, 'organization_id')

    # New tables
    op.drop_index('ix_forecast_scenarios_org_id', table_name='forecast_scenarios')
    op.drop_index('ix_forecast_scenarios_user_id', table_name='forecast_scenarios')
    op.drop_table('forecast_scenarios')
    op.drop_table('organization_settings')
