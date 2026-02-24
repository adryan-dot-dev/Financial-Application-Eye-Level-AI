# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
Financial-Application-Eye-Level-AI/
├── backend/                          # FastAPI backend (Python 3.9)
│   ├── app/
│   │   ├── main.py                   # FastAPI app, lifespan, middleware
│   │   ├── config.py                 # Environment settings (Pydantic)
│   │   ├── api/
│   │   │   ├── deps.py               # Auth, DataContext, permissions
│   │   │   └── v1/
│   │   │       ├── router.py         # API router assembly
│   │   │       ├── endpoints/        # 20+ endpoint modules
│   │   │       │   ├── transactions.py
│   │   │       │   ├── loans.py
│   │   │       │   ├── forecast.py
│   │   │       │   ├── alerts.py
│   │   │       │   ├── categories.py
│   │   │       │   ├── fixed.py
│   │   │       │   ├── installments.py
│   │   │       │   ├── dashboard.py
│   │   │       │   ├── auth.py
│   │   │       │   ├── settings.py
│   │   │       │   ├── organizations.py
│   │   │       │   └── [more...]
│   │   │       └── schemas/          # Pydantic validation schemas
│   │   │           ├── transaction.py
│   │   │           ├── loan.py
│   │   │           ├── forecast.py
│   │   │           ├── alert.py
│   │   │           └── [more...]
│   │   ├── core/
│   │   │   ├── security.py           # JWT encode/decode, blacklist
│   │   │   ├── exceptions.py         # Custom exception classes
│   │   │   ├── error_response.py     # Error response models
│   │   │   ├── logging_config.py     # Structured logging setup
│   │   │   ├── request_logger.py     # Middleware for request logging
│   │   │   ├── slow_query_logger.py  # Query performance tracking
│   │   │   ├── rate_limit.py         # Rate limiting config (slowapi)
│   │   │   ├── cache.py              # Caching helpers
│   │   │   └── __init__.py
│   │   ├── db/
│   │   │   ├── session.py            # AsyncEngine, AsyncSessionMaker
│   │   │   ├── base.py               # SQLAlchemy DeclarativeBase
│   │   │   └── models/               # 20+ ORM entity models
│   │   │       ├── user.py
│   │   │       ├── transaction.py
│   │   │       ├── category.py
│   │   │       ├── loan.py
│   │   │       ├── organization.py
│   │   │       ├── org_member.py
│   │   │       ├── org_settings.py
│   │   │       ├── org_budget.py
│   │   │       ├── installment.py
│   │   │       ├── fixed_income_expense.py
│   │   │       ├── credit_card.py
│   │   │       ├── bank_account.py
│   │   │       ├── alert.py
│   │   │       ├── expected_income.py
│   │   │       ├── audit_log.py
│   │   │       ├── backup.py
│   │   │       ├── subscription.py
│   │   │       ├── forecast_scenario.py
│   │   │       ├── org_report.py
│   │   │       ├── expense_approval.py
│   │   │       ├── bank_balance.py
│   │   │       └── __init__.py
│   │   ├── services/                 # Business logic services
│   │   │   ├── forecast_service.py   # Forecast calculations
│   │   │   ├── alert_service.py      # Alert generation
│   │   │   ├── scheduler.py          # APScheduler setup (lifespan)
│   │   │   ├── audit_service.py      # Audit logging
│   │   │   ├── financial_aggregator.py
│   │   │   ├── exchange_rate_service.py
│   │   │   ├── installment_payment_service.py
│   │   │   ├── loan_payment_service.py
│   │   │   ├── credit_card_service.py
│   │   │   ├── budget_service.py
│   │   │   ├── automation_service.py
│   │   │   ├── backup_service.py
│   │   │   ├── billing_service.py
│   │   │   ├── obligo_service.py
│   │   │   └── __init__.py
│   │   ├── repositories/             # Data access layer (minimal)
│   │   │   └── __init__.py
│   │   ├── utils/
│   │   │   └── __init__.py           # Utility functions
│   │   └── __init__.py
│   ├── alembic/                      # Database migrations
│   │   ├── versions/                 # Migration scripts
│   │   ├── env.py
│   │   └── alembic.ini
│   ├── tests/                        # Pytest test suite
│   │   ├── test_auth.py
│   │   ├── test_transactions.py
│   │   ├── test_forecast.py
│   │   └── [more...]
│   ├── scripts/
│   │   └── seed_data.py              # Initialize admin user + default categories
│   ├── logs/                         # Application logs directory
│   ├── requirements.txt              # Python dependencies
│   ├── venv/                         # Virtual environment
│   └── pytest.ini                    # Pytest configuration
│
├── frontend/                         # React frontend (TypeScript)
│   ├── src/
│   │   ├── main.tsx                  # Vite entry point
│   │   ├── App.tsx                   # Root component with providers
│   │   ├── router.tsx                # React Router v7 route definitions
│   │   ├── pages/                    # Page components (lazy-loaded)
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── OnboardingPage.tsx    # User setup flow
│   │   │   ├── DashboardPage.tsx     # Overview + KPI cards
│   │   │   ├── TransactionsPage.tsx  # CRUD, filters, table
│   │   │   ├── FixedPage.tsx         # Fixed income/expenses
│   │   │   ├── InstallmentsPage.tsx  # Installment plans
│   │   │   ├── LoansPage.tsx         # Loan management
│   │   │   ├── CategoriesPage.tsx    # Category CRUD
│   │   │   ├── ForecastPage.tsx      # 1-6 month forecast
│   │   │   ├── BalancePage.tsx       # Current balance + history
│   │   │   ├── AlertsPage.tsx        # Alert list + dismiss
│   │   │   ├── SettingsPage.tsx      # Preferences + exports
│   │   │   ├── UsersPage.tsx         # User management
│   │   │   ├── BackupsPage.tsx       # Backup restore
│   │   │   ├── SubscriptionsPage.tsx # Subscription list
│   │   │   ├── CreditCardsPage.tsx   # Credit card CRUD
│   │   │   ├── BankAccountsPage.tsx  # Bank account CRUD
│   │   │   ├── OrganizationPage.tsx  # Org management
│   │   │   └── ErrorPage.tsx         # 404/error display
│   │   │
│   │   ├── components/
│   │   │   ├── layout/               # App shell components
│   │   │   │   ├── AppLayout.tsx     # Main layout wrapper
│   │   │   │   ├── Header.tsx        # Top navigation
│   │   │   │   ├── DesktopHeader.tsx
│   │   │   │   ├── Sidebar.tsx       # Left navigation
│   │   │   │   ├── MobileBottomNav.tsx
│   │   │   │   └── [more...]
│   │   │   ├── dashboard/            # Dashboard widgets
│   │   │   │   ├── FinancialHealthWidget.tsx
│   │   │   │   ├── TopExpensesWidget.tsx
│   │   │   │   ├── MonthlyComparisonChart.tsx
│   │   │   │   └── [more...]
│   │   │   ├── ui/                   # Reusable UI components
│   │   │   │   ├── DatePicker.tsx
│   │   │   │   ├── PeriodSelector.tsx
│   │   │   │   ├── BudgetProgressBar.tsx
│   │   │   │   ├── CreditCardSelector.tsx
│   │   │   │   ├── CategoryIcon.tsx
│   │   │   │   ├── Skeleton.tsx
│   │   │   │   └── [more...]
│   │   │   ├── organization/         # Org management tabs
│   │   │   │   ├── OrgOverviewTab.tsx
│   │   │   │   ├── OrgBudgetsTab.tsx
│   │   │   │   ├── OrgSettingsTab.tsx
│   │   │   │   ├── OrgAuditLogTab.tsx
│   │   │   │   └── [more...]
│   │   │   ├── auth/
│   │   │   │   └── ProtectedRoute.tsx # Auth guard component
│   │   │   ├── Toast.tsx             # Toast notification container
│   │   │   ├── ErrorBoundary.tsx     # Error fallback wrapper
│   │   │   ├── CommandPalette.tsx    # Global search/commands
│   │   │   ├── OrgSwitcher.tsx       # Org selector dropdown
│   │   │   ├── CurrencySelector.tsx
│   │   │   └── AnimatedPage.tsx      # Page transition wrapper
│   │   │
│   │   ├── contexts/                 # React Context providers
│   │   │   ├── AuthContext.tsx       # User identity, login/logout
│   │   │   ├── OrganizationContext.tsx
│   │   │   ├── ThemeContext.tsx      # Dark/light mode
│   │   │   └── ToastContext.tsx      # Notifications
│   │   │
│   │   ├── api/                      # API client modules
│   │   │   ├── client.ts             # Axios instance + interceptors
│   │   │   ├── auth.ts               # Auth endpoints
│   │   │   ├── transactions.ts       # Transaction CRUD
│   │   │   ├── loans.ts
│   │   │   ├── forecast.ts
│   │   │   ├── alerts.ts
│   │   │   ├── categories.ts
│   │   │   ├── fixed.ts
│   │   │   ├── installments.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── settings.ts
│   │   │   ├── organizations.ts
│   │   │   └── [more...]
│   │   │
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useCurrency.ts        # Currency formatting
│   │   │   ├── useCountUp.ts         # Number animation
│   │   │   ├── usePeriodSelector.ts  # Period/date range
│   │   │   ├── useScrollReveal.ts    # Scroll animations
│   │   │   ├── useCursorGlow.ts      # Mouse glow effect
│   │   │   └── useModalA11y.ts       # Modal accessibility
│   │   │
│   │   ├── lib/                      # Utilities
│   │   │   ├── queryClient.ts        # TanStack Query config
│   │   │   ├── queryKeys.ts          # Query key factory (centralized)
│   │   │   └── utils.ts              # Helper functions
│   │   │
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript type definitions
│   │   │
│   │   ├── i18n/                     # Internationalization
│   │   │   ├── config.ts             # i18next setup
│   │   │   └── locales/
│   │   │       ├── en.json           # English strings
│   │   │       └── he.json           # Hebrew strings (RTL)
│   │   │
│   │   └── assets/                   # Static assets
│   │       ├── images/
│   │       └── fonts/
│   │
│   ├── public/                       # Static files served as-is
│   │   ├── logo.jpeg
│   │   ├── locales/                  # i18n translation files
│   │   └── index.html
│   │
│   ├── vite.config.ts                # Vite bundler config
│   ├── tsconfig.json                 # TypeScript config
│   ├── tailwind.config.ts            # Tailwind CSS v4 config
│   ├── package.json                  # npm dependencies
│   ├── package-lock.json
│   └── dist/                         # Production build output
│
├── alembic.ini                       # Database migration config
├── docker-compose.yml                # Local PostgreSQL + pgAdmin
├── PLAN.md                           # Detailed implementation plan
├── CLAUDE.md                         # Project instructions
├── README.md                         # Setup guide
└── .planning/
    └── codebase/                     # GSD mapping documents
        ├── ARCHITECTURE.md
        ├── STRUCTURE.md
        ├── STACK.md
        ├── INTEGRATIONS.md
        ├── CONVENTIONS.md
        ├── TESTING.md
        └── CONCERNS.md
