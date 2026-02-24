# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Runner:**
- Backend: pytest 8.3.4 with pytest-asyncio 0.25.0 for async support
- Frontend: No test infrastructure currently installed (vitest intended but not yet configured)
- Config: `backend/pytest.ini` with settings:
  - `asyncio_mode = auto` - Enables async test support automatically
  - `testpaths = tests` - Tests in `backend/tests/` directory
  - `pythonpath = .` - Allows imports from package root

**Assertion Library:**
- Backend: pytest's built-in assertions (simple `assert` statements)
- No additional assertion library used

**Run Commands:**
```bash
# Backend tests (from project root)
cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v

# Backend tests with coverage (if needed)
# cd backend && pytest tests/ --cov=app --cov-report=html

# Backend specific test file
cd backend && pytest tests/test_auth.py -v

# Backend tests matching pattern
cd backend && pytest tests/ -k "test_login" -v
```

**Frontend:**
No test runner currently configured. When Vitest is set up, commands would be:
```bash
# From project root
cd frontend && npm test
cd frontend && npm run test:watch
cd frontend && npm run test:coverage
```

## Test File Organization

**Location:**
- Backend: `backend/tests/` directory at same level as `backend/app/`
- Frontend: Not yet established (would typically be `frontend/src/__tests__/` or co-located `*.test.tsx`)

**Naming:**
- Backend: `test_*.py` prefix for test modules (e.g., `test_auth.py`, `test_transactions.py`, `test_loans.py`)
- Test functions: `test_*` prefix (e.g., `test_login_admin()`, `test_register_and_login()`)

**Structure:**
```
backend/tests/
├── conftest.py                      # Fixtures, setup, teardown
├── test_auth.py                     # Authentication tests (33+ tests)
├── test_transactions.py             # Transaction CRUD tests
├── test_categories.py               # Category management tests
├── test_loans.py                    # Loan tracking tests
├── test_installments.py             # Installment tests
├── test_alerts.py                   # Alert generation tests
├── test_dashboard.py                # Dashboard aggregation tests
├── test_forecast.py                 # Forecast calculation tests
├── test_bank_accounts.py            # Bank account tests
├── test_credit_cards.py             # Credit card tests
├── test_users_admin.py              # User management tests
├── test_edge_cases_v2.py            # Edge case coverage (88+ tests)
├── test_financial_precision.py      # DECIMAL precision tests
├── test_concurrent_access.py        # Concurrency and race conditions
├── test_middleware_and_hardening.py # Security middleware tests
├── test_rate_limiting.py            # Rate limiter tests
├── test_cross_module_integration.py # Integration across modules
├── test_backups.py                  # Backup/restore tests
└── test_pagination_edge_cases.py    # Pagination boundary tests
```

## Test Structure

**Suite Organization:**
Backend tests use pytest's marker system and function grouping. No explicit test classes:

```python
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_login_admin(client: AsyncClient):
    response = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "Admin2026!",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
```

**Patterns:**
- All tests are async functions marked with `@pytest.mark.asyncio`
- Each test is independent (auto-cleanup via conftest fixture)
- Test names describe scenario and expected outcome: `test_login_admin()`, `test_login_wrong_password()`
- Assertions are simple: `assert response.status_code == 200`, `assert field_name == expected_value`

## Fixtures

**Core Fixtures (from `backend/tests/conftest.py`):**

1. **`event_loop`** (session-scoped):
   - Provides asyncio event loop for entire test session
   - Cleanup runs after all tests complete

2. **`db`** (function-scoped):
   - AsyncSession connected to test database (`cashflow_test`)
   - Yields session for test to use
   - Auto-closed after test

3. **`client`** (function-scoped):
   - AsyncClient pointing to FastAPI test app
   - Uses ASGI transport for in-process testing (no HTTP server)
   - Yields client for making requests

4. **`auth_headers`** (function-scoped):
   - Logs in as admin and returns Authorization header dict
   - Format: `{"Authorization": "Bearer <token>"}`
   - Usage: `response = await client.get(url, headers=auth_headers)`

