# Codebase Concerns

**Analysis Date:** 2026-02-24

## Overview

This document catalogs technical debt, known bugs, security gaps, and fragile areas across the Cash Flow Management backend and frontend. These concerns are drawn from existing audit reports (AGENT_1_VERIFICATION.md, AGENT_2_POLISH.md, BACKEND_AUDIT_REPORT.md), git commits, and codebase analysis.

---

## Critical Bugs (P0 — Must Fix)

### B1: Orphaned Transactions on Installment Reverse-Payment

**Severity:** CRITICAL — Financial Data Integrity

**Files:** `backend/app/api/v1/endpoints/installments.py` (lines 425-450)

**Issue:** When reversing an installment payment via reverse-payment endpoint, the code decrements `payments_completed` but does NOT delete the associated `Transaction` record created during the original mark-paid. Creates phantom transactions that don't reconcile with the actual payment state.

**Impact:**
- Transactions module shows payment that no longer exists in installments module
- Dashboard forecasts include payments that have been reversed
- Audit trail becomes inaccurate

**Fix Approach:**
- Query for the transaction created during the original mark-paid payment
- Delete it before decrementing `payments_completed`
- Ensure cascading deletion rules are in place

---

### B2: Untyped `response_model=list` (4 endpoints)

**Severity:** HIGH — API Type Safety

**Files:**
- `backend/app/api/v1/endpoints/bank_accounts.py:62`
- `backend/app/api/v1/endpoints/credit_cards.py:67` and line 212
- `backend/app/api/v1/endpoints/budgets.py:72`

**Issue:** Endpoints return `response_model=list` without specifying element type. Should be `List[ResponseType]`. Missing type annotation breaks OpenAPI docs and IDE autocomplete.

**Fix Approach:**
- Import `List` from `typing`
- Change each `response_model=list` to `response_model=List[CorrectResponseType]`
- Verify response types match schema

---

### B3: Balance Race Condition — Multiple `is_current=True` Records

**Severity:** CRITICAL — Data Consistency

**Files:** `backend/app/api/v1/endpoints/balance.py`

**Issue:** Despite migration `57ac70dcfa4d_fix_bank_balance_unique_constraint.py` adding a unique index, the race condition still exists in the code logic. Multiple concurrent updates can create duplicate `is_current=True` rows for the same bank account.

**Current Mitigation:** Uses `FOR UPDATE` locking to serialize requests, but logic may still allow duplicates if constraints aren't enforced at DB level.

**Impact:**
- `GET /balance` returns unpredictable result (which `is_current=True` row is selected?)
- Historical balance tracking corrupted
- User sees wrong available credit

**Database Constraint:** Verify this index exists and is correctly scoped:
```sql
CREATE UNIQUE INDEX uq_balance_current
  ON bank_balances (user_id, organization_id, bank_account_id)
  WHERE is_current = TRUE;
```

**Fix Approach:**
- Verify unique index is in place
- Add check in Python code to detect duplicates and raise error
- Add test that spawns concurrent updates and verifies only one `is_current=True`

---

### B4: Missing Fields in Request Schemas

**Severity:** HIGH — Frontend-Backend Contract

**Missing in Create/Update Schemas:**
- `TransactionCreate/Update`: should accept `credit_card_id` (Optional[UUID])
- `InstallmentCreate/Update`: should accept `credit_card_id` (Optional[UUID])
- `SubscriptionCreate/Update`: should accept `credit_card_id` (Optional[UUID])
- `FixedCreate/Update`: should accept `credit_card_id` (Optional[UUID])
- `LoanCreate/Update`: should accept `bank_account_id` (Optional[UUID])
- `BalanceCreate/Update`: should accept `bank_account_id` (Optional[UUID])
- `BalanceCreate/Update`: should accept `currency` (Optional[str], pattern `^[A-Z]{3}$`)
- `InstallmentCreate`: should accept `first_payment_made` (Optional[bool])
- `LoanCreate`: should accept `first_payment_made` (Optional[bool])

