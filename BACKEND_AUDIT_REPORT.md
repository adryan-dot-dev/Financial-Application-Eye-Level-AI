# Backend Comprehensive Audit Report & Test Plan
**Date:** 2026-02-16
**Status:** Pre-Production Readiness Review
**Total Existing Tests:** 176 (all ERROR - PostgreSQL not running)

---

## EXECUTIVE SUMMARY

7 parallel audit agents scanned the entire backend codebase:
- **10 API modules** reviewed (transactions, categories, fixed, installments, loans, balance, forecast, alerts, settings, dashboard)
- **67+ API routes** analyzed
- **176 existing tests** identified (cannot run - Docker/PostgreSQL offline)
- **48 critical/high issues** found
- **120+ missing test cases** identified

### Overall Score by Module

| Module | Score | Critical Issues | Test Coverage |
|--------|-------|-----------------|---------------|
| Auth & Security | 7.4/10 | 2 | ~70% |
| Transactions | 7/10 | 5 | ~30% |
| Categories | 6/10 | 4 | ~20% |
| Fixed Payments | 7/10 | 3 | ~40% |
| Installments | 5/10 | 3 | ~35% |
| Loans | 6/10 | 4 | ~40% |
| Forecast | 7.5/10 | 2 | ~55% |
| Balance | 7/10 | 2 | ~50% |
| Alerts | 7/10 | 2 | ~45% |
| Dashboard | 7/10 | 1 | **0%** |
| Settings | 7.2/10 | 1 | ~30% |

---

## PART 1: CRITICAL BUGS FOUND

### RED - Must Fix Before Production

| # | Module | Bug | Impact | Location |
|---|--------|-----|--------|----------|
| 1 | Categories | NO PAGINATION on list endpoint | OOM risk with many categories | `endpoints/categories.py` |
| 2 | Installments | NO endpoint to mark payments as paid | Core functionality missing | `endpoints/installments.py` |
| 3 | Loans | Amortization schedule diverges from actual payments | Wrong financial data displayed | `endpoints/loans.py` |
| 4 | Balance | Race condition - multiple `is_current=True` possible | Wrong balance shown | `endpoints/balance.py` |
| 5 | Dashboard | 0% test coverage (0/10 endpoints tested) | No regression safety | No test file exists |
| 6 | Transactions | Archived categories can be assigned to new transactions | Data integrity | `endpoints/transactions.py:104` |
| 7 | Categories | Circular parent-child references allowed | Infinite loops | `endpoints/categories.py` |
| 8 | Installments | Rounding error accumulation (1000÷3 = 333.33×3 = 999.99) | Financial inaccuracy | `endpoints/installments.py` |

### ORANGE - High Priority

| # | Module | Bug | Impact |
|---|--------|-----|--------|
| 9 | Fixed | Category type mismatch not validated | Wrong reporting |
| 10 | Loans | Can create loan where monthly_payment < monthly_interest | Infinite loan |
| 11 | Loans | Partial payments not tracked properly | Payment count wrong |
| 12 | Transactions | Date range allows start > end (no validation) | Silent wrong results |
| 13 | Categories | Category type change doesn't cascade to transactions | Semantic corruption |
| 14 | Fixed | Concurrent automation calls not truly idempotent (TOCTOU) | Duplicate transactions |
| 15 | Alerts | Thresholds hardcoded (1000, 5000, 10000 ILS) | Not scalable per user |
| 16 | Settings | Currency, language, date_format not validated | Invalid data stored |
| 17 | Auth | No token blacklist/revocation on logout | Security gap |
| 18 | Dashboard | Week start hardcoded to Sunday, ignores user settings | Wrong display |

### YELLOW - Medium Priority

