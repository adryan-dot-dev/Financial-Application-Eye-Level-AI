# STRUCTURE.md — Directory Layout & Organization

## Focus: arch
**Codebase:** Financial-Application-Eye-Level-AI

---

## Root Structure

```
Financial-Application-Eye-Level-AI/
├── backend/                    # FastAPI Python backend
├── frontend/                   # React TypeScript frontend
├── scripts/                    # DB maintenance scripts
├── agents/                     # Multi-agent coordination docs
├── .planning/                  # GSD planning docs
├── .claude/                    # Claude Code rules/hooks/skills
├── pgadmin/                    # pgAdmin config
├── PLAN.md                     # Phase roadmap
├── CLAUDE.md                   # Claude project instructions
├── README.md                   # Project documentation
├── api_test.py                 # Root-level integration test script
├── promote_admin.py            # Admin user promotion utility
└── *.md                        # Various prompt/audit documents
```

---

## Backend Structure (`backend/`)

```
backend/
├── app/
│   ├── main.py                 # FastAPI app factory, middleware, lifespan
│   ├── api/
│   │   ├── deps.py             # Shared dependencies (get_db, get_current_user)
│   │   └── v1/
│   │       └── endpoints/      # Route handlers (one file per domain)
│   │           ├── auth.py
│   │           ├── transactions.py
│   │           ├── categories.py
│   │           ├── fixed.py
│   │           ├── installments.py
│   │           ├── loans.py
│   │           ├── balance.py
│   │           ├── forecast.py
│   │           ├── alerts.py
│   │           ├── settings.py
│   │           ├── dashboard.py    # ⚠ 1,236 lines — needs modularization
│   │           ├── users.py
│   │           ├── organizations.py
│   │           ├── budgets.py
│   │           ├── credit_cards.py
│   │           ├── bank_accounts.py
│   │           ├── currency.py
│   │           ├── backups.py
│   │           ├── export.py
│   │           ├── subscriptions.py
│   │           ├── automation.py
│   │           └── expected_income.py
│   ├── core/
│   │   ├── config.py           # Settings via pydantic-settings
│   │   ├── security.py         # JWT, password hashing, token blacklist
│   │   ├── database.py         # SQLAlchemy async engine, session factory
│   │   └── scheduler.py        # APScheduler for recurring charges
│   ├── models/                 # SQLAlchemy ORM models
│   ├── schemas/                # Pydantic v2 request/response schemas
│   └── services/               # Business logic layer
│       └── alert_service.py    # ⚠ 1,098 lines — needs splitting
├── tests/
│   ├── conftest.py             # pytest fixtures (client, auth_headers, db)
│   └── test_*.py               # ~46 test files, one per module
├── alembic/
│   ├── env.py                  # Alembic async config
│   ├── script.py.mako
│   └── versions/               # ~20 migration files
├── alembic.ini
├── requirements.txt
├── .env                        # Local dev secrets (NOT committed)
├── .env.example
└── .env.production             # Production env template
```

### Backend Naming Conventions
- Files: `snake_case.py`
- Models: `PascalCase` (e.g., `Transaction`, `BankBalance`)
- Schemas: `PascalCase` with suffixes: `TransactionCreate`, `TransactionResponse`
- Endpoints: `snake_case` functions, grouped by resource
- Tests: `test_{module}.py`

---

## Frontend Structure (`frontend/`)