**Files:**
- `backend/app/api/v1/schemas/transaction.py`
- `backend/app/api/v1/schemas/installment.py`
- `backend/app/api/v1/schemas/subscription.py`
- `backend/app/api/v1/schemas/fixed.py`
- `backend/app/api/v1/schemas/loan.py`
- `backend/app/api/v1/schemas/balance.py`

**Impact:** Frontend sends these fields, backend rejects or ignores them.

**Fix Approach:**
- Add each missing field with proper type and validation
- Update endpoint logic to accept and persist these fields

---

## High-Priority Issues (P1)

### H1: Circular Reference Detection Incomplete

**Severity:** HIGH — Data Integrity

**Files:** `backend/app/api/v1/endpoints/categories.py` (lines 146-160)

**Issue:** Category circular reference detection only catches cycles that include the current category being updated. A→B→C→B cycle is NOT caught if updating A or D.

**Example Scenario:**
- Create Category A (parent: none)
- Create Category B (parent: A)
- Create Category C (parent: B)
- Update B to parent: C ← Creates cycle A→B→C→B, but update succeeds

**Fix Approach:**
- Implement full cycle detection (DFS or similar) on the entire parent chain, not just for current category
- Cache parent relationships to avoid repeated lookups
- Add database constraint (if possible) to prevent invalid parent assignments

---

### H2: Category Type Mismatch Not Enforced

**Severity:** HIGH — Semantic Corruption

**Files:** `backend/app/api/v1/endpoints/transactions.py` (line ~104), `backend/app/api/v1/endpoints/fixed.py`

**Issue:** Can assign an "income" transaction to an "expense" category, or vice versa. No validation prevents this semantic mismatch.

**Impact:**
- Dashboard calculations show wrong totals
- Reports are inaccurate
- User confusion about transaction types

**Fix Approach:**
- In transaction/fixed/installment creation endpoints, validate `category.type == transaction_type`
- Add error message: "Category type must match transaction type"

---

### H3: Missing Database Indexes

**Severity:** HIGH — Performance

**Files:** `backend/alembic/versions/` (latest migration)

**Missing Indexes:**
- `credit_cards`: `Index("ix_credit_cards_user_active", "user_id", "is_active")`
- `subscriptions`: `Index("ix_subscriptions_credit_card_id", "credit_card_id")`
- `transactions`: `Index("ix_transactions_user_date", "user_id", "transaction_date")` (for filtering/sorting)
- `bank_balances`: `Index("ix_bank_balances_user_current", "user_id", "is_current")`

**Impact:** List queries on these tables perform full table scans as dataset grows.

**Fix Approach:**
- Create Alembic migration to add indexes
- Monitor query performance after deployment

---

### H4: Alert Generation Not Scheduled

**Severity:** HIGH — Missing Automation

**Files:** `backend/app/services/scheduler.py`, `backend/app/services/alert_service.py`

**Issue:** Alerts are only generated on-demand (when dashboard/forecast endpoint is called). Should run on a daily schedule to proactively notify users.

**Current Behavior:**
- Alert generation: `generate_alerts()` in alert_service.py
- Called only from: `dashboard.py` and `forecast.py` endpoints
- Users only see alerts when they visit the dashboard

**Fix Approach:**
- Add scheduler job (e.g., 00:10 UTC after expected nightly batch processing)
- Call `generate_alerts()` for each user
- Send notifications (if notification system exists)

---

### H5: Exchange Rate Conversion Direction — Needs Verification

**Severity:** HIGH — Financial Accuracy

**Files:** `backend/app/services/exchange_rate_service.py` (line ~185)

**Issue:** User reported wrong currency conversion. When Frankfurter API returns USD→ILS rate of 3.65, conversion of 100 USD should give 365 ILS. Service uses `amount * rate` — verify direction is correct.

