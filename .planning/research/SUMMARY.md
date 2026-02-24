# Project Research Summary

**Project:** Cash Flow Management — Eye Level AI
**Domain:** Production deployment of existing FastAPI + React + PostgreSQL financial application to Render.com
**Researched:** 2026-02-24
**Confidence:** HIGH (all critical claims verified against official Render docs)

---

## Executive Summary

This project is not greenfield development — it is a mature, well-built financial application (Phases 0-4 complete, 155 tests, 67 API routes) that needs to cross the final gap from local Docker to live production. The codebase is surprisingly production-ready in many areas: structured JSON logging, security headers, rate limiting, JWT auth, APScheduler for nightly jobs, and a comprehensive test suite. The primary gaps are deployment configuration, a handful of critical data integrity bugs, and several platform-specific adaptations required by Render.

The recommended approach is a two-phase execution: fix the 12 blocking issues first (data bugs + deployment config), then deploy. This order matters because some bugs (B4: missing schema fields, H2: category type mismatch) require code changes that overlap with the deployment changes already needed. Bundling them avoids multiple migration cycles. The deployment itself is straightforward using a `render.yaml` Blueprint with three services: a Starter Web Service for FastAPI, a free Static Site for React, and a Basic-256MB PostgreSQL database — totaling $13/month. Free tier is categorically unsuitable for a financial app (database deleted after 30 days, service sleeps and misses nightly scheduler jobs).

The top risks are infrastructure-specific: Render provides `postgresql://` URLs while asyncpg requires `postgresql+asyncpg://` (app crashes on startup without a config.py validator fix), the CSP header currently set on the API will block cross-origin API calls from the separate frontend domain (blank page in production), and the JWT `SECRET_KEY` auto-generates on restart if not pinned as an env var (all users logged out on every deploy). Each of these has a known, well-documented fix. No architectural changes are required — only targeted code edits plus the render.yaml and environment variable configuration.

---

## Key Findings

### Recommended Stack

The deployment stack is Render.com with three services managed via `render.yaml` (Infrastructure as Code). Frankfurt region is the correct choice for Israel-based users (~40ms RTT vs ~140ms for US East). The backend runs Python 3.9.21 (must be pinned via `PYTHON_VERSION` env var — Render defaults to 3.14.3) with a single uvicorn worker (optimal for 0.5 CPU Starter plan; gunicorn multiprocessing is wasteful below 1 CPU). The frontend is served as a static site via Render CDN with a `/* -> /index.html` rewrite rule for React Router SPA routing.

**Core technologies:**
- **Render Web Service (Starter, $7/mo):** FastAPI + uvicorn, always-on, `preDeployCommand` for Alembic migrations
- **Render Static Site (Free, $0):** React/Vite `dist/` output, CDN-backed, SPA rewrite rules
- **Render PostgreSQL (Basic-256MB, $6/mo):** Persistent, includes backups, no expiration — mandatory for financial data
- **render.yaml at repo root:** Single IaC file defining all three services, env var injection, migration command
- **Python 3.9.21:** Pinned via `PYTHON_VERSION` env var; app explicitly requires 3.9 (compat shims, all 155 tests pass on 3.9)

### Expected Features (Production Readiness)

**Must fix before deploy (12 items — deploy blockers):**
- **B1:** Orphaned transactions on installment reverse-payment — phantom transactions inflate totals
- **B3:** Balance race condition (`is_current=True` duplicates) — wrong current balance, the core value proposition
- **B4:** Missing schema fields (`credit_card_id`, `bank_account_id`, `currency`, `first_payment_made`) — silent data loss, frontend/backend contract broken
- **F1:** 9 missing translation keys on CreditCardsPage — page shows raw keys instead of Hebrew text
- **F2:** Wrong translation key (`creditCards.add` vs `creditCards.addCard`) — "Add card" button broken
- **F3:** Alerts snooze dropdown unclickable (`overflow-hidden` vs `overflow-visible`) — core interaction broken
- **H2:** Category type mismatch not enforced — income assigned to expense category corrupts dashboard totals
- **H3:** 4 missing DB indexes (credit_cards, subscriptions, transactions, bank_balances) — full table scans under real data
- **Deep health check:** `/health` always returns 200 even if DB is down; Render routes traffic to dead instances
- **render.yaml:** No deployment config exists; cannot deploy without it
- **Production env vars:** SECRET_KEY, DATABASE_URL, CORS_ORIGINS must be configured for Render
- **Alembic in preDeployCommand:** DB schema must match code before app starts

