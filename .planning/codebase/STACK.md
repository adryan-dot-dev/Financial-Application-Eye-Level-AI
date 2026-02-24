# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- Python 3.9.6 - Backend API, services, automation, scheduling, business logic
- TypeScript 5.9.3 - Frontend React application, type safety
- JavaScript (ES2022) - Build tooling, configuration
- SQL - Database queries via SQLAlchemy ORM

**Secondary:**
- CSS 4 - Tailwind CSS with `@theme` directive, dark/light mode theming
- HTML5 - React JSX templates

## Runtime

**Environment:**
- Node.js 20+ (frontend development and build)
- Python 3.9.6 (backend - **no union syntax `X | Y`, use `Optional[X]`**)
- PostgreSQL 16 Alpine (containerized via Docker)

**Package Manager:**
- Frontend: `npm` (npm dependencies in `package.json`)
- Backend: `pip` with `requirements.txt` (Python 3.9 compatible)
- Lockfile: `package-lock.json` (frontend); `requirements.txt` pinned (backend)

## Frameworks

**Core:**
- FastAPI 0.115.6 - Backend REST API, async-first, auto OpenAPI/Swagger docs
- React 19.2.0 - Frontend UI library, JSX components, hooks
- React Router v7.13.0 - Client-side routing with lazy loading and `ProtectedRoute`

**Database/ORM:**
- SQLAlchemy 2.0.36 (async) - ORM with full type hints, async query support
- asyncpg 0.30.0 - PostgreSQL async driver
- Alembic 1.14.1 - Database migrations, version control for schema

**State Management:**
- React Context API - Auth and Theme contexts (localStorage persistence)
- TanStack React Query v5.90.20 - Server state, caching, automatic refetch
- Axios 1.13.5 - HTTP client with JWT token injection and refresh logic

**Build/Dev:**
- Vite 7.3.1 - Frontend bundler, dev server with instant HMR
- TypeScript 5.9.3 - Type checking via `tsc -b`
- ESLint 9.39.1 - JavaScript/TypeScript linting (flat config)
- Tailwind CSS 4.1.18 - Utility-first CSS with `@tailwindcss/vite` plugin

**Testing:**
- pytest 8.3.4 - Backend unit/integration tests
- pytest-asyncio 0.25.0 - Async test support with fixtures
- httpx 0.28.1 - Async HTTP client for test requests

**Charting/UI:**
- Recharts 3.7.0 - React-native charts (dashboard, forecast, balance)
- lucide-react 0.563.0 - Icon library (26+ icons used)
- @number-flow/react 0.5.12 - Animated number transitions for KPI displays
- cmdk 1.1.1 - Command palette / search UI component
- motion 12.34.1 - Framer motion for animations
- clsx 2.1.1 - Conditional CSS class concatenation

**Internationalization:**
- i18next 25.8.4 - Translation framework (Hebrew RTL + English)
- i18next-browser-languagedetector 8.2.0 - Auto-detect browser language
- react-i18next 16.5.4 - React integration for i18n

**Security & Validation:**
- python-jose 3.3.0 (cryptography) - JWT token creation/verification
- passlib 1.7.4 (bcrypt) - Password hashing context
- bcrypt 4.0.1 - Bcrypt hashing library (pinned for Python 3.9 compatibility)
- email-validator 2.2.0 - Email format validation
- pydantic 2.7.1 - Request/response schema validation

**Rate Limiting:**
- slowapi 0.1.9 - FastAPI rate limiter decorator with Redis migration path

**Automation & Scheduling:**
- APScheduler 3.10.4 - Job scheduler for daily recurring charges, backups, alerts
- python-dateutil 2.9.0 - Date manipulation utilities

**Utilities:**
- greenlet 3.1.1 - Required by SQLAlchemy async context switching
- eval-type-backport 0.3.1 - Enable `from __future__ import annotations` on Python 3.9
- pydantic-settings 2.7.1 - Environment variable parsing with validation
- python-multipart 0.0.20 - Multipart form data parsing

## Configuration

**Environment:**
- Backend: `.env` file with pydantic-settings validation
- Frontend: `.env` file with Vite environment variables (prefixed `VITE_`)
- Database connection: `DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db`
- CORS origins: JSON array or comma-separated list in `CORS_ORIGINS`

**Build:**
- Frontend: `vite.config.ts` with React plugin, Tailwind plugin, `@/` path alias
- Backend: `app/config.py` with `Settings` class for environment validation
- TypeScript: `tsconfig.json` references `tsconfig.app.json` + `tsconfig.node.json`
  - Strict mode enabled, `verbatimModuleSyntax: true`, ES2022 target
- ESLint: `eslint.config.js` (flat config) with TypeScript, React hooks, React refresh

## Key Dependencies

**Critical:**
- FastAPI 0.115.6 - All API endpoints, request/response handling, middleware
- React 19.2.0 - All UI components and state management
- PostgreSQL 16 - Data persistence, ACID compliance, financial precision (DECIMAL)
- SQLAlchemy 2.0.36 - Type-safe async ORM, parameterized queries (prevents SQL injection)
- Tailwind CSS 4.1.18 - All styling with dark/light mode theming

**Infrastructure & Async:**
- asyncpg 0.30.0 - PostgreSQL async driver, connection pooling
- Alembic 1.14.1 - Schema migrations, version control
- uvicorn 0.34.0 - ASGI server for FastAPI (with `--reload` for dev)
- greenlet 3.1.1 - Context switching for async/await

**Auth & Security:**
- python-jose 3.3.0 - JWT generation and validation (HS256 algorithm)
- bcrypt 4.0.1 - Password hashing with salt (15-minute access tokens, 7-day refresh)

**Observability:**
- slowapi 0.1.9 - Rate limiting with per-endpoint decorators (3-10/min on auth endpoints)
- Structured logging via stdlib `logging` (JSON format in production)

**Frontend State:**
- TanStack React Query 5.90.20 - Server state, background refetch, cache invalidation
- Axios 1.13.5 - HTTP client with request interceptors (JWT injection), response interceptors (401 refresh loop)

## Platform Requirements

**Development:**
- Python 3.9.6+ (3.9 specifically for compatibility with `eval-type-backport`)
- Node.js 20+ (supports ES2022 target)
- Docker & docker-compose (for PostgreSQL + pgAdmin)
- macOS/Linux/Windows with Docker Desktop

**Production:**
- PostgreSQL 16 database
- Python 3.9.6+ ASGI server (uvicorn, gunicorn, hypercorn)
- Node.js 20+ for frontend build artifact generation
- Reverse proxy (nginx, Cloudflare, etc.) for TLS termination
- Memory: 256M+ for backend service, 512M+ for PostgreSQL

## Deployment Architecture

**Local Development:**
```yaml
docker-compose.yml:
  - PostgreSQL 16 Alpine (memory: 512M limit, 256M reserved)
  - pgAdmin 4 (memory: 256M limit, 128M reserved)
  - Health checks: pg_isready every 5s with 30s timeout
  - Persistent volumes: postgres_data, pgadmin_data, backup_data
```

**Build Process:**
- Frontend: `npm run build` → Vite bundle → TypeScript compilation + minification
- Backend: Direct Python execution (no build step) with Alembic migrations

---

*Stack analysis: 2026-02-24*