**Scenario to Test:**
- Frankfurter: `GET /latest?from=USD&to=ILS` → returns `{ "rates": { "ILS": 3.65 } }`
- Input: 100 USD
- Expected: 365 ILS
- Actual: ?

**Fix Approach:**
- Add integration test with mocked Frankfurter response
- Verify conversion formula: `amount_usd * rate_from_api` = correct ILS amount
- If inverted, swap numerator/denominator

---

## Medium-Priority Issues (P2)

### M1: Test Flakiness — Test Isolation & Determinism

**Severity:** MEDIUM — Test Reliability

**Files:** `backend/tests/conftest.py`, all test files

**Issue:** Multiple test runs produce different results (4 to 34 failures across runs). Root causes include:
1. **Shared database state** — Tests don't fully clean up after themselves
2. **IDOR failures** — User2 auth token not properly set up in fixture
3. **Stale ORM data** — `StaleDataError` in concurrent tests
4. **Test ordering** — Tests fail in different orders depending on pytest collection

**Current Mitigation:** conftest.py uses DELETE-based cleanup (not TRUNCATE) to avoid locks. But cleanup may not be complete across all tables.

**Fix Approach:**
- Verify all test fixtures properly reset data after each test
- Add `@pytest.mark.asyncio` to all async tests
- Run test suite 3 times sequentially; results must be identical
- Isolate user2 fixture to ensure fresh auth token per test

---

### M2: Pagination Missing on Categories List

**Severity:** MEDIUM — Scalability

**Files:** `backend/app/api/v1/endpoints/categories.py` (GET endpoint)

**Issue:** `GET /categories` returns all categories without pagination. With thousands of categories, causes memory bloat and slow response.

**Fix Approach:**
- Add `skip` and `limit` query parameters
- Default limit: 100
- Return total count in response metadata

---

### M3: Rounding Error Accumulation in Installments

**Severity:** MEDIUM — Financial Inaccuracy

**Files:** `backend/app/api/v1/endpoints/installments.py` (line 41)

**Issue:** Installment monthly amount calculated as `total / num_payments` with ROUND_HALF_UP. Over many payments, rounding errors accumulate. Example: 1000 ÷ 3 = 333.33 × 3 = 999.99 (off by 0.01).

**Current Code:**
```python
def _calc_monthly_amount(total: Decimal, num_payments: int) -> Decimal:
    return (total / num_payments).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
```

**Fix Approach:**
- Calculate monthly amount as above
- On last payment, override with: `total - (monthly_amount * (num_payments - 1))`
- Ensures exact total over all payments

---

### M4: Loan Payment Validation Missing

**Severity:** MEDIUM — Data Validity

**Files:** `backend/app/api/v1/endpoints/loans.py`

**Issue:** Can create loan where `monthly_payment < monthly_interest`. This creates an infinite loan that never terminates.

**Example:**
- Principal: 100,000 ILS
- Interest rate: 10% (monthly interest = 10,000 ILS)
- Monthly payment: 5,000 ILS
- Payment < Interest → balance grows every month

**Fix Approach:**
- In loan creation/update: `monthly_payment >= calculated_monthly_interest`
- Return validation error if violated

---

### M5: Date Range Validation Missing

**Severity:** MEDIUM — Data Quality

**Files:** `backend/app/api/v1/endpoints/transactions.py` (list endpoint)

**Issue:** `GET /transactions?start_date=2026-02-24&end_date=2026-02-01` (start > end) silently returns empty or wrong results. No error raised.

**Fix Approach:**
- Add validation: `end_date >= start_date`
- Return 422 if violated

---

### M6: First Payment Made Flag Not in Schemas

**Severity:** MEDIUM — API Contract

**Files:** `backend/app/api/v1/endpoints/installments.py:223`, `backend/app/api/v1/endpoints/loans.py:149`

