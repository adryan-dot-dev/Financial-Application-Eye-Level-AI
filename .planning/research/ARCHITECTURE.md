# Architecture: Deploying FastAPI + React + PostgreSQL on Render.com

**Domain:** Production deployment of existing full-stack financial application
**Researched:** 2026-02-24
**Overall confidence:** HIGH (official Render docs verified all critical claims)

---

## Recommended Architecture

```
GitHub (main branch)
    |
    |--- auto-deploy on push --->  Render Web Service (FastAPI backend)
    |                                   |
    |                                   |--- internal URL ---> Render PostgreSQL
    |                                   |
    |--- auto-deploy on push --->  Render Static Site (React/Vite dist/)
                                        |
                                        |--- VITE_API_URL ---> Web Service public URL
```

Three Render services, one GitHub repo, auto-deploy from `main` branch.

### Component Boundaries

| Component | Render Service Type | Responsibility | Communicates With |
|-----------|-------------------|---------------|-------------------|
| **Backend API** | Web Service (Python) | FastAPI REST API, auth, business logic, scheduler | PostgreSQL (internal URL), Frontend (CORS) |
| **Frontend** | Static Site | React SPA, served via CDN | Backend API (public HTTPS URL) |
| **Database** | PostgreSQL (managed) | Data persistence, ACID compliance | Backend only (internal network) |

### Data Flow (Production)

```
User Browser
  --> Render CDN (Static Site: https://cashflow-frontend.onrender.com)
    --> React SPA loads, client-side routing via React Router
      --> Axios calls to https://cashflow-api.onrender.com/api/v1/*
        --> Render Web Service (FastAPI + uvicorn)
          --> SQLAlchemy async --> Render PostgreSQL (internal URL)
          --> Response JSON back to frontend
```

Key difference from local dev: In development, Vite proxies `/api` to `localhost:8000`. In production, the frontend calls the backend's full public URL directly. No proxy.

---

## Critical Architecture Decision: DATABASE_URL Conversion

**Confidence: HIGH** (verified via SQLAlchemy docs + Render docs)

Render provides PostgreSQL connection strings in the format:
```
postgresql://user:password@host:port/database
```

The application uses SQLAlchemy async with asyncpg, which requires:
```
postgresql+asyncpg://user:password@host:port/database
```

**The `config.py` must convert the Render-provided URL.** The current `config.py` hardcodes `postgresql+asyncpg://` in the default. For production, add a validator that replaces `postgresql://` or `postgres://` with `postgresql+asyncpg://`:

```python
@field_validator("DATABASE_URL", mode="before")
@classmethod
def fix_database_url(cls, v: str) -> str:
    """Convert Render's postgresql:// to postgresql+asyncpg:// for SQLAlchemy async."""
    if v.startswith("postgres://"):
        v = v.replace("postgres://", "postgresql+asyncpg://", 1)
    elif v.startswith("postgresql://") and "+asyncpg" not in v:
        v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
    return v
```

Similarly, `alembic/env.py` already reads `settings.DATABASE_URL`, so the same conversion applies automatically. **No separate Alembic URL configuration needed.**

---

## Pattern 1: Database Migrations via Pre-Deploy Command

**Confidence: HIGH** (Render official docs)

**Use Render's `preDeployCommand`** -- not the start command, not manual execution.

**What:** The pre-deploy command runs after `buildCommand` completes but before `startCommand` launches. It executes on a separate instance from your live service. Filesystem changes are NOT reflected in the deployed service, but database changes persist.

**Why this is the right choice:**
- Migrations run exactly once per deploy, not on every restart
- If migration fails, the deploy fails -- old version stays live (zero-downtime safety)
- Separation of concerns: build -> migrate -> start

**Configuration:**

```yaml
# In render.yaml (web service)
preDeployCommand: "cd backend && alembic upgrade head"
```

Or in the Render Dashboard: Settings > Pre-Deploy Command.

