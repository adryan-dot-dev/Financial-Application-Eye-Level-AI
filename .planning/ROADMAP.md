# Roadmap: Cash Flow Management — Phase 5

## Overview

Phase 5 takes a fully built financial application (Phases 0-4 complete, 155+ tests, 67 API routes) from local Docker development to live production on Render.com. The work splits into three natural delivery boundaries: fix all code-level bugs and add deployment-specific code changes first (5A), then stand up the infrastructure and go live (5B), then harden test coverage and fix edge cases that don't block launch (5C). This order matters because 5A code changes are prerequisites for 5B deployment to function at all, and 5C items are important but not launch-blocking.

## Phases

- [ ] **Phase 5A: Pre-Deploy Fixes** - Fix all backend data bugs, frontend UI bugs, and add deployment-specific code changes so the codebase is production-ready
- [ ] **Phase 5B: Deployment + Go-Live** - Stand up Render infrastructure (GitHub, Web Service, Static Site, PostgreSQL), configure env vars, migrate, seed, and smoke test
- [ ] **Phase 5C: Post-Deploy Hardening** - Add dashboard test coverage, stabilize test suite, fix edge case bugs (circular categories, exchange rate validation)

## Phase Details

### Phase 5A: Pre-Deploy Fixes
**Goal**: The codebase is correct (no data corruption bugs), visually complete (no broken UI), and contains all code changes required for Render deployment
**Depends on**: Nothing (first phase of Phase 5)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, FE-01, FE-02, FE-03, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DEPLOY-07, DEPLOY-08
**Success Criteria** (what must be TRUE):
  1. All 155+ existing backend tests pass after changes (no regressions)
  2. Reversing an installment payment does not leave orphaned transactions in the database (BUG-01 verified by test)
  3. The frontend CreditCardsPage displays fully translated Hebrew text with no raw translation keys visible (FE-01, FE-02)
  4. The alerts snooze dropdown opens and is clickable without being clipped by parent overflow (FE-03)
  5. A render.yaml file exists at repo root defining three services (Web Service, Static Site, PostgreSQL) with correct build/start commands and preDeployCommand for Alembic (DEPLOY-08)
**Plans**: 3 plans

Plans:
- [ ] 5A-01-PLAN.md — Backend bug fixes (BUG-01 through BUG-06) + Alembic migration for constraints and indexes
- [ ] 5A-02-PLAN.md — Frontend UI fixes (FE-01, FE-02, FE-03) — CreditCardsPage translations + alerts overflow
- [ ] 5A-03-PLAN.md — Deployment code changes (DEPLOY-01 through DEPLOY-08) — config.py, session.py, main.py, client.ts, .python-version, render.yaml

### Phase 5B: Deployment + Go-Live
**Goal**: The application is live and accessible at Render URLs with working auth, CORS, database, and seed data
**Depends on**: Phase 5A (code must be deployment-ready before infrastructure setup)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09
**Success Criteria** (what must be TRUE):
  1. The GitHub repository exists with all code pushed to main branch (INFRA-01)
  2. The backend API responds to requests at the Render Web Service URL (health check returns 200 with DB connectivity confirmed) (INFRA-02, INFRA-06)
  3. The frontend loads at the Render Static Site URL, displays the login page in Hebrew, and SPA routing works on page refresh (INFRA-03)
  4. A user can log in, create a transaction, and see it reflected on the dashboard in the production environment (INFRA-09 smoke test)
  5. Pushing a commit to GitHub main triggers automatic redeployment on Render (INFRA-08)
**Plans**: TBD

Plans:
- [ ] 5B-01: GitHub repo creation + Render infrastructure setup (INFRA-01 through INFRA-08)
- [ ] 5B-02: Production smoke test + go-live verification (INFRA-09)

### Phase 5C: Post-Deploy Hardening
**Goal**: Test coverage gaps are closed, test suite is stable, and edge case bugs that surfaced during development are resolved
**Depends on**: Phase 5B (post-deploy work, app is already live)
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04
**Success Criteria** (what must be TRUE):
  1. Dashboard module has test coverage for its 11 sub-endpoints (previously 0% coverage) (HARD-01)
  2. Running the full test suite 3 times sequentially produces identical pass/fail results with zero flaky tests (HARD-02)
  3. Creating a category hierarchy with a circular reference (A -> B -> C -> A) returns an error instead of causing infinite recursion (HARD-03)
  4. Converting USD to ILS using the exchange rate service returns the correct direction (verified by unit test with mocked Frankfurter API response) (HARD-04)
**Plans**: TBD

Plans:
- [ ] 5C-01: Dashboard module tests + test suite stabilization (HARD-01, HARD-02)
- [ ] 5C-02: Edge case bug fixes — circular categories + exchange rate validation (HARD-03, HARD-04)

## Progress

**Execution Order:**
Phases execute in order: 5A -> 5B -> 5C

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5A. Pre-Deploy Fixes | 0/3 | Not started | - |
| 5B. Deployment + Go-Live | 0/2 | Not started | - |
| 5C. Post-Deploy Hardening | 0/2 | Not started | - |