**Issue:** Endpoints pop `first_payment_made` from request data but schema may not include it. Frontend sends it, backend silently ignores.

**Fix Approach:**
- Add to `InstallmentCreate` and `LoanCreate` schemas: `first_payment_made: Optional[bool] = False`

---

### M7: Alert Thresholds Hardcoded

**Severity:** MEDIUM — User Customization

**Files:** `backend/app/services/alert_service.py` (lines 114, 148)

**Issue:** Alert severity thresholds hardcoded as global constants (1000, 5000, 10000 ILS). Not scalable per user; users can't customize.

**Current:**
```python
warning_threshold: Decimal = Decimal("5000")
```

**Fix Approach:**
- Move thresholds to `Settings` table
- Allow user to configure via settings endpoint
- Fallback to defaults if not configured

---

### M8: Token Blacklist Not Implemented on Logout

**Severity:** MEDIUM — Security

**Files:** `backend/app/core/security.py`, `backend/app/api/v1/endpoints/auth.py` (logout endpoint)

**Issue:** JWT token doesn't get revoked on logout. User can keep using old refresh token indefinitely (until expiration). No token blacklist mechanism.

**Current:** `_token_blacklist` variable exists in security.py but is never populated.

**Fix Approach:**
- Add token to blacklist on logout
- Check blacklist before validating token in `get_current_user`
- Consider using Redis for scalable blacklist in production

---

### M9: Settings Fields Not Validated

**Severity:** MEDIUM — Data Integrity

**Files:** `backend/app/api/v1/endpoints/settings.py`

**Issue:** `currency`, `language`, `date_format` fields stored without validation. Invalid values (e.g., `currency: "XYZ"` or `language: "klingon"`) are silently accepted.

**Fix Approach:**
- Add enum or pattern validation to `SettingsUpdate` schema
- Valid currencies: ISO 4217 codes (ILS, USD, EUR, etc.)
- Valid languages: from i18n supported list (he, en)
- Valid date_formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD

---

### M10: Week Start Day Hardcoded

**Severity:** MEDIUM — Configuration

**Files:** `backend/app/api/v1/endpoints/dashboard.py` (weekly calculations)

**Issue:** Week always starts on Sunday, ignoring user settings. User in Israel may prefer Sunday, but user in Europe may prefer Monday.

**Fix Approach:**
- Add `week_start_day` to Settings schema (0=Sunday, 1=Monday, etc.)
- Use it in dashboard weekly calculations

---

## Frontend Issues (P1-P2)

### F1: Missing Translation Keys

**Severity:** HIGH — UI Functionality

**File:** `frontend/src/pages/CreditCardsPage.tsx` + `src/i18n/locales/he.json`, `en.json`

**Missing 9 keys needed in both locale files:**
```json
"creditCards.subscriptionsShort": "מנויים" / "Subscriptions"
"creditCards.installmentsShort": "תשלומים" / "Installments"
"creditCards.fixedShort": "קבועות" / "Fixed"
"creditCards.chargeSubscriptions": "חיובי מנויים" / "Subscription Charges"
"creditCards.chargeInstallments": "חיובי תשלומים" / "Installment Charges"
"creditCards.chargeFixed": "חיובים קבועים" / "Fixed Charges"
"creditCards.noCharges": "אין חיובים" / "No charges"
"creditCards.totalExpected": "סה\"כ צפוי" / "Total Expected"
"creditCards.availableAfterBilling": "אשראי זמין לאחר חיוב" / "Available After Billing"
```

**Fix Approach:**
- Add all keys to `he.json` with Hebrew translations
- Add all keys to `en.json` with English translations
- Ensure keys are used in CreditCardsPage.tsx

---

### F2: Credit Cards Button Wrong Translation Key

**Severity:** HIGH — UI Display

**File:** `frontend/src/pages/CreditCardsPage.tsx` (lines 379, 504, 739)

**Issue:** Uses `t('creditCards.add')` but correct key is `creditCards.addCard`.

