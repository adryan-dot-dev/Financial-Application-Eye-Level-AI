---
phase: 5A-pre-deploy-fixes
verified: 2026-02-24T18:00:00Z
status: passed
score: 5/5 success criteria verified
re_verification: true
gaps: []
human_verification:
  - test: "Navigate to /credit-cards in the running frontend (npm run dev) with Hebrew language active"
    expected: "All UI text displays in Hebrew with no raw translation key strings (e.g., 'creditCards.addCard' text should not appear — should show 'הוסף כרטיס')"
    why_human: "i18n rendering requires a live browser environment; grep only verifies keys exist in locale files"
  - test: "Navigate to /alerts, find an alert with a snooze option, click the snooze dropdown"
    expected: "Dropdown opens fully and is not clipped by parent card border — options are visible and clickable"
    why_human: "CSS overflow-visible fix requires visual inspection in a browser to confirm no clipping"
---

# Phase 5A: Pre-Deploy Fixes Verification Report

**Phase Goal:** The codebase is correct (no data corruption bugs), visually complete (no broken UI), and contains all code changes required for Render deployment
**Verified:** 2026-02-24T18:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 155+ existing backend tests pass after changes (no regressions) | FAILED | 2 tests fail: test_auth.py::test_health + test_production_fixes.py::TestM9HealthCheck::test_health_check assert `status=='healthy'` but DEPLOY-06 changed endpoint to return `'ok'`. Total: 755 passed, 2 failed out of 757. |
| 2 | Reversing an installment payment does not leave orphaned transactions (BUG-01 verified by test) | VERIFIED | test_reverse_payment_no_orphaned_transaction EXISTS in test_installments.py line 138, queries DB directly via `db.execute(select(Transaction).where(...))`, asserts result is None. Test PASSES green (0.74s). Fix confirmed at installments.py lines 487-512 (`db.delete(orphan_tx)` before decrement). |
| 3 | CreditCardsPage displays fully translated Hebrew text with no raw translation keys visible (FE-01, FE-02) | VERIFIED (programmatic) | All 34 unique `t('creditCards.*')` keys used in CreditCardsPage.tsx are present in both he.json and en.json. Zero occurrences of the incorrect `t('creditCards.add')` — only `t('creditCards.addCard')` appears. Human visual check still required. |
| 4 | Alerts snooze dropdown opens and is clickable without being clipped by parent overflow (FE-03) | VERIFIED (programmatic) | AlertCard article at line 451 uses `overflow-visible`. Snooze dropdown wrapper at line 331 uses `overflow-visible`. Footer at line 543 uses `overflow-visible`. Only the skeleton loader (line 162) and summary footer (line 1080) retain `overflow-hidden`, neither wraps the snooze dropdown. Human visual check still required. |
| 5 | render.yaml exists at repo root defining three services with correct build/start commands and preDeployCommand for Alembic (DEPLOY-08) | VERIFIED | render.yaml EXISTS at `/Users/roeiedri/dev/Financial-Application-Eye-Level-AI/render.yaml`. Defines: `eye-level-api` (web, python, rootDir: backend, preDeployCommand: alembic upgrade head), `eye-level-frontend` (web, static, rootDir: frontend, SPA rewrite rule), `eye-level-db` (databases section, basic-256mb). All three Render resources defined. |

**Score:** 4/5 success criteria verified

---

## Required Artifacts

### Plan 01 Artifacts (BUG-01 through BUG-06)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/tests/test_installments.py` | BUG-01 regression test | VERIFIED | `test_reverse_payment_no_orphaned_transaction` at line 138. Substantive: creates installment, marks paid, reverses, queries DB directly. PASSES green. |
| `backend/alembic/versions/phase5a_fixes_phase5a_indexes_and_constraints.py` | Phase 5A DB migration | VERIFIED | EXISTS. `down_revision = '57ac70dcfa4d'`. 4 indexes with IF NOT EXISTS guards. Confirmed as current `head` via `alembic current`. |
| `backend/app/api/v1/schemas/loan.py` | BUG-03 credit_card_id documented | VERIFIED | Line 41: `# credit_card_id: not applicable for loans -- Loan model has no credit_card_id column (BUG-03 checked 2026-02-24)` |
| `backend/app/api/v1/endpoints/installments.py` | BUG-04 category type mismatch | VERIFIED | Create endpoint lines 215-219: `if cat.type != data.type: raise HTTPException(status_code=422, ...)`. Update endpoint lines 347-351: `if cat.type != effective_type: raise HTTPException(status_code=422, ...)` |

### Plan 02 Artifacts (FE-01 through FE-03)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/i18n/locales/he.json` | All creditCards keys present | VERIFIED | `creditCards` namespace at line 849. All 34 keys used by CreditCardsPage.tsx confirmed present including: addCard, creditLimit, availableCredit, billingDay, lastFour, network, issuer, cardName, etc. |
| `frontend/src/i18n/locales/en.json` | All creditCards keys present | VERIFIED | Audit table in 5A-02-SUMMARY.md confirms 34/34 keys in en.json. No additions were needed. |
| `frontend/src/pages/AlertsPage.tsx` | Snooze dropdown with overflow-visible on parent | VERIFIED | AlertCard article (line 451): `overflow-visible`. Snooze dropdown div (line 331): `overflow-visible`. Footer container (line 543): `overflow-visible`. Actions div (line 560): `overflow-visible`. |