**For both fresh DB and upgrades:** `alembic upgrade head` is idempotent. On a fresh database it creates all tables from the initial migration. On an existing database it applies only unapplied migrations. This handles both scenarios.

**Caveat:** The pre-deploy command has access to the same `DATABASE_URL` environment variable. Since `alembic/env.py` reads from `settings.DATABASE_URL` (which uses pydantic-settings), the env var is picked up automatically. The URL conversion validator in `config.py` handles the `postgresql://` -> `postgresql+asyncpg://` transformation.

---

## Pattern 2: CORS for Static Site -> Web Service Communication

**Confidence: HIGH** (verified via codebase + Render docs)

The frontend (Static Site) and backend (Web Service) will be on **different Render subdomains**:
- Frontend: `https://cashflow-frontend.onrender.com`
- Backend: `https://cashflow-api.onrender.com`

This is cross-origin. The backend must explicitly allow the frontend's origin.

**Current `config.py` already supports this** via the `CORS_ORIGINS` environment variable (JSON array or comma-separated string). The validator rejects wildcards (`*`), which is correct for production.

**Production CORS_ORIGINS value:**
```
CORS_ORIGINS=https://cashflow-frontend.onrender.com
```

**The frontend's Axios client currently uses `baseURL: '/api/v1'`** (relative path). This works in development because Vite proxies `/api` to `localhost:8000`. In production on a Static Site, there is no proxy. The client must use the full backend URL.

**Solution:** Change `client.ts` to use an environment variable:

```typescript
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
})
```

Then set the Vite build environment variable:
```
VITE_API_URL=https://cashflow-api.onrender.com/api/v1
```

This is set as an environment variable on the Render Static Site service (available at build time since Vite inlines `import.meta.env.VITE_*` values during `npm run build`).

**Important:** The refresh token endpoint in `client.ts` also uses a hardcoded relative path (`/api/v1/auth/refresh`). This must also use the base URL:

```typescript
const response = await axios.post(
  `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`,
  { refresh_token: refreshToken }
)
```

---

## Pattern 3: Environment Variables Across Services

**Confidence: HIGH** (Render official docs)

### Backend (Web Service) Environment Variables

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL` | Auto-populated | `fromDatabase` in render.yaml |
| `SECRET_KEY` | Random 64-char string | `generateValue: true` or manual |
| `CORS_ORIGINS` | `https://cashflow-frontend.onrender.com` | Manual / render.yaml |
| `DEBUG` | `false` | render.yaml |
| `ADMIN_DEFAULT_PASSWORD` | Strong password | `sync: false` (manual entry) |
| `PYTHON_VERSION` | `3.9.6` | render.yaml (or `.python-version` file) |

### Frontend (Static Site) Environment Variables

| Variable | Value | Source |
|----------|-------|--------|
| `VITE_API_URL` | `https://cashflow-api.onrender.com/api/v1` | render.yaml or dashboard |

**Note on `VITE_*` variables:** These are embedded at build time by Vite, not at runtime. Changing them requires a rebuild.

### Python Version Specification

Render uses `.python-version` file in the root directory or `PYTHON_VERSION` env var to determine the Python version. Since the project requires Python 3.9.6 specifically:

```
# backend/.python-version (or project root)
3.9.6
```

Or set `PYTHON_VERSION=3.9.6` as an environment variable on the Web Service.

---

## Pattern 4: APScheduler on Render Free Tier -- Critical Limitations

**Confidence: HIGH** (Render official docs confirm sleep behavior)

### The Problem

The app uses APScheduler (AsyncIOScheduler) running in-process with the FastAPI web service. It schedules 7 daily jobs (recurring charges at 00:05, alerts at 00:10, billing at 00:15, payments at 00:30, backup at 02:00, cleanup at 03:00 -- all Asia/Jerusalem timezone).

