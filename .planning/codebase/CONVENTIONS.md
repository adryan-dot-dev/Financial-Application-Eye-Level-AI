# CONVENTIONS.md — Code Style & Patterns

## Focus: quality
**Codebase:** Financial-Application-Eye-Level-AI

---

## Backend (Python / FastAPI)

### Naming
- **snake_case** for all Python: modules, functions, variables, file names
- **PascalCase** for SQLAlchemy models and Pydantic schemas
- **UPPER_SNAKE_CASE** for constants and environment variable names

### Python 3.9 Compatibility (CRITICAL)
- `from __future__ import annotations` **required at the top of every file**
- No `X | Y` union syntax — use `Optional[X]` or `Union[X, Y]`
- `eval-type-backport==0.3.1` and `bcrypt==4.0.1` pinned in requirements

### Type Hints
- Explicit type hints required throughout all backend code
- Use `Optional[X]` not `X | None`
- Pydantic v2 schemas for all request/response models

### Error Handling
- Custom exception classes inherit from FastAPI's `HTTPException`
- Raise HTTP exceptions at the router level, not in services
- Services return data or raise domain exceptions

### Dependency Injection
- FastAPI `Depends()` pattern for DB sessions, auth, settings
- Auth guard: `current_user: User = Depends(get_current_user)`
- DB session: `db: AsyncSession = Depends(get_db)`

### API Structure
- All routes under `/api/v1/` prefix
- Router files in `backend/app/api/`
- Services in `backend/app/services/`
- Models in `backend/app/models/`
- Schemas in `backend/app/schemas/`

### Database
- SQLAlchemy 2.0 async with `AsyncSession`
- Always use `await db.commit()` / `await db.refresh()`
- Financial values: `DECIMAL(15,2)` — never use Python `float` for money
- Use `Decimal` type from `decimal` module for arithmetic
- Currency: `VARCHAR(3) DEFAULT 'ILS'` on all financial tables

### Soft Delete
- Categories use `is_archived` bool (soft delete), not hard delete
- Other entities use hard delete

---

## Frontend (TypeScript / React)

### Naming
- **camelCase** for variables, functions, hooks
- **PascalCase** for React components and TypeScript interfaces/types
- **kebab-case** for file names: `transaction-form.tsx`
- Hook files: `useTransactions.ts`, `useAuth.ts`

### TypeScript
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- Strict mode enabled
- Path alias `@/` maps to `src/`

### State Management
- **React Query (TanStack Query)** for all server state / API calls
- **React Context** for auth (`AuthContext`) and theme (`ThemeContext`)
- No Redux or Zustand — keep it simple

### Styling
- **Tailwind CSS v4** with `@theme` directive (NOT v3 `@tailwind` directives)
- CSS custom properties for dark/light mode theming
- Brand gradient: cyan → blue → purple → magenta
- RTL-aware layout (Hebrew default)

### Internationalization
- i18next with Hebrew (default, RTL) and English
- All UI strings must be in i18n translation files
- Direction: `dir="rtl"` for Hebrew, `dir="ltr"` for English

### Component Patterns
- Functional components only (no class components)
- Custom hooks for data fetching logic
- `lucide-react` for all icons
- `Recharts` for all charts/visualizations

### Linting
- ESLint configured with strict rules for frontend
- No backend linter currently enforced

---

## Git Conventions
- Commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` prefixes
- Branch-per-feature, merged to main
