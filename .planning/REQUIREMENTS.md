# Requirements — Phase 5

**Project:** Cash Flow Management — Eye Level AI
**Phase:** 5 — Production Readiness + Render Deployment
**Status:** Active

---

## v1 Requirements (Phase 5 scope)

### Bug Fixes — Backend Data Integrity

- [ ] **BUG-01**: Fix orphaned transactions on installment reverse-payment — delete associated Transaction before decrementing payments_completed
- [ ] **BUG-02**: Fix balance race condition — verify unique DB constraint `uq_balance_current` is in place, add Python-level duplicate detection
- [ ] **BUG-03**: Fix missing schema fields — add credit_card_id, bank_account_id, currency, first_payment_made to relevant Create/Update schemas
- [ ] **BUG-04**: Fix category type mismatch validation — enforce income category → income transaction only (error 422 if mismatch)
- [ ] **BUG-05**: Add 4 missing DB indexes — Alembic migration for credit_cards, subscriptions, transactions, bank_balances
- [ ] **BUG-06**: Fix untyped response_model=list on 4 endpoints — change to List[CorrectResponseType]

### Bug Fixes — Frontend UI

- [ ] **FE-01**: Add 9 missing translation keys in CreditCardsPage to he.json + en.json
- [ ] **FE-02**: Fix wrong translation key — t('creditCards.add') → t('creditCards.addCard') (3 occurrences)
- [ ] **FE-03**: Fix alerts snooze dropdown — overflow-hidden → overflow-visible

### Deployment Code Changes (Render-specific)

- [ ] **DEPLOY-01**: Add DATABASE_URL field_validator in config.py — transforms postgresql:// → postgresql+asyncpg://
- [ ] **DEPLOY-02**: Pin SECRET_KEY as env var — document generation command, never auto-generate in production
- [ ] **DEPLOY-03**: Fix CSP header — remove or make environment-aware (CSP on API service blocks cross-origin frontend calls)
- [ ] **DEPLOY-04**: Switch connection pool to NullPool on Render — add RENDER env var detection in session.py
- [ ] **DEPLOY-05**: Fix frontend API URL — update client.ts to use VITE_API_URL env var with fallback to /api/v1
- [ ] **DEPLOY-06**: Add deep health check endpoint — verify DB connectivity, return 503 if down
- [ ] **DEPLOY-07**: Add PYTHON_VERSION=3.9.21 and .python-version file
- [ ] **DEPLOY-08**: Create render.yaml — define 3 services (Web Service, Static Site, PostgreSQL) with preDeployCommand

### Infrastructure + Go-Live

- [ ] **INFRA-01**: Create GitHub repository and push code (main branch)
- [ ] **INFRA-02**: Set up Render Web Service (FastAPI backend) — Starter plan ($7/mo), Frankfurt region
- [ ] **INFRA-03**: Set up Render Static Site (React frontend) — Free, CDN, SPA rewrite rule /* → /index.html
- [ ] **INFRA-04**: Set up Render PostgreSQL — Basic-256MB plan ($6/mo), no 30-day expiry
- [ ] **INFRA-05**: Configure all production environment variables — DATABASE_URL, SECRET_KEY, CORS_ORIGINS, VITE_API_URL, ADMIN_DEFAULT_PASSWORD, PYTHON_VERSION, RENDER=true
- [ ] **INFRA-06**: Run Alembic migration on production DB (via preDeployCommand)
- [ ] **INFRA-07**: Seed production DB — admin user, default categories (via Render Shell)
- [ ] **INFRA-08**: Enable Render auto-deploy from GitHub main branch
- [ ] **INFRA-09**: Smoke test production — login, create transaction, view dashboard, verify forecast

### Post-Deploy Hardening (week 1)

- [ ] **HARD-01**: Add dashboard module tests — 11 sub-endpoints (currently 0% coverage)
- [ ] **HARD-02**: Fix test flakiness — 3 sequential runs must produce identical results
- [ ] **HARD-03**: Fix circular reference detection in categories — full DFS cycle detection
- [ ] **HARD-04**: Verify exchange rate conversion direction — unit test with mocked Frankfurter response

---

## v2 Requirements (deferred)

- Installment rounding — last payment absorbs remainder (M3)
- Loan payment validation — monthly_payment >= monthly_interest (M4)
- Date range validation — start_date <= end_date (M5)
- Token blacklist persistence — Redis or DB-backed (M8)
- Settings field validation — ISO 4217 currency, supported languages (M9)
- Alert sound preference persistence — localStorage (F4)
- Snooze re-notification polling — refetchInterval (F5)
- JWT migration — httpOnly cookies instead of localStorage
- Alert threshold customization per user (M7)
- Week start day configuration (M10)

---

## Out of Scope (Phase 5)

- E2E testing (Playwright/Cypress) — Phase 6, after app is live
- Custom domain — render.com subdomain מספיק לעכשיו
- CI/CD GitHub Actions pipeline — Render auto-deploy מספיק
- Prometheus/Grafana monitoring — overkill לסקאל הנוכחי
- Redis cache/session store — in-memory מספיק לעכשיו
- New features — Phase 5 הוא strictly bug fixes + deployment
- Mobile app — לא בתכנית

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| BUG-01 | Phase 5A | Pending |
| BUG-02 | Phase 5A | Pending |
| BUG-03 | Phase 5A | Pending |
| BUG-04 | Phase 5A | Pending |
| BUG-05 | Phase 5A | Pending |
| BUG-06 | Phase 5A | Pending |
| FE-01 | Phase 5A | Pending |
| FE-02 | Phase 5A | Pending |
| FE-03 | Phase 5A | Pending |
| DEPLOY-01 | Phase 5A | Pending |
| DEPLOY-02 | Phase 5A | Pending |
| DEPLOY-03 | Phase 5A | Pending |
| DEPLOY-04 | Phase 5A | Pending |
| DEPLOY-05 | Phase 5A | Pending |
| DEPLOY-06 | Phase 5A | Pending |
| DEPLOY-07 | Phase 5A | Pending |
| DEPLOY-08 | Phase 5A | Pending |
| INFRA-01 | Phase 5B | Pending |
| INFRA-02 | Phase 5B | Pending |
| INFRA-03 | Phase 5B | Pending |
| INFRA-04 | Phase 5B | Pending |
| INFRA-05 | Phase 5B | Pending |
| INFRA-06 | Phase 5B | Pending |
| INFRA-07 | Phase 5B | Pending |
| INFRA-08 | Phase 5B | Pending |
| INFRA-09 | Phase 5B | Pending |
| HARD-01 | Phase 5C | Pending |
| HARD-02 | Phase 5C | Pending |
| HARD-03 | Phase 5C | Pending |
| HARD-04 | Phase 5C | Pending |

---

*Requirements defined: 2026-02-24, Phase 5 initialization*
*Traceability updated: 2026-02-24, Roadmap created*
