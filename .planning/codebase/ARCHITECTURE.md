# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Layered MVC/Service Architecture with async backend (FastAPI) and React frontend

**Key Characteristics:**
- Backend: FastAPI (async) + SQLAlchemy 2.0 ORM + PostgreSQL
- Frontend: React 19 + TypeScript + React Router v7 + TanStack Query
- Multi-user/multi-organization support with JWT authentication
- Data context abstraction for personal vs organization data isolation
- Financial precision using DECIMAL(15,2) throughout
- Real-time forecasting, alerts, and scheduler-based automations

## Layers

**API Layer (Presentation):**
- Purpose: HTTP request handling, validation, routing, response serialization
- Location: `backend/app/api/v1/endpoints/`
- Contains: 20+ endpoint modules (transactions, loans, categories, forecast, etc.)
- Depends on: Schemas (validation), Services (business logic), Dependencies (auth/context)
- Used by: Frontend API clients, external integrations
- Key files: `backend/app/api/v1/router.py`, `backend/app/api/deps.py`

**Schema Layer (Validation):**
- Purpose: Request/response validation using Pydantic, type safety
- Location: `backend/app/api/v1/schemas/`
- Contains: Pydantic BaseModel classes (Create, Update, Response variants)
- Depends on: Python stdlib (datetime, Decimal, UUID)
- Used by: Endpoints for input validation and response marshaling
- Pattern: Each domain (transaction, loan, etc.) has dedicated schema file with validators

**Service Layer (Business Logic):**
- Purpose: Core financial algorithms, state transitions, cross-domain orchestration
- Location: `backend/app/services/`
- Contains: 15+ services (forecast, alert, payment, audit, backup, exchange_rate, etc.)
- Depends on: Models, Repositories, SQLAlchemy ORM
- Used by: Endpoints, Scheduler, other services
- Pattern: Stateless functions, async-first, single responsibility per service
- Examples:
  - `forecast_service.py`: forecast calculations, scenario modeling
  - `alert_service.py`: threshold checking, alert generation
  - `installment_payment_service.py`: payment scheduling, due date calculation
  - `financial_aggregator.py`: aggregating balance/forecast across accounts

**Repository Layer (Data Access):**
- Purpose: Query building, data retrieval, persistence operations
- Location: `backend/app/repositories/` (minimal - most logic in services)
- Contains: CRUD operations, complex queries
- Depends on: Models, SQLAlchemy
- Used by: Services
- Current state: Mostly handled inline in endpoints/services; can be expanded

**Model Layer (Domain):**
- Purpose: Database schema definition, ORM entity mapping
- Location: `backend/app/db/models/`
- Contains: 20+ SQLAlchemy models (Transaction, Loan, Category, User, Organization, etc.)
- Key relationships:
  - User (1:many) → Transaction, Category, Settings
  - Organization (1:many) → OrganizationMember, Transaction, Budget
  - Category (1:many) → Transaction
  - Loan (1:many) → LoanPayment schedule (implicit)
  - Account types: BankAccount, CreditCard, Subscription
- Financial fields: All amounts stored as Numeric(15,2), currency as VARCHAR(3)
- Soft deletes: Categories use is_archived flag

**Database Layer (Persistence):**
- Purpose: Connection management, session lifecycle
- Location: `backend/app/db/session.py`
- Contains: AsyncEngine, AsyncSessionMaker, session generator
- Configuration: PostgreSQL async engine with pool size 10, max_overflow 20, 30s query timeout
- Depends on: SQLAlchemy async, asyncpg driver
- Used by: Endpoints (via FastAPI Depends), Services

**Frontend - Component Layer:**
- Purpose: UI rendering, user interaction
- Location: `frontend/src/components/`, `frontend/src/pages/`
- Contains: React components organized by domain (dashboard, transactions, loans, etc.)
- Pages (lazy-loaded): Dashboard, Transactions, Fixed, Installments, Loans, Subscriptions, CreditCards, BankAccounts, Categories, Forecast, Balance, Alerts, Settings, Users, Backups, Organizations
- Depends on: Contexts (Auth, Organization, Theme, Toast), Hooks (React Query), API clients
- Pattern: Smart components (pages) use hooks + React Query; dumb components handle UI only

**Frontend - Context Layer (State Management):**
- Purpose: Global state for authentication, organization, theme, notifications
- Location: `frontend/src/contexts/`
- Contains:
  - `AuthContext`: User identity, login/logout, token management
  - `OrganizationContext`: Active organization, member list, org-specific settings
  - `ThemeContext`: Dark/light/system theme, CSS variables
  - `ToastContext`: Toast notifications (errors, success messages)
- Used by: Pages, Components via useContext hooks

