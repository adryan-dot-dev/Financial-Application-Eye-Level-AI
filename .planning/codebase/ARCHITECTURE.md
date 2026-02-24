# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Layered monolithic architecture with clear separation between API, business logic, persistence, and presentation layers.

**Key Characteristics:**
- Backend: FastAPI async framework with SQLAlchemy ORM (async)
- Frontend: React 19 with TypeScript, TanStack Query for server state
- Authentication: JWT with refresh tokens
- Multi-tenancy: Organization-scoped data isolation via `DataContext`
- Financial precision: DECIMAL(15,2) for all monetary fields
- API versioning: `/api/v1/` prefix for future expansion

## Layers

**Presentation (Frontend):**
- Purpose: User interface, client-side routing, state management
- Location: `frontend/src/`
- Contains: React components, pages, hooks, contexts
- Depends on: TanStack Query for API calls, React Router for navigation
- Used by: End users via browser

**API Layer (Backend):**
- Purpose: HTTP endpoints, request/response validation, routing
- Location: `backend/app/api/v1/endpoints/`
- Contains: Route handlers, Pydantic schemas (request/response models)
- Depends on: Services layer for business logic, DB session injection
- Used by: Frontend via axios client, external API consumers

**Service Layer (Backend):**
- Purpose: Business logic, domain calculations, workflow orchestration
- Location: `backend/app/services/`
- Contains: `forecast_service.py`, `alert_service.py`, `financial_aggregator.py`, etc. (17 services)
- Depends on: Repositories for data access, external services (exchange rates)
- Used by: Endpoints, scheduled tasks

**Repository/Data Access Layer (Backend):**
- Purpose: Query construction, data persistence abstraction
- Location: `backend/app/repositories/` (currently minimal; most logic in services)
- Contains: Currently sparse; most CRUD operations done directly in endpoints via SQLAlchemy queries
- Depends on: SQLAlchemy models, AsyncSession
- Used by: Services and endpoints

**Database Layer (Backend):**
- Purpose: Schema definition, ORM mapping
- Location: `backend/app/db/`
- Contains: 19 SQLAlchemy models in `models/`, async session factory in `session.py`
- Depends on: PostgreSQL, Alembic migrations
- Used by: All application layers via SQLAlchemy

**Core/Infrastructure Layer (Backend):**
- Purpose: Cross-cutting concerns, security, logging, rate limiting
- Location: `backend/app/core/`
- Contains: JWT security, rate limiting, logging, exception classes, caching utilities
- Depends on: External libraries (jose, passlib, slowapi)
- Used by: All layers

## Data Flow

**Request → Response Flow (Happy Path):**

1. Browser sends HTTP request with JWT token in `Authorization: Bearer <token>` header
2. Axios interceptor in `frontend/src/api/client.ts` attaches token
3. FastAPI receives at `backend/app/main.py`
4. SecurityHeadersMiddleware and RequestLoggingMiddleware process request
5. Route handler in `backend/app/api/v1/endpoints/*.py` receives request
6. Dependency injection:
   - `get_current_user()` validates JWT, fetches User from DB
   - `get_data_context()` creates DataContext (user scope or org scope)
   - `get_db()` provides AsyncSession
7. Endpoint validates input with Pydantic schema
8. Calls service layer method (e.g., `forecast_service.get_monthly_forecast()`)
9. Service queries database via AsyncSession + SQLAlchemy ORM
10. Service performs calculations, aggregation, business logic
11. Returns response model (Pydantic schema)
12. Endpoint serializes to JSON
13. Frontend receives via axios, processes with React Query
14. React Query caches result (staleTime: 5 min)
15. Component renders UI

**State Management Flow:**

