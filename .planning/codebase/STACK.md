# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- Python 3.9.6 - Backend API, business logic, database migrations
- TypeScript 5.9.3 - Frontend application, type-safe React components
- JavaScript (Node.js 20+) - Build tooling, package management

**Secondary:**
- SQL - Database queries (via SQLAlchemy ORM)

## Runtime

**Environment:**
- Python 3.9.6 with async/await support (IMPORTANT: no `X | Y` union syntax, uses `from __future__ import annotations`)
- Node.js 20+ for frontend development
- Uvicorn ASGI server for running FastAPI application

**Package Manager:**
- Backend: pip with requirements.txt
- Frontend: npm with package-lock.json (locked dependency tree)
- Lockfiles: Both present and committed

## Frameworks

**Core:**
- FastAPI 0.115.6 - REST API framework with automatic OpenAPI documentation
- React 19.2.0 - UI framework with hooks and modern patterns
- Tailwind CSS 4.1.18 - Utility-first CSS framework with Vite integration

**Backend Support:**
- SQLAlchemy 2.0.36 - Async ORM with type hints, uses `sqlalchemy[asyncio]`
- Pydantic 2.x (via pydantic-settings 2.7.1) - Data validation and settings management
- Alembic 1.14.1 - Database migration management integrated with SQLAlchemy

**Frontend Support:**
- React Router v7.13.0 - Client-side routing with lazy loading
- TanStack Query (React Query) 5.90.20 - Server state management and caching
- Vite 7.3.1 - Fast build tool and dev server with HMR
- Recharts 3.7.0 - Chart library built on React components

**Testing:**
- Backend: pytest 8.3.4 + pytest-asyncio 0.25.0 for async test support
- Frontend: ESLint 9.39.1 + typescript-eslint for linting

**Build/Dev:**
- @vitejs/plugin-react 5.1.1 - React Fast Refresh plugin for Vite
- @tailwindcss/vite 4.1.18 - Tailwind CSS integration as Vite plugin
- TypeScript 5.9.3 - Type checking compiler

## Key Dependencies

**Critical Backend:**
- asyncpg 0.30.0 - Async PostgreSQL driver, required for SQLAlchemy async
- python-jose[cryptography] 3.3.0 - JWT token creation and validation
- passlib[bcrypt] 1.7.4 + bcrypt 4.0.1 - Password hashing (pinned bcrypt for Python 3.9 compatibility)
- eval-type-backport 0.3.1 - Python 3.9 compatibility for type hint evaluation

**Critical Frontend:**
- axios 1.13.5 - HTTP client for API communication with interceptors
- i18next 25.8.4 + react-i18next 16.5.4 - Internationalization with Hebrew RTL support
- lucide-react 0.563.0 - Icon library (used for all UI icons)
- clsx 2.1.1 - Utility for conditional CSS classnames
- motion 12.34.1 - Animation library

**Infrastructure:**
- slowapi 0.1.9 - Rate limiting middleware for FastAPI
- APScheduler 3.10.4 - Job scheduler for background tasks
- python-dateutil 2.9.0 - Date/time utilities
- httpx 0.28.1 - Async HTTP client (used for exchange rate API calls)

## Configuration

**Environment:**
- Backend: `.env` file (in `.gitignore`) with pydantic-settings loader
- Frontend: `.env.example` present, uses Vite's `import.meta.env` pattern
- Key backend configs:
  - `DATABASE_URL`: PostgreSQL connection string with asyncpg driver
  - `SECRET_KEY`: JWT signing key (auto-generated if not provided)
  - `ALGORITHM`: JWT algorithm (HS256)
  - `ACCESS_TOKEN_EXPIRE_MINUTES`: 15 minutes default
  - `REFRESH_TOKEN_EXPIRE_DAYS`: 7 days default
  - `CORS_ORIGINS`: JSON array or comma-separated list of allowed origins
  - `ADMIN_DEFAULT_PASSWORD`: For initial admin user creation
  - `DEBUG`: Boolean for debug mode (controls OpenAPI docs exposure)

**Build:**
- Backend: `alembic.ini` - Database migration configuration
- Backend: `pytest.ini` - Pytest configuration
- Frontend: `vite.config.ts` - Vite build config with React and Tailwind plugins
- Frontend: `tsconfig.json` - TypeScript configuration with app and node configs
- Frontend: `eslint.config.js` - ESLint configuration for TS/TSX files

## Platform Requirements

**Development:**
- PostgreSQL 16+ (via Docker)
- Python 3.9.6+ (CRITICAL: 3.9 compatibility required, no 3.10+ union syntax)
- Node.js 20+ for frontend tooling
- Docker and docker-compose for local database setup

**Production:**
- PostgreSQL 16+ database (ACID compliance, financial precision support)
- Linux/Unix server (for running Uvicorn + FastAPI)
- Node.js or similar for frontend static hosting (pre-built with `npm run build`)
- Memory: PostgreSQL container limited to 512M, pgAdmin to 256M (see docker-compose.yml)

## Database

**Connection:**
- PostgreSQL 16-alpine via Docker (containerized development)
- Connection string: `postgresql+asyncpg://cashflow:cashflow@localhost:5432/cashflow`
- Async connection pooling: pool_size=10, max_overflow=20
- Query timeout: 30 seconds (server_settings statement_timeout)
- Pool recycling: 3600 seconds (hourly)
- Health checks enabled on Docker service

**Data Types:**
- Financial fields: `DECIMAL(15,2)` - no FLOAT used for currency
- Timestamps: DateTime with timezone awareness
- Soft deletes: `is_archived` boolean flag on categories (not hard deletes)
- Currency field: `VARCHAR(3)` with default 'ILS' on all financial tables

## Integrations (External APIs)

**Exchange Rates:**
- Frankfurter.app free API - No authentication required
- Used for multi-currency support (ILS, USD, EUR)
- In-memory cache with 1-hour TTL
- Fallback mechanism for expired cached rates if API fails
- Supported currencies hardcoded: ILS, USD, EUR

**pgAdmin (Development Only):**
- Container image: dpage/pgadmin4
- Exposed on port 5050 for database management
- Not for production use

## Security Stack

**Authentication:**
- JWT (JSON Web Tokens) with HS256 algorithm
- Tokens stored in localStorage (access token) and localStorage (refresh token)
- Token validation on frontend app mount
- Token blacklist in-memory (MVP) - can migrate to Redis in Phase 6+

**Password Management:**
- bcrypt with passlib for hashing and verification
- Configurable rounds (bcrypt 4.0.1 pinned for Python 3.9 compatibility)

**API Security:**
- CORS middleware with explicit origin whitelist (no wildcard allowed)
- Rate limiting via slowapi (configurable per endpoint)
- Security headers middleware (ASGI-based, not BaseHTTPMiddleware)
- Headers: X-Content-Type-Options, X-Frame-Options, HSTS, CSP, etc.

## Internationalization (i18n)

**Framework:**
- i18next 25.8.4 - Core library
- react-i18next 16.5.4 - React integration
- i18next-browser-languagedetector 8.2.0 - Browser language detection

**Languages:**
- Hebrew (he) - Default, RTL support
- English (en) - Secondary

**Configuration:**
- Namespace-based organization (e.g., 'common', 'dashboard', 'errors')
- localStorage persistence of language selection
- System language detection with fallback

---

*Stack analysis: 2026-02-24*
