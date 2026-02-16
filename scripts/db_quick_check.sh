#!/bin/bash
# Quick database health check
# הרצה: ./scripts/db_quick_check.sh
echo "=== CashFlow DB Quick Check ==="
echo ""

echo "=== Record Counts ==="
docker exec cashflow-db psql -U cashflow -c "
SELECT 'Users' as entity, count(*) as count FROM users
UNION ALL SELECT 'Settings', count(*) FROM settings
UNION ALL SELECT 'Categories', count(*) FROM categories
UNION ALL SELECT 'Transactions', count(*) FROM transactions
UNION ALL SELECT 'Fixed Income/Expenses', count(*) FROM fixed_income_expenses
UNION ALL SELECT 'Installments', count(*) FROM installments
UNION ALL SELECT 'Loans', count(*) FROM loans
UNION ALL SELECT 'Bank Balances', count(*) FROM bank_balances
UNION ALL SELECT 'Alerts', count(*) FROM alerts
UNION ALL SELECT 'Expected Income', count(*) FROM expected_income
ORDER BY count DESC;
"

echo ""
echo "=== Users without Settings (SHOULD BE EMPTY) ==="
docker exec cashflow-db psql -U cashflow -c "
SELECT u.username, u.email FROM users u LEFT JOIN settings s ON u.id = s.user_id WHERE s.id IS NULL;
"

echo ""
echo "=== Recent Users ==="
docker exec cashflow-db psql -U cashflow -c "
SELECT u.username, u.email, u.created_at, 
  CASE WHEN s.onboarding_completed THEN 'Yes' ELSE 'No' END as onboarded
FROM users u LEFT JOIN settings s ON u.id = s.user_id
ORDER BY u.created_at DESC LIMIT 5;
"

echo ""
echo "=== DB Size ==="
docker exec cashflow-db psql -U cashflow -c "
SELECT pg_size_pretty(pg_database_size('cashflow')) as db_size;
"
