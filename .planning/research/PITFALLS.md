# Pitfalls Research: Deploying FastAPI + React + PostgreSQL to Render

**Domain:** Production deployment of async FastAPI financial app to Render.com
**Researched:** 2026-02-24
**Confidence:** HIGH (verified with official Render docs, SQLAlchemy docs, community reports)

---

## Critical Pitfalls

### Pitfall 1: asyncpg Connection Pool Exhaustion on Render (Stale Connections)

**What goes wrong:**
The current `session.py` uses `QueuePool` (SQLAlchemy default for `create_async_engine`) with `pool_size=10, max_overflow=20`. Render terminates idle TCP connections at the OS level after an unspecified timeout. SQLAlchemy keeps these dead connections in its pool and hands them to requests, causing `asyncpg.exceptions.ConnectionDoesNotExistError` or silent 500 errors.

**Why it happens:**
Render's infrastructure recycles idle connections. SQLAlchemy's `AsyncAdaptedQueuePool` has no way to detect OS-level connection termination without actively pinging. While `pool_pre_ping=True` is already set (good), on the free tier the entire service sleeps after 15 minutes -- when it wakes, ALL pooled connections are dead. The `pool_pre_ping` helps for individual stale connections but the cold-start scenario destroys every connection in the pool simultaneously, causing a burst of ping-then-reconnect overhead on the first requests.

