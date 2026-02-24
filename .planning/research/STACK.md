# Technology Stack: Production Deployment on Render.com

**Project:** Cash Flow Management - Eye Level AI
**Researched:** 2026-02-24
**Focus:** Production deployment configuration for existing FastAPI + React app on Render.com

---

## Recommended Deployment Stack

### Render Service Architecture

| Service | Render Type | Plan | Purpose |
|---------|-------------|------|---------|
| Backend API | Web Service | Starter ($7/mo) | FastAPI + uvicorn, Python 3.9 |
| Frontend | Static Site | Free ($0/mo) | React/Vite built assets served via CDN |
| Database | PostgreSQL | Basic-256MB ($6/mo) | Managed PostgreSQL 16, no expiry |

**Total cost: $13/month.** Do NOT use the free tier for backend or database in production -- see Pitfalls section below.

### Why NOT Free Tier

| Resource | Free Tier Problem | Impact |
|----------|------------------|--------|
| Web Service | Spins down after 15min idle, ~60s cold start | Users see blank page / timeout on first request |
| PostgreSQL | Expires after 30 days, permanently deleted | **Total data loss** after 30 days |
| Web Service | 750 hrs/month limit, 0.1 CPU | Throttled performance, potential suspension |

**Verdict:** Free tier is only for demos. For a real product, Starter Web Service + Basic-256MB PostgreSQL is the minimum viable production setup. [Confidence: HIGH -- verified from official Render docs]

---

## render.yaml (Infrastructure as Code) -- RECOMMENDED

Use `render.yaml` over manual Dashboard configuration because:
1. Configuration is version-controlled alongside code
2. Reproducible -- anyone can deploy from the same repo
3. Atomic changes -- push a config update, all services redeploy
4. `preDeployCommand` for migrations is declarative, not a manual dashboard setting

**Confidence: HIGH** -- Blueprint spec verified from official Render docs.

### Complete render.yaml

Place this file at the repository root (`/render.yaml`):

```yaml
# render.yaml -- Render Blueprint for Cash Flow Management
# Docs: https://render.com/docs/blueprint-spec

databases:
  - name: cashflow-db
    plan: basic-256mb
    region: frankfurt          # Closest to Israel
    postgresMajorVersion: "16"
    databaseName: cashflow
    user: cashflow

services:
  # ── Backend API (FastAPI) ─────────────────────────────────
  - type: web
    name: cashflow-api
    runtime: python
    region: frankfurt
    plan: starter
    repo: https://github.com/YOUR_ORG/Financial-Application-Eye-Level-AI.git
    branch: main
    rootDir: backend
    buildCommand: "pip install -r requirements.txt"
    startCommand: "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
    preDeployCommand: "PYTHONPATH=. alembic upgrade head"
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: cashflow-db
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: ALGORITHM
        value: HS256
      - key: ACCESS_TOKEN_EXPIRE_MINUTES
        value: "15"
      - key: REFRESH_TOKEN_EXPIRE_DAYS
        value: "7"
      - key: CORS_ORIGINS
        value: "https://cashflow-frontend.onrender.com"
      - key: ADMIN_DEFAULT_PASSWORD
        sync: false        # Set manually in Dashboard -- never in YAML
      - key: DEBUG
        value: "false"
      - key: PYTHON_VERSION
        value: "3.9.21"

  # ── Frontend (React + Vite Static Site) ───────────────────
  - type: web
    name: cashflow-frontend
    runtime: static
    region: frankfurt
    plan: free
    repo: https://github.com/YOUR_ORG/Financial-Application-Eye-Level-AI.git
    branch: main
    rootDir: frontend
    buildCommand: "npm install && npm run build"
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        value: "https://cashflow-api.onrender.com/api/v1"
```

---

## Critical Configuration Details

### 1. Python Version Pinning

**Problem:** Render defaults to Python 3.14.3 for new services (as of Feb 2026). The app requires Python 3.9.

**Solution:** Set `PYTHON_VERSION` environment variable to `3.9.21` (latest 3.9 patch). Alternatively, create a `.python-version` file in `backend/` containing `3.9`.

**Confidence: HIGH** -- verified from official Render Python version docs. Render supports any version from 3.7.3 onward.

### 2. DATABASE_URL Scheme Transformation (CODE CHANGE REQUIRED)

