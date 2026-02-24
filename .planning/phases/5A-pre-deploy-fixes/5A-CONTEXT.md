# Phase 5A: Pre-Deploy Fixes - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all backend data bugs (BUG-01 through BUG-06), frontend UI bugs (FE-01 through FE-03), and add Render-specific deployment code changes (DEPLOY-01 through DEPLOY-08) so the codebase is production-ready. Infrastructure setup and go-live are Phase 5B — this phase ends when the codebase is correct and deployable.

</domain>

<decisions>
## Implementation Decisions

### CSP Strategy (DEPLOY-03)
- Environment-aware approach — NOT removed entirely
- Detection: use `RENDER` env var (Render sets this automatically on all Web Services)
- Production (RENDER=true): CSP applied, allows only frontend Render URL (from ALLOWED_ORIGINS config)
- Development (RENDER not set): no CSP header applied
- Consistent with DEPLOY-04 which also uses RENDER env var for NullPool detection

### Bug Fix Test Coverage
- Only BUG-01 gets a regression test (as specified in success criteria)
- BUG-02 through BUG-06: no new tests in Phase 5A (testing hardening is Phase 5C)
- BUG-01 test level: integration test with actual DB — create installment → make payment → reverse → assert no Transaction row remains in DB
- Validation: run full pytest suite after each plan (after 5A-01, after 5A-02, after 5A-03)

### Migration Consolidation (BUG-02, BUG-03, BUG-05)
- Single Alembic migration covers all schema changes in plan 5A-01
- BUG-03 (schema fields): DB columns already exist — only Pydantic schema fix needed, no DB migration required
- BUG-02 (balance race condition): migration checks for `uq_balance_current` unique constraint and adds it if missing
- BUG-05 (indexes): migration adds 4 missing indexes (credit_cards, subscriptions, transactions, bank_balances)
- Result: one migration file handles BUG-02 constraint + BUG-05 indexes

### render.yaml Specifics (DEPLOY-08)
- Service names: `eye-level-api` (Web Service), `eye-level-frontend` (Static Site), `eye-level-db` (PostgreSQL)
- preDeployCommand: `alembic upgrade head` — fail-fast, no retries (migration failure stops deployment)
- Health check endpoint (DEPLOY-06): returns JSON `{"status": "ok", "db": true, "version": "1.0.0"}` — 200 if DB connected, 503 if DB down
- Health check path used by Render for service health monitoring

### Claude's Discretion
- Exact Alembic migration naming and revision chaining
- Python-level duplicate detection implementation for BUG-02 (in addition to DB constraint)
- Version string source for health check response (hardcoded or from config)
- Ordering of changes within each plan file

</decisions>

<specifics>
## Specific Ideas

- RENDER env var reuse: both DEPLOY-03 (CSP) and DEPLOY-04 (NullPool) should share the same RENDER-based detection pattern — consistent approach across both
- Migration safety: use `IF NOT EXISTS` style checks in Alembic for constraint/index creation to handle environments where they may already exist

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 5A-pre-deploy-fixes*
*Context gathered: 2026-02-24*
