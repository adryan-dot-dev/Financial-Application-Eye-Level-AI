# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**Currency Exchange:**
- Frankfurter.app (https://api.frankfurter.app) - Free exchange rate API
  - SDK/Client: httpx (async HTTP client)
  - Auth: None (public API, no keys required)
  - Implementation: `app/services/exchange_rate_service.py`
  - Supported currencies: ILS, USD, EUR
  - Cache strategy: In-memory with 1-hour TTL
  - Fallback: Uses expired cached rate if API unreachable
  - Used by: Multi-currency transaction conversion (Phase 5+)

## Data Storage

**Databases:**
- PostgreSQL 16 (primary)
  - Connection: Via `DATABASE_URL` env var (asyncpg dialect)
  - Client: SQLAlchemy 2.0 async ORM with asyncpg driver
  - Container: postgres:16-alpine via docker-compose
  - Location: `app/db/session.py` - async session factory
  - Connection pooling: 10 base connections, 20 overflow, 3600s recycle
  - Query timeout: 30 seconds server-side

**Backup Storage:**
- Local filesystem (development)
  - Path: `/backups` volume (Docker mount point)
  - Retention: 30 days (configurable via `BACKUP_RETENTION_DAYS`)
  - Backup mechanism: Custom scripts in `backend/scripts/`
  - Used for: Database backups and exports

**File Storage:**
- Local filesystem only - No S3/cloud storage in current phases
- Public assets: `frontend/public/` (logo.jpeg and locales)

**Caching:**
- In-memory Python dict (MVP) - Token blacklist, exchange rates
  - Location: `app/core/security.py` - `_token_blacklist` set
  - Location: `app/services/exchange_rate_service.py` - `_RateCache` class
- Future: Can migrate to Redis (documented migration path in security.py)

## Authentication & Identity

**Auth Provider:**
- Custom JWT implementation (no external auth provider)
  - Implementation: `app/core/security.py`
  - Token creation: `create_access_token()` and `create_refresh_token()`
  - Algorithm: HS256 with configurable SECRET_KEY
  - Access token expiry: 15 minutes (configurable)
  - Refresh token expiry: 7 days (configurable)
  - Token invalidation: JTI-based blacklist on logout

**Frontend Auth Flow:**
- AuthContext: `frontend/src/contexts/AuthContext.tsx`
- Token storage: localStorage (access_token, refresh_token keys)
- Token validation: Automatic on app mount via `authApi.getMe()`
- Endpoints: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`

## Monitoring & Observability

**Error Tracking:**
- Not detected - No external error tracking service integrated
- Error handling: In-app only with custom exception classes

**Logs:**
- Structured logging with Python logging module
  - Config: `app/core/logging_config.py` - JSON and standard formatters
  - Request logging middleware: `app/core/request_logger.py` - All HTTP requests logged
  - Slow query logging: `app/core/slow_query_logger.py` - SQLAlchemy event listeners
  - Output: Console and file logs (rotate daily)
  - Logs directory: `backend/logs/` (in .gitignore for local dev)

## CI/CD & Deployment

**Hosting:**
- Not detected - Application is self-hosted
- Expected targets: Linux/Unix with Python 3.9+ and PostgreSQL 16+

**CI Pipeline:**
- Not detected - No CI/CD configured yet
- Manual test execution: `pytest tests/ -v` for backend

**Containerization:**
- Docker Compose: `docker-compose.yml` (development environment)
- Services:
  - `db` - PostgreSQL 16-alpine with health checks
  - `pgAdmin` - Management UI on port 5050 (dev only)
- Volumes: postgres_data, pgadmin_data, backup_data (persistent)

## Environment Configuration

**Required env vars (Backend):**
- `DATABASE_URL` - PostgreSQL connection (required)
- `SECRET_KEY` - JWT signing key (auto-generated if missing)
- `CORS_ORIGINS` - Allowed frontend origins (JSON array or comma-separated)
- `DEBUG` - Boolean, enables OpenAPI docs

**Optional env vars (Backend):**
- `ALGORITHM` - JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Access token TTL (default: 15)
- `REFRESH_TOKEN_EXPIRE_DAYS` - Refresh token TTL (default: 7)
- `ADMIN_DEFAULT_PASSWORD` - For seed script (default: empty)
- `BACKUP_DIR` - Backup location (default: /backups)
- `BACKUP_RETENTION_DAYS` - Keep backups for N days (default: 30)

**Secrets location:**
- Backend: `.env` file in `backend/` directory (git-ignored)
- Frontend: `.env` in `frontend/` (git-ignored, minimal - no secrets stored)
- Template: `.env.example` files provide structure without secrets

## Webhooks & Callbacks

**Incoming:**
- Not detected - No incoming webhooks configured

**Outgoing:**
- Not detected - No external webhook calls (Phase 5+ feature)

## API Design

**REST API Structure:**
- Base URL: `http://localhost:8000/api/v1/`
- Framework: FastAPI with automatic OpenAPI documentation
- Documentation endpoints: `/docs` (Swagger UI) and `/redoc` (ReDoc)
- Prefix: `/api/v1/` for versioning

**API Modules (10 total):**
- `transactions` - Transaction CRUD and filtering
- `categories` - Category management with archive support
- `fixed` - Fixed income/expenses
- `installments` - Installment payment tracking
- `loans` - Loan management with amortization
- `balance` - Current and historical balance queries
- `forecast` - Cash flow forecasting
- `alerts` - Alert management and notifications
- `settings` - User preferences
- `dashboard` - KPI aggregations and summaries
- Additional: `auth`, `users` (admin), `organizations`, `bank_accounts`, `credit_cards`, `budgets`, `expected_income`, `subscriptions`, `expense_approvals`, `automation`, `backups`, `export`

**API Response Format:**
- HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 422, 500
- Error format: `{error: string, message: string, details?: object}`
- Pydantic schemas for request/response validation
- Pagination: Limit/offset pattern on list endpoints

**Frontend API Client:**
- Location: `frontend/src/api/client.ts`
- HTTP library: axios 1.13.5
- Request interceptor: Automatically adds JWT Bearer token from localStorage
- Error handling: Translates HTTP status codes to user-friendly i18n messages
- Baseurl: `/api/v1` (proxied through Vite dev server)

## Database Schema

**Core Tables:**
- `users` - User accounts with hashed passwords
- `organizations` - Multi-org structure (future expansion)
- `org_members` - User-org membership with roles
- `categories` - Transaction categories (soft-deleted via is_archived)
- `transactions` - Income/expense transactions
- `fixed_income_expenses` - Recurring monthly items
- `loans` - Loan records with payment schedules
- `installments` - Installment plans
- `subscriptions` - Recurring charges
- `bank_accounts` - Connected bank accounts
- `credit_cards` - Credit card accounts
- `alerts` - System-generated alerts
- `settings` - User preferences (not JSONB)
- `audit_log` - Change tracking (Phase 8+)
- Additional: `expected_income`, `expense_approvals`, `forecast_scenarios`, `org_budgets`, `org_reports`, `org_settings`, `backups`

**Data Consistency:**
- Foreign keys with CASCADE/SET NULL as appropriate
- Indexes on: foreign keys, filtering columns, date ranges
- Unique constraints on: email, username, org_member (user_id, org_id)
- Timezone awareness: All timestamps in UTC
- Financial precision: DECIMAL(15,2) for all monetary amounts
- Currency: VARCHAR(3) with default 'ILS' on all financial tables

## Rate Limiting

**Implementation:**
- Library: slowapi 0.1.9 (FastAPI plugin)
- Configuration: `app/core/rate_limit.py`
- Exception handler: Registered in `app/main.py`
- Default: Configurable per endpoint via `@limiter.limit()` decorator

---

*Integration audit: 2026-02-24*