**Fix Approach:**
- Replace all 3 occurrences with `t('creditCards.addCard')`

---

### F3: Alerts Snooze Dropdown Unclickable

**Severity:** HIGH — UI Usability

**File:** `frontend/src/pages/AlertsPage.tsx` (line 313)

**Issue:** `overflow-hidden` CSS clips dropdown options, making them unclickable.

**Current CSS:**
```tsx
className="animate-fade-in-scale absolute top-full z-50 mt-1.5 min-w-52 overflow-hidden rounded-xl border shadow-lg"
```

**Fix Approach:**
```tsx
className="animate-fade-in-scale absolute top-full z-50 mt-1.5 min-w-52 overflow-visible rounded-xl border shadow-lg"
```

---

### F4: Alert Sound Preference Not Persisted

**Severity:** LOW — User Experience

**File:** `frontend/src/pages/AlertsPage.tsx` (line 653)

**Issue:** `soundEnabled` state resets on page refresh.

**Fix Approach:**
- Use localStorage: `localStorage.getItem('alertSoundEnabled')` on mount
- Update localStorage on toggle

---

### F5: Snooze Re-notification Missing

**Severity:** MEDIUM — User Experience

**File:** `frontend/src/pages/AlertsPage.tsx`

**Issue:** After snoozing, alert disappears but doesn't automatically reappear when snooze expires. No polling on AlertsPage.

**Fix Approach:**
- Add `refetchInterval: 30000` to alerts query
- Backend already filters out snoozed alerts where `snoozed_until > now`, so they reappear automatically

---

### F6: Validation Errors Generic

**Severity:** LOW — UX Polish

**File:** `frontend/src/pages/CreditCardsPage.tsx` (lines 296-309)

**Issue:** All validation errors show generic `t('common.error')` instead of specific messages.

**Fix Approach:**
- Use specific keys: `validation.required`, `creditCards.lastFourInvalid`, etc.

---

## Performance & Scalability Concerns

### P1: No Query Pagination on List Endpoints

**Affected Endpoints:**
- `GET /categories` (no pagination)
- `GET /subscriptions` (check if paginated)
- `GET /fixed` (check if paginated)

**Issue:** As datasets grow, returning all records becomes slow and memory-intensive.

**Fix:** Add `skip` (default 0) and `limit` (default 100, max 1000) parameters to all list endpoints.

---

### P2: Decimal Field Precision Edge Case

**Severity:** MEDIUM — Financial Precision

**Files:** `backend/app/db/models/` (balance model)

**Issue:** `balance` field is `DECIMAL(15,2)` which means 15 total digits with 2 after decimal. Maximum value: 9,999,999,999,999.99. Edge case: if user has balance near this limit, arithmetic operations may overflow.

**Fix Approach:**
- Document the maximum balance value in schema
- Add validation to reject amounts > 9,999,999,999,999.99
- Consider using DECIMAL(18,2) for more headroom

---

## Test Coverage Gaps

### T1: Dashboard Module — 0% Coverage

**Severity:** HIGH — Regression Risk

**Files:** `backend/app/api/v1/endpoints/dashboard.py` (11 sub-endpoints)

**Issue:** No tests exist for dashboard endpoints. Any refactor risks silent breakage.

**Sub-endpoints without tests:**
- `GET /dashboard/summary`
- `GET /dashboard/weekly`
- `GET /dashboard/monthly`
- `GET /dashboard/quarterly`
- `GET /dashboard/category-breakdown`
- `GET /dashboard/upcoming-payments`
- `GET /dashboard/financial-health`
- `GET /dashboard/installments-summary`
- `GET /dashboard/loans-summary`
- `GET /dashboard/top-expenses`
- `GET /dashboard/subscriptions-summary`

**Fix Approach:**
- Create `backend/tests/test_dashboard.py` with 11+ test cases
- Test data calculations, filtering by date range, DataContext isolation