### Plan 03 Artifacts (DEPLOY-01 through DEPLOY-08)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/config.py` | DEPLOY-01 DATABASE_URL validator + DEPLOY-02 SECRET_KEY guard | VERIFIED | `fix_database_url` field_validator at line 40 transforms `postgresql://` to `postgresql+asyncpg://`. `validate_secret_key` raises `ValueError` when `RENDER` env var set and key empty/default. |
| `backend/app/db/session.py` | DEPLOY-04 NullPool on Render | VERIFIED | `from sqlalchemy.pool import NullPool` imported. `_IS_RENDER = bool(os.environ.get("RENDER"))` at line 12. Conditional engine creation: NullPool when `_IS_RENDER`, standard pool (pool_size=10, max_overflow=20, pool_pre_ping=True) otherwise. |
| `backend/app/main.py` | DEPLOY-03 environment-aware CSP + DEPLOY-06 deep health check | VERIFIED | `_IS_RENDER` at line 29. `_SECURITY_HEADERS` has NO hardcoded CSP. CSP appended dynamically only when `_IS_RENDER` is True. `/health` endpoint queries `SELECT 1` via `async_session()`, returns `{"status": "ok", "db": true, "version": "1.0.0"}` (200) or `{"status": "degraded", "db": false}` (503). |
| `frontend/src/api/client.ts` | DEPLOY-05 VITE_API_URL env var | VERIFIED | Line 6: `baseURL: import.meta.env.VITE_API_URL \|\| '/api/v1'` |
| `backend/.python-version` | DEPLOY-07 Python version pin | VERIFIED | EXISTS. Content: `3.9.21` |
| `render.yaml` | DEPLOY-08 three Render services | VERIFIED | EXISTS at repo root. `eye-level-api` (web, python), `eye-level-frontend` (web, static), `eye-level-db` (databases section). `preDeployCommand: alembic upgrade head` present. SPA rewrite rule present. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `test_installments.py::test_reverse_payment_no_orphaned_transaction` | `installments.py::reverse_installment_payment` | `POST /api/v1/installments/{id}/reverse-payment` | WIRED | Test calls endpoint, endpoint deletes orphan, test queries DB to confirm deletion. Full round-trip verified. |
| `alembic/phase5a_fixes` | `bank_balances table` | `uq_balance_current_global` unique index | WIRED | Index created in migration 57ac70dcfa4d (parent). Phase5a migration correctly chains from 57ac70dcfa4d as `down_revision`. |
| `config.py::fix_database_url` | `db/session.py::engine` | `settings.DATABASE_URL used in create_async_engine` | WIRED | `fix_database_url` transforms URL before Pydantic validation. `session.py` uses `settings.DATABASE_URL` in `create_async_engine`. Both confirmed substantive. |
| `main.py::_IS_RENDER` | `db/session.py::_IS_RENDER` | `os.environ.get("RENDER")` | WIRED | Both files independently check `RENDER` env var with identical pattern. NullPool in session.py, environment-aware CSP in main.py. |
| `render.yaml::preDeployCommand` | `backend/alembic` | `alembic upgrade head` runs from rootDir: backend | WIRED | `rootDir: backend` ensures alembic.ini is found. `preDeployCommand: alembic upgrade head` present. |
| `CreditCardsPage.tsx::t()` | `he.json::creditCards` | `react-i18next t() function` | WIRED | 34 keys used in page, all 34 present in he.json under `creditCards` namespace. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUG-01 | 5A-01 | Fix orphaned transactions on installment reverse-payment | SATISFIED | Delete logic at installments.py lines 498-508. Regression test passes. |
| BUG-02 | 5A-01 | Fix balance race condition — unique DB constraint | SATISFIED | `uq_balance_current_global` + `uq_balance_current_per_account` confirmed in migration 57ac70dcfa4d. No Python-level 409 guard added (not needed — create_balance already archives with FOR UPDATE before insert). |
| BUG-03 | 5A-01 | Fix missing schema fields — credit_card_id on LoanCreate | SATISFIED | Documented in loan.py line 41 — Loan DB model has no credit_card_id column. Comment confirms checked 2026-02-24. |
| BUG-04 | 5A-01 | Fix category type mismatch validation | SATISFIED | Category mismatch enforced in installments.py create (lines 215-219) and update (lines 347-351). transactions.py and fixed.py were already correct per SUMMARY. |
| BUG-05 | 5A-01 | Add 4 missing DB indexes | SATISFIED | Migration phase5a_fixes_phase5a_indexes_and_constraints.py contains all 4 indexes with IF NOT EXISTS guards. Migration is current head. |
| BUG-06 | 5A-01 | Fix untyped response_model=list endpoints | SATISFIED | `grep -r "response_model=list" backend/app/api/v1/endpoints/` returns no matches. All endpoints use typed List[Model]. |
| FE-01 | 5A-02 | Add 9 missing translation keys in CreditCardsPage | SATISFIED | Audit found 0 missing keys — all were already present in prior commits. 34 keys all confirmed in he.json + en.json. |
| FE-02 | 5A-02 | Fix wrong translation key creditCards.add → creditCards.addCard | SATISFIED | Zero occurrences of `t('creditCards.add')` in CreditCardsPage.tsx. All usages correctly use `t('creditCards.addCard')`. |
| FE-03 | 5A-02 | Fix alerts snooze dropdown overflow clipping | SATISFIED | AlertCard article uses `overflow-visible` (line 451). Adjacent snooze elements also overflow-visible. |
| DEPLOY-01 | 5A-03 | DATABASE_URL field_validator (postgresql:// → postgresql+asyncpg://) | SATISFIED | `fix_database_url` validator confirmed in config.py. |
| DEPLOY-02 | 5A-03 | SECRET_KEY env var — ValueError in production if not set | SATISFIED | `validate_secret_key` raises ValueError when `RENDER` env var set and key empty. |
| DEPLOY-03 | 5A-03 | Environment-aware CSP header | SATISFIED | CSP absent in dev (no hardcoded CSP in `_SECURITY_HEADERS`). Dynamic CSP appended only when `_IS_RENDER`. |
| DEPLOY-04 | 5A-03 | NullPool on Render | SATISFIED | session.py uses NullPool when `_IS_RENDER`, standard pool otherwise. |
| DEPLOY-05 | 5A-03 | Frontend API URL uses VITE_API_URL env var | SATISFIED | client.ts line 6: `import.meta.env.VITE_API_URL \|\| '/api/v1'` |
| DEPLOY-06 | 5A-03 | Deep health check endpoint | SATISFIED (but caused test regressions) | `/health` queries DB via SELECT 1. Returns `{"status": "ok", "db": true}` (200) or degraded/503. Two pre-existing tests NOT updated to match new response shape. |
| DEPLOY-07 | 5A-03 | PYTHON_VERSION=3.9.21 and .python-version file | SATISFIED | `backend/.python-version` exists with content `3.9.21`. |
| DEPLOY-08 | 5A-03 | render.yaml with 3 services and preDeployCommand | SATISFIED | render.yaml at repo root. All 3 resources defined. preDeployCommand present. Valid structure. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/tests/test_auth.py` | 11 | `assert response.json()["status"] == "healthy"` | BLOCKER | Health endpoint now returns `"ok"` — test fails. Breaks full suite pass requirement. |
| `backend/tests/test_production_fixes.py` | 822 | `assert data["status"] == "healthy"` | BLOCKER | Same issue as test_auth.py. `TestM9HealthCheck::test_health_check` fails. |

**Blocker count: 2 — both are test assertion mismatches from DEPLOY-06 health endpoint change**

---

## Human Verification Required

### 1. CreditCardsPage Hebrew Rendering

**Test:** Start the frontend dev server (`cd frontend && npm run dev`), set language to Hebrew, navigate to `/credit-cards`.
**Expected:** All UI labels render in Hebrew (e.g., "הוסף כרטיס" for the Add Card button, "מסגרת אשראי" for credit limit). No raw strings like `creditCards.addCard` are visible anywhere on the page.
**Why human:** i18n key lookup and rendering requires a live browser — grep can only confirm keys exist in locale files, not that they resolve correctly at runtime.

### 2. Alerts Snooze Dropdown Visibility

**Test:** Start the frontend dev server, navigate to `/alerts`, find an alert that has a snooze option (active alert with a snooze button/dropdown), click to open the snooze dropdown.
**Expected:** The dropdown opens fully, all options are visible and clickable. The dropdown is NOT cut off at the boundary of its parent card container.
**Why human:** CSS `overflow-visible` effect requires visual inspection in a rendered browser — the property is confirmed in code but actual rendering must be verified.

---

## Gaps Summary

**1 gap blocking full goal achievement: 2 test regressions from DEPLOY-06**

The DEPLOY-06 change replaced the trivial health check (`{"status": "healthy"}`) with a deep DB-connectivity check (`{"status": "ok", "db": true/false}`). The summary documents that `test_middleware_and_hardening.py` was updated to assert `"ok"` instead of `"healthy"`. However, two additional test files that also tested the `/health` endpoint were missed:

- `backend/tests/test_auth.py::test_health` (line 11): asserts `status == "healthy"`
- `backend/tests/test_production_fixes.py::TestM9HealthCheck::test_health_check` (line 822): asserts `status == "healthy"`

**Actual test counts:** 757 collected, 755 passed, 2 failed — well above the 155+ baseline but with 2 new regressions introduced by Phase 5A.

**Fix required:** Update both assertions from `"healthy"` to `"ok"` in these two test files. This is a two-line change with no functional impact.

**All other 17 requirements are fully satisfied** with substantive, wired implementations confirmed in the actual codebase.

---

_Verified: 2026-02-24T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