**Render free tier spins down web services after 15 minutes of inactivity.** When the service spins down:
1. The APScheduler instance is destroyed (it lives in memory)
2. All scheduled jobs are lost
3. When the service wakes up (on next HTTP request), `start_scheduler()` runs again
4. Jobs scheduled for 00:05-03:00 will NEVER fire if nobody visits the app during those hours

**The `misfire_grace_time=3600` (1 hour) helps partially:** If the service wakes within 1 hour of the missed time, the job will still execute. But on the free tier, the service won't wake unless someone makes an HTTP request.

### Realistic Assessment

For a financial cash flow app used by Eye Level AI employees during business hours (roughly 08:00-18:00 Israel time), the nightly jobs (00:05-03:00) will almost certainly NOT run on the free tier. The service will be asleep from ~18:15 until the next morning when someone opens the app.

### Recommendation: Accept the Limitation for Now

**Do NOT try to keep the free tier alive with external pinging.** This wastes the 750 free monthly hours budget and is fragile. Instead:

1. **Document the limitation** prominently: "On free tier, scheduled jobs may not run. Upgrade to Starter ($7/month) for always-on service."
2. **Add a manual trigger endpoint** for admins to run daily processing on demand (e.g., `POST /api/v1/admin/run-daily-jobs`). The app already has `_process_all_users_recurring` as a callable function.
3. **When ready for production use**, upgrade to Starter plan ($7/month) which does NOT spin down.

### If Using Paid Tier ($7/month Starter)

APScheduler works perfectly on paid tiers because the service never spins down. The current scheduler configuration with `misfire_grace_time=3600` is well-designed -- it handles brief restarts during deployments gracefully.

---

## Pattern 5: SPA Routing for React Router on Render Static Site

**Confidence: HIGH** (Render official docs)

React Router v7 uses client-side routing. When a user navigates to `/transactions` and refreshes the page, the browser requests `/transactions` from the server. Without configuration, this returns 404 because no file exists at that path.

**Solution: Add a rewrite rule on the Render Static Site.**

In Render Dashboard (or render.yaml):
- **Source:** `/*`
- **Destination:** `/index.html`
- **Type:** `rewrite`

**Render's built-in behavior protects static assets:** "Render does not apply redirect or rewrite rules to a path if a resource exists at that path." This means `/assets/index-abc123.js` will be served as a file, not rewritten to `index.html`. The wildcard rewrite only catches routes that don't match actual files.

**In render.yaml:**
```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

---

## Pattern 6: render.yaml -- Recommended Approach

**Confidence: HIGH** (Render official docs)

**Use render.yaml (Infrastructure as Code) over dashboard-only configuration.** Reasons:
- Version-controlled, reproducible deployments
- Single source of truth for all three services
- Easier to review, modify, and share
- Can be generated from existing dashboard services if needed

### Complete render.yaml for This Project

```yaml
# render.yaml - Cash Flow Management (Eye Level AI)
# Place in the repository root

databases:
  - name: cashflow-db
    plan: free  # Change to starter ($6/mo) for production
    databaseName: cashflow
    user: cashflow

services:
  # Backend - FastAPI Web Service
  - type: web
    name: cashflow-api
    runtime: python
    plan: free  # Change to starter ($7/mo) for always-on
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    preDeployCommand: alembic upgrade head
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: cashflow-db
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: CORS_ORIGINS
        value: https://cashflow-frontend.onrender.com
      - key: DEBUG
        value: "false"
      - key: ADMIN_DEFAULT_PASSWORD
        sync: false  # Enter manually in dashboard
      - key: PYTHON_VERSION
        value: "3.9.6"

  # Frontend - React Static Site
  - type: web
    name: cashflow-frontend
    runtime: static
    rootDir: frontend
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    envVars:
      - key: VITE_API_URL
        value: https://cashflow-api.onrender.com/api/v1
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

### Monorepo Root Directory Configuration