**Problem:** Render's `fromDatabase` `connectionString` property provides a URL in format `postgresql://user:pass@host:port/db`. The app's SQLAlchemy async engine requires `postgresql+asyncpg://user:pass@host:port/db`. Without this transformation, the app will crash on startup with a dialect error.

**Solution:** Add a `field_validator` to `backend/app/config.py`:

```python
@field_validator("DATABASE_URL", mode="before")
@classmethod
def fix_database_url(cls, v: str) -> str:
    """Render provides postgresql:// but asyncpg needs postgresql+asyncpg://"""
    if v and v.startswith("postgresql://"):
        v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif v and v.startswith("postgres://"):
        v = v.replace("postgres://", "postgresql+asyncpg://", 1)
    return v
```

This is the standard pattern used by every FastAPI+asyncpg app deployed to Render/Heroku/Railway. Handle it in code (tested, portable) rather than shell commands in preDeployCommand (brittle, untested).

**Confidence: HIGH** -- well-documented pattern across multiple deployment guides and community posts.

### 3. Alembic Migration Strategy (preDeployCommand)

**Problem:** Alembic must run before the app starts, against the production database.

**Solution:** Use Render's `preDeployCommand`:

```
PYTHONPATH=. alembic upgrade head
```

**How preDeployCommand works on Render:**
- Runs after `buildCommand` completes (dependencies installed)
- Runs before `startCommand` (app not yet serving traffic)
- Has access to all environment variables
- If it fails, deployment is cancelled (old version keeps running -- zero-downtime)
- Runs in the same environment as the service

**Why `PYTHONPATH=.`:** Alembic's `env.py` imports `app.config` and `app.db.models`, which require the backend root in the Python path. Since `rootDir: backend` is set in render.yaml, the working directory is already `backend/`, so `.` is correct.

**Why the existing Alembic setup works:** `alembic/env.py` already overrides the hardcoded `alembic.ini` URL with `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)`. After adding the `fix_database_url` validator (section 2), `settings.DATABASE_URL` will have the correct `postgresql+asyncpg://` scheme.

**Confidence: HIGH** -- verified from official Render Blueprint spec and changelog.

### 4. Health Check Endpoint

**Current state:** The app already has a `/health` endpoint at `backend/app/main.py:148` that returns `{"status": "healthy", "version": "0.1.0"}` with HTTP 200.

**Render health check behavior:**
- Checks every few seconds
- Expects 2xx or 3xx response within 5 seconds
- After 15s of failures: stops routing traffic to instance
- After 60s of failures: restarts service
- During deploy: 15 minutes to pass health checks or deploy is cancelled

**No changes needed.** The existing `/health` endpoint is fully compatible.

**Confidence: HIGH** -- verified from official Render health check docs.

### 5. Static Site SPA Routing

**Problem:** React Router v7 uses client-side routing. Direct URL access (e.g., `https://app.../transactions`) returns 404 because there is no `transactions/index.html` file on disk.

**Solution:** The `routes` section in render.yaml:

```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

This rewrites all non-file paths to `index.html`, letting React Router handle routing. Actual static files (JS, CSS, images) are served directly because Render does not apply rewrite rules when a resource exists at the requested path.

**Confidence: HIGH** -- verified from official Render redirects/rewrites docs.

### 6. CORS Configuration

**Problem:** Frontend on `https://cashflow-frontend.onrender.com` calls API on `https://cashflow-api.onrender.com` (cross-origin).

**Solution:** Set `CORS_ORIGINS` environment variable to the exact frontend URL. The existing `config.py` already parses comma-separated strings and JSON arrays.

**Important:** The app's `parse_cors_origins` validator explicitly blocks the wildcard `*`. Always use exact origin URLs.

### 7. Frontend API URL (Build-Time Variable)

**Problem:** The frontend currently uses `VITE_API_URL=http://localhost:8000/api/v1`. In production it must point to the Render backend.

**Solution:** Set `VITE_API_URL` as an environment variable on the Render static site service:

```
VITE_API_URL=https://cashflow-api.onrender.com/api/v1
```

**Critical:** Vite environment variables prefixed with `VITE_` are baked into the JavaScript bundle at build time. They are NOT runtime variables. If the API URL changes, the frontend must be rebuilt.

### 8. Connection Pool Sizing

**Current `session.py` config:** `pool_size=10, max_overflow=20` (30 total connections possible).