5. **`cleanup`** (function-scoped, autouse):
   - Runs before each test automatically
   - Clears token blacklist
   - Deletes all test data in correct FK order
   - Re-creates admin user and seed categories
   - Ensures test isolation

**Example Usage:**
```python
@pytest.mark.asyncio
async def test_list_transactions(client: AsyncClient, auth_headers: dict, db: AsyncSession):
    # DB is fresh (via cleanup fixture)
    # Client is ready to make requests
    response = await client.get("/api/v1/transactions", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] == 0  # Fresh DB
```

## Test Database Setup

**Isolation:**
- Test database: `cashflow_test` (separate from dev database `cashflow`)
- Created via: `DATABASE_URL="...cashflow_test" alembic upgrade head`
- Connection pooling: `NullPool` (no connection caching between tests)
- Async engine: SQLAlchemy 2.0 async with asyncpg

**Pre-test Setup:**
- Kill stale connections from prior test runs (prevents deadlocks)
- Delete all data in FK-safe order (NOT TRUNCATE - causes deadlocks)
- Insert admin user (triggers prevent deletion)
- Insert 13 seed categories
- Clear token blacklist

**Important Notes:**
- Uses DELETE not TRUNCATE (TRUNCATE requires AccessExclusiveLock, deadlocks with async sessions)
- Uses PostgreSQL upsert (`INSERT ... ON CONFLICT DO UPDATE`) to atomically handle both fresh and existing admin
- Respects database triggers (e.g., `trg_prevent_admin_delete` blocks admin deletion)

```python
# From conftest.py - DELETE order respects FK constraints
await session.execute(AuditLog.__table__.delete())           # No FK deps
await session.execute(ExpenseApproval.__table__.delete())    # Org tables
await session.execute(Transaction.__table__.delete())        # FK to categories
await session.execute(CreditCard.__table__.delete())
await session.execute(BankAccount.__table__.delete())
await session.execute(Category.__table__.delete())           # Categories
await session.execute(User.__table__.delete().where(...))    # Non-admin only
```

## Mocking

**Framework:**
- Backend: No explicit mocking library (could use `unittest.mock` if needed)
- Backend: Prefers real database + fixtures over mocking
- Tests hit real async database to verify ORM behavior and SQL

**Patterns:**
- **No mocking of database:** Tests use real test database to catch SQL/ORM issues
- **No mocking of async operations:** Let async code run naturally to catch race conditions
- **Rate limiter disabled:** Set `limiter.enabled = False` in conftest to allow unlimited requests during tests

**What NOT to Mock:**
- Database queries (use test DB instead)
- Async/await behavior (let it run naturally)
- Response schemas (test serialization and validation)

**When to Mock (if needed):**
- External APIs (Stripe, bank webhooks) - not yet required in Phase 5
- System time for scheduling tests - not yet implemented
- Email/SMS sending - not yet required

## Test Coverage

**Current Status:**
- Backend: 155+ tests pass (as of Phase 2)
- Coverage areas:
  - Authentication: 15+ tests (login, register, token refresh, logout)
  - Transactions: 20+ tests (CRUD, filters, pagination, sorting)
  - Forecasting: 30+ tests (calculation accuracy, edge cases)
  - Financial precision: 25+ tests (DECIMAL rounding, currency handling)
  - Concurrency: 20+ tests (race conditions, overlapping transactions)
  - Edge cases: 88+ tests (boundary conditions, malformed input)
  - Rate limiting: 10+ tests (per-endpoint limits)
  - Security: 15+ tests (IDOR prevention, authorization checks)

**Requirements:**
- No formal coverage threshold enforced
- Target: >80% for critical paths (auth, transactions, forecast)
- All CRUD endpoints have at least happy path + error case tests

**View Coverage:**
```bash
# If coverage installed
cd backend && pytest tests/ --cov=app --cov-report=html
# Then open htmlcov/index.html
```

## Test Types