**Frontend - API Client Layer:**
- Purpose: HTTP communication with backend
- Location: `frontend/src/api/`
- Contains: ~25 API modules (auth, transactions, categories, etc.) + base client
- Key file: `client.ts` - Axios interceptor for JWT, token refresh, error handling
- Pattern: Modular API clients per domain, reusable getApiErrorMessage() for i18n errors

**Frontend - Query Management:**
- Purpose: Server state synchronization, caching, refetching
- Location: `frontend/src/lib/queryClient.ts`, `frontend/src/lib/queryKeys.ts`
- Contains: TanStack Query configuration + query key factory
- Pattern: Centralized query keys (transactions, categories, forecast, etc.)

**Frontend - Utilities & Hooks:**
- Purpose: Reusable logic, custom React hooks
- Location: `frontend/src/hooks/`, `frontend/src/lib/utils.ts`
- Hooks: useCurrency, useCountUp, usePeriodSelector, useScrollReveal, useCursorGlow, useModalA11y
- Utils: Currency formatting, query helpers

**Frontend - Internationalization:**
- Purpose: Multi-language support (Hebrew + English), RTL rendering
- Location: `frontend/src/i18n/`
- Framework: i18next
- Configuration: Hebrew default (RTL), English fallback (LTR)
- Used by: All UI text via i18n.t() calls

## Data Flow

**Request → Response Flow:**

1. Frontend (React Component) calls API function from `src/api/[domain].ts`
2. API function uses Axios `apiClient` (in `src/api/client.ts`)
3. Axios adds JWT token from localStorage as Bearer header
4. Request reaches FastAPI endpoint at `/api/v1/[route]`
5. Endpoint depends on injected:
   - `get_current_user` → validates JWT, returns User
   - `get_data_context` → determines personal vs org scope
   - `get_db` → provides AsyncSession
6. Endpoint queries via SQLAlchemy ORM (with data context filter)
7. Optional service call for business logic (forecast, alerts, etc.)
8. Response marshaled to Pydantic schema
9. FastAPI returns JSON
10. Axios response interceptor checks for 401, attempts token refresh if needed
11. React Query caches result in queryClient
12. Component re-renders with data, loading/error state via useQuery hook

**Example: List Transactions**
```
TransactionsPage.tsx
  → useQuery(['transactions', filters], () => transactionsApi.list(filters))
    → GET /api/v1/transactions?page=1&start_date=...
      → Axios: add Bearer token
        → FastAPI endpoint list_transactions()
          → get_current_user: validate JWT token
          → get_data_context: if org_id set, filter to org; else filter to user_id
          → db.execute(SELECT Transaction WHERE context_filter)
          → eager load categories via selectinload()
          → return TransactionListResponse (items + pagination)
        → Pydantic serializes to JSON
      ← Axios receives JSON
  ← React Query caches and returns data
  ← Component renders table with transactions
```

**State Management Flow:**

1. User logs in → AuthContext stores JWT in localStorage and state
2. User switches organization → OrganizationContext updates current_organization_id
3. Each endpoint request includes data_context (org_id or user_id)
4. Endpoint's ownership_filter() ensures isolation:
   - Personal: `WHERE user_id = X AND organization_id IS NULL`
   - Org: `WHERE organization_id = Y`
5. Frontend updates UI based on org switcher selection

**Async Scheduler Flow:**

1. Backend app startup (lifespan event) → start_scheduler() in `scheduler.py`
2. Scheduler runs periodic jobs:
   - Check alert conditions
   - Process payment due dates
   - Generate forecasts (if auto-refresh enabled)
3. Jobs execute asynchronously without blocking API
4. Results logged or stored in database
5. App shutdown → stop_scheduler()

## Key Abstractions

**DataContext (Org-aware data isolation):**
- Purpose: Encapsulate "whose data am I accessing?" logic
- Location: `backend/app/api/deps.py`, lines 107-176
- Pattern: `DataContext(user_id, organization_id, is_org_context)` injected into endpoints
- Methods:
  - `ownership_filter(model_class)` → SQLAlchemy WHERE clause
  - `create_fields()` → dict of user_id/org_id for new records
- Usage: Every endpoint that touches financial data uses `ctx.ownership_filter(Model)` in query

**Pydantic Schemas (Request/Response validation):**
- Purpose: Single source of truth for API contracts
- Location: `backend/app/api/v1/schemas/[domain].py`
- Pattern: Create, Update, Response, ListResponse classes per domain
- Validation: Field validators, max_length/pattern/gt checks, Decimal precision
- Example: `TransactionCreate` validates amount precision (max 15 digits total, 2 decimal)

**SQLAlchemy Models (ORM domain entities):**
- Purpose: Bridge between Python objects and database tables
- Pattern: Mapped class with type hints, ForeignKey relationships, indexes
- Example: `Transaction` model has relationships to User, Organization, Category, BankAccount, CreditCard
- Constraints: CheckConstraint for domain validation (e.g., amount > 0)