Since both `backend/` and `frontend/` are in the same repo:
- **Web Service:** `rootDir: backend` -- build and start commands run relative to `backend/`
- **Static Site:** `rootDir: frontend` -- `npm install && npm run build` run in `frontend/`, and `dist` is relative to `frontend/`

**Build filters (optional but recommended):**
```yaml
# On the web service:
buildFilter:
  paths:
    - backend/**
  ignoredPaths:
    - backend/tests/**

# On the static site:
buildFilter:
  paths:
    - frontend/**
```

This prevents the backend from redeploying when only frontend files change, and vice versa.

---

## Pattern 7: GitHub -> Render Deployment Strategy

**Confidence: HIGH** (Render official docs)

### Branch Strategy

**Single branch: `main`** -- auto-deploy on push.

For this project (small team, no staging environment), this is sufficient:
1. Developer works on a feature branch
2. Opens PR to `main`
3. PR is reviewed/tested
4. Merge to `main` triggers auto-deploy on Render

### Auto-Deploy Trigger Options

| Option | Setting | When to Use |
|--------|---------|-------------|
| **On Commit** (default) | `autoDeployTrigger: commit` | When you want fastest deploys |
| **After CI Checks Pass** | `autoDeployTrigger: checksPass` | When you have GitHub Actions CI |
| **Off** | `autoDeployTrigger: off` | When you want manual control only |

**Recommendation:** Use **On Commit** initially. If/when you add GitHub Actions for tests, switch to **After CI Checks Pass** to prevent deploying broken code.

### Deploy Order Concern

When you push to `main`, Render deploys all services simultaneously. The pre-deploy command for the backend (Alembic migration) runs before the backend starts. The frontend rebuild also happens concurrently. This is fine because:
1. Database migrations are backward-compatible (adding columns, not removing)
2. The frontend and backend deploy independently
3. The health check ensures the backend is healthy before receiving traffic

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running Migrations in the Start Command

**What:** Adding `alembic upgrade head &&` before `uvicorn` in the start command
**Why bad:** Migrations run on EVERY restart (not just deploys). On the free tier, the service restarts after every sleep cycle. Running migrations on every wake-up adds latency and risks issues.
**Instead:** Use `preDeployCommand` which runs once per deploy.

### Anti-Pattern 2: Using CORS Wildcard Origin

**What:** Setting `CORS_ORIGINS=*` to "make it work"
**Why bad:** Allows any website to make authenticated requests to the API. The `config.py` validator already rejects this, which is correct.
**Instead:** Explicitly set the Render Static Site URL.

### Anti-Pattern 3: Hardcoding Backend URL in Frontend Code

**What:** Writing `https://cashflow-api.onrender.com` directly in `client.ts`
**Why bad:** Can't change without code modification. Breaks local development.
**Instead:** Use `import.meta.env.VITE_API_URL` with fallback to `/api/v1` for local dev.

### Anti-Pattern 4: Using Free PostgreSQL for Production Data

**What:** Relying on the free tier PostgreSQL for real financial data
**Why bad:** Free databases expire after 30 days. All data is deleted. No backups available.
**Instead:** Use at minimum the Starter plan ($6/month) for persistent data. The free tier is only suitable for initial testing/demo.

### Anti-Pattern 5: External Ping Services to Keep Free Tier Alive

**What:** Using UptimeRobot/cron to ping the service every 14 minutes
**Why bad:** Consumes the 750 monthly free hours budget faster. Still unreliable. Masks the real problem.
**Instead:** Accept the limitation or upgrade to $7/month Starter.

---

## Scalability Considerations

