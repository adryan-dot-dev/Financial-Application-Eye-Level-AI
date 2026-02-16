-- ============================================
-- Database Security Initialization Script
-- ============================================
-- Run this ONCE as the postgres superuser after creating the database.
-- Usage: psql -U postgres -d cashflow -f init_db_security.sql
-- ============================================

-- Create restricted application user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cashflow_app') THEN
        CREATE ROLE cashflow_app WITH LOGIN PASSWORD 'CashFlow_Pr0d_2026!Secure';
        RAISE NOTICE 'Created role cashflow_app';
    ELSE
        ALTER ROLE cashflow_app WITH PASSWORD 'CashFlow_Pr0d_2026!Secure';
        RAISE NOTICE 'Role cashflow_app already exists, password updated';
    END IF;
END
$$;

-- Grant connection privilege
GRANT CONNECT ON DATABASE cashflow TO cashflow_app;

-- Grant schema usage (read/write data, but NOT create/drop tables)
GRANT USAGE ON SCHEMA public TO cashflow_app;

-- Grant DML privileges on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cashflow_app;

-- Grant DML privileges on future tables (created by migration user)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cashflow_app;

-- Grant sequence usage (needed for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cashflow_app;

-- Grant sequence usage on future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cashflow_app;

-- Revoke DDL privileges from PUBLIC role (prevent app user from creating tables)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ============================================
-- Verification queries (uncomment to check)
-- ============================================
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'cashflow_app';
-- SELECT has_schema_privilege('cashflow_app', 'public', 'CREATE') AS can_create_in_schema;