**Fix in first week post-deploy (5 items):**
- H1: Circular reference detection in categories
- H5: Exchange rate conversion direction (affects multi-currency only)
- T1: Dashboard module 0% test coverage (11 endpoints unprotected)
- M1: Flaky test isolation (erodes confidence in test suite)
- B2: Untyped `response_model=list` on 4 endpoints

**Defer to v2+ (anti-features — do NOT build now):**
- Prometheus/Grafana monitoring stack (overkill for Render + handful of users)
- Redis for token blacklist (in-memory + 15min access token TTL is sufficient)
- OpenTelemetry / distributed tracing (single-service, request_id logging exists)
- CI/CD GitHub Actions pipeline (Render Git-connected auto-deploy is sufficient)
- E2E testing with Playwright/Cypress (expensive to maintain, not blocking go-live)
- Custom domain (Render subdomain works for launch validation)

### Architecture Approach

Three Render services communicate in a well-defined topology: the GitHub `main` branch triggers auto-deploy of both backend and frontend simultaneously. The backend pre-deploy command runs Alembic migrations against the managed PostgreSQL database before starting the API server. The React frontend calls the backend via an absolute URL (`VITE_API_URL` baked in at build time) — there is no Vite dev proxy in production. Key architectural change required: `frontend/src/api/client.ts` currently uses `baseURL: '/api/v1'` (relative path working via Vite proxy in dev); in production this must use `import.meta.env.VITE_API_URL || '/api/v1'` to reach the separate Render Web Service domain.

**Major components:**

1. **Render Web Service (FastAPI backend)** — REST API, auth, business logic, APScheduler nightly jobs, communicates with PostgreSQL via internal network URL
2. **Render Static Site (React frontend)** — SPA served via CDN, calls backend via public HTTPS URL, `/* -> /index.html` rewrite for React Router
3. **Render PostgreSQL (managed DB)** — Data persistence, ACID compliance, Alembic migrations run by preDeployCommand before each deploy

### Critical Pitfalls

1. **DATABASE_URL format mismatch** — Render provides `postgresql://`, asyncpg requires `postgresql+asyncpg://`. Without a `field_validator` in `config.py`, the app crashes on startup with a dialect error. Fix: add URL transformation validator (well-documented, tested in code, portable). This is a deploy-day blocker.

2. **JWT SECRET_KEY auto-generates on restart** — `config.py` generates a random key if none is set. Every Render deploy restarts the service, invalidating all existing JWTs. Every user is logged out on every deploy. Fix: generate once with `python -c "import secrets; print(secrets.token_urlsafe(64))"` and pin as `SECRET_KEY` env var on Render. Never change it unless intentionally invalidating all sessions.

3. **CSP header blocks cross-origin API calls** — `main.py` sets `Content-Security-Policy: default-src 'self'`. In production, frontend (`cashflow-frontend.onrender.com`) calls backend (`cashflow-api.onrender.com`) — different origins. `connect-src` inherits `default-src 'self'`, so all API calls are blocked by the browser (blank white page, CORS-like error in console). Fix: remove CSP from the API service (API returns JSON, not HTML — CSP is a browser protection for HTML pages) or make it environment-aware.

4. **asyncpg connection pool exhaustion on Render** — `session.py` uses `QueuePool` with `pool_size=10, max_overflow=20`. Render terminates idle TCP connections at OS level. After a free-tier sleep/wake cycle, all pooled connections are dead simultaneously, causing a burst of failures on wake-up. Fix: use `NullPool` on Render (fresh connection per request, no stale connections). Make pool config environment-aware with `if os.getenv("RENDER"): poolclass = NullPool`.

5. **APScheduler jobs silently missed on free tier** — 7 nightly jobs (00:05-03:00 Israel time) require the service to be awake. Free tier sleeps after 15 min of inactivity. For a business-hours app, the service will be asleep all night. `misfire_grace_time=3600` only helps if the service wakes within 1 hour of the scheduled time. Fix for initial deploy: use Starter plan ($7/mo, always-on). If free tier is needed temporarily: add HTTP admin endpoints to trigger jobs manually, add startup catch-up logic.

6. **Ephemeral filesystem invalidates backup service** — `backup_service.py` writes to `/backups` on the server filesystem. Render filesystems reset on every deploy, restart, or sleep/wake cycle. All backups silently disappear. Fix: disable the filesystem backup job on Render deployment. Rely on Render's managed PostgreSQL backups (included with Basic plan) for data protection.