```
Frontend:
  App.tsx (root)
    ├─ ThemeProvider (light/dark/system + CSS vars)
    ├─ AuthProvider (JWT tokens, user state)
    │   ├─ localStorage: access_token, refresh_token
    │   └─ SessionStorage: onboarding_completed flag
    ├─ OrganizationProvider (current org context)
    ├─ ToastProvider (transient notifications)
    ├─ QueryClientProvider (TanStack Query)
    │   └─ React Router
    │       ├─ Protected routes via ProtectedRoute component
    │       └─ Lazy-loaded pages with Suspense
    └─ ErrorBoundary (fallback UI on crashes)

Backend:
  FastAPI lifespan:
    ├─ Startup: scheduler.start_scheduler() (APScheduler)
    └─ Shutdown: scheduler.stop_scheduler(), engine.dispose()

  Session management:
    ├─ get_db() creates AsyncSession per request
    ├─ Automatic rollback on exception
    └─ Connection pool: size=10, overflow=20, recycle=3600s
```

**Authorization & Data Isolation:**

1. `DataContext` represents "who is accessing what"
   - Location: `backend/app/api/deps.py` (DataContext class)
   - Two modes:
     - **User context** (is_org_context=False): Access user's own data
     - **Organization context** (is_org_context=True): Access org member data

2. Every model has `ownership_filter()` method
   - Example from Transaction: `.where(ctx.ownership_filter(Transaction))`
   - Generates WHERE clause that restricts queries to user/org scope

3. Endpoints pass `ctx` to services, services pass to repository queries
   - Safety: Cannot query data outside user's scope even if user manipulates URL

## Key Abstractions

**DataContext:**
- Purpose: Encapsulate current user/org scope for data access
- Location: `backend/app/api/deps.py`
- Attributes: `user_id`, `organization_id`, `is_org_context`
- Methods: `ownership_filter()` generates WHERE clause for isolation
- Used: In all endpoints that access user/org data

**Service Classes:**
- Purpose: Encapsulate domain logic, reusable workflows
- Location: `backend/app/services/`
- Examples:
  - `forecast_service.py`: 6-month cash flow forecasting with multiple scenarios
  - `alert_service.py`: Automatic alert generation on negative forecast
  - `financial_aggregator.py`: KPI calculation (income/expense/balance aggregates)
  - `exchange_rate_service.py`: Currency conversion with caching
  - `scheduler.py`: Background jobs (alert generation, payment reminders)

**Pydantic Schemas:**
- Purpose: Request/response validation, API contract
- Location: `backend/app/api/v1/schemas/`
- Pattern: Separate Create, Update, Response schemas per entity
- Example: `TransactionCreate`, `TransactionUpdate`, `TransactionResponse`

**SQLAlchemy Models:**
- Purpose: ORM mapping to database tables
- Location: `backend/app/db/models/`
- 19 models: User, Category, Transaction, Fixed, Installment, Loan, Alert, Organization, etc.
- Pattern: Base class provides common fields (id, created_at, updated_at)

**React Contexts:**
- Purpose: Global state without prop drilling
- Location: `frontend/src/contexts/`
- Four contexts:
  - `AuthContext`: User authentication state + login/logout
  - `ThemeContext`: Theme (light/dark/system) + CSS variable management
  - `OrganizationContext`: Current org + org switching
  - `ToastContext`: Toast notifications queue

**Custom React Hooks:**
- Purpose: Logic reuse across components
- Location: `frontend/src/hooks/`
- Examples:
  - `useCurrency()`: Format amounts with current currency
  - `usePeriodSelector()`: Date range selection state
  - `useModalA11y()`: Focus trap + keyboard handling for modals
  - `useScrollReveal()`: Intersection observer for fade-in animations

**API Client:**
- Purpose: Centralized HTTP client with interceptors
- Location: `frontend/src/api/client.ts`
- Features:
  - JWT token injection on every request
  - Automatic 401 handling with token refresh
  - Error translation to i18n keys
  - Base URL: `/api/v1`

## Entry Points

**Backend:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload`
- Responsibilities:
  - Creates FastAPI app instance
  - Registers middleware (security headers, logging, CORS, rate limiting)
  - Includes API router (`api_router` from `app.api.v1.router`)
  - Defines lifespan context manager (scheduler start/stop)
  - Exception handlers (DataError, IntegrityError, global 500)
  - Health check endpoint at `/health`

**Frontend:**
- Location: `frontend/src/main.tsx`
- Triggers: `npm run dev` (Vite dev server)
- Responsibilities:
  - Mounts React app to `#root` DOM element
  - Registers service worker for PWA support
  - Creates React strict mode for development warnings

