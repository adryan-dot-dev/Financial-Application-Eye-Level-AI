# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- Backend Python: `snake_case.py` (e.g., `forecast_service.py`, `auth.py`, `conftest.py`)
- Frontend TypeScript: `camelCase.tsx` or `PascalCase.tsx` for components (e.g., `AuthContext.tsx`, `ThemeContext.tsx`, `DatePicker.tsx`)
- Backend schemas: `snake_case.py` inside `app/api/v1/schemas/` (e.g., `auth.py`, `transaction.py`, `installment.py`)
- Backend models: `snake_case.py` inside `app/db/models/` (e.g., `user.py`, `transaction.py`, `category.py`)
- Backend services: `snake_case.py` with `_service` suffix (e.g., `forecast_service.py`, `budget_service.py`)
- Backend endpoints: `snake_case.py` matching resource names (e.g., `transactions.py`, `auth.py`, `categories.py`)
- Frontend pages: `PascalCase.tsx` with `Page` suffix (e.g., `DashboardPage.tsx`, `TransactionsPage.tsx`)
- Frontend components: `PascalCase.tsx` (e.g., `ObligoWidget.tsx`, `BudgetProgressBar.tsx`, `DatePicker.tsx`)

**Functions:**
- Backend: `snake_case` (e.g., `get_current_balance()`, `_fetch_forecast_data()`, `hash_password()`)
- Frontend: `camelCase` (e.g., `useAuth()`, `handleSubmit()`, `formatCurrency()`)
- Frontend hooks: `useXxxx` pattern (e.g., `useAuth()`, `useTheme()`, `useToast()`)
- Private/internal functions: Leading underscore in Python (e.g., `_ensure_ctx()`, `_safe_day()`)
- Async functions: No special suffix - use `async def` or `async function` based on language

**Variables:**
- Backend constants: `UPPER_CASE` (e.g., `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`)
- Backend variables: `snake_case` (e.g., `user_id`, `current_balance`, `fixed_items`)
- Frontend constants: `UPPER_CASE` or `camelCase` depending on scope (e.g., `const DEFAULT_PAGE_SIZE = 20`)
- Frontend variables: `camelCase` (e.g., `isLoading`, `userName`, `transactionList`)
- React state: `camelCase` (e.g., `const [isAuthenticated, setIsAuthenticated] = useState()`)

**Types:**
- Backend Pydantic models: `PascalCase` (e.g., `UserResponse`, `TransactionCreate`, `TokenResponse`)
- Backend response schemas: Suffix with `Response` (e.g., `UserResponse`, `TransactionListResponse`)
- Backend request schemas: Suffix with `Create`, `Update`, or specific action (e.g., `TransactionCreate`, `TransactionUpdate`, `UserRegister`)
- Frontend TypeScript interfaces: `PascalCase` with prefix indicating scope (e.g., `User`, `Transaction`, `AuthContextValue`)
- Enums: `PascalCase` (e.g., `UserRole`, `TransactionType`)

## Code Style

**Formatting:**
- Frontend: ESLint with TypeScript support (see `frontend/eslint.config.js`)
- Frontend TypeScript: ES2022 target, strict mode enabled
- Backend: PEP 8 conventions (implicit via Pydantic and FastAPI patterns)
- Line length: No strict limit enforced by linter, but follow language conventions
- Indentation: 2 spaces (frontend), 4 spaces (backend)

**Linting:**
- Frontend: ESLint (eslint@^9.39.1) with plugins:
  - `@eslint/js` for JavaScript recommendations
  - `typescript-eslint` for TypeScript checks
  - `eslint-plugin-react-hooks` for React hooks rules
  - `eslint-plugin-react-refresh` for React refresh compatibility
- Backend: No formal linter - rely on type hints and Pydantic validation
- Run: `npm run lint` in frontend directory

**Type Safety:**
- Frontend: `verbatimModuleSyntax: true` in `tsconfig.app.json` - use `import type` for type-only imports
- Frontend: `noUnusedLocals: true`, `noUnusedParameters: true`, `strict: true`
- Backend: `from __future__ import annotations` at top of every file (Python 3.9 compatibility)
- Backend: Explicit type hints on all function signatures (params and return types)
- Backend: Never use `any` / `dict` without type specification unless truly generic

## Import Organization

**Order:**
1. Future imports (`from __future__ import annotations`)
2. Standard library (Python: `os`, `sys`, `datetime`, etc.; JavaScript: none typically)
3. Third-party libraries (FastAPI, SQLAlchemy, React, etc.)
4. Local application imports (app.*, models, schemas, etc.)
5. Empty line between groups

**Path Aliases:**
- Frontend: `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`)
  - Example: `import { AuthContext } from '@/contexts/AuthContext'`
  - Example: `import type { User } from '@/types'`
