"""production hardening: indexes, constraints, triggers

Comprehensive production-grade hardening of the PostgreSQL database:
- Additional indexes for common query patterns and FK columns
- Partial indexes for active/non-archived records
- CHECK constraints for data integrity on all financial tables
- Enum-style constraints for type/status/severity fields
- Currency format validation
- Auto-update triggers for updated_at columns
- Admin deletion prevention trigger
- Audit logging trigger for significant financial changes
- Unique constraint to prevent duplicate bank balances per date per user

Revision ID: b708280a0aad
Revises: 029e8f951a2e
Create Date: 2026-02-16
"""
from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = 'b708280a0aad'
down_revision = '029e8f951a2e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =========================================================================
    # 1. ADDITIONAL INDEXES
    # =========================================================================

    # -- Foreign key indexes (missing) --
    # installments.category_id FK index
    op.create_index(
        'ix_installments_category_id', 'installments', ['category_id'],
        postgresql_where='category_id IS NOT NULL'
    )
    # loans.category_id FK index
    op.create_index(
        'ix_loans_category_id', 'loans', ['category_id'],
        postgresql_where='category_id IS NOT NULL'
    )
    # fixed_income_expenses.category_id FK index
    op.create_index(
        'ix_fixed_category_id', 'fixed_income_expenses', ['category_id'],
        postgresql_where='category_id IS NOT NULL'
    )
    # categories.parent_id FK index
    op.create_index(
        'ix_categories_parent_id', 'categories', ['parent_id'],
        postgresql_where='parent_id IS NOT NULL'
    )

    # -- Composite indexes for common queries --
    # installments: user + type (filter by income/expense)
    op.create_index(
        'ix_installments_user_type', 'installments', ['user_id', 'type']
    )
    # installments: user + start_date (date range queries)
    op.create_index(
        'ix_installments_user_start_date', 'installments', ['user_id', 'start_date']
    )
    # loans: user + start_date
    op.create_index(
        'ix_loans_user_start_date', 'loans', ['user_id', 'start_date']
    )
    # fixed: user + start_date
    op.create_index(
        'ix_fixed_user_start_date', 'fixed_income_expenses', ['user_id', 'start_date']
    )
    # alerts: user + severity (filter by severity)
    op.create_index(
        'ix_alerts_user_severity', 'alerts', ['user_id', 'severity']
    )
    # alerts: user + created_at (sort by recency)
    op.create_index(
        'ix_alerts_user_created_at', 'alerts', ['user_id', 'created_at']
    )
    # transactions: user + created_at (sort by recency)
    op.create_index(
        'ix_transactions_user_created_at', 'transactions', ['user_id', 'created_at']
    )

    # -- Partial indexes for active/non-archived records --
    # Active fixed income/expenses only
    op.create_index(
        'ix_fixed_active_only', 'fixed_income_expenses',
        ['user_id', 'type', 'day_of_month'],
        postgresql_where='is_active = true'
    )
    # Active (non-completed) installments
    op.create_index(
        'ix_installments_active', 'installments',
        ['user_id', 'type'],
        postgresql_where='payments_completed < number_of_payments'
    )
    # Active loans
    op.create_index(
        'ix_loans_active', 'loans',
        ['user_id'],
        postgresql_where="status = 'active'"
    )
    # Non-archived categories
    op.create_index(
        'ix_categories_active', 'categories',
        ['user_id', 'type'],
        postgresql_where='is_archived = false'
    )
    # Unread, non-dismissed alerts
    op.create_index(
        'ix_alerts_unread', 'alerts',
        ['user_id', 'created_at'],
        postgresql_where='is_read = false AND is_dismissed = false'
    )

    # =========================================================================
    # 2. CHECK CONSTRAINTS
    # =========================================================================

    # -- Loans --
    op.create_check_constraint(
        'ck_loan_interest_rate_non_negative', 'loans',
        'interest_rate >= 0'
    )
    op.create_check_constraint(
        'ck_loan_remaining_balance_non_negative', 'loans',
        'remaining_balance >= 0'
    )
    op.create_check_constraint(
        'ck_loan_payments_made_non_negative', 'loans',
        'payments_made >= 0'
    )
    op.create_check_constraint(
        'ck_loan_monthly_payment_positive', 'loans',
        'monthly_payment > 0'
    )
    op.create_check_constraint(
        'ck_loan_total_payments_positive', 'loans',
        'total_payments > 0'
    )
    op.create_check_constraint(
        'ck_loan_status_valid', 'loans',
        "status IN ('active', 'completed', 'paused')"
    )

    # -- Installments --
    op.create_check_constraint(
        'ck_installment_payments_non_negative', 'installments',
        'payments_completed >= 0'
    )
    op.create_check_constraint(
        'ck_installment_num_payments_positive', 'installments',
        'number_of_payments > 0'
    )
    op.create_check_constraint(
        'ck_installment_monthly_amount_positive', 'installments',
        'monthly_amount > 0'
    )
    op.create_check_constraint(
        'ck_installment_type_valid', 'installments',
        "type IN ('income', 'expense')"
    )

    # -- Fixed income/expenses --
    op.create_check_constraint(
        'ck_fixed_type_valid', 'fixed_income_expenses',
        "type IN ('income', 'expense')"
    )

    # -- Transactions --
    op.create_check_constraint(
        'ck_transaction_type_valid', 'transactions',
        "type IN ('income', 'expense')"
    )
    op.create_check_constraint(
        'ck_transaction_entry_pattern_valid', 'transactions',
        "entry_pattern IN ('one_time', 'recurring', 'installment', 'loan_payment')"
    )

    # -- Categories --
    op.create_check_constraint(
        'ck_category_type_valid', 'categories',
        "type IN ('income', 'expense')"
    )
    op.create_check_constraint(
        'ck_category_color_format', 'categories',
        "color ~ '^#[0-9a-fA-F]{6}$'"
    )

    # -- Alerts --
    op.create_check_constraint(
        'ck_alert_severity_valid', 'alerts',
        "severity IN ('info', 'warning', 'critical')"
    )

    # -- Expected income --
    op.create_check_constraint(
        'ck_expected_income_amount_positive', 'expected_income',
        'expected_amount > 0'
    )

    # -- Currency length validation (all financial tables) --
    op.create_check_constraint(
        'ck_transaction_currency_len', 'transactions',
        "length(currency) = 3"
    )
    op.create_check_constraint(
        'ck_fixed_currency_len', 'fixed_income_expenses',
        "length(currency) = 3"
    )
    op.create_check_constraint(
        'ck_installment_currency_len', 'installments',
        "length(currency) = 3"
    )
    op.create_check_constraint(
        'ck_loan_currency_len', 'loans',
        "length(currency) = 3"
    )
    op.create_check_constraint(
        'ck_balance_currency_len', 'bank_balances',
        "length(currency) = 3"
    )
    op.create_check_constraint(
        'ck_settings_currency_len', 'settings',
        "length(currency) = 3"
    )

    # -- Settings constraints --
    op.create_check_constraint(
        'ck_settings_week_start_day', 'settings',
        'week_start_day >= 0 AND week_start_day <= 6'
    )
    op.create_check_constraint(
        'ck_settings_forecast_months', 'settings',
        'forecast_months_default >= 1 AND forecast_months_default <= 24'
    )
    op.create_check_constraint(
        'ck_settings_theme_valid', 'settings',
        "theme IN ('light', 'dark', 'system')"
    )
    op.create_check_constraint(
        'ck_settings_language_valid', 'settings',
        "language IN ('he', 'en')"
    )

    # -- Users constraints --
    op.create_check_constraint(
        'ck_user_email_format', 'users',
        "email ~* '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'"
    )
    op.create_check_constraint(
        'ck_user_username_length', 'users',
        'length(username) >= 1'
    )

    # -- Bank balances: unique per user + date --
    op.create_unique_constraint(
        'uq_bank_balance_user_date', 'bank_balances',
        ['user_id', 'effective_date']
    )

    # =========================================================================
    # 3. TRIGGERS
    # =========================================================================

    # -- 3a. Auto-update updated_at trigger function --
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Apply to all tables that have updated_at
    for table in [
        'users', 'settings', 'categories', 'transactions',
        'fixed_income_expenses', 'installments', 'loans', 'expected_income'
    ]:
        op.execute(f"""
            CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION fn_update_updated_at();
        """)

    # -- 3b. Prevent deletion of admin users --
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_prevent_admin_delete()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.is_admin = true THEN
                RAISE EXCEPTION 'Cannot delete admin user (id=%)', OLD.id;
            END IF;
            RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_prevent_admin_delete
        BEFORE DELETE ON users
        FOR EACH ROW
        EXECUTE FUNCTION fn_prevent_admin_delete();
    """)

    # -- 3c. Audit log table + triggers for significant changes --
    op.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id BIGSERIAL PRIMARY KEY,
            table_name VARCHAR(50) NOT NULL,
            record_id UUID NOT NULL,
            user_id UUID,
            action VARCHAR(20) NOT NULL,
            old_values JSONB,
            new_values JSONB,
            changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE INDEX ix_audit_log_table_record ON audit_log (table_name, record_id);
    """)
    op.execute("""
        CREATE INDEX ix_audit_log_user_id ON audit_log (user_id);
    """)
    op.execute("""
        CREATE INDEX ix_audit_log_changed_at ON audit_log (changed_at);
    """)

    # Trigger: Log balance changes
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_audit_balance_change()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO audit_log (table_name, record_id, user_id, action, new_values)
                VALUES ('bank_balances', NEW.id, NEW.user_id, 'INSERT',
                    jsonb_build_object('balance', NEW.balance, 'effective_date', NEW.effective_date, 'currency', NEW.currency));
                RETURN NEW;
            ELSIF TG_OP = 'UPDATE' THEN
                IF OLD.balance IS DISTINCT FROM NEW.balance THEN
                    INSERT INTO audit_log (table_name, record_id, user_id, action, old_values, new_values)
                    VALUES ('bank_balances', NEW.id, NEW.user_id, 'UPDATE',
                        jsonb_build_object('balance', OLD.balance),
                        jsonb_build_object('balance', NEW.balance));
                END IF;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                INSERT INTO audit_log (table_name, record_id, user_id, action, old_values)
                VALUES ('bank_balances', OLD.id, OLD.user_id, 'DELETE',
                    jsonb_build_object('balance', OLD.balance, 'effective_date', OLD.effective_date));
                RETURN OLD;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_balance_change
        AFTER INSERT OR UPDATE OR DELETE ON bank_balances
        FOR EACH ROW
        EXECUTE FUNCTION fn_audit_balance_change();
    """)

    # Trigger: Log large transactions (amount >= 10000)
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_audit_large_transaction()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' AND NEW.amount >= 10000 THEN
                INSERT INTO audit_log (table_name, record_id, user_id, action, new_values)
                VALUES ('transactions', NEW.id, NEW.user_id, 'LARGE_INSERT',
                    jsonb_build_object('amount', NEW.amount, 'type', NEW.type, 'date', NEW.date, 'description', COALESCE(NEW.description, '')));
            ELSIF TG_OP = 'UPDATE' AND (NEW.amount >= 10000 OR OLD.amount >= 10000) THEN
                INSERT INTO audit_log (table_name, record_id, user_id, action, old_values, new_values)
                VALUES ('transactions', NEW.id, NEW.user_id, 'LARGE_UPDATE',
                    jsonb_build_object('amount', OLD.amount, 'type', OLD.type),
                    jsonb_build_object('amount', NEW.amount, 'type', NEW.type));
            ELSIF TG_OP = 'DELETE' AND OLD.amount >= 10000 THEN
                INSERT INTO audit_log (table_name, record_id, user_id, action, old_values)
                VALUES ('transactions', OLD.id, OLD.user_id, 'LARGE_DELETE',
                    jsonb_build_object('amount', OLD.amount, 'type', OLD.type, 'date', OLD.date));
            END IF;
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_large_transaction
        AFTER INSERT OR UPDATE OR DELETE ON transactions
        FOR EACH ROW
        EXECUTE FUNCTION fn_audit_large_transaction();
    """)

    # Trigger: Log loan status changes
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_audit_loan_status()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.status IS DISTINCT FROM NEW.status OR OLD.payments_made IS DISTINCT FROM NEW.payments_made THEN
                INSERT INTO audit_log (table_name, record_id, user_id, action, old_values, new_values)
                VALUES ('loans', NEW.id, NEW.user_id, 'STATUS_CHANGE',
                    jsonb_build_object('status', OLD.status, 'payments_made', OLD.payments_made, 'remaining_balance', OLD.remaining_balance),
                    jsonb_build_object('status', NEW.status, 'payments_made', NEW.payments_made, 'remaining_balance', NEW.remaining_balance));
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_loan_status
        AFTER UPDATE ON loans
        FOR EACH ROW
        EXECUTE FUNCTION fn_audit_loan_status();
    """)


def downgrade() -> None:
    # =========================================================================
    # Drop triggers (reverse order)
    # =========================================================================
    op.execute("DROP TRIGGER IF EXISTS trg_audit_loan_status ON loans;")
    op.execute("DROP FUNCTION IF EXISTS fn_audit_loan_status();")

    op.execute("DROP TRIGGER IF EXISTS trg_audit_large_transaction ON transactions;")
    op.execute("DROP FUNCTION IF EXISTS fn_audit_large_transaction();")

    op.execute("DROP TRIGGER IF EXISTS trg_audit_balance_change ON bank_balances;")
    op.execute("DROP FUNCTION IF EXISTS fn_audit_balance_change();")

    op.execute("DROP INDEX IF EXISTS ix_audit_log_changed_at;")
    op.execute("DROP INDEX IF EXISTS ix_audit_log_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_audit_log_table_record;")
    op.execute("DROP TABLE IF EXISTS audit_log;")

    op.execute("DROP TRIGGER IF EXISTS trg_prevent_admin_delete ON users;")
    op.execute("DROP FUNCTION IF EXISTS fn_prevent_admin_delete();")

    for table in [
        'users', 'settings', 'categories', 'transactions',
        'fixed_income_expenses', 'installments', 'loans', 'expected_income'
    ]:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};")

    op.execute("DROP FUNCTION IF EXISTS fn_update_updated_at();")

    # =========================================================================
    # Drop constraints
    # =========================================================================
    op.drop_constraint('uq_bank_balance_user_date', 'bank_balances', type_='unique')

    op.drop_constraint('ck_user_username_length', 'users', type_='check')
    op.drop_constraint('ck_user_email_format', 'users', type_='check')

    op.drop_constraint('ck_settings_language_valid', 'settings', type_='check')
    op.drop_constraint('ck_settings_theme_valid', 'settings', type_='check')
    op.drop_constraint('ck_settings_forecast_months', 'settings', type_='check')
    op.drop_constraint('ck_settings_week_start_day', 'settings', type_='check')

    op.drop_constraint('ck_settings_currency_len', 'settings', type_='check')
    op.drop_constraint('ck_balance_currency_len', 'bank_balances', type_='check')
    op.drop_constraint('ck_loan_currency_len', 'loans', type_='check')
    op.drop_constraint('ck_installment_currency_len', 'installments', type_='check')
    op.drop_constraint('ck_fixed_currency_len', 'fixed_income_expenses', type_='check')
    op.drop_constraint('ck_transaction_currency_len', 'transactions', type_='check')

    op.drop_constraint('ck_expected_income_amount_positive', 'expected_income', type_='check')
    op.drop_constraint('ck_alert_severity_valid', 'alerts', type_='check')
    op.drop_constraint('ck_category_color_format', 'categories', type_='check')
    op.drop_constraint('ck_category_type_valid', 'categories', type_='check')
    op.drop_constraint('ck_transaction_entry_pattern_valid', 'transactions', type_='check')
    op.drop_constraint('ck_transaction_type_valid', 'transactions', type_='check')
    op.drop_constraint('ck_fixed_type_valid', 'fixed_income_expenses', type_='check')
    op.drop_constraint('ck_installment_type_valid', 'installments', type_='check')
    op.drop_constraint('ck_installment_monthly_amount_positive', 'installments', type_='check')
    op.drop_constraint('ck_installment_num_payments_positive', 'installments', type_='check')
    op.drop_constraint('ck_installment_payments_non_negative', 'installments', type_='check')
    op.drop_constraint('ck_loan_status_valid', 'loans', type_='check')
    op.drop_constraint('ck_loan_total_payments_positive', 'loans', type_='check')
    op.drop_constraint('ck_loan_monthly_payment_positive', 'loans', type_='check')
    op.drop_constraint('ck_loan_payments_made_non_negative', 'loans', type_='check')
    op.drop_constraint('ck_loan_remaining_balance_non_negative', 'loans', type_='check')
    op.drop_constraint('ck_loan_interest_rate_non_negative', 'loans', type_='check')

    # =========================================================================
    # Drop indexes
    # =========================================================================
    op.drop_index('ix_alerts_unread', 'alerts')
    op.drop_index('ix_categories_active', 'categories')
    op.drop_index('ix_loans_active', 'loans')
    op.drop_index('ix_installments_active', 'installments')
    op.drop_index('ix_fixed_active_only', 'fixed_income_expenses')

    op.drop_index('ix_transactions_user_created_at', 'transactions')
    op.drop_index('ix_alerts_user_created_at', 'alerts')
    op.drop_index('ix_alerts_user_severity', 'alerts')
    op.drop_index('ix_fixed_user_start_date', 'fixed_income_expenses')
    op.drop_index('ix_loans_user_start_date', 'loans')
    op.drop_index('ix_installments_user_start_date', 'installments')
    op.drop_index('ix_installments_user_type', 'installments')

    op.drop_index('ix_categories_parent_id', 'categories')
    op.drop_index('ix_fixed_category_id', 'fixed_income_expenses')
    op.drop_index('ix_loans_category_id', 'loans')
    op.drop_index('ix_installments_category_id', 'installments')