| Concern | Free Tier (Demo) | Starter Tier ($13/mo total) | Production Growth |
|---------|-------------------|---------------------------|-------------------|
| **Database expiry** | 30-day limit, data lost | Persistent, backups included | Standard plan for PITR |
| **Service sleep** | Spins down after 15 min | Always on | Auto-scaling |
| **Concurrent users** | 1-2 (wake-up delay) | ~10-50 concurrent | Scale horizontally |
| **Scheduled jobs** | Will miss nightly jobs | Work reliably | Dedicated worker service |
| **Connection pool** | Pool size 10 fine | Pool size 10 fine | PgBouncer for 100+ |
| **Build minutes** | 500/month free | 500/month included | Paid plans increase |

### Upgrade Path

1. **Phase 1 (Demo/Testing):** Free tier for all three services. Accept 30-day DB expiry and service sleep.
2. **Phase 2 (Internal Use):** Starter Web Service ($7/mo) + Starter PostgreSQL ($6/mo) = $13/month. Always-on, persistent data, scheduler works.
3. **Phase 3 (Growth):** Standard plans, custom domain, separate background worker for scheduler.

---

## Setup Order (Deployment Sequence)

Based on component dependencies:

1. **Create GitHub repository** -- Push code to `main`
2. **Create Render PostgreSQL** -- Gets internal URL immediately
3. **Create Render Web Service (backend)** -- Needs DB URL, runs migrations via pre-deploy
4. **Get backend public URL** -- Needed for frontend CORS and API URL
5. **Create Render Static Site (frontend)** -- Needs `VITE_API_URL` pointing to backend
6. **Update backend CORS_ORIGINS** -- Set to the actual frontend URL
7. **Trigger redeploy of backend** -- To pick up CORS change
8. **Smoke test** -- Verify end-to-end flow

**Or use render.yaml:** Push render.yaml to the repo, connect repo in Render dashboard, and create all services at once via Blueprint. The `fromDatabase` reference and service names are resolved automatically. You still need to manually enter `ADMIN_DEFAULT_PASSWORD` (marked `sync: false`).

---

## Sources

### Official Render Documentation (HIGH confidence)
- [Deploy a FastAPI App](https://render.com/docs/deploy-fastapi) -- Build/start commands
- [Blueprint YAML Reference](https://render.com/docs/blueprint-spec) -- Complete render.yaml syntax, preDeployCommand, fromDatabase, routes
- [Static Site Redirects and Rewrites](https://render.com/docs/redirects-rewrites) -- SPA rewrite rules
- [Create and Connect to PostgreSQL](https://render.com/docs/postgresql-creating-connecting) -- Internal/external URLs
- [Multi-Service Architectures](https://render.com/docs/multi-service-architecture) -- Cross-service communication
- [Deploying on Render](https://render.com/docs/deploys) -- Auto-deploy, pre-deploy command, zero-downtime
- [Flexible Plans for Render Postgres](https://render.com/docs/postgresql-refresh) -- Free tier 30-day expiry, paid plans
- [Free Instance Types](https://render.com/blog/free-tier) -- 750 hours/month, 15-min sleep
- [Monorepo Support](https://render.com/docs/monorepo-support) -- rootDir, build filters

### Community / Tutorials (MEDIUM confidence)
- [How to Deploy FastAPI + PostgreSQL on Render](https://www.freecodecamp.org/news/deploy-fastapi-postgresql-app-on-render/) -- Step-by-step guide
- [CORS error calling API from static page](https://community.render.com/t/cors-error-calling-api-from-static-page/8164) -- Cross-origin between Render services

### Codebase Analysis (HIGH confidence)
- `backend/app/config.py` -- Settings class with CORS_ORIGINS validator, DATABASE_URL default
- `backend/app/db/session.py` -- SQLAlchemy async engine using `settings.DATABASE_URL`
- `backend/alembic/env.py` -- Reads `settings.DATABASE_URL`, async migration support
- `backend/app/services/scheduler.py` -- APScheduler with 7 daily cron jobs
- `frontend/src/api/client.ts` -- Axios baseURL currently hardcoded to `/api/v1`
- `frontend/vite.config.ts` -- Vite dev server proxy for `/api`

---

*Architecture research: 2026-02-24*