**How to avoid:**
1. Switch to `NullPool` for Render deployment. This is the [officially discussed approach](https://github.com/sqlalchemy/sqlalchemy/discussions/10238) for platforms like Render that kill idle connections. `NullPool` creates a fresh connection per request and closes it after -- no stale connections possible.
2. If you need connection reuse for performance, deploy Render's PgBouncer as a separate private service and connect through it with `NullPool` in SQLAlchemy (let PgBouncer handle pooling).
3. Make pool configuration environment-aware:
   ```python
   if os.getenv("RENDER"):
       pool_kwargs = {"poolclass": NullPool}
   else:
       pool_kwargs = {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True, "pool_recycle": 3600}
   engine = create_async_engine(settings.DATABASE_URL, **pool_kwargs)
   ```

**Warning signs:**
- Intermittent 500 errors after periods of inactivity
- `ConnectionDoesNotExistError` or `InterfaceError: connection is closed` in logs
- First request after cold start fails, second succeeds

**Phase to address:** Infrastructure setup (before first deploy)

---

### Pitfall 2: Render Free PostgreSQL Expires After 30 Days -- Data Loss

**What goes wrong:**
Render free PostgreSQL databases expire and are **deleted** 30 days after creation (changed from 90 days as of May 2024). There is a 14-day grace period, then the database and ALL data are permanently destroyed. Free tier databases have **zero backup support** -- no point-in-time recovery, no snapshots, nothing.

**Why it happens:**
Developers deploy to the free tier for testing/demo, forget the expiration, and lose all production data. The 30-day countdown starts from database creation, not from last use.

**How to avoid:**
1. **For a financial app: Do NOT use free tier PostgreSQL in production.** Upgrade to the Starter plan ($7/month) which provides backups and no expiration.
2. If using free tier temporarily for demo/testing:
   - Set a calendar reminder for day 25
   - Implement automated pg_dump export via a cron job or manual weekly backup
   - Store backups externally (S3, local machine, etc.)
3. The existing `backup_service.py` writes to `/backups` directory on the server filesystem -- this is useless on Render because the filesystem is ephemeral and resets on every deploy.

**Warning signs:**
- Email from Render about upcoming expiration (check spam folder)
- App suddenly returns connection errors after ~30 days

**Phase to address:** Infrastructure setup (day 1 decision -- choose paid or implement backup strategy)

---

### Pitfall 3: APScheduler Jobs Silently Stop Running on Render Free Tier

**What goes wrong:**
The scheduler runs 7 daily jobs (recurring charges at 00:05, alerts at 00:10, billing at 00:15, loan/installment payments at 00:30, backup at 02:00, cleanup at 03:00 Israel time). On Render free tier, the service sleeps after 15 minutes of inactivity. If no HTTP requests come in between 23:45 and 03:00, the service is asleep during ALL scheduled job times. Jobs are silently missed. `misfire_grace_time=3600` only helps if the service wakes within 1 hour of the scheduled time -- but there is no guarantee of that.

**Why it happens:**
APScheduler runs in-process. When the process is sleeping (Render free tier) or restarted (deploy), all scheduler state is lost. The `AsyncIOScheduler` stores jobs in memory only -- no persistent job store. Additionally, APScheduler has a [known issue](https://github.com/agronholm/apscheduler/issues/283) where after long idle periods, the scheduler appears "running" but refuses to execute jobs.

**How to avoid:**
1. **Accept the limitation on free tier:** Document that scheduled jobs only run when the service is awake. Use UptimeRobot or similar to ping the `/health` endpoint every 10 minutes to keep the service awake (but this consumes the 750 free hours per month -- 750/24 = 31 days, barely enough).
2. **Trigger jobs via HTTP instead of cron:** Create admin-only endpoints like `POST /api/v1/admin/run-daily-jobs` that can be called by an external cron service (cron-job.org, GitHub Actions scheduled workflow).
3. **Add startup catch-up logic:** On app startup (lifespan), check if daily jobs were missed (e.g., last_run_time is yesterday or older) and run them immediately.
4. On paid tier ($7/month), the service never sleeps -- scheduler runs reliably.

**Warning signs:**
- `_last_run_time` is None or days old (check via `get_scheduler_status()`)
- Recurring charges not appearing for users
- Alerts not generated despite threshold breaches
- Loan/installment payments not auto-processed

**Phase to address:** Infrastructure setup + deployment configuration

---

### Pitfall 4: Content-Security-Policy Header Breaks React SPA

**What goes wrong:**
The current `main.py` sets `content-security-policy: default-src 'self'`. When the React frontend is served from a different Render domain (e.g., `myapp.onrender.com` for static site, `myapp-api.onrender.com` for backend), the browser blocks ALL API calls because `connect-src` falls back to `default-src 'self'`, which means only same-origin connections are allowed. Additionally, Vite injects inline scripts during build, which are blocked by `script-src 'self'` (inherited from `default-src`).

**Why it happens:**
The CSP header works in development because the Vite proxy makes everything same-origin. In production with separate Render services, the frontend and backend are on different origins.

**How to avoid:**
1. Remove or relax the CSP header for the API service. The API returns JSON, not HTML -- CSP is primarily a browser protection for HTML pages.
2. If keeping CSP, make it environment-aware:
   ```python
   csp = f"default-src 'self'; connect-src 'self' {settings.FRONTEND_URL}; script-src 'self' 'unsafe-inline'"
   ```
3. Better: Don't set CSP on the API at all. Set it on the static site via Render's headers configuration or a `_headers` file in the build output.

**Warning signs:**
- Blank white page after deploy (React app doesn't load)
- Console errors: "Refused to connect... violates Content Security Policy"
- API calls fail silently in production but work locally

**Phase to address:** Pre-deployment configuration (security headers review)

---

### Pitfall 5: CORS Misconfiguration Between Render Static Site and Web Service

**What goes wrong:**
The frontend (Render Static Site at e.g., `https://cashflow.onrender.com`) makes API calls to the backend (Render Web Service at e.g., `https://cashflow-api.onrender.com`). Without the exact production frontend URL in `CORS_ORIGINS`, all API requests fail with CORS errors. The current config only allows `localhost:5173` and `localhost:3000`.

**Why it happens:**
1. Developer forgets to add the Render static site URL to `CORS_ORIGINS` environment variable
2. The URL format must be exact: `https://cashflow.onrender.com` (no trailing slash, must include `https://`)
3. The frontend `client.ts` currently uses `baseURL: '/api/v1'` (relative path) which works with Vite's proxy but fails on Render where frontend and backend are separate services

**How to avoid:**
1. Set `CORS_ORIGINS` environment variable on Render Web Service to include the exact static site URL
2. Change the frontend API client to use an absolute URL in production:
   ```typescript
   const apiClient = axios.create({
     baseURL: import.meta.env.VITE_API_URL || '/api/v1',
   })
   ```
3. Set `VITE_API_URL=https://cashflow-api.onrender.com/api/v1` as a build-time environment variable on the Render Static Site
4. Verify CORS works with a preflight OPTIONS request before going live

**Warning signs:**
- "Access to XMLHttpRequest has been blocked by CORS policy" in browser console
- Login page appears to work but API calls silently fail
- Network tab shows OPTIONS requests returning 4xx

**Phase to address:** Deployment configuration (environment variables setup)

---

### Pitfall 6: DATABASE_URL Format Mismatch -- asyncpg vs psycopg2

**What goes wrong:**
Render provides `DATABASE_URL` in the format `postgresql://user:pass@host:port/db`. The app expects `postgresql+asyncpg://...` (with the asyncpg dialect prefix). Without the prefix, SQLAlchemy defaults to the synchronous psycopg2 driver, which crashes immediately in an async context. Additionally, Alembic's `env.py` reads `settings.DATABASE_URL` which needs the asyncpg prefix, but `alembic.ini` has a hardcoded localhost URL.

**Why it happens:**
Render auto-populates `DATABASE_URL` without any driver prefix. The app's `config.py` uses `DATABASE_URL` directly without transformation.

**How to avoid:**
1. Add URL transformation in `config.py`:
   ```python
   @field_validator("DATABASE_URL", mode="before")
   @classmethod
   def fix_database_url(cls, v: str) -> str:
       if v.startswith("postgres://"):
           v = v.replace("postgres://", "postgresql+asyncpg://", 1)
       elif v.startswith("postgresql://") and "+asyncpg" not in v:
           v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
       return v
   ```
2. Or set the environment variable manually on Render with the correct prefix
3. Make sure `alembic/env.py` also gets the corrected URL (it already reads from `settings.DATABASE_URL`, which is good)

**Warning signs:**
- `ModuleNotFoundError: No module named 'psycopg2'` on startup
- `sqlalchemy.exc.InvalidRequestError: The asyncio extension requires an async driver`
- App crashes immediately on Render but works locally

**Phase to address:** Infrastructure setup (build script / environment config)

---

## Moderate Pitfalls

### Pitfall 7: SPA Routing 404 on Page Refresh

**What goes wrong:**
User navigates to `/transactions`, then refreshes the browser. Render's static site returns 404 because there is no physical file at `/transactions` -- only `/index.html` exists.

**Why it happens:**
React Router handles routing client-side. Without a rewrite rule, the static file server looks for a literal file match.

**How to avoid:**
Add a rewrite rule in Render Static Site settings:
- Source: `/*`
- Destination: `/index.html`
- Action: Rewrite (NOT redirect)

**Warning signs:**
- 404 errors on any non-root URL after page refresh
- Direct links to app pages return "Not Found"

**Phase to address:** Static site deployment configuration

---

### Pitfall 8: Alembic Migration Fails on First Deploy (No Tables Exist)

**What goes wrong:**
The build command runs `alembic upgrade head` against a fresh Render PostgreSQL database. If the migration chain depends on existing tables (e.g., a migration that ALTER TABLEs a table created by an earlier migration that failed), the entire chain can break. Also, the `alembic_version` table doesn't exist yet, which is normal -- but running migrations from the build command means any failure kills the entire deploy.

**Why it happens:**
1. Build commands run during deploy. If `alembic upgrade head` fails, the deploy fails, and the service doesn't start
2. The build command runs in a different process than the app -- it may time out or fail to connect if the database is still provisioning
3. Alembic acquires locks on tables during migration. If a previous failed deploy left a lock, subsequent migrations hang

**How to avoid:**
1. Create a `build.sh` script:
   ```bash
   #!/usr/bin/env bash
   set -e
   pip install -r requirements.txt
   cd backend
   alembic upgrade head
   ```
2. Test the full migration chain locally against a fresh database BEFORE first deploy:
   ```bash
   dropdb cashflow_fresh && createdb cashflow_fresh
   DATABASE_URL="postgresql+asyncpg://...cashflow_fresh" alembic upgrade head
   ```
3. Add `lock_timeout` to migration connections to fail fast instead of hanging:
   ```python
   connect_args={"server_settings": {"lock_timeout": "10000"}}  # 10s
   ```
4. If migration fails mid-chain on Render, you may need to manually connect via external URL and fix the state

**Warning signs:**
- Deploy stuck at "Building..." for minutes
- Deploy fails with database connection errors
- App starts but schema is missing tables

**Phase to address:** Build script creation (pre-first-deploy)

---

### Pitfall 9: JWT Secret Key Auto-Generation Breaks on Restart

**What goes wrong:**
The current `config.py` auto-generates a random `SECRET_KEY` if none is provided (`secrets.token_urlsafe(64)`). On Render, every deploy restarts the service, generating a new secret key. ALL existing JWTs (access tokens AND refresh tokens) become invalid. Every user is forcibly logged out on every deploy.

**Why it happens:**
The auto-generation is a dev convenience. In production without a pinned `SECRET_KEY` environment variable, each process restart produces a different key.

**How to avoid:**
1. Generate a strong secret key once: `python -c "import secrets; print(secrets.token_urlsafe(64))"`
2. Set it as `SECRET_KEY` environment variable on Render Web Service
3. NEVER change it unless you intentionally want to invalidate all tokens
4. Add a startup check that REFUSES to start if `SECRET_KEY` is empty in non-debug mode:
   ```python
   if not settings.DEBUG and not os.getenv("SECRET_KEY"):
       raise RuntimeError("SECRET_KEY must be set in production")
   ```

**Warning signs:**
- All users logged out after every deploy
- Refresh tokens fail immediately after deploy
- "Token signature verification failed" errors

**Phase to address:** Environment variable setup (pre-first-deploy)

---

### Pitfall 10: Backup Service Writes to Ephemeral Filesystem

**What goes wrong:**
The scheduler's `_daily_backup` job calls `create_backup()` which writes to `BACKUP_DIR=/backups`. On Render, the filesystem is ephemeral -- files written at runtime are lost on every deploy, restart, or sleep/wake cycle. All backups silently disappear.

**Why it happens:**
The backup service was designed for a Docker/local environment with persistent volumes. Render Web Services have no persistent storage.

**How to avoid:**
1. Disable the backup scheduler job on Render (it wastes CPU and provides zero value)
2. If backups are needed, write to an external store (S3, Cloudflare R2, etc.)
3. For the paid Render PostgreSQL tier, use Render's built-in PITR backup instead
4. For the free tier, implement a manual `pg_dump` workflow via external cron

**Warning signs:**
- Backup files exist briefly but disappear after deploy/restart
- `cleanup_old_backups` finds nothing to clean

**Phase to address:** Deployment configuration (disable or redirect backup service)

---

### Pitfall 11: Python 3.9 Not Available on Render by Default

**What goes wrong:**
The project requires Python 3.9.6 (pinned due to compatibility constraints). Render may default to a newer Python version (3.11 or 3.12). If the wrong Python version is used, `from __future__ import annotations` patterns work but other 3.9-specific behavior may differ.

**Why it happens:**
Render auto-detects Python version from `runtime.txt` or defaults to latest stable. Without explicit version pinning, the build uses whatever Render provides.

**How to avoid:**
1. Create `runtime.txt` in the backend directory: `python-3.9.6` (or the closest available version on Render)
2. Or set the `PYTHON_VERSION` environment variable on Render
3. Better long-term: Upgrade to Python 3.11+ (3.9 is past EOL since October 2025) and remove all the `from __future__ import annotations` shims

**Warning signs:**
- Build succeeds but runtime errors on Python-version-specific behavior
- `bcrypt==4.0.1` (pinned) may not have wheels for the default Python version

**Phase to address:** Build configuration (pre-first-deploy)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Free tier PostgreSQL | Zero cost | Data deleted every 30 days, no backups | Demo/testing only, NEVER for financial data |
| In-process APScheduler | No separate worker service | Missed jobs on sleep/restart, no horizontal scaling | Single-instance with keep-alive ping |
| JWT in localStorage | Simple implementation | XSS vulnerability exposes tokens | Acceptable with strong CSP + no third-party scripts, but httpOnly cookies are strictly better for financial apps |
| Auto-generated SECRET_KEY | Works out of box in dev | All tokens invalidated on restart | Never in production |
| `NullPool` everywhere | Avoids stale connections | Slightly higher latency per request | Always acceptable on Render; negligible overhead with internal networking |
| Hardcoded `alembic.ini` URL | Simple local dev | Breaks on any non-local database | Never in production -- must use env var override |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Render PostgreSQL URL | Using `DATABASE_URL` as-is (missing `+asyncpg` prefix) | Transform URL in config.py validator or set manually with correct prefix |
| Render Static Site + Web Service | Frontend uses relative API path `/api/v1` | Use `VITE_API_URL` env var for absolute backend URL in production builds |
| Render Static Site routing | No rewrite rule configured | Add `/* -> /index.html` rewrite rule for SPA routing |
| Render environment variables | Setting `CORS_ORIGINS` as plain string without brackets | Use comma-separated format (the config parser already handles this) |
| Frankfurter API (exchange rates) | Assuming it's always available | Add timeout, retry, and fallback to cached rate. On Render, outbound HTTP may be slow |
| Render deploy + Alembic | Running `alembic upgrade head` in start command | Run in build command (`build.sh`) so migrations complete before app starts |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cold start on free tier (25-60 sec) | First request after 15min idle is extremely slow | Keep-alive ping every 10min OR use paid tier | Every time service sleeps (multiple times per day) |
| QueuePool with dead connections | Burst of 500 errors after wake-up | Use NullPool on Render | After every sleep/wake cycle |
| No connection pooling (NullPool) + high traffic | New TCP connection per request adds ~5-10ms overhead | Deploy PgBouncer private service if >50 req/sec | Unlikely at current scale, revisit if app grows |
| Scheduler jobs all at 00:05-00:30 | Spike in DB connections during nightly batch | Stagger jobs, use NullPool to avoid pool exhaustion during batch | With >100 active users processing recurring charges |
| External database URL (not internal) | Every query traverses public internet, 10-50ms added latency | Always use internal connection URL (only works within Render) | Immediately -- visible in every API response time |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| JWT access+refresh tokens in localStorage | XSS attack steals both tokens, attacker gets full account access to financial data | Migrate to httpOnly cookie for refresh token, keep access token in memory only |
| `SECRET_KEY` auto-generated per restart | Token invalidation on deploy is annoying; BUT if someone discovers the pattern, they could predict keys | Pin SECRET_KEY in environment variable, add startup guard |
| `DEBUG=true` on Render (exposes stack traces) | Full error details including file paths, SQL, and internal state leaked to users | Ensure `DEBUG=false` in production env vars; current code already hides docs when DEBUG=false (good) |
| `ADMIN_DEFAULT_PASSWORD` not changed | If seed script runs in production with default password, admin account is compromised | Either don't run seed in production, or force password change on first login |
| Swagger/ReDoc accessible in production | API documentation reveals all endpoints, schemas, and auth flows | Already handled: `docs_url=None` when `DEBUG=false` (good) |
| Token blacklist in-memory only | After restart, all blacklisted tokens are valid again until natural expiry | Accept for now (tokens expire in 15min). For production hardening, use Redis or DB-backed blacklist |
| Rate limiting per-IP only on Render | Render may use shared IPs or proxies, making IP-based limiting less effective | Add per-user rate limiting on sensitive endpoints (login, token refresh) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Cold start delay (25-60 sec) | User thinks app is broken, leaves | Show loading spinner with "Starting up..." message; add health check preload |
| Forced logout on every deploy | User loses in-progress work, must re-login | Pin SECRET_KEY so tokens survive deploys |
| Backup service silently fails | User trusts data is backed up but it isn't | Disable backup UI/indicators if no persistent storage available |
| Scheduler jobs missed silently | User doesn't see expected recurring charges or alerts | Add "Last processed" indicator on dashboard; show warning if >24h since last run |
| HTTPS redirect delay | Mixed content warnings, broken assets on first load | Ensure all URLs use https:// explicitly |

---

## "Looks Done But Isn't" Checklist

- [ ] **CORS:** `CORS_ORIGINS` env var includes the exact Render static site URL (with `https://`, no trailing slash)
- [ ] **API URL:** Frontend `VITE_API_URL` points to the Render Web Service URL (absolute, with `/api/v1`)
- [ ] **Database URL:** `DATABASE_URL` includes `+asyncpg` prefix and uses **internal** connection string
- [ ] **Secret Key:** `SECRET_KEY` is set as a persistent environment variable (not auto-generated)
- [ ] **SPA Routing:** Static site has `/* -> /index.html` rewrite rule
- [ ] **CSP Header:** `content-security-policy` either removed from API or updated to allow frontend origin
- [ ] **Pool Config:** SQLAlchemy uses `NullPool` on Render (not the default QueuePool)
- [ ] **Alembic:** Build script runs `alembic upgrade head` before start command
- [ ] **Python Version:** `runtime.txt` or `PYTHON_VERSION` env var pins the correct Python version
- [ ] **DEBUG:** `DEBUG=false` in production environment variables
- [ ] **Backup:** Filesystem backup disabled or redirected to external storage
- [ ] **Free Tier DB:** Calendar reminder set for 30-day database expiration (or upgraded to paid)
- [ ] **Scheduler:** Keep-alive mechanism in place OR scheduler jobs accessible via HTTP endpoints
- [ ] **Health Check:** `/health` endpoint works and returns 200 (Render uses this for readiness)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Database expired (30-day free tier) | HIGH -- data is gone | Restore from external backup (if you made one). If not, recreate DB and re-seed. All user data lost. |
| All users logged out (SECRET_KEY changed) | LOW -- annoying | Users re-login. No data lost. Set SECRET_KEY env var to prevent recurrence. |
| Stale connection pool errors | LOW | Restart service (redeploy). Switch to NullPool to prevent recurrence. |
| Missed scheduler jobs | MEDIUM | Manually trigger via admin endpoints. Add catch-up logic on startup. |
| CORS blocking all requests | LOW | Add correct origin to CORS_ORIGINS env var, redeploy. 5-minute fix. |
| CSP blocking API calls | LOW | Remove/update CSP header, redeploy. |
| Migration failed mid-chain | MEDIUM | Connect via external URL, check `alembic_version` table, manually fix state, re-run. |
| Backup files lost (ephemeral filesystem) | HIGH if no external backup | No recovery possible. Implement external backup going forward. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: asyncpg pool exhaustion | Infrastructure setup | Deploy, wait 20min, hit API -- should work without errors |
| P2: Free DB 30-day expiration | Infrastructure decision (day 1) | Confirm paid tier OR backup strategy documented |
| P3: APScheduler missed jobs | Deployment config | Check `get_scheduler_status()` endpoint after 24h -- last_run_time should be today |
| P4: CSP blocks React | Pre-deploy config review | Load production URL, check browser console for CSP errors |
| P5: CORS misconfiguration | Environment variable setup | Hit any API endpoint from production frontend -- no CORS errors in console |
| P6: DATABASE_URL format | Build script / env config | App starts successfully on Render without psycopg2 errors |
| P7: SPA 404 on refresh | Static site config | Navigate to `/transactions`, refresh page -- should load correctly |
| P8: Alembic first deploy | Build script testing | First deploy completes, all tables exist in Render PostgreSQL |
| P9: JWT secret rotation | Environment variable setup | Deploy twice -- users stay logged in after second deploy |
| P10: Ephemeral backup files | Deployment config | Verify backup strategy doesn't rely on local filesystem |
| P11: Python version mismatch | Build config | Check Render build logs for correct Python version |

---

## Sources

- [SQLAlchemy Connection Pooling Docs](https://docs.sqlalchemy.org/en/20/core/pooling.html) -- NullPool vs QueuePool (HIGH confidence)
- [SQLAlchemy/Render NullPool Discussion #10238](https://github.com/sqlalchemy/sqlalchemy/discussions/10238) -- NullPool recommendation for Render (HIGH confidence)
- [Render Deploy FastAPI Docs](https://render.com/docs/deploy-fastapi) -- Build/start command format (HIGH confidence)
- [Render Free Tier Docs](https://render.com/docs/free) -- Sleep behavior, DB expiration, limits (HIGH confidence)
- [Render PostgreSQL Docs](https://render.com/docs/postgresql) -- Connection strings, SSL, expiration (HIGH confidence)
- [Render PostgreSQL Connection Pooling](https://render.com/docs/postgresql-connection-pooling) -- PgBouncer setup (HIGH confidence)
- [Render Static Site Rewrites](https://render.com/docs/redirects-rewrites) -- SPA rewrite rules (HIGH confidence)
- [Render Free DB 30-Day Expiration Changelog](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90) -- Expiration policy change (HIGH confidence)
- [asyncpg SSL Issue #737](https://github.com/MagicStack/asyncpg/issues/737) -- sslmode parameter handling (HIGH confidence)
- [APScheduler FAQ](https://apscheduler.readthedocs.io/en/3.x/faq.html) -- Missed jobs, persistent stores (HIGH confidence)
- [APScheduler Idle Issue #283](https://github.com/agronholm/apscheduler/issues/283) -- Scheduler stops executing after idle (MEDIUM confidence)
- [JWT Storage Security Guide](https://www.descope.com/blog/post/developer-guide-jwt-storage) -- localStorage vs httpOnly cookies (MEDIUM confidence)
- [Render Community: Vite SPA Routing](https://community.render.com/t/react-router-not-working-after-deploying-vite-react-project/11103) -- 404 on refresh fix (HIGH confidence)
- [Render Community: CORS Static Site](https://community.render.com/t/strategies-for-cors-auth-with-preview-deploys-custom-domains/4729) -- CORS between services (MEDIUM confidence)
- [Render Community: Free Tier Sleep Behavior](https://community.render.com/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303) -- 15-min sleep, cold start (HIGH confidence)

---
*Pitfalls research for: FastAPI + React + PostgreSQL deployment to Render.com*
*Researched: 2026-02-24*
*Total pitfalls catalogued: 11 (6 critical, 5 moderate)*