**Render Basic-256MB PostgreSQL limit:** 100 connections.

**No changes needed** for a single-instance Starter plan. If scaling to multiple instances, reduce pool_size proportionally (e.g., 3 instances x 10 pool + 20 overflow = 90, still under 100).

---

## Complete Environment Variables Reference

### Backend Web Service

| Variable | Source | Value/Method | Required |
|----------|--------|-------------|----------|
| `DATABASE_URL` | `fromDatabase` | Auto-populated from cashflow-db connectionString | YES |
| `SECRET_KEY` | `generateValue: true` | Random 256-bit base64 string, generated by Render | YES |
| `ALGORITHM` | Hardcoded | `HS256` | YES |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Hardcoded | `15` | YES |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Hardcoded | `7` | YES |
| `CORS_ORIGINS` | Hardcoded | `https://cashflow-frontend.onrender.com` | YES |
| `ADMIN_DEFAULT_PASSWORD` | Manual (Dashboard) | Set via Dashboard, never committed to YAML or git | YES (for seed) |
| `DEBUG` | Hardcoded | `false` | YES |
| `PYTHON_VERSION` | Hardcoded | `3.9.21` | YES |

### Frontend Static Site

| Variable | Source | Value/Method | Required |
|----------|--------|-------------|----------|
| `VITE_API_URL` | Hardcoded | `https://cashflow-api.onrender.com/api/v1` | YES |

---

## Build and Start Commands

### Backend

| Phase | Command | Notes |
|-------|---------|-------|
| Build | `pip install -r requirements.txt` | Render auto-detects Python, installs pip dependencies |
| Pre-deploy | `PYTHONPATH=. alembic upgrade head` | Runs migrations before app starts; fails = rollback deploy |
| Start | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | Single worker, optimal for 0.5 CPU Starter plan |

**Why uvicorn (not gunicorn+uvicorn workers):**
- Starter plan has 0.5 CPU -- a single async uvicorn process is optimal
- Gunicorn multiprocessing overhead is wasteful with < 1 CPU core
- FastAPI's async design means one uvicorn process handles concurrency via asyncio
- Upgrade to `gunicorn -w 2 -k uvicorn.workers.UvicornWorker` only on Standard plan (1+ CPU)

### Frontend

| Phase | Command | Notes |
|-------|---------|-------|
| Build | `npm install && npm run build` | Runs `tsc -b && vite build` (TypeScript check + bundle) |
| Publish | `dist/` directory | Vite outputs to `dist/` by default, served via Render CDN |

---

## Region Selection

**Recommendation: `frankfurt`** -- closest Render region to Israel for lowest latency.

| Region | Estimated RTT to Israel | Notes |
|--------|------------------------|-------|
| Frankfurt | ~40ms | EU West, closest option |
| Ohio | ~140ms | US East |
| Oregon | ~200ms | US West, Render's default |

All three services (backend, frontend CDN edge, database) MUST be in the same region to minimize inter-service latency, especially between backend and database.

**Confidence: MEDIUM** -- latency estimates are approximate. Verify with a real request after deployment.

---

## Required Code Changes for Deployment

Summary of changes needed in the existing codebase before deploying:

| File | Change | Why |
|------|--------|-----|
| `backend/app/config.py` | Add `fix_database_url` field validator | Transform Render's `postgresql://` to `postgresql+asyncpg://` |
| `backend/.python-version` (new) | Create file containing `3.9` | Pin Python version on Render (backup for env var) |
| `/render.yaml` (new) | Create Blueprint file at repo root | Define all Render services as IaC |
| `frontend/.env.production` (optional) | `VITE_API_URL` for local prod builds | Only if testing production builds locally |

**No changes needed to:**
- `alembic/env.py` -- already reads DATABASE_URL from settings
- `alembic.ini` -- overridden by env.py at runtime
- `app/main.py` -- health check already exists, DEBUG already controls docs
- `backend/app/db/session.py` -- pool settings are appropriate
- `frontend/vite.config.ts` -- dev proxy is dev-only, irrelevant to production

---

## Alternatives Considered