---

## Implications for Roadmap

Based on combined research, two phases are sufficient and the right sequence is bugs-first, then deploy, then post-deploy hardening.

### Phase 1: Pre-Deploy Fixes (Bugs + Code Changes)
**Rationale:** Several bugs require code changes that overlap with deployment prep changes (config.py validator, schema additions, Alembic migration). Doing them together avoids running multiple migrations and ensures the first deploy goes out clean. The 12 deploy-blocking items split cleanly into three groups: backend data bugs (B1, B3, B4, H2, H3), frontend UI bugs (F1, F2, F3), and deployment code changes (DATABASE_URL validator, deep health check, client.ts API URL, CSP header, NullPool pool config).
**Delivers:** A codebase that is correct (no data corruption bugs), visually complete (no broken UI), and ready to connect to production infrastructure.
**Addresses:** B1, B3, B4, F1, F2, F3, H2, H3 from FEATURES.md; Pitfalls P1 (NullPool), P4 (CSP), P6 (DATABASE_URL), P5 (CORS/client.ts)
**Avoids:** Silent data corruption on first real users, blank page in production, all-users-logged-out on every deploy

### Phase 2: Deployment Configuration + Go-Live
**Rationale:** With the code fixes in place, this phase is pure infrastructure: write render.yaml, set environment variables, run the migration, seed data, and smoke test. This is mechanical but must be done in dependency order (DB -> backend -> frontend -> CORS update -> redeploy). The `render.yaml` Blueprint approach deploys all three services atomically and is version-controlled.
**Delivers:** Live application at `https://cashflow-frontend.onrender.com` with correct auth, CORS, database schema, and seed data.
**Uses:** render.yaml from STACK.md, Frankfurt region selection, preDeployCommand for Alembic, `PYTHON_VERSION=3.9.21`, `SECRET_KEY` generated and pinned, `CORS_ORIGINS` set to exact frontend URL, `VITE_API_URL` set for frontend build
**Avoids:** P2 (paid PostgreSQL — no 30-day expiration), P3 (Starter plan for scheduler), P7 (SPA rewrite rule), P8 (Alembic on fresh DB), P9 (pinned SECRET_KEY), P10 (backup service disabled), P11 (Python version pinned)

### Phase 3: Post-Deploy Hardening (First Week)
**Rationale:** These items are important but do not block go-live. They improve developer confidence (T1 dashboard tests, M1 test stability) and handle edge cases that only surface with real users (H1 circular categories, H5 exchange rate direction). B2 (untyped response models) is a developer-experience fix.
**Delivers:** Higher test coverage on dashboard module (0% -> covered), stable test suite (no flaky runs), edge case handling for circular category hierarchies and multi-currency scenarios.
**Addresses:** H1, H5, T1, M1, B2 from FEATURES.md

### Phase Ordering Rationale

- Phase 1 before Phase 2 because some code changes (config.py validator, client.ts, CSP) are prerequisites for the deployment to function at all — they cannot be done after deploy.
- Phase 1 also includes the Alembic migration for H3 (DB indexes) and B4 (schema fields) so that the initial migration on Render's fresh database includes everything in one `alembic upgrade head` pass.
- Phase 3 is strictly post-deploy because none of the items cause deploy failures or data corruption on go-live.
- Anti-features (Redis, CI/CD, monitoring stack, E2E tests) are correctly deferred — they add operational complexity without proportional value at current scale.

### Research Flags

Phases with standard patterns (skip research-phase — fully documented):
- **Phase 2 (Deployment):** render.yaml Blueprint, preDeployCommand, SPA rewrite rules, fromDatabase env injection — all verified against official Render docs. Zero ambiguity.

