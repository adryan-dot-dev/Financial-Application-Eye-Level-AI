# Agent 1 — Backend Verification, Bug Fix & Hardening

## Your Mission

You are a backend verification agent for the CashFlow Management system. Your job:
1. Run ALL backend tests — fix every failure
2. Fix ALL backend bugs found by QA audit (listed below)
3. Verify test isolation — results must be deterministic (same every run)
4. Target: **750+ passed, 0 failed, deterministic**
5. Do NOT break any passing test

## Project Location

```
/Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
```

## Technical Constraints (CRITICAL)

- **Python 3.9.6** — `from __future__ import annotations` in ALL files, NO `X | Y` union syntax
- **DECIMAL(15,2)** for financial amounts — NEVER use float
- **async SQLAlchemy 2.0** with asyncpg
- All new columns MUST be `nullable=True` or have `server_default`
- API prefix: `/api/v1/`

## Commands

```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
source venv/bin/activate
PYTHONPATH=. pytest tests/ -v --tb=short          # full suite
PYTHONPATH=. pytest tests/test_FILE.py -v --tb=long # single file
PYTHONPATH=. alembic upgrade head                   # migration
```

## CRITICAL: Tests Are FLAKY

Multiple runs produce different results (4 to 34 failures). Root cause: **tests share database state**. Fix isolation alongside individual bugs.

---

## PART A: Test Failures (up to 34 unique across runs)

### Group 1: IDOR / User Isolation (18 tests)
Tests create User2 and verify User2 can't access User1's data. Fail because User2 auth token isn't properly set up.
```
test_idor_comprehensive.py (10 tests: category_update, category_delete, fixed_get, fixed_update, installment_get, installment_update, loan_payment, balance_access, alert_read, subscription_get)
test_cross_module_integration.py::test_user_isolation
test_cross_module_integration.py::test_dashboard_user_isolation
test_integration.py::test_user_isolation_across_all_modules
test_credit_cards.py::test_idor_get_other_user_card       — expects 403, gets 401
test_bank_accounts.py::test_idor_protection               — expects 404, gets 401
test_subscriptions.py::test_subscription_idor_prevention
test_edge_cases.py::test_user2_cannot_access_user1_loan
test_bulk_operations.py::test_bulk_delete_other_users_ids
```

### Group 2: Org Permissions + Reports (13 tests)
Tests call org sub-endpoints that return 404 or wrong status.
```
test_org_permissions.py (11 tests: generate_reports, approve, audit_log, etc.)
test_org_reports.py::test_delete_report, test_member_cannot_generate, test_list_reports
test_missing_endpoints.py::test_add_member_to_organization
```

### Group 3: Users Admin (4 tests)
StaleDataError — ORM session doesn't match DB state.
```
test_users_admin.py::test_reset_password
test_users_admin.py::test_update_user_deactivate
test_users_admin.py::test_list_users_search_by_username
test_users_admin.py::test_list_users_requires_admin
```

### Group 4: Miscellaneous (13 tests)
```
test_transactions.py::test_list_transactions_paginated
test_auth_completeness.py::test_change_password_success
test_dashboard.py::test_loans_summary_with_data / progress_after_payment
test_production_fixes.py::test_reverse_completed_loan_reactivates
test_production_fixes.py::test_circular_reference_chain
test_cascade_integrity.py (3 tests)
test_bank_accounts.py::test_list_bank_accounts
test_categories.py::test_delete_category_soft
test_edge_cases.py::test_create_loan_with_single_payment
test_concurrent_access.py::test_concurrent_read_write
test_automation.py (2 tests)
```

---

## PART B: Backend Bugs Found by QA Audit — FIX ALL

### BUG-B1: Untyped `response_model=list` (4 endpoints) — HIGH
```
app/api/v1/endpoints/bank_accounts.py:62  → should be List[BankAccountResponse]
app/api/v1/endpoints/credit_cards.py:67   → should be List[CreditCardResponse]
app/api/v1/endpoints/credit_cards.py:212  → should be List[CardChargeItem] or proper type
app/api/v1/endpoints/budgets.py:72        → should be List[BudgetResponse]
```
Fix: Import proper response types and set `response_model=List[TypeName]`.

### BUG-B2: Orphaned transactions on installment reverse-payment — CRITICAL
`app/api/v1/endpoints/installments.py:425-450`: When reversing a payment, `payments_completed` is decremented but the associated Transaction record is NOT deleted. Creates phantom transactions.
Fix: Query and delete the transaction created during the original mark-paid before decrementing.