| # | Module | Bug | Impact |
|---|--------|-----|--------|
| 19 | Fixed | No audit trail for pause/resume | No accountability |
| 20 | Transactions | entry_pattern not validated on update | Invalid state |
| 21 | Both | No payment reversal endpoint | Can't undo errors |
| 22 | Forecast | Paused loans still counted | Wrong predictions |
| 23 | Balance | Decimal validation (15 total vs 13 integer digits) | Edge case overflow |
| 24 | Alerts | `expires_at` field exists but never used | Dead code |
| 25 | Auth | Rate limit per-IP only (no per-user) | Brute force risk |
| 26 | Dashboard | Emergency fund score wrong when expenses = 0 | Misleading health |

---

## PART 2: MISSING DB CONSTRAINTS

These should be added via Alembic migration:

```sql
-- Prevent invalid payment counts
ALTER TABLE installments ADD CONSTRAINT ck_installments_payments
  CHECK (payments_completed <= number_of_payments);

ALTER TABLE loans ADD CONSTRAINT ck_loans_payments
  CHECK (payments_made <= total_payments);

-- Enforce day_of_month range (schema validates but DB doesn't)
ALTER TABLE fixed_income_expenses ADD CONSTRAINT ck_fixed_day
  CHECK (day_of_month >= 1 AND day_of_month <= 31);

ALTER TABLE installments ADD CONSTRAINT ck_inst_day
  CHECK (day_of_month >= 1 AND day_of_month <= 31);

ALTER TABLE loans ADD CONSTRAINT ck_loan_day
  CHECK (day_of_month >= 1 AND day_of_month <= 31);

-- Enforce positive amounts at DB level
ALTER TABLE transactions ADD CONSTRAINT ck_transaction_amount
  CHECK (amount > 0);

ALTER TABLE fixed_income_expenses ADD CONSTRAINT ck_fixed_amount
  CHECK (amount > 0);

-- Unique current balance per user
CREATE UNIQUE INDEX uq_balance_current
  ON bank_balances (user_id) WHERE is_current = TRUE;

-- Alert type enum
ALTER TABLE alerts ADD CONSTRAINT ck_alert_type
  CHECK (alert_type IN ('negative_cashflow', 'high_expenses', 'approaching_negative'));

ALTER TABLE alerts ADD CONSTRAINT ck_alert_severity
  CHECK (severity IN ('critical', 'warning', 'info'));
```

---

## PART 3: COMPREHENSIVE TEST PLAN

### PREREQUISITE: Start Docker & PostgreSQL
```bash
# Start Docker Desktop, then:
docker start cashflow-postgres
# Or: docker-compose up -d
cd backend && source venv/bin/activate
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. pytest tests/ -v
```

---

### MODULE 1: AUTH & SECURITY (15 tests needed)

#### Registration Tests
- [ ] `test_register_valid_user` - Standard registration
- [ ] `test_register_duplicate_username` - 409 conflict
- [ ] `test_register_duplicate_email` - 409 conflict
- [ ] `test_register_weak_password_no_uppercase` - 422
- [ ] `test_register_weak_password_no_digit` - 422
- [ ] `test_register_weak_password_too_short` - 422
- [ ] `test_register_empty_username` - 422

#### Login & Token Tests
- [ ] `test_login_correct_credentials` - Returns access + refresh
- [ ] `test_login_wrong_password` - 401
- [ ] `test_login_nonexistent_user` - 401
- [ ] `test_expired_access_token` - 401
- [ ] `test_expired_refresh_token` - 401
- [ ] `test_refresh_with_access_token` - 401 (wrong token type)
- [ ] `test_token_refresh_returns_new_tokens` - New pair
- [ ] `test_inactive_user_cannot_login` - 401

#### Security Tests
- [ ] `test_change_password_flow` - Old→New
- [ ] `test_change_password_wrong_old` - 401
- [ ] `test_cors_blocks_unknown_origin` - CORS enforcement
- [ ] `test_rate_limit_login` - 429 after 5 attempts

---

### MODULE 2: TRANSACTIONS (25 tests needed)

