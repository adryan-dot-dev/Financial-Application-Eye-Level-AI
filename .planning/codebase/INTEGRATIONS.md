# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**Internal Only:**
- No third-party payment processors (Stripe, PayPal)
- No banking APIs or Plaid integration
- No accounting software APIs (QuickBooks, Xero)
- No external analytics services

**Self-Service REST API (Internal):**
- 67 API routes across 10 modules: transactions, categories, fixed, installments, loans, balance, forecast, alerts, settings, dashboard
- API versioning: `/api/v1/` prefix
- Built with FastAPI auto-documentation (OpenAPI/Swagger at `/docs`, ReDoc at `/redoc`)

## Data Storage

**Databases:**
- PostgreSQL 16 (Alpine Docker image)
  - Connection: `postgresql+asyncpg://user:pass@localhost:5432/cashflow`
  - Client: SQLAlchemy 2.0 async ORM with asyncpg driver
  - Pool size: 10 connections, max overflow: 20, recycled every 3600s
  - Statement timeout: 30 seconds (prevents slow queries)
  - Health checks: `pg_isready` via docker-compose every 5s

**File Storage:**
- Local filesystem only (no S3, Azure Blob, etc.)
  - Backups: `/backups` directory (Docker volume `backup_data`)
  - Retention: 30 days (cleanup via scheduler job)

**Caching:**
- In-memory token blacklist (MVP, per `app/core/security.py`)
  - **Migration path to Redis:** Redis client for distributed token blacklist across workers
  - Environment: `REDIS_URL` (future)

**Session Storage:**
- Browser localStorage for JWT tokens
  - `access_token`: 15-minute TTL
  - `refresh_token`: 7-day TTL

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based (no OAuth2, no third-party IdP)
  - Token creation: `python-jose` with HS256 algorithm
  - Password hashing: bcrypt with salt (passlib context)
  - Token validation: JWT signature verification in `app/core/security.py`

**Credentials Flow:**
1. User submits username + password to `POST /api/v1/auth/login`
2. Backend hashes input, compares with stored bcrypt hash
3. Backend generates JWT with `jti` (JWT ID) for blacklist support
4. Returns `access_token` and `refresh_token` (httpOnly cookies in future)
5. Frontend stores tokens in localStorage, injects into `Authorization: Bearer` header
6. On 401, frontend calls `POST /api/v1/auth/refresh` with `refresh_token`
7. Backend validates refresh token, issues new access token

**Implementation Files:**
- `backend/app/core/security.py`: `hash_password()`, `verify_password()`, JWT creation/validation
- `backend/app/api/v1/endpoints/auth.py`: Login, register, logout, refresh routes
- `frontend/src/api/auth.ts`: API client methods
- `frontend/src/contexts/AuthContext.tsx`: Login/logout state, token persistence

**Token Blacklist:**
- Current: In-memory `_token_blacklist` set in `app/core/security.py`
- Clears on process restart, not shared across workers (MVP limitation)
- Production plan: Move to Redis with TTL auto-expiry

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, DataDog, etc.)
- All exceptions logged via Python `logging` module (stderr)
- FastAPI global exception handler: `app/main.py` catches unhandled exceptions

**Logs:**
- Python stdlib `logging` with JSON formatting (production-ready in `app/core/logging_config.py`)
- Request logging middleware: `RequestLoggingMiddleware` in `app/core/request_logger.py`
- Database slow query logging: `app/core/slow_query_logger.py` (logs queries > 1s)
- Debug mode: `DEBUG=true` enables SQL echo, exception details

**Health Checks:**
- `/health` endpoint returns `{"status": "healthy", "version": "0.1.0"}`
- Docker compose health check: PostgreSQL `pg_isready` every 5s

## CI/CD & Deployment

**Hosting:**
- Not configured (self-hosted path only)
- Local: Uvicorn dev server on `http://localhost:8000`
- Docker-compose for local database (no cloud deployment config)

**CI Pipeline:**
- Not configured (no GitHub Actions, GitLab CI, etc.)
- Manual test execution: `pytest tests/ -v` in backend
- Manual build: `npm run build` for frontend

**Containerization:**
- `docker-compose.yml` includes PostgreSQL 16 + pgAdmin 4
- No backend Dockerfile (frontend can be containerized via Node multi-stage build)
- No orchestration (no Kubernetes manifests)

## Environment Configuration

**Required Backend Env Vars:**
- `DATABASE_URL` (PostgreSQL connection string, required)
- `SECRET_KEY` (JWT signing key, auto-generated if missing)
- `ALGORITHM` (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 15)
- `REFRESH_TOKEN_EXPIRE_DAYS` (default: 7)
- `CORS_ORIGINS` (default: `["http://localhost:5173"]`, JSON array or comma-separated)
- `ADMIN_DEFAULT_PASSWORD` (used by seed script)
- `DEBUG` (default: false, enables SQL echo and exception details)
- `BACKUP_DIR` (default: `/backups`)
- `BACKUP_RETENTION_DAYS` (default: 30)

**Required Frontend Env Vars:**
- `VITE_API_URL` (backend API base URL, default: `http://localhost:8000/api/v1`)

**Secrets Location:**
- Backend: `.env` file in project root (gitignored)
- Frontend: `.env` file in `frontend/` (gitignored)
- **CRITICAL:** Never commit `.env` files. Use `.env.example` with placeholder values.

**Default Credentials (Development Only):**
- Admin user created by `backend/scripts/seed_data.py`
- Username: `admin`
- Password: Value of `ADMIN_DEFAULT_PASSWORD` (default: `admin123`)

## Webhooks & Callbacks

**Incoming:**
- None configured (no Stripe webhooks, bank webhooks, etc.)

**Outgoing:**
- None (no integrations with external systems)

**Internal Scheduled Jobs (APScheduler):**
- Daily job (configurable cron): `_process_all_users_recurring()`
  - Processes recurring charges for all active users
  - Calls `process_recurring_charges()` per user
  - Logs per-user results to `/backups/scheduler_logs/`

**Job Results Logging:**
- Last run time and summary stored in module-level variables (`_last_run_time`, `_last_run_result`)
- Results endpoint: `GET /api/v1/dashboard/job-status` (future)

## Database Schema Patterns

**Financial Precision:**
- All monetary amounts: `DECIMAL(15,2)` (not FLOAT or INT)
- All transactions include `currency` field: `VARCHAR(3) DEFAULT 'ILS'` (future multi-currency)

**Soft Deletes:**
- Categories: `is_archived` boolean (deleted records remain in DB)
- Other entities: Hard delete (via cascade)

**Audit Trail:**
- Basic fields: `created_at`, `updated_at` timestamps
- Full audit log: **Out of scope for MVP** (Phase 8 planned)

## Import/Export

**Currently Supported:**
- CSV export (commented out in `requirements.txt`: `# openpyxl==3.1.5`, `# reportlab==4.2.5`)

**In Development (Phase 5):**
- Excel export (`openpyxl` package)
- PDF export (`reportlab` package)
- CSV import validation

---

*Integration audit: 2026-02-24*