**App Component:**
- Location: `frontend/src/App.tsx`
- Responsibilities:
  - Wraps entire app with context providers (Theme, Auth, Org, Toast, Query)
  - Nests React Router provider
  - Error boundary for crash handling

**Router:**
- Location: `frontend/src/router.tsx`
- Responsibilities:
  - Defines all routes (login, register, protected routes, pages)
  - Lazy loads pages with Suspense
  - Public routes: `/login`, `/register`
  - Protected routes: wrapped in `<ProtectedRoute />` which checks JWT
  - AppLayout wrapper: provides sidebar, header, navigation

## Error Handling

**Strategy:** Layered error handling with specific exceptions bubbling to appropriate handler

**Backend Patterns:**

1. **Domain-specific exceptions:** `backend/app/core/exceptions.py`
   - `NotFoundException`: 404 for missing resources
   - `AlreadyExistsException`: 409 for duplicates
   - `UnauthorizedException`: 401 for missing/invalid token
   - `ForbiddenException`: 403 for permission denial
   - `InvalidDateRangeException`: 422 for validation
   - `NegativeAmountException`: 422 for business rule violations

2. **Global exception handlers:** `backend/app/main.py`
   - `DataError`: 422 - PostgreSQL data errors (null bytes, encoding)
   - `IntegrityError`: 422/409/422 - FK violations, unique constraints
   - `Exception`: 500 - Catch-all, never leaks stack trace in production

3. **Dependency injection validation:**
   - `get_current_user()`: raises `UnauthorizedException` if token invalid/expired
   - Automatic via FastAPI before endpoint executes

**Frontend Patterns:**

1. **API error translation:** `frontend/src/api/client.ts`
   - Maps HTTP status codes to i18n keys
   - Extracts Pydantic validation error messages
   - Default fallback: `toast.error`

2. **Error boundary:** `frontend/src/components/ErrorBoundary.tsx`
   - Catches React rendering errors
   - Shows fallback UI instead of white screen

3. **Component error states:**
   - Queries in error state show retry button + error message
   - Network errors show connection icon + retry

## Cross-Cutting Concerns

**Logging:**
- Backend: `backend/app/core/logging_config.py`
  - Structured logging with JSON output in production
  - DEBUG level logs in development
  - RequestLoggingMiddleware logs all HTTP requests/responses
  - SlowQueryLogger logs queries > 1 second
- Frontend: `console` for development, silent in production

**Validation:**
- Backend: Pydantic schemas on all endpoints
  - Input: `TransactionCreate`, `UserUpdate`, etc.
  - Output: `TransactionResponse`, `UserResponse`, etc.
- Frontend: React Hook Form + custom validators where needed

**Authentication:**
- Backend: JWT with `Authorization: Bearer <token>` header
  - Token contains `sub` (user_id), `exp` (expiration), `iat` (issued), `jti` (unique ID)
  - Refresh tokens stored in localStorage (7-day expiry)
  - Access tokens: 15-minute expiry
  - Blacklist set for logout (in-memory, migration path to Redis)
- Frontend: localStorage stores tokens
  - Request interceptor injects token
  - Response interceptor handles 401 + refresh flow

**Rate Limiting:**
- Backend: `backend/app/core/rate_limit.py` using slowapi
  - 100 requests per minute per IP (default)
  - Configurable per endpoint
  - Returns 429 Too Many Requests

**Caching:**
- Backend: Exchange rate cache (5-minute TTL)
- Frontend: TanStack Query (5-minute staleTime, 1 retry)

**Security Headers:**
- Backend: Pure ASGI middleware in `backend/app/main.py`
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - HSTS: 1 year
  - CSP: default-src 'self'
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: deny camera, microphone, geolocation

**Internationalization:**
- Backend: Error messages in English (extensible to i18n)
- Frontend: i18next with Hebrew (he) default + English (en)
  - RTL CSS support via Tailwind
  - All UI text through `t()` function

---

*Architecture analysis: 2026-02-24*