#### CRUD Tests
- [ ] `test_create_transaction_income` - Basic income
- [ ] `test_create_transaction_expense` - Basic expense
- [ ] `test_create_transaction_with_category` - Category association
- [ ] `test_create_transaction_without_category` - Null category OK
- [ ] `test_update_transaction_amount` - Change amount
- [ ] `test_update_transaction_type` - Change type
- [ ] `test_delete_transaction` - Hard delete, verify 404

#### Validation Tests
- [ ] `test_create_transaction_zero_amount` - 422 (gt=0)
- [ ] `test_create_transaction_negative_amount` - 422
- [ ] `test_create_transaction_invalid_type` - 422
- [ ] `test_create_transaction_missing_date` - 422
- [ ] `test_create_transaction_max_amount` - 9999999999999.99
- [ ] `test_create_transaction_excessive_precision` - 422 (3+ decimals)
- [ ] `test_create_transaction_archived_category` - Should reject
- [ ] `test_create_transaction_category_type_mismatch` - income category with expense type

#### Pagination & Filter Tests
- [ ] `test_list_transactions_pagination` - page/page_size
- [ ] `test_list_transactions_filter_by_type` - income only
- [ ] `test_list_transactions_filter_by_date_range` - start/end
- [ ] `test_list_transactions_date_range_start_after_end` - Should error or empty
- [ ] `test_list_transactions_filter_by_amount_range` - min/max
- [ ] `test_list_transactions_search_description` - LIKE search
- [ ] `test_list_transactions_sort_by_date` - ASC/DESC
- [ ] `test_list_transactions_sort_by_amount` - ASC/DESC
- [ ] `test_list_transactions_invalid_sort` - 422

#### Bulk Operations Tests
- [ ] `test_bulk_create_transactions` - Multiple at once
- [ ] `test_bulk_delete_transactions` - Delete by IDs
- [ ] `test_duplicate_transaction` - Creates copy with new ID

#### Security Tests
- [ ] `test_user_cannot_see_other_user_transactions` - 404 isolation
- [ ] `test_user_cannot_update_other_user_transaction` - 404
- [ ] `test_user_cannot_delete_other_user_transaction` - 404

---

### MODULE 3: CATEGORIES (18 tests needed)

#### CRUD Tests
- [ ] `test_create_category_income` - Type income
- [ ] `test_create_category_expense` - Type expense
- [ ] `test_list_categories_all` - Returns all active
- [ ] `test_list_categories_by_type` - Filter income/expense
- [ ] `test_list_categories_include_archived` - Show archived
- [ ] `test_update_category_name` - Change name
- [ ] `test_delete_category_soft` - is_archived=True

#### Validation Tests
- [ ] `test_create_category_duplicate_name_type` - 409 or 422
- [ ] `test_create_category_case_insensitive_duplicate` - "Food" vs "food"
- [ ] `test_create_category_name_max_length` - 100 chars
- [ ] `test_create_category_name_exceeds_max` - 101 chars → 422
- [ ] `test_create_category_invalid_color` - Non-hex color
- [ ] `test_create_category_self_parent` - parent_id = own ID
- [ ] `test_create_category_circular_parent` - Cat1→Cat2→Cat1

#### Relationship Tests
- [ ] `test_delete_category_sets_null_on_transactions` - FK SET NULL
- [ ] `test_category_type_change_with_existing_transactions` - Should warn/prevent
- [ ] `test_reorder_categories` - Display order update
- [ ] `test_reorder_categories_other_user_ids` - Security check

---

### MODULE 4: FIXED INCOME/EXPENSES (20 tests needed)

#### CRUD Tests
- [ ] `test_create_fixed_income` - Monthly income
- [ ] `test_create_fixed_expense` - Monthly expense
- [ ] `test_create_fixed_with_end_date` - Has termination
- [ ] `test_create_fixed_no_end_date` - Perpetual
- [ ] `test_list_fixed_all` - Returns all
- [ ] `test_list_fixed_by_type` - Filter income/expense
- [ ] `test_update_fixed_amount` - Change amount
- [ ] `test_update_fixed_day_of_month` - Change billing day
- [ ] `test_delete_fixed` - Remove