**Unit Tests:**
- Scope: Individual functions or service methods
- Approach: Isolated tests with real database fixtures
- Examples:
  - `test_login_admin()` - Tests auth endpoint
  - `test_list_transactions_filter_by_date()` - Tests query filtering
  - `test_forecast_calculation_accuracy()` - Tests forecast math

**Integration Tests:**
- Scope: Multiple services working together
- Approach: Real database + real API calls
- Examples:
  - `test_create_transaction_updates_balance()` - Transaction + Balance interaction
  - `test_forecast_uses_fixed_and_variable_income()` - Forecast combining multiple sources
  - `test_concurrent_transaction_creation()` - Race condition handling

**E2E Tests:**
- Status: Not yet implemented (planned for Phase 5)
- Framework: Would use Playwright or Cypress for browser automation
- Scope: Full user workflows (login → create transaction → view forecast)

## Common Patterns

**Async Testing:**
```python
@pytest.mark.asyncio
async def test_create_transaction(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/transactions",
        headers=auth_headers,
        json={
            "date": "2026-02-24",
            "amount": "100.50",
            "type": "income",
            "category_id": "...",
            "description": "Salary"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "100.50"
    assert data["is_recurring"] is False
```

**Error Testing:**
```python
@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    response = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "WrongPass9",
    })
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data

@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient):
    response = await client.post("/api/v1/auth/register", json={
        "username": "admin",  # Already exists
        "email": "other@example.com",
        "password": "TestPass1",
    })
    assert response.status_code == 409  # Conflict
```

**Authorization Testing:**
```python
@pytest.mark.asyncio
async def test_list_transactions_requires_auth(client: AsyncClient):
    response = await client.get("/api/v1/transactions")
    assert response.status_code == 403  # Forbidden without auth

@pytest.mark.asyncio
async def test_user_cannot_access_other_users_transactions(
    client: AsyncClient,
    db: AsyncSession
):
    # Create user1, user2, transaction for user1
    # Login as user2
    # Verify user2 cannot fetch user1's transaction
    assert response.status_code == 404  # Not found in user2's context
```

**Pagination Testing:**
```python
@pytest.mark.asyncio
async def test_list_transactions_pagination(client: AsyncClient, auth_headers: dict):
    # Create 50 transactions
    for i in range(50):
        await client.post(...)

    # First page
    response = await client.get(
        "/api/v1/transactions?page=1&page_size=20",
        headers=auth_headers
    )
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 20
    assert data["total"] == 50
    assert data["pages"] == 3
    assert len(data["items"]) == 20

    # Last page
    response = await client.get(
        "/api/v1/transactions?page=3&page_size=20",
        headers=auth_headers
    )
    data = response.json()
    assert len(data["items"]) == 10  # 50 % 20
```

**Financial Precision Testing:**
```python
@pytest.mark.asyncio
async def test_decimal_precision_in_transactions(client: AsyncClient, auth_headers: dict):
    # Test amounts with cents
    response = await client.post(
        "/api/v1/transactions",
        headers=auth_headers,
        json={
            "date": "2026-02-24",
            "amount": "123.45",
            "type": "income",
            "category_id": "...",
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "123.45"  # Not "123.4499999"
```

## Best Practices

1. **Test isolation:** Each test is independent via `cleanup` fixture
2. **No flaky tests:** Tests don't depend on timing or external services
3. **Descriptive names:** Test name tells you what's being tested and what should happen
4. **Explicit assertions:** Use `assert x == y`, not vague `assert result`
5. **Real database:** Don't mock the DB - use test database instead
6. **Test data freshness:** Each test gets clean DB state via cleanup fixture
7. **Async correctness:** Mark all async tests with `@pytest.mark.asyncio`
8. **Error cases:** Test both happy path (201/200) and error paths (400/401/409)
9. **Authorization first:** If endpoint requires auth, test unauthorized case before happy path
10. **Performance aware:** Tests run in parallel-friendly manner (NullPool prevents connection conflicts)

---

*Testing analysis: 2026-02-24*
