# TESTING.md — Test Structure & Practices

## Focus: quality
**Codebase:** Financial-Application-Eye-Level-AI

---

## Backend Testing

### Framework
- **pytest** + **pytest-asyncio** for async test support
- **httpx** `AsyncClient` for API endpoint testing
- **SQLAlchemy** with `NullPool` for test database isolation

### Structure
- **Test root:** `backend/tests/`
- **Config:** `backend/tests/conftest.py` (fixtures)
- **~46 test files** organized by module
- Current passing: **155 tests** (Phase 2 completion)

### Test Database
- Separate database: `cashflow_test` (not the dev DB)
- Uses `NullPool` to avoid connection sharing between tests
- Cleanup via `DELETE` statements (not `TRUNCATE`) to avoid deadlocks
- Full schema reset between test sessions via Alembic migrations

### Key Fixtures (conftest.py)
```python
# Async client for API calls
@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    ...

# Auth headers for regular user
@pytest.fixture
async def auth_headers(client) -> dict:
    ...

# Auth headers for admin user
@pytest.fixture
async def admin_headers(client) -> dict:
    ...

# Database session
@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    ...
```

### Performance Optimizations
- **bcrypt hash caching** — admin user password hash computed once and reused across tests
- Fixtures scoped to `session` where possible to reduce setup overhead

### Test Categories
- **Auth tests:** Registration, login, token refresh, logout
- **CRUD tests:** Create/Read/Update/Delete for all 10 API modules
- **Authorization tests:** Role-based access, user isolation
- **Financial precision tests:** Verify DECIMAL(15,2) handling, no float drift
- **Edge case tests:** 88 edge cases added in Phase 2.5 (security hardening)
- **Validation tests:** Input validation, boundary values

### Known Test Gaps (from api_test.py)
The following bugs are documented but NOT yet fixed:
- Zero/negative amounts not rejected
- Non-admin users can list all users
- Data isolation not enforced in some endpoints
- Duplicate categories allowed

### Running Tests
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. pytest tests/ -v
# Run specific module:
PYTHONPATH=. pytest tests/test_transactions.py -v
# Run with coverage:
PYTHONPATH=. pytest tests/ --cov=app --cov-report=html
```

---

## Frontend Testing

### Current State
- **No test configuration observed** in Phase 4 deliverables
- No `vitest.config.ts` or `jest.config.ts` found
- Frontend testing is a Phase 5 gap to address

### Recommended Setup (not yet implemented)
- **Vitest** for unit/component tests (compatible with Vite)
- **React Testing Library** for component tests
- **Playwright** or **Cypress** for E2E tests

---

## API Coverage
- **33 routes** tested in Phase 1
- **67 routes** tested in Phase 2
- All 10 API modules covered: transactions, categories, fixed, installments, loans, balance, forecast, alerts, settings, dashboard

---

## CI/CD
- No automated CI pipeline observed (no `.github/workflows/`)
- Tests run manually via `pytest` command
- Phase 5 goal: add frontend tests + E2E coverage