| Decision | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|-------------------|
| IaC | render.yaml | Manual Dashboard | Dashboard config is not version-controlled, not reproducible |
| ASGI Server | uvicorn (single) | gunicorn + uvicorn workers | 0.5 CPU on Starter makes multiprocessing overhead wasteful |
| DB Plan | Basic-256MB | Free | Free expires in 30 days, data is permanently deleted |
| Web Plan | Starter | Free | Free spins down after 15min, ~60s cold start |
| Frontend | Static Site | Web Service | Static site is CDN-backed, free, faster, correct for SPA |
| Region | Frankfurt | Oregon (default) | Frankfurt is geographically closest to Israel |
| Python Version | 3.9.21 (via env var) | Render default (3.14.3) | App explicitly requires Python 3.9 (compat shims, all tests run on 3.9) |
| URL Transform | In config.py validator | In preDeployCommand shell | Code-level fix is testable, portable, not brittle shell one-liner |

---

## Deployment Sequence

```
1. Create GitHub repository, push code
2. Verify render.yaml is at repository root
3. In Render Dashboard: New > Blueprint
4. Connect GitHub repo, select main branch
5. Review generated services (should show: cashflow-api, cashflow-frontend, cashflow-db)
6. Manually set ADMIN_DEFAULT_PASSWORD in Dashboard (cashflow-api > Environment)
7. Click "Deploy Blueprint"
   a. Render provisions PostgreSQL database
   b. Render builds backend (pip install -r requirements.txt)
   c. Render runs preDeployCommand (PYTHONPATH=. alembic upgrade head)
   d. Render starts uvicorn, waits for /health to return 200
   e. Render builds frontend (npm install && npm run build)
   f. Render serves dist/ via CDN with rewrite rules
8. Verify: access https://cashflow-frontend.onrender.com
9. Run seed script via Render Shell: PYTHONPATH=. python scripts/seed_data.py
10. Smoke test: login, create transaction, verify dashboard
```

---

## Post-Deployment: Running Seed Script

Render does not have a built-in "run once" mechanism. Options:

1. **Render Shell** (recommended for first deploy): Backend service > Shell tab > `PYTHONPATH=. python scripts/seed_data.py`
2. **Idempotent preDeployCommand**: Append `&& PYTHONPATH=. python scripts/seed_data.py` -- runs on EVERY deploy, so the seed script MUST be idempotent (check-before-insert)
3. **One-off Job**: Create a temporary Render Cron Job, run once, delete

**Recommendation:** Use Render Shell for the initial seed. Ensure the seed script is idempotent regardless.

---

## Production Security Notes

The current `main.py` correctly:
- Disables `/docs` and `/redoc` when `DEBUG=false`
- Sets security headers (HSTS, X-Frame-Options, CSP, etc.)
- Has rate limiting via slowapi
- Uses parameterized queries via SQLAlchemy (SQL injection prevention)
- Blocks CORS wildcard `*`

**One concern:** The `Content-Security-Policy` header is set to `default-src 'self'`. In production with a separate frontend domain, API responses don't serve HTML, so this CSP is fine for the API. The frontend's CSP is controlled by Render's static site headers (configurable in render.yaml `headers` section if needed).

---

## Sources

- [Deploy FastAPI on Render](https://render.com/docs/deploy-fastapi) -- HIGH confidence (official docs)
- [Blueprint YAML Reference](https://render.com/docs/blueprint-spec) -- HIGH confidence (official docs)
- [Render Blueprints (IaC)](https://render.com/docs/infrastructure-as-code) -- HIGH confidence (official docs)
- [Setting Python Version](https://render.com/docs/python-version) -- HIGH confidence (official docs)
- [Health Checks](https://render.com/docs/health-checks) -- HIGH confidence (official docs)
- [Static Site Redirects/Rewrites](https://render.com/docs/redirects-rewrites) -- HIGH confidence (official docs)
- [Environment Variables and Secrets](https://render.com/docs/configure-environment-variables) -- HIGH confidence (official docs)
- [Deploy for Free](https://render.com/docs/free) -- HIGH confidence (official docs)
- [Free PostgreSQL 30-day expiry](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90) -- HIGH confidence (official changelog)
- [Render Pricing](https://render.com/pricing) -- HIGH confidence (official pricing page)
- [Pre-deploy command changelog](https://render.com/changelog/predeploy-command) -- HIGH confidence (official changelog)
- [How to Deploy FastAPI + PostgreSQL on Render](https://www.freecodecamp.org/news/deploy-fastapi-postgresql-app-on-render/) -- MEDIUM confidence (third-party guide)