- Backend: No path aliases - use absolute imports from package root
  - Example: `from app.services.forecast_service import get_current_balance`
  - Example: `from app.db.models import User, Transaction`

**Example - Frontend:**
```typescript
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { LoginRequest, RegisterRequest, User } from '@/types'
import { authApi } from '@/api/auth'
import { queryClient } from '@/lib/queryClient'
```

**Example - Backend:**
```python
from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, DataContext
from app.api.v1.schemas.transaction import TransactionResponse
from app.db.models import Transaction, User
from app.services.forecast_service import get_current_balance
```

## Error Handling

**Patterns:**
- Backend: Custom exception classes in `app/core/exceptions.py` (e.g., `AlreadyExistsException`, `UnauthorizedException`, `NotFoundException`)
- Backend: HTTPException wrapping with semantic status codes:
  - 400: Bad request (validation error)
  - 401: Unauthorized (auth required or invalid)
  - 403: Forbidden (auth required or insufficient permissions)
  - 404: Not found
  - 409: Conflict (e.g., duplicate username, resource already exists)
  - 422: Unprocessable entity (data validation error, FK violations, etc.)
  - 500: Internal server error (unhandled exceptions)
- Backend: All exceptions logged with context before re-raising or converting to HTTP response
- Backend: Global exception handler in `app/main.py` catches unhandled exceptions and never leaks stack traces in production
- Frontend: Error boundary component catches React component errors (`ErrorBoundary` in `src/components/ErrorBoundary.tsx`)
- Frontend: API call errors caught with try-catch, user notified via toast or error message
- Frontend: Context hooks throw descriptive Error if used outside their provider (e.g., "useAuth must be used within an AuthProvider")

**Example - Backend:**
```python
from app.core.exceptions import UnauthorizedException, AlreadyExistsException

# Raise custom exception
if not user or not verify_password(data.password, user.password_hash):
    raise UnauthorizedException("Invalid username or password")

if result.scalar_one_or_none():
    raise AlreadyExistsException("Username")
```

**Example - Frontend:**
```typescript
const { user, isLoading } = useAuth()
// Throws: "useAuth must be used within an AuthProvider"

try {
  const response = await authApi.login(credentials)
} catch (error) {
  throw error  // Error boundary or caller handles
}
```

## Logging

**Framework:**
- Backend: Python `logging` module with structured logging via `app/core/logging_config.py`
- Backend: Log level configured via DEBUG setting (debug in dev, warnings+ in prod)
- Backend: Logger instance: `logger = logging.getLogger(__name__)`
- Frontend: No centralized logging framework - use `console.log/warn/error` for debugging only
- Backend audit logging: `app/services/audit_service.py` logs actions (login, register, CRUD operations)

**Patterns:**
- Backend: Log at DEBUG level for internal flow, INFO for important events, WARNING for issues, ERROR for failures
- Backend: Include context: user_id, entity_id, action type
- Backend: Never log passwords, tokens, or sensitive data
- Backend: Exception handler logs stack trace at exception level, never exposes to client

**Example - Backend:**
```python
logger = logging.getLogger(__name__)

logger.info("Application started - scheduler initialized")
logger.warning("Data error: %s", exc)
logger.exception("Unhandled exception: %s", exc)  # Includes stack trace

await log_action(db, user_id=user.id, action="login", entity_type="user", entity_id=str(user.id), request=request)
```

## Comments

**When to Comment:**
- Explain WHY, not WHAT (code structure explains WHAT)
- Complex business logic or non-obvious algorithms
- Workarounds or temporary solutions - mark with `TODO` or `FIXME`
- Deviations from standard patterns or conventions
- Performance optimizations or gotchas (e.g., bcrypt performance note in conftest)

**JSDoc/TSDoc:**
- Frontend: Not strictly required but use for exported functions/components
- Backend: Use docstrings for public functions and services
- Pydantic models: Include field descriptions via `Field(..., description="...")`

**Example - Backend:**
```python
async def _fetch_forecast_data(
    db: AsyncSession, user_id: UUID = None, *, ctx: Optional[DataContext] = None,
) -> Tuple[list, list, list, dict, list]:
    """Fetch all data needed for forecast in parallel-ready queries.

    Returns (fixed_items, installments, loans, expected_incomes_dict, subscriptions).
    """

async def _safe_day(year: int, month: int, day: int) -> date:
    """Handle day_of_month > days in month (e.g., 31 in April)."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))
```

## Function Design

**Size:**
- Keep functions under 50 lines when possible
- If longer, consider extracting helper functions or breaking into service methods
- Private helper functions (leading `_`) acceptable if 10-20 lines

**Parameters:**
- Positional parameters first, optional/keyword parameters last
- For multiple options or complex configs, use dataclass or schema (e.g., `DataContext`)
- Backend async functions: explicit `AsyncSession` dependency injection via `Depends(get_db)`
- Frontend hooks: no parameters beyond custom hook options