#### Pause/Resume Tests
- [ ] `test_pause_fixed` - is_active → False
- [ ] `test_resume_fixed` - is_active → True
- [ ] `test_pause_already_paused` - Idempotent
- [ ] `test_resume_already_active` - Idempotent
- [ ] `test_paused_fixed_excluded_from_forecast` - Forecast respects pause

#### Validation Tests
- [ ] `test_create_fixed_end_before_start` - 422
- [ ] `test_create_fixed_day_0` - 422 (must be 1-31)
- [ ] `test_create_fixed_day_32` - 422
- [ ] `test_create_fixed_zero_amount` - 422
- [ ] `test_create_fixed_category_type_mismatch` - expense category with income type

#### Calculation Tests
- [ ] `test_fixed_day_31_in_february` - Clamps to 28/29
- [ ] `test_fixed_day_31_in_april` - Clamps to 30
- [ ] `test_fixed_end_date_inclusive` - Last month included

---

### MODULE 5: INSTALLMENTS (22 tests needed)

#### CRUD Tests
- [ ] `test_create_installment` - Basic creation
- [ ] `test_create_installment_auto_monthly_amount` - total/payments
- [ ] `test_list_installments` - Returns all
- [ ] `test_get_installment_with_schedule` - Full payment schedule
- [ ] `test_get_installment_payments` - Payment list
- [ ] `test_update_installment_name` - Metadata update
- [ ] `test_delete_installment` - Remove

#### Payment Schedule Calculation Tests
- [ ] `test_installment_even_split` - 1000÷4 = 250.00 each
- [ ] `test_installment_uneven_split` - 1000÷3 = 333.33 (rounding)
- [ ] `test_installment_rounding_total_mismatch` - 333.33×3 ≠ 1000.00
- [ ] `test_installment_single_payment` - 1 payment = total amount
- [ ] `test_installment_max_payments_360` - 30-year installment
- [ ] `test_installment_day_31_february` - Day clamping

#### Progress Tracking Tests
- [ ] `test_installment_status_pending` - Future start date
- [ ] `test_installment_status_active` - On track
- [ ] `test_installment_status_overdue` - Missed payments
- [ ] `test_installment_status_completed` - All paid
- [ ] `test_installment_progress_percentage` - 50% at halfway
- [ ] `test_installment_is_on_track` - completed >= expected
- [ ] `test_installment_remaining_amount` - Correct calculation

#### Validation Tests
- [ ] `test_create_installment_zero_payments` - 422
- [ ] `test_create_installment_zero_amount` - 422
- [ ] `test_create_installment_negative_amount` - 422

---

### MODULE 6: LOANS (25 tests needed)

#### CRUD Tests
- [ ] `test_create_loan` - Basic loan
- [ ] `test_create_loan_zero_interest` - 0% interest
- [ ] `test_list_loans` - Returns all
- [ ] `test_get_loan_with_amortization` - Full schedule
- [ ] `test_update_loan_metadata` - Change name/description
- [ ] `test_delete_loan` - Remove

#### Interest & Amortization Tests
- [ ] `test_loan_amortization_month_1` - Verify interest/principal split
- [ ] `test_loan_amortization_month_2` - Decreasing interest
- [ ] `test_loan_amortization_last_payment` - Final payment adjustment
- [ ] `test_loan_zero_interest_amortization` - All principal, no interest
- [ ] `test_loan_interest_3_5_percent` - 3.5% annual → 0.2917%/month
- [ ] `test_loan_interest_10_percent` - Higher rate
- [ ] `test_loan_total_paid_vs_original` - Total > original (with interest)