**React Query (Server state management):**
- Purpose: Sync frontend with backend state, caching, refetching
- Query keys: Structured by domain (`['transactions', { filters }]`)
- Mutations: Used for POST/PUT/DELETE operations
- Invalidation: `queryClient.invalidateQueries()` after mutations to refresh lists

**Theme Context + CSS Variables:**
- Purpose: Persist user theme preference, dynamic styling
- Mechanism: Light/dark theme stored in localStorage, CSS custom properties updated
- Example: `--color-primary: hsl(200, 80%, 50%)` in light mode, different in dark mode

## Entry Points

**Backend Entry Point:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities:
  - Create FastAPI app instance with lifespan hooks
  - Register middleware (CORS, security headers, request logging, rate limiting)
  - Mount API router at `/api/v1`
  - Define exception handlers (DataError, IntegrityError, generic)
  - Health check endpoint `/health`

**Frontend Entry Point:**
- Location: `frontend/src/main.tsx`
- Renders: `App.tsx` in root DOM element
- Responsibilities:
  - Initialize Vite/React
  - Mount context providers (ThemeProvider, AuthProvider, OrganizationProvider, ToastProvider)
  - Mount RouterProvider from React Router
  - Wrap in ErrorBoundary

**Frontend Router Entry:**
- Location: `frontend/src/router.tsx`
- Responsibilities:
  - Define route tree (lazy-loaded pages)
  - Protect routes via ProtectedRoute component
  - Wrap authenticated routes with AppLayout (header/sidebar)
  - Handle 404 error page

## Error Handling

**Strategy:** Layered error handling with type-safe exceptions and user-friendly messages

**Backend patterns:**

- Custom exceptions (`backend/app/core/exceptions.py`):
  - `UnauthorizedException` (401) - invalid/expired token
  - `ForbiddenException` (403) - permission denied
  - `NotFoundException` (404) - resource not found
  - `ConflictException` (409) - duplicate/state conflict
  - `ValidationException` (422) - input validation failed

- Exception handlers in `main.py`:
  - `DataError` → 422 with "Invalid data: contains unsupported characters"
  - `IntegrityError` → 422/409 with context-specific message (FK, unique, etc.)
  - Generic `Exception` → 500 with "Internal server error" (stack trace in DEBUG only)

- Service errors: Services raise custom exceptions; endpoints catch and map to HTTP status

**Frontend patterns:**

- `getApiErrorMessage()` in `client.ts` translates HTTP errors to i18n keys
- Axios response interceptor catches 401, attempts token refresh; on failure redirects to /login
- React Query's useQuery/useMutation `onError` callback → toast notification
- ErrorBoundary catches render-time errors, displays fallback UI

## Cross-Cutting Concerns

**Logging:**
- Backend: Structured logging via `logging_config.py`
  - JSON format for production, colorized for development
  - Request logging: method, path, status, duration (RequestLoggingMiddleware)
  - Slow query logging: queries > 500ms logged with query text
  - Service/business logic: log errors, state transitions, important operations

- Frontend: console.log/error for debugging; production builds have minimal logging

**Validation:**

- Backend:
  - Pydantic schema validation at endpoint layer (automatic)
  - Field validators for domain-specific rules (Decimal precision, pattern matching)
  - SQLAlchemy CheckConstraints at model layer
  - Service layer: business rule validation (e.g., loan amount > 0, date ranges)

- Frontend:
  - Form validation before submit (if applicable)
  - Pydantic error messages from backend translated to i18n
  - useQuery `enabled` flag to prevent invalid requests

**Authentication:**

- Strategy: JWT with short-lived access token + long-lived refresh token
- Backend:
  - `get_current_user` dependency: validates JWT, checks blacklist, verifies user active
  - Token refresh endpoint: uses refresh_token to issue new access_token
  - Token blacklist: in-memory or Redis (prevents replay after logout)
  - Password invalidation: token issued_at compared against user.password_changed_at

- Frontend:
  - JWT stored in localStorage (access_token, refresh_token)
  - Axios interceptor adds Bearer header
  - 401 response triggers refresh; on failure redirects to /login
  - Logout clears localStorage and queryClient cache

**Authorization:**

- Data isolation via DataContext (user/org scope)
- Role-based permissions: ORG_PERMISSIONS dict in `deps.py` maps action → allowed_roles
- Examples:
  - "create_transactions" → allowed for owner, admin, member
  - "manage_org_settings" → allowed for owner, admin only
  - "view_audit_log" → allowed for owner, admin only

**Security Headers (ASGI Middleware):**

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- Content-Security-Policy: default-src 'self'
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

**Rate Limiting:**

- Backend: slowapi library integrated with FastAPI
- Configured in `core/rate_limit.py`
- Applied to sensitive endpoints (auth, exports, etc.)

---

*Architecture analysis: 2026-02-24*