```

## Directory Purposes

**backend/app/api/v1/endpoints/**
- Purpose: HTTP request handlers, business logic invocation, response formatting
- Contains: One module per domain (transactions, loans, categories, etc.)
- Pattern: Each endpoint function decorated with @router.get/@router.post, validates input via Depends, calls services, returns response schema
- Key files: `transactions.py` (CRUD + bulk ops), `forecast.py` (forecast generation), `dashboard.py` (aggregated KPIs)

**backend/app/api/v1/schemas/**
- Purpose: Input/output validation contracts
- Contains: Pydantic BaseModel classes organized by domain
- Pattern: Create, Update, Response, ListResponse for each domain
- Examples: `TransactionCreate`, `LoanUpdate`, `ForecastResponse`
- All amount fields: Decimal type with max_digits=15, decimal_places=2

**backend/app/core/**
- Purpose: Cross-cutting concerns, configuration, infrastructure
- Key files:
  - `security.py`: JWT encode/decode, token blacklist check
  - `exceptions.py`: Domain exception classes (Unauthorized, Forbidden, NotFound, Conflict)
  - `logging_config.py`: Structured JSON logging setup
  - `rate_limit.py`: Rate limiting configuration
  - `cache.py`: Caching utilities

**backend/app/db/models/**
- Purpose: ORM entity definitions
- Pattern: SQLAlchemy Mapped classes with type hints, relationships, constraints
- Key models:
  - `user.py`: User entity, password hashing
  - `transaction.py`: Core financial transaction (1:many to Category)
  - `organization.py`: Multi-tenant org root
  - `org_member.py`: Org membership with role
  - `loan.py`, `installment.py`: Scheduled payment entities
  - `alert.py`: Generated threshold violations
  - `audit_log.py`: Action audit trail

**backend/app/services/**
- Purpose: Business logic, domain algorithms
- Pattern: Stateless async functions, single responsibility
- Key services:
  - `forecast_service.py`: Cash flow forecasting (1-6 months)
  - `alert_service.py`: Alert evaluation (low balance, upcoming payments)
  - `scheduler.py`: APScheduler setup, periodic job scheduling
  - `financial_aggregator.py`: Summing transactions, running balance
  - `installment_payment_service.py`: Payment schedule generation

**frontend/src/pages/**
- Purpose: Top-level route components with full page logic
- Pattern: Lazy-loaded, fetch data with useQuery, manage local state
- Examples: TransactionsPage manages table with filters; DashboardPage combines multiple widget queries
- All pages wrapped in Suspense for loading state

**frontend/src/components/ui/**
- Purpose: Reusable UI building blocks
- Pattern: Dumb components (no data fetching), prop-driven
- Examples: DatePicker (input wrapper), BudgetProgressBar (visual only), CategoryIcon (icon + fallback)
- Tailwind CSS v4 for styling

**frontend/src/contexts/**
- Purpose: Global application state providers
- Pattern: Context + Provider pattern, useContext hook for consumption
- AuthContext: Holds user identity, provides login/logout/register
- ThemeContext: Persists light/dark preference in localStorage
- OrganizationContext: Active org ID, member list, org-specific settings

**frontend/src/api/**
- Purpose: HTTP communication abstraction
- Pattern: One module per domain, functions for each endpoint
- Base client in `client.ts` configures Axios with JWT, interceptors
- Each module exports functions like `list()`, `create()`, `update()`, `delete()`
- Error handling: `getApiErrorMessage()` translates to i18n keys

**frontend/src/lib/**
- Purpose: Utilities and configuration
- `queryClient.ts`: TanStack Query config (default options, cache time)
- `queryKeys.ts`: Centralized query key factory (prevents typos)
- `utils.ts`: Helpers (date formatting, URL encoding, etc.)

**frontend/src/i18n/**
- Purpose: Multi-language support
- Framework: i18next
- Locales: Hebrew (RTL, default), English (LTR)
- Usage: `i18n.t('key')` in all UI strings
- Config in `config.ts`: language detection, namespace loading

## Key File Locations

**Entry Points:**
- Backend: `backend/app/main.py` - FastAPI app instance, middleware, exception handlers
- Frontend: `frontend/src/main.tsx` - Vite entry, renders App.tsx
- Frontend Router: `frontend/src/router.tsx` - Route tree, ProtectedRoute wrapper

**Configuration:**
- Backend: `backend/app/config.py` - Settings (Pydantic BaseSettings, env vars)
- Frontend: `frontend/vite.config.ts` - Bundler config, alias, dev server proxy
- Frontend: `frontend/tsconfig.json` - TypeScript compiler, verbatimModuleSyntax: true
- Database: `alembic.ini`, `backend/alembic/` - Migration configuration

**Core Logic:**
- Transactions: `backend/app/db/models/transaction.py`, `backend/app/api/v1/endpoints/transactions.py`, `frontend/src/pages/TransactionsPage.tsx`
- Forecast: `backend/app/services/forecast_service.py`, `backend/app/api/v1/endpoints/forecast.py`, `frontend/src/pages/ForecastPage.tsx`
- Alerts: `backend/app/services/alert_service.py`, `backend/app/api/v1/endpoints/alerts.py`, `frontend/src/pages/AlertsPage.tsx`
- Authentication: `backend/app/api/v1/endpoints/auth.py`, `backend/app/core/security.py`, `frontend/src/contexts/AuthContext.tsx`, `frontend/src/pages/LoginPage.tsx`

**Testing:**
- Backend: `backend/tests/` - pytest test suite (100+ tests)
- Database: Alembic migrations in `backend/alembic/versions/`

## Naming Conventions

**Files:**
- Python: `snake_case.py` (e.g., `transaction_service.py`)
- TypeScript: `camelCase.ts` / `PascalCase.tsx` (e.g., `useCurrency.ts`, `TransactionsPage.tsx`)
- Directories: `lowercase/` or `snake_case/` (e.g., `backend/app/api/v1/endpoints/`)

**Functions:**
- Python: `snake_case` (e.g., `list_transactions()`, `get_current_user()`)
- TypeScript: `camelCase` (e.g., `useQuery()`, `apiClient.get()`)
- React Hooks: `useXxx` prefix (e.g., `useCurrency()`)

**Variables:**
- Python: `snake_case` (e.g., `user_id`, `current_user`)
- TypeScript: `camelCase` (e.g., `userId`, `currentUser`)
- React state: `camelCase` (e.g., `const [isLoading, setIsLoading]`)

**Types & Interfaces:**
- Python: `PascalCase` (e.g., `TransactionCreate`, `User`)
- TypeScript: `PascalCase` (e.g., `Transaction`, `AlertResponse`)
- TypeScript interfaces: `PascalCase` (e.g., `AuthContextValue`)

**Database:**
- Tables: `lowercase` (e.g., `transactions`, `organizations`)
- Columns: `snake_case` (e.g., `user_id`, `created_at`)
- Indexes: `idx_[table]_[columns]` (e.g., `idx_transactions_user_id`)

**Routes:**
- Path pattern: `/api/v1/[resource]/[action]` (e.g., `/api/v1/transactions/list`)
- Query params: `camelCase` (e.g., `?pageSize=20&sortBy=date`)
- Method: GET (read), POST (create), PUT/PATCH (update), DELETE (remove)

**React Query Keys:**
- Pattern: `['resource', { filters }]` (e.g., `['transactions', { page: 1, userId }]`)
- Defined in `frontend/src/lib/queryKeys.ts` for consistency

## Where to Add New Code

**New Feature (e.g., new entity type):**

1. **Database Model:**
   - Create `backend/app/db/models/[entity].py`
   - Inherit from `Base`
   - Define columns with type hints and ForeignKey relationships
   - Add indexes on filtered/sorted columns
   - Run `alembic revision --autogenerate -m "add [entity] table"`
   - Run `alembic upgrade head`

2. **API Schema:**
   - Create `backend/app/api/v1/schemas/[entity].py`
   - Define `Create`, `Update`, `Response`, `ListResponse` classes
   - Add field validators for business rules

3. **Endpoint:**
   - Create `backend/app/api/v1/endpoints/[entity].py`
   - Implement GET /list, POST /create, PUT /{id}/update, DELETE /{id}
   - Use DataContext for multi-tenant safety
   - Include error handling
   - Register in `backend/app/api/v1/router.py`

4. **Service (if business logic):**
   - Create `backend/app/services/[entity]_service.py`
   - Call from endpoints
   - Example: `forecast_service.py` calculates cash flow

5. **Frontend Page:**
   - Create `frontend/src/pages/[Entity]Page.tsx`
   - Use React Query (useQuery, useMutation) for API calls
   - Add to `frontend/src/router.tsx` route tree

6. **Frontend API Client:**
   - Create `frontend/src/api/[entity].ts` or add to existing
   - Export functions: `list()`, `create()`, `update()`, `delete()`

7. **Tests:**
   - Add `backend/tests/test_[entity].py` for pytest
   - Verify CRUD operations, edge cases, org isolation

**New Component/Module (UI):**

1. Create in `frontend/src/components/[category]/[Component].tsx`
2. Use TypeScript for props: `interface Props { ... }`
3. Use Tailwind CSS classes (no inline styles)
4. Export as named export + default (for lazy loading)
5. Use i18n for all text: `i18n.t('key')`
6. Accessibility: aria labels, semantic HTML, keyboard navigation

**New Utility/Helper:**

- Shared helpers: `frontend/src/lib/utils.ts` or `backend/app/utils/__init__.py`
- Domain-specific: in appropriate service/module
- React hooks: `frontend/src/hooks/use[Feature].ts`

## Special Directories

**backend/alembic/versions/**
- Purpose: Database migration history
- Generated: Auto-generated from model changes via `alembic revision --autogenerate`
- Committed: Yes, tracked in git for reproducibility
- Pattern: Each migration is a Python script with `upgrade()` and `downgrade()`

**backend/logs/**
- Purpose: Application runtime logs
- Generated: During app execution
- Committed: No (in .gitignore)
- Format: JSON structured logs or plain text depending on DEBUG setting

**backend/tests/pytest_cache/**
- Purpose: Pytest caching for faster test runs
- Generated: Automatically by pytest
- Committed: No (in .gitignore)

**frontend/dist/**
- Purpose: Production build output
- Generated: `npm run build` command
- Committed: No (in .gitignore)
- Contains: Minified JS, CSS, static assets

**frontend/node_modules/**
- Purpose: npm dependencies
- Generated: `npm install`
- Committed: No (in .gitignore)

**.planning/codebase/**
- Purpose: GSD (Granular Specification Documents) for code analysis
- Generated: By GSD orchestrator
- Committed: Yes (guides future implementations)
- Documents: ARCHITECTURE.md, STRUCTURE.md, STACK.md, INTEGRATIONS.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

---

*Structure analysis: 2026-02-24*