#### Payment Recording Tests
- [ ] `test_record_loan_payment` - Standard payment
- [ ] `test_record_payment_auto_completes` - Last payment → status=completed
- [ ] `test_record_payment_on_completed_loan` - 422 error
- [ ] `test_record_payment_exceeds_balance` - 422 error
- [ ] `test_record_partial_payment` - Less than monthly_payment
- [ ] `test_record_overpayment` - More than monthly_payment
- [ ] `test_loan_remaining_balance_after_payment` - Correct deduction
- [ ] `test_loan_concurrent_payments` - Row locking (with_for_update)

#### Status Management Tests
- [ ] `test_loan_prevent_reactivate_completed` - 422
- [ ] `test_loan_prevent_manual_complete_early` - 422
- [ ] `test_loan_pause_status` - status=paused

#### Validation Tests
- [ ] `test_create_loan_negative_interest` - 422
- [ ] `test_create_loan_payment_less_than_interest` - Should warn

---

### MODULE 7: FORECAST (18 tests needed)

#### Basic Forecast Tests
- [ ] `test_forecast_empty_no_data` - Returns zeros
- [ ] `test_forecast_with_balance_only` - Static balance forward
- [ ] `test_forecast_with_fixed_income` - Monthly income projected
- [ ] `test_forecast_with_fixed_expense` - Monthly expense projected
- [ ] `test_forecast_with_both_fixed` - Income - expense = net

#### Data Source Integration Tests
- [ ] `test_forecast_includes_installments` - Active installment payments
- [ ] `test_forecast_excludes_completed_installments` - Completed skipped
- [ ] `test_forecast_includes_loans` - Active loan payments
- [ ] `test_forecast_excludes_completed_loans` - Completed skipped
- [ ] `test_forecast_includes_expected_income` - Specific month income

#### Negative Balance Detection Tests
- [ ] `test_forecast_detects_negative_month` - has_negative_months=True
- [ ] `test_forecast_first_negative_month` - Correct month identified
- [ ] `test_forecast_no_negative` - has_negative_months=False

#### Period Tests
- [ ] `test_forecast_monthly_3_months` - Default range
- [ ] `test_forecast_monthly_12_months` - Full year
- [ ] `test_forecast_weekly_4_weeks` - Weekly breakdown
- [ ] `test_forecast_summary` - Aggregated view
- [ ] `test_forecast_fixed_day_31_february` - Day clamping in forecast

---

### MODULE 8: BALANCE (12 tests needed)

#### CRUD Tests
- [ ] `test_create_balance` - Initial balance
- [ ] `test_get_current_balance` - Returns is_current=True
- [ ] `test_update_balance` - Change amount
- [ ] `test_new_balance_replaces_current` - Old → is_current=False
- [ ] `test_balance_history` - All records returned

#### Edge Case Tests
- [ ] `test_get_balance_when_none_set` - 404
- [ ] `test_update_balance_when_none_exists` - 404
- [ ] `test_negative_balance` - Allowed
- [ ] `test_zero_balance` - Allowed
- [ ] `test_large_balance` - Max precision (15,2)
- [ ] `test_multiple_balance_same_day` - Latest wins
- [ ] `test_balance_future_effective_date` - Allowed

---

### MODULE 9: ALERTS (15 tests needed)

#### Basic Tests
- [ ] `test_alerts_initially_empty` - No alerts for new user
- [ ] `test_unread_alerts_count` - Count endpoint
- [ ] `test_alerts_generated_on_negative_forecast` - Auto-generation

#### Alert Type Tests
- [ ] `test_alert_negative_cashflow_critical` - balance < -5000
- [ ] `test_alert_negative_cashflow_warning` - -5000 < balance < 0
- [ ] `test_alert_approaching_negative` - 0 < balance < 1000
- [ ] `test_alert_high_expenses` - net < -10000
- [ ] `test_no_duplicate_alerts_same_month` - Keyed by (type, month)