---

### T2: Organization Module — Partial Coverage

**Severity:** MEDIUM — Regression Risk

**Files:** `backend/tests/test_org_permissions.py` (incomplete)

**Issues:**
- Organization member CRUD not fully tested
- Org-level budget calculations not tested
- Report generation not tested

---

## Fragile Areas

### FR1: Installment Status Calculation Logic

**Severity:** HIGH — Complex Business Logic

**Files:** `backend/app/api/v1/endpoints/installments.py` (lines 50-100, `_enrich_installment` function)

**Fragility Reasons:**
- Status depends on multiple conditions (start_date, day_of_month, payments_completed, today's date)
- Off-by-one errors possible in `months_elapsed` calculation
- Month boundary handling (31st of month doesn't exist in all months) requires careful `_safe_day` logic

**Current Test Coverage:** Partial in `test_edge_cases.py`

**Safe Modification Guide:**
- Always test with edge case dates (month-end, leap years, start before today)
- Mock `date.today()` to control test conditions
- Add regression tests before changing status calculation

---

### FR2: Exchange Rate Service — External Dependency

**Severity:** MEDIUM — Reliability

**Files:** `backend/app/services/exchange_rate_service.py`

**Fragility Reasons:**
- Depends on Frankfurter API availability
- Rate caching (1 hour) may return stale data
- Fallback behavior when API is down not clear
- Conversion direction verified only by user report, not by test

**Safe Modification Guide:**
- Always mock Frankfurter in tests
- Add integration test with real API (separate CI step)
- Verify conversion direction with known rate (e.g., USD→ILS at 3.65)

---

### FR3: Alert Generation Business Logic

**Severity:** MEDIUM — Complex Thresholds & Conditions

**Files:** `backend/app/services/alert_service.py` (150+ lines of alert builder functions)

**Fragility Reasons:**
- Multiple alert types with different thresholds
- Hebrew month name mappings
- Forecast integration may change
- Deduplication logic relies on `created_at` timezone

**Safe Modification Guide:**
- Test alerts in isolation with mocked forecast data
- Use `datetime.now(timezone.utc)` for timezone consistency
- Add test for each alert type and threshold

---

## Security Gaps

### S1: IDOR — Incomplete Ownership Validation

**Severity:** MEDIUM — Access Control

**Files:** Multiple endpoints in `backend/app/api/v1/endpoints/`

**Issue:** While `DataContext` is widely used for filtering, some endpoints may not properly validate ownership on DELETE or specific operations. Example: Can user delete someone else's category if they know the ID?

**Fix Approach:**
- Audit every endpoint that modifies data
- Ensure ownership check before DELETE, PUT, POST to owned resources
- Use `ctx.ownership_filter()` consistently

---

### S2: Rate Limiting Per-IP Only

**Severity:** MEDIUM — Brute Force Risk

**Files:** `backend/app/core/rate_limit.py`

**Issue:** Rate limiting is per-IP only, not per-user. An attacker on same IP as legitimate user would be rate-limited, but multiple attackers on different IPs could brute-force login independently.

**Fix Approach:**
- Add per-user rate limiting on login endpoint
- Track failed login attempts per username/email
- Lock account after N failed attempts (e.g., 5)
- Add exponential backoff or CAPTCHA

---

### S3: SQL Injection Prevention Verified by ORM Only

**Severity:** LOW — Code Review Gap

**Files:** All endpoint files

**Issue:** Codebase uses SQLAlchemy ORM, which prevents SQL injection. However, if raw SQL is added in future without parameterization, risk increases.

**Fix Approach:**
- Add pre-commit hook to flag raw SQL (`.execute()` without proper binding)
- Document SQLAlchemy usage guidelines
- Code review to ensure no raw SQL

---

## Dependency Risks

### D1: Python 3.9 Compatibility Pinned

**Severity:** LOW — Maintenance

**Files:** `backend/requirements.txt`

**Issue:** Project requires Python 3.9.6 (`from __future__ import annotations`, no `X | Y` syntax). Pinning to 3.9 means missing security updates and bug fixes in 3.10+.

**Timeline for Risk:**
- Python 3.9 EOL: October 2025 (already in past)
- Python 3.10 EOL: October 2026
- Python 3.11 EOL: October 2027

**Fix Approach:**
- Create upgrade plan to Python 3.11 (has been LTS stable since 2023)
- Update type hints to use modern syntax (`X | Y` instead of `Union[X, Y]`)
- Remove `from __future__ import annotations` when upgrading
- Test thoroughly after upgrade

---

### D2: FastAPI async-to-sync Boundaries

**Severity:** MEDIUM — Reliability

**Files:** `backend/app/` (async endpoints with sync dependencies)

**Issue:** If any dependency accidentally calls blocking I/O (e.g., `requests` library instead of `httpx`), it blocks the entire event loop.

**Fix Approach:**
- Audit all dependencies for blocking I/O
- Use only async-safe libraries (httpx, aiopg, etc.)
- Document in ARCHITECTURE.md

---

## Documentation Gaps

### Doc1: API Response Schema Not Fully Documented

**Files:** `backend/app/api/v1/schemas/`

**Issue:** Some response schemas have computed fields that aren't documented. Example: `InstallmentResponse` has `progress_percentage`, `remaining_amount`, `next_payment_date` (computed) but schema docstring doesn't explain.

**Fix Approach:**
- Add `Field(description="...")` to computed fields in Pydantic models
- Auto-generate API docs from these descriptions

---

### Doc2: Business Rule Validation Not Documented

**Files:** Various endpoint files

**Issue:** Business rules (e.g., "loan monthly_payment >= monthly_interest") are enforced in code but not documented in ARCHITECTURE.md or endpoint docstrings.

**Fix Approach:**
- Create `BUSINESS_RULES.md` with all financial constraints
- Link to implementation files

---

## Migration Risk

### Mig1: Alembic Migrations May Have Gaps

**Severity:** MEDIUM — Database Evolution

**Files:** `backend/alembic/versions/`

**Issue:** If production database hasn't been migrated to latest version, schema mismatches occur.

**Fix Approach:**
- Document exact migration chain required
- Add sanity checks in app startup to verify DB schema version
- Log warning if DB version < code version

---

## Summary by Severity

| Severity | Count | Blocking Deployment | Example |
|----------|-------|---------------------|---------|
| **CRITICAL** | 3 | YES | Orphaned transactions, race condition, untyped responses |
| **HIGH** | 10 | PARTIAL | Missing schema fields, circular refs, indexes, hardcoded thresholds |
| **MEDIUM** | 14 | NO | Test flakiness, rounding errors, IDOR gaps, rate limiting |
| **LOW** | 6 | NO | Documentation, Python 3.9 EOL, generic error messages |

---

## Recommended Fix Priority

### Phase 1 — Before Production (Week 1)
1. Fix B1 (orphaned transactions)
2. Fix B2 (untyped responses)
3. Fix B3 (race condition uniqueness)
4. Add all missing schema fields (B4)
5. Add all missing translation keys (F1)
6. Fix F2, F3 (UI functionality)

### Phase 2 — Production Hardening (Week 2)
7. Fix H1-H5 (circular refs, category type, indexes, scheduling, exchange rate)
8. Eliminate test flakiness (M1)
9. Fix M2-M10 (pagination, rounding, validation, token blacklist)

### Phase 3 — Long-term Improvements (Month 2)
10. Dashboard test coverage (T1)
11. Python 3.9→3.11 upgrade (D1)
12. Rate limiting per-user (S2)
13. Extract business rules documentation (Doc2)

---

*Concerns audit completed: 2026-02-24*
*Total concerns identified: 42 issues across Critical, High, Medium, Low severity*