### BUG-B3: Verify `credit_card_id` exists in ALL create/update schemas — CRITICAL
Frontend sends `credit_card_id` when creating transactions, installments, subscriptions, fixed entries. Verify these schemas accept it:
- `app/api/v1/schemas/transaction.py` — `TransactionCreate` / `TransactionUpdate`
- `app/api/v1/schemas/installment.py` — `InstallmentCreate` / `InstallmentUpdate`
- `app/api/v1/schemas/subscription.py` — `SubscriptionCreate` / `SubscriptionUpdate`
- `app/api/v1/schemas/fixed.py` — `FixedCreate` / `FixedUpdate`
If missing, add: `credit_card_id: Optional[uuid.UUID] = None`

### BUG-B4: Verify `bank_account_id` exists in balance/loan schemas — CRITICAL
- `app/api/v1/schemas/balance.py` — `BalanceCreate` / `BalanceUpdate`
- `app/api/v1/schemas/loan.py` — `LoanCreate` / `LoanUpdate`
If missing, add: `bank_account_id: Optional[uuid.UUID] = None`

### BUG-B5: Balance `currency` field not in schemas — HIGH
`app/db/models/bank_balance.py:25` has `currency` column but `BalanceCreate`/`BalanceUpdate` schemas don't expose it.
Fix: Add `currency: Optional[str] = Field(None, pattern="^[A-Z]{3}$")` to both schemas.

### BUG-B6: `first_payment_made` not in schemas — HIGH
`app/api/v1/endpoints/installments.py:223` pops `first_payment_made` from data but schema may not include it.
Same for `app/api/v1/endpoints/loans.py:149`.
Fix: Add `first_payment_made: Optional[bool] = False` to InstallmentCreate and LoanCreate schemas.

### BUG-B7: Category circular reference detection incomplete — MEDIUM
`app/api/v1/endpoints/categories.py:146-160`: Only detects cycles that include the current category. A→B→C→B cycle is not caught.
Fix: If `current in visited` AND it's not `category_id`, raise error for general cycle.

### BUG-B8: Missing database indexes — MEDIUM
- `credit_cards`: Add `Index("ix_credit_cards_user_active", "user_id", "is_active")`
- `subscriptions`: Add `Index("ix_subscriptions_credit_card_id", "credit_card_id")`

### BUG-B9: Alert generation not scheduled — MEDIUM
Alerts are only generated on dashboard/forecast load. Should also run on scheduler.
In `app/services/scheduler.py`: Add a daily job (e.g., 00:10 after recurring charges) that calls `generate_alerts()` for all users.

### BUG-B10: Exchange rate — verify conversion direction — MEDIUM
User reported wrong conversion. Service logic at `exchange_rate_service.py:185` uses `amount * rate`.
Verify: When Frankfurter returns USD→ILS rate of 3.65, conversion of 100 USD should give 365 ILS.
Check if the rate is being fetched in the right direction.

---

## Strategy

### Phase 1: Investigate (4 sub-agents in parallel)

**Sub-agent A — Test Group 1+2 (IDOR + Org):**
- Read conftest.py, test_idor_comprehensive.py, test_org_permissions.py
- Check user2 fixture setup
- Check org sub-route paths vs test URLs
- Run failing tests with --tb=long

**Sub-agent B — Test Group 3+4 (Users + Misc):**
- Read test_users_admin.py, users.py endpoint
- Run all misc failing tests with --tb=long
- Identify StaleDataError root cause

**Sub-agent C — Backend Bugs B1-B5:**
- Read all 4 schema files (transaction, installment, subscription, fixed)
- Verify credit_card_id, bank_account_id, currency, first_payment_made fields
- Read installments.py reverse-payment code
- Read all 4 endpoints with response_model=list

**Sub-agent D — Backend Bugs B6-B10:**
- Read categories.py circular ref code
- Read models for missing indexes
- Read scheduler.py for alert generation gap
- Read exchange_rate_service.py conversion logic

### Phase 2: Fix (sequentially, test after each)
1. Fix bugs (source code first, then tests)
2. After each fix: run that specific test
3. After each group: run full suite

### Phase 3: Determinism Check
```bash
PYTHONPATH=. pytest tests/ -v --tb=short 2>&1 | tail -5
PYTHONPATH=. pytest tests/ -v --tb=short 2>&1 | tail -5
```
Both runs MUST show identical results.

## Expected Output

1. Total failures on first run
2. Root cause per group + per bug
3. What changed per fix (file + description)
4. Final: 0 failures, two consecutive runs match
5. All files modified