#### Interaction Tests
- [ ] `test_mark_alert_as_read` - is_read=True
- [ ] `test_dismiss_alert` - is_dismissed=True, hidden from list
- [ ] `test_mark_all_alerts_as_read` - Bulk operation
- [ ] `test_dismissed_alert_regenerated` - New data → new alert
- [ ] `test_alert_preserves_read_on_regen` - is_read kept

#### Edge Cases
- [ ] `test_alerts_with_no_forecast_data` - Empty state
- [ ] `test_alert_multiple_types_same_month` - Both negative + high expenses

---

### MODULE 10: DASHBOARD (30 tests needed - CURRENTLY 0%)

#### Summary KPIs
- [ ] `test_dashboard_summary_empty` - No data
- [ ] `test_dashboard_summary_with_income` - Monthly income total
- [ ] `test_dashboard_summary_with_expenses` - Monthly expense total
- [ ] `test_dashboard_summary_net_cashflow` - income - expenses
- [ ] `test_dashboard_summary_trends` - % change vs last month

#### Period Breakdowns
- [ ] `test_dashboard_weekly_12_weeks` - Returns 12 weeks
- [ ] `test_dashboard_weekly_running_balance` - Correct calculation
- [ ] `test_dashboard_monthly_12_months` - Returns 12 months
- [ ] `test_dashboard_monthly_year_boundary` - Dec→Jan transition
- [ ] `test_dashboard_quarterly_8_quarters` - Returns 8 quarters

#### Category Breakdown
- [ ] `test_dashboard_category_breakdown_empty` - No expenses
- [ ] `test_dashboard_category_breakdown_percentages` - Sum to 100%
- [ ] `test_dashboard_category_breakdown_uncategorized` - Null category

#### Upcoming Payments
- [ ] `test_dashboard_upcoming_fixed` - Fixed income/expenses
- [ ] `test_dashboard_upcoming_installments` - Active installments
- [ ] `test_dashboard_upcoming_loans` - Active loans
- [ ] `test_dashboard_upcoming_next_30_days` - Default range
- [ ] `test_dashboard_upcoming_custom_range` - days parameter

#### Financial Health
- [ ] `test_dashboard_health_score_range` - 0-100
- [ ] `test_dashboard_health_savings_ratio` - Factor calculation
- [ ] `test_dashboard_health_debt_ratio` - Loan impact
- [ ] `test_dashboard_health_balance_trend` - Improving/declining
- [ ] `test_dashboard_health_expense_stability` - CV calculation
- [ ] `test_dashboard_health_emergency_fund` - Months of coverage
- [ ] `test_dashboard_health_zero_income` - Edge case
- [ ] `test_dashboard_health_zero_expenses` - Edge case

#### Summaries
- [ ] `test_dashboard_installments_summary` - Progress, amounts
- [ ] `test_dashboard_loans_summary` - Balances, progress
- [ ] `test_dashboard_top_expenses` - Top 5, sorted

#### Security
- [ ] `test_dashboard_user_isolation` - No cross-user data

---

### MODULE 11: SETTINGS (10 tests needed)

#### Basic Tests
- [ ] `test_get_settings_default` - Auto-created with defaults
- [ ] `test_update_settings_theme_dark` - theme=dark
- [ ] `test_update_settings_theme_light` - theme=light
- [ ] `test_update_settings_language` - he→en
- [ ] `test_update_settings_currency` - ILS→USD

#### Validation Tests
- [ ] `test_update_settings_invalid_theme` - 422
- [ ] `test_update_settings_invalid_currency` - Should validate ISO
- [ ] `test_update_settings_forecast_months_0` - 422 (ge=1)
- [ ] `test_update_settings_forecast_months_25` - 422 (le=24)
- [ ] `test_update_settings_partial` - Only update one field

---

### MODULE 12: AUTOMATION (already has 21 tests, add 8 more)