```
frontend/
├── src/
│   ├── main.tsx                # React entry point, providers
│   ├── App.tsx                 # Root component, QueryClientProvider
│   ├── router.tsx              # React Router v7 route definitions
│   ├── index.css               # Tailwind v4 @theme, CSS custom properties
│   ├── api/                    # API client functions (one file per domain)
│   │   ├── client.ts           # Axios instance, interceptors, token refresh
│   │   ├── auth.ts
│   │   ├── transactions.ts
│   │   ├── categories.ts
│   │   ├── fixed.ts
│   │   ├── installments.ts
│   │   ├── loans.ts
│   │   ├── balance.ts
│   │   ├── forecast.ts
│   │   ├── alerts.ts
│   │   ├── settings.ts
│   │   ├── dashboard.ts
│   │   ├── organizations.ts
│   │   ├── budgets.ts
│   │   ├── credit-cards.ts
│   │   ├── bank-accounts.ts
│   │   ├── currency.ts
│   │   ├── backups.ts
│   │   ├── subscriptions.ts
│   │   ├── users.ts
│   │   └── ...
│   ├── pages/                  # Route-level page components
│   │   ├── DashboardPage.tsx
│   │   ├── TransactionsPage.tsx
│   │   ├── FixedPage.tsx
│   │   ├── InstallmentsPage.tsx
│   │   ├── LoansPage.tsx
│   │   ├── CategoriesPage.tsx
│   │   ├── BalancePage.tsx
│   │   ├── ForecastPage.tsx
│   │   ├── AlertsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── OnboardingPage.tsx
│   │   ├── OrganizationPage.tsx
│   │   └── ...
│   ├── components/
│   │   ├── layout/             # AppLayout, Sidebar, Header, BottomNav
│   │   ├── auth/               # ProtectedRoute
│   │   ├── dashboard/          # Dashboard-specific widgets
│   │   ├── organization/       # Org management tabs
│   │   └── ui/                 # Shared UI primitives
│   ├── contexts/
│   │   ├── AuthContext.tsx      # JWT state, auto-validation on mount
│   │   ├── ThemeContext.tsx     # light/dark/system with localStorage
│   │   ├── OrganizationContext.tsx
│   │   └── ToastContext.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useCountUp.ts
│   │   ├── useCurrency.ts
│   │   ├── usePeriodSelector.ts
│   │   └── ...
│   ├── lib/
│   │   ├── queryClient.ts      # TanStack Query client config
│   │   ├── queryKeys.ts        # Centralized query key factory
│   │   └── utils.ts            # Formatting helpers
│   ├── i18n/
│   │   ├── config.ts           # i18next setup (he default, RTL)
│   │   └── locales/
│   │       ├── he.json         # Hebrew translations
│   │       └── en.json         # English translations
│   └── types/
│       └── index.ts            # Shared TypeScript types
├── public/
│   ├── logo.jpeg               # Brand logo
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker (PWA)
├── index.html
├── vite.config.ts              # Vite + path aliases (@/ → src/)
├── tsconfig.app.json
├── package.json
└── eslint.config.js
```

### Frontend Naming Conventions
- Page files: `PascalCase + Page.tsx` (e.g., `TransactionsPage.tsx`)
- Component files: `PascalCase.tsx`
- API files: `kebab-case.ts` (e.g., `credit-cards.ts`)
- Hook files: `camelCase.ts` with `use` prefix (e.g., `useCurrency.ts`)
- Context files: `PascalCase + Context.tsx`

---

## Scripts (`scripts/`)

```
scripts/
├── backup_db.sh            # PostgreSQL dump
├── restore_db.sh           # Restore from dump
├── db_quick_check.sh       # Quick DB health check
├── db_queries_guide.sql    # Reference queries
├── init_db_security.sql    # Row-level security setup
└── view_logs.sh            # Log viewer helper
```

---

## Key File Locations

| Purpose | Path |
|---------|------|
| FastAPI app entry | `backend/app/main.py` |
| DB session factory | `backend/app/core/database.py` |
| JWT / auth logic | `backend/app/core/security.py` |
| Shared API deps | `backend/app/api/deps.py` |
| Test fixtures | `backend/tests/conftest.py` |
| Latest migration | `backend/alembic/versions/b708280a0aad_production_hardening_*.py` |
| React entry | `frontend/src/main.tsx` |
| Route definitions | `frontend/src/router.tsx` |
| API base client | `frontend/src/api/client.ts` |
| Global CSS/theme | `frontend/src/index.css` |
| Query keys | `frontend/src/lib/queryKeys.ts` |
| i18n Hebrew | `frontend/src/i18n/locales/he.json` |