**Return Values:**
- Explicit type hints on all returns
- Backend async functions return the actual result, not futures
- Consider returning Pydantic schemas for API responses
- Return Optional[T] explicitly when None is possible (not implicitly None)

**Example - Backend:**
```python
async def get_current_balance(
    db: AsyncSession, user_id: UUID = None, *, ctx: Optional[DataContext] = None,
) -> Decimal:
    """Get the user's current bank balance."""
    ctx = _ensure_ctx(user_id=user_id, ctx=ctx)
    result = await db.execute(
        select(BankBalance).where(
            ctx.ownership_filter(BankBalance),
            BankBalance.is_current == True,
        )
    )
    balance = result.scalar_one_or_none()
    return balance.balance if balance else Decimal("0")
```

**Example - Frontend:**
```typescript
async function login(data: LoginRequest): Promise<void> {
  // Clear cached state
  sessionStorage.removeItem('onboarding_completed')

  // Fetch tokens
  const response = await authApi.login(data)
  localStorage.setItem('access_token', response.access_token)

  // Update state
  const userData = await authApi.getMe()
  setUser(userData)
}
```

## Module Design

**Exports:**
- Backend: Import specific items (not `import *`)
- Frontend: Export named components and functions, not defaults (aids refactoring)
- Use explicit `__all__` in backend modules for clarity (optional but recommended)

**Barrel Files:**
- Backend: `app/db/models/__init__.py` re-exports all models
- Backend: `app/api/v1/endpoints/` modules not barrel-exported individually
- Frontend: Individual file imports preferred, no barrel files in main src

**Example - Backend barrel:**
```python
# app/db/models/__init__.py
from app.db.models.user import User
from app.db.models.transaction import Transaction
from app.db.models.category import Category
# ... etc

__all__ = ["User", "Transaction", "Category", ...]
```

**Example - Frontend import:**
```typescript
// GOOD
import { UserResponse } from '@/api/user'
import type { User } from '@/types'

// BAD
import * as userModule from '@/api/user'
```

## Validation

**Input Validation:**
- Backend: Pydantic `BaseModel` with field validators on all schemas
- Backend: Regex validators on username/email/password fields
- Backend: Enum validators on type fields (income/expense, etc.)
- Backend: Range validators on numeric fields via `Query()` and `Field()`
- Frontend: Type checking via TypeScript - no runtime Zod/Joi validation (assume server validates)

**Example - Backend Pydantic:**
```python
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
            raise ValueError("Username may only contain letters, digits, underscores, dots, and hyphens")
        return v
```

## API Design

**Endpoint Patterns:**
- Base path: `/api/v1/`
- Resource-based: `/api/v1/{resource}`, `/api/v1/{resource}/{id}`, `/api/v1/{resource}/{id}/{sub-resource}`
- Verbs: GET (retrieve), POST (create), PUT/PATCH (update), DELETE (delete)
- Query params: pagination (`page`, `page_size`), filtering (`category_id`, `type`), sorting (`sort_by`, `sort_order`)
- Response schemas: `{items, total, page, page_size, pages}` for list endpoints

**Request/Response:**
- Request body: POST/PUT use JSON with schema validation
- Query params: Type hints with defaults (e.g., `page: int = Query(1, ge=1)`)
- Pagination: Optional, defaults to `page=1, page_size=20, max=100`
- Response: Always JSON, wrapped in schema matching domain language

**Example:**
```python
@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: Optional[UUID] = None,
    sort_by: str = Query("date", pattern="^(date|amount|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Implementation
```

## Security Conventions

**Authorization:**
- Backend: `get_current_user` dependency injects authenticated user
- Backend: `DataContext` provides ownership filter to ensure user only accesses their own data
- Backend: All queries wrap with `ctx.ownership_filter(Model)` to prevent IDOR
- Frontend: `ProtectedRoute` component checks `isAuthenticated` before rendering
- Frontend: Redirect to login if auth context returns loading=false and no user

**Data Handling:**
- Financial amounts: Always `Decimal` type, never float
- Sensitive data: Never log passwords, tokens, or full credit card numbers
- User input: Sanitize HTML tags in text fields (see `sanitize_full_name` in auth schema)
- Database: Use parameterized queries (SQLAlchemy ORM handles this)

**Token Management:**
- Backend: JWT with short-lived access token (15 min) and longer-lived refresh token (7 days)
- Frontend: Access token stored in `localStorage` (consider httpOnly cookie for production)
- Frontend: Refresh token stored in `localStorage` (consider httpOnly cookie for production)
- Backend: Token blacklist for logout/invalidation (in-memory set during session)

---

*Conventions analysis: 2026-02-24*