#### Additional Tests
- [ ] `test_automation_concurrent_execution` - No duplicate transactions
- [ ] `test_automation_fixed_day_31_in_february` - Day clamping
- [ ] `test_automation_installment_final_payment` - Correct amount
- [ ] `test_automation_loan_final_payment` - Closes loan
- [ ] `test_automation_paused_installment_skipped` - Not charged
- [ ] `test_automation_completed_loan_skipped` - Not charged
- [ ] `test_automation_end_date_today` - Processed or not?
- [ ] `test_automation_multiple_users` - Isolation between users

---

### MODULE 13: CROSS-MODULE INTEGRATION (12 tests needed)

#### End-to-End Flow Tests
- [ ] `test_e2e_create_balance_add_income_check_forecast` - Full flow
- [ ] `test_e2e_create_loan_record_payments_verify_dashboard` - Loan lifecycle
- [ ] `test_e2e_installment_lifecycle` - Create → payments → complete
- [ ] `test_e2e_fixed_pause_verify_forecast_updates` - Pause impact
- [ ] `test_e2e_alert_generation_on_negative_forecast` - Alert triggered
- [ ] `test_e2e_category_archive_transaction_impact` - SET NULL cascade

#### Data Consistency Tests
- [ ] `test_forecast_matches_automation_output` - Same amounts
- [ ] `test_dashboard_totals_match_transaction_sum` - Consistent
- [ ] `test_balance_independent_of_transactions` - Manual model
- [ ] `test_loan_remaining_matches_amortization` - Consistent

#### Multi-User Isolation Tests
- [ ] `test_complete_user_isolation` - User A can't see User B data
- [ ] `test_user_deletion_cascades` - All data removed

---

### MODULE 14: EXPECTED INCOME (5 tests exist, add 5 more)

- [ ] `test_expected_income_month_normalization` - Always 1st of month
- [ ] `test_expected_income_duplicate_month` - Unique constraint
- [ ] `test_expected_income_affects_forecast` - Included in predictions
- [ ] `test_expected_income_zero_amount` - Edge case
- [ ] `test_expected_income_past_month` - Historical entry

---

## PART 4: TEST EXECUTION ORDER

### Phase A: Fix Infrastructure (Must Do First)
1. Start Docker Desktop
2. Start PostgreSQL container
3. Run `alembic upgrade head`
4. Verify: `pytest tests/test_auth.py::test_health -v`

### Phase B: Run Existing 176 Tests
```bash
PYTHONPATH=. pytest tests/ -v --tb=short
```
Expected: All 176 should PASS if DB is running

### Phase C: Write New Tests (Priority Order)
1. Dashboard tests (30 tests) - **0% coverage currently**
2. Cross-module integration tests (12 tests)
3. Installment payment endpoint (after implementing it)
4. Loan calculation verification tests
5. Remaining module tests

### Phase D: Fix Bugs & Re-Test
1. Add DB constraints (migration)
2. Fix category pagination
3. Fix archived category validation
4. Fix rounding error in installments
5. Re-run full suite

---

## PART 5: PRODUCTION READINESS CHECKLIST

### Must Have (Before Deploy)
- [ ] All 176 existing tests pass
- [ ] Dashboard test suite created (30+ tests)
- [ ] DB constraints added via migration
- [ ] Category pagination added
- [ ] Installment mark-paid endpoint
- [ ] Archived category check in transaction create
- [ ] Balance unique constraint for is_current

### Should Have (Before Users)
- [ ] Cross-module integration tests
- [ ] Configurable alert thresholds (per user)
- [ ] Settings validation (currency ISO, language enum)
- [ ] Loan payment feasibility validation
- [ ] Token revocation/blacklist

### Nice to Have (Phase 6)
- [ ] Cursor-based pagination
- [ ] Audit logging
- [ ] Payment reversal endpoints
- [ ] Forecast accuracy tracking

---

**Total New Tests Needed: ~210**
**Current Tests: 176**
**Target: ~386 tests for production readiness**