Phases that may benefit from targeted research during planning:
- **Phase 3, item T1 (Dashboard tests):** The dashboard module has 11 sub-endpoints with complex aggregation logic. Writing meaningful tests requires understanding the expected behavior under edge cases (empty data, mixed currencies, date boundaries). A focused code-reading pass before writing tests is warranted.
- **Phase 3, item H5 (Exchange rate direction):** The Frankfurter API integration and conversion formula need validation with a known exchange rate. Low-risk but warrants a unit test that verifies the direction (not just that a number comes back).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All critical claims (render.yaml syntax, plan tiers, Python version pinning, uvicorn vs gunicorn tradeoff) verified against official Render docs |
| Features | HIGH | Based on direct codebase analysis of backend/app/main.py, config.py, session.py, scheduler.py, and frontend source files — primary source, not inference |
| Architecture | HIGH | Three-service topology and all patterns verified against official Render docs (Blueprint spec, Static Site rewrites, PostgreSQL connection docs, Multi-Service architecture docs) |
| Pitfalls | HIGH | P1-P6 verified against official SQLAlchemy docs, Render changelog, and Render community reports. P7-P11 verified against official Render docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Seed script idempotency:** STACK.md recommends running the seed via Render Shell on first deploy. The seed script must be verified to be idempotent (check-before-insert) before running in production, since it may encounter an existing admin user if re-run. Verify before Phase 2.
- **Scheduler keep-alive decision:** If the app goes live on Starter plan ($7/mo), APScheduler works reliably. If there is a cost constraint requiring free tier temporarily, the nightly jobs will not run. This decision needs explicit sign-off before Phase 2 — it affects whether the recurring charges, alerts, and loan/installment auto-processing features function at all in production.
- **ADMIN_DEFAULT_PASSWORD workflow:** The env var must be set manually in the Render Dashboard (marked `sync: false` in render.yaml to avoid committing to git). The seed script creates the admin user using this password. The workflow (who sets it, what the value is, when the seed runs) needs to be documented and agreed on before Phase 2.
- **Token storage (localStorage vs httpOnly cookies):** PITFALLS.md flags that JWT refresh tokens in localStorage are vulnerable to XSS. For a financial app, httpOnly cookies are strictly better. The current implementation uses localStorage. This is an accepted risk for launch (with short 15-min access token TTL providing mitigation) but should be tracked as a post-launch security hardening item.

---

## Sources

### Primary (HIGH confidence)
- [Deploy FastAPI on Render](https://render.com/docs/deploy-fastapi) — build/start commands, Python version
- [Blueprint YAML Reference](https://render.com/docs/blueprint-spec) — preDeployCommand, fromDatabase, routes, complete render.yaml syntax
- [Render Blueprints (IaC)](https://render.com/docs/infrastructure-as-code) — version-controlled deployments
- [Setting Python Version](https://render.com/docs/python-version) — PYTHON_VERSION env var, .python-version file
- [Health Checks](https://render.com/docs/health-checks) — behavior during deploy, failure handling
- [Static Site Redirects/Rewrites](https://render.com/docs/redirects-rewrites) — SPA rewrite rules, file-first behavior
- [Free PostgreSQL 30-day expiry changelog](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90) — data loss risk on free tier
- [Render Pricing](https://render.com/pricing) — Starter $7/mo, Basic-256MB $6/mo
- [Pre-deploy command changelog](https://render.com/changelog/predeploy-command) — migration strategy
- [Render Free Tier Docs](https://render.com/docs/free) — sleep behavior, 750 hrs/month, 15-min idle
- [SQLAlchemy Connection Pooling Docs](https://docs.sqlalchemy.org/en/20/core/pooling.html) — NullPool vs QueuePool
- [SQLAlchemy/Render NullPool Discussion #10238](https://github.com/sqlalchemy/sqlalchemy/discussions/10238) — NullPool recommendation
- [Render Static Site Rewrites](https://render.com/docs/redirects-rewrites) — SPA routing
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/) — CSP, security headers
- Codebase analysis: `backend/app/config.py`, `backend/app/main.py`, `backend/app/db/session.py`, `backend/app/services/scheduler.py`, `backend/alembic/env.py`, `frontend/src/api/client.ts`, `frontend/vite.config.ts` — direct source, highest confidence

### Secondary (MEDIUM confidence)
- [How to Deploy FastAPI + PostgreSQL on Render](https://www.freecodecamp.org/news/deploy-fastapi-postgresql-app-on-render/) — step-by-step guide corroborating official docs
- [FastAPI production deployment best practices - Render](https://render.com/articles/fastapi-production-deployment-best-practices) — official Render article
- [Render Community: CORS Static Site](https://community.render.com/t/strategies-for-cors-auth-with-preview-deploys-custom-domains/4729) — CORS between Render services
- [Render Community: Free Tier Sleep Behavior](https://community.render.com/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303) — 15-min sleep, cold start timings
- [APScheduler FAQ](https://apscheduler.readthedocs.io/en/3.x/faq.html) — missed jobs, persistent stores
- [JWT Storage Security Guide](https://www.descope.com/blog/post/developer-guide-jwt-storage) — localStorage vs httpOnly cookies

---

*Research completed: 2026-02-24*
*Ready for roadmap: yes*
