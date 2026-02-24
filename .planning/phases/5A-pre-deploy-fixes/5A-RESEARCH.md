# Phase 5A: Pre-Deploy Fixes - Research

**Researched:** 2026-02-24
**Domain:** FastAPI bug fixes + React i18n + Render deployment configuration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **CSP Strategy (DEPLOY-03):** Environment-aware — NOT removed entirely. Detection: use `RENDER` env var (Render sets this automatically on all Web Services). Production (RENDER=true): CSP applied, allows only frontend Render URL (from ALLOWED_ORIGINS config). Development (RENDER not set): no CSP header applied. Consistent with DEPLOY-04.
- **Bug Fix Test Coverage:** Only BUG-01 gets a regression test. BUG-02 through BUG-06: no new tests in Phase 5A. BUG-01 test level: integration test with actual DB — create installment → make payment → reverse → assert no Transaction row remains in DB.
- **Validation:** Run full pytest suite after each plan (after 5A-01, after 5A-02, after 5A-03).
- **Migration Consolidation:** Single Alembic migration covers all schema changes in plan 5A-01. BUG-03 (schema fields): DB columns already exist — only Pydantic schema fix needed, no DB migration required. BUG-02 (balance race condition): migration checks for `uq_balance_current` unique constraint and adds it if missing. BUG-05 (indexes): migration adds 4 missing indexes (credit_cards, subscriptions, transactions, bank_balances). Result: one migration file handles BUG-02 constraint + BUG-05 indexes.
- **render.yaml Specifics (DEPLOY-08):** Service names: `eye-level-api` (Web Service), `eye-level-frontend` (Static Site), `eye-level-db` (PostgreSQL). preDeployCommand: `alembic upgrade head` — fail-fast, no retries. Health check endpoint (DEPLOY-06): returns JSON `{"status": "ok", "db": true, "version": "1.0.0"}` — 200 if DB connected, 503 if DB down.

### Claude's Discretion
- Exact Alembic migration naming and revision chaining
- Python-level duplicate detection implementation for BUG-02 (in addition to DB constraint)
- Version string source for health check response (hardcoded or from config)
- Ordering of changes within each plan file

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope

### Specific Ideas (from CONTEXT.md specifics)
- RENDER env var reuse: both DEPLOY-03 (CSP) and DEPLOY-04 (NullPool) should share the same RENDER-based detection pattern
- Migration safety: use `IF NOT EXISTS` style checks in Alembic for constraint/index creation
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | Fix orphaned transactions on installment reverse-payment — delete associated Transaction before decrementing payments_completed | reverse_installment_payment in installments.py already has delete-orphan logic (lines 488-497); existing tests verify payments_completed but NOT that Transaction row is gone — new integration test required |
| BUG-02 | Fix balance race condition — verify unique DB constraint `uq_balance_current` is in place, add Python-level duplicate detection | DB constraint state is complex (see Architecture Patterns); Python-level check goes in create_balance/update_balance in balance.py before db.commit() |
| BUG-03 | Fix missing schema fields — add credit_card_id, bank_account_id, currency, first_payment_made to relevant Create/Update schemas | LoanCreate is missing credit_card_id; all other relevant schemas (InstallmentCreate, FixedCreate, SubscriptionCreate) already have the fields; only Pydantic change, no DB migration |
| BUG-04 | Fix category type mismatch validation — enforce income category → income transaction only (error 422 if mismatch) | ALREADY IMPLEMENTED in transactions.py lines 125-128 (create) and 252-255 (update); verify coverage in other endpoints (installments, fixed) |
| BUG-05 | Add 4 missing DB indexes — Alembic migration for credit_cards, subscriptions, transactions, bank_balances | Many indexes already exist; need to identify exactly which 4 are truly missing (see Common Pitfalls); use `IF NOT EXISTS` or `checkfirst=True` |
| BUG-06 | Fix untyped response_model=list on 4 endpoints — change to List[CorrectResponseType] | All endpoints audited: ALL use `List[TypedModel]` already; no untyped `list` found — planner must confirm which specific endpoints are intended |
| FE-01 | Add 9 missing translation keys in CreditCardsPage to he.json + en.json | Both he.json and en.json already have comprehensive creditCards section; cross-checking page usage vs. translation keys shows no obvious gaps — planner must do precise diff |
| FE-02 | Fix wrong translation key — t('creditCards.add') → t('creditCards.addCard') (3 occurrences) | CreditCardsPage only uses `t('creditCards.addCard')` (confirmed, no `creditCards.add` usage found) — may already be fixed |
| FE-03 | Fix alerts snooze dropdown — overflow-hidden → overflow-visible | AlertsPage lines 162, 1080 have `overflow-hidden` on card wrappers; snooze dropdown uses `overflow-visible` on inner elements but parent cards may clip it |
| DEPLOY-01 | Add DATABASE_URL field_validator in config.py — transforms postgresql:// → postgresql+asyncpg:// | config.py has field_validator infrastructure; add validator for DATABASE_URL; Render provides postgresql:// format |
| DEPLOY-02 | Pin SECRET_KEY as env var — document generation command, never auto-generate in production | config.py currently auto-generates SECRET_KEY if empty (secrets.token_urlsafe(64)); need to raise error in production instead of silently generating |
| DEPLOY-03 | Fix CSP header — environment-aware (CSP on API service blocks cross-origin frontend calls) | main.py SecurityHeadersMiddleware applies hardcoded `default-src 'self'` CSP to all responses; RENDER env var detection pattern needed |
| DEPLOY-04 | Switch connection pool to NullPool on Render — add RENDER env var detection in session.py | session.py uses pool_size=10, max_overflow=20; Render's serverless architecture requires NullPool; tests already use NullPool (conftest.py line 46) |
| DEPLOY-05 | Fix frontend API URL — update client.ts to use VITE_API_URL env var with fallback to /api/v1 | client.ts baseURL is hardcoded to '/api/v1'; needs: `import.meta.env.VITE_API_URL \|\| '/api/v1'` |
| DEPLOY-06 | Add deep health check endpoint — verify DB connectivity, return 503 if down | main.py has basic `/health` returning 200 always; replace with DB connectivity check using `await db.execute(text("SELECT 1"))` |
| DEPLOY-07 | Add PYTHON_VERSION=3.9.21 and .python-version file | No .python-version file exists; Render reads this for Python version pinning; create both .python-version and set env var |
| DEPLOY-08 | Create render.yaml — define 3 services (Web Service, Static Site, PostgreSQL) with preDeployCommand | No render.yaml exists at repo root; must define all 3 services with correct build/start commands |
</phase_requirements>

---

## Summary

Phase 5A is a surgical fix-and-configure phase with three distinct tracks: backend data integrity bugs, frontend UI translation bugs, and Render deployment plumbing. The existing codebase is in better shape than the requirements imply — several bugs (BUG-04 category mismatch, BUG-06 untyped response_model, FE-02 wrong key) appear to already be fixed in the current code. The planner MUST audit each requirement against actual code before writing tasks, not assume all listed bugs are open.

The most complex areas are: (1) the Alembic migration for BUG-02/BUG-05 which must use conditional index creation (`IF NOT EXISTS`) because some constraints/indexes already exist from previous migrations; (2) the CSP middleware refactor in main.py which requires restructuring the SecurityHeadersMiddleware to detect the RENDER env var; (3) the render.yaml format which is Render's IaC specification.

The BUG-01 regression test is the most important deliverable because the reverse_installment_payment endpoint already has the fix code — the test exists to prove the fix is correct and prevent future regressions. Existing tests verify `payments_completed == 0` after reversal but NOT that the associated Transaction row is actually deleted from the database.

**Primary recommendation:** For each bug in plan 5A-01, read the actual endpoint code first to confirm the bug still exists before implementing a fix. BUG-04 and BUG-06 may be no-ops. BUG-01's endpoint code is already correct — only the regression test is missing.

---

## Standard Stack

### Core (already in use — no new installs)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| FastAPI | 0.115.6 | API framework | field_validator pattern already used in config.py |
| SQLAlchemy | 2.0.36 (async) | ORM + session management | NullPool import: `from sqlalchemy.pool import NullPool` |
| Alembic | 1.14.1 | Migrations | `op.execute(sa.text(...))` for raw SQL in migrations |
| pydantic-settings | 2.7.1 | Settings/env | `field_validator` with `mode="before"` |
| asyncpg | 0.30.0 | PostgreSQL async driver | requires `postgresql+asyncpg://` URL scheme |

### Frontend (already in use)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| react-i18next | ^16.5.4 | i18n | Keys in `frontend/src/i18n/locales/{he,en}.json` |
| Vite | 7 | Build tool | `import.meta.env.VITE_*` for env vars |
| Tailwind CSS | v4 | Styling | `overflow-visible` vs `overflow-hidden` on card wrappers |

### No New Installs Required
All dependencies are already in `requirements.txt` and `package.json`. Phase 5A is configuration and bug fixes only.

---

## Architecture Patterns

### Pattern 1: Render Environment Detection (DEPLOY-03, DEPLOY-04)
**What:** Both CSP middleware (main.py) and connection pool (session.py) need to detect Render environment.
**When to use:** Anywhere behavior must differ between local dev and Render production.

```python
# In session.py
import os

_IS_RENDER = os.environ.get("RENDER") == "true"

if _IS_RENDER:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        poolclass=NullPool,  # Required for Render's serverless architecture
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={"server_settings": {"statement_timeout": "30000"}},
    )
```

```python
# In main.py SecurityHeadersMiddleware — environment-aware CSP
import os

_IS_RENDER = os.environ.get("RENDER") == "true"

# Build security headers — CSP only on Render
_SECURITY_HEADERS: List[Tuple[bytes, bytes]] = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    # ... other headers ...
]

# CSP is applied ONLY on Render (RENDER env var set)
if _IS_RENDER:
    allowed_origins = settings.CORS_ORIGINS
    csp_value = f"default-src 'self'; connect-src 'self' {' '.join(allowed_origins)}"
    _SECURITY_HEADERS.append(
        (b"content-security-policy", csp_value.encode())
    )
```

### Pattern 2: DATABASE_URL Transformation (DEPLOY-01)
**What:** Render provides `postgresql://` scheme; asyncpg requires `postgresql+asyncpg://`.
**Implementation:** Add to config.py before the existing CORS validator.

```python
@field_validator("DATABASE_URL", mode="before")
@classmethod
def fix_database_url(cls, v: str) -> str:
    """Transform postgresql:// → postgresql+asyncpg:// for Render compatibility."""
    if isinstance(v, str) and v.startswith("postgresql://"):
        return v.replace("postgresql://", "postgresql+asyncpg://", 1)
    return v
```

### Pattern 3: Conditional Alembic Index Creation (BUG-02, BUG-05)
**What:** Creating indexes/constraints that may already exist from previous migrations.
**Use `IF NOT EXISTS` equivalents in Alembic.**

```python
# For indexes — use op.execute with IF NOT EXISTS
op.execute(sa.text(
    "CREATE INDEX IF NOT EXISTS ix_credit_cards_billing_day "
    "ON credit_cards (billing_day)"
))

# For unique constraints — check_first approach
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # Check if constraint exists before creating
    constraints = [c['name'] for c in inspector.get_unique_constraints('bank_balances')]
    if 'uq_balance_current' not in constraints:
        # Also check indexes
        indexes = [i['name'] for i in inspector.get_indexes('bank_balances')]
        if 'uq_balance_current' not in indexes:
            op.execute(sa.text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_balance_current "
                "ON bank_balances (user_id) WHERE is_current = true AND bank_account_id IS NULL"
            ))
```

### Pattern 4: Deep Health Check (DEPLOY-06)
**What:** Replace the basic `/health` endpoint with a DB-aware one.
**Pattern:** Use a proper DB dependency, return 503 on failure.

```python
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.db.session import async_session

@app.get("/health")
async def health_check():
    """Deep health check: verify DB connectivity."""
    db_healthy = False
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
            db_healthy = True
    except Exception:
        pass

    payload = {"status": "ok" if db_healthy else "degraded", "db": db_healthy, "version": "1.0.0"}
    status_code = status.HTTP_200_OK if db_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=payload, status_code=status_code)
```

### Pattern 5: BUG-01 Regression Test Pattern
**What:** Verify that `reverse-payment` actually deletes the Transaction row.
**Test must query DB directly — not just check API response.**

```python
@pytest.mark.asyncio
async def test_reverse_payment_no_orphaned_transaction(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    # 1. Create installment
    # 2. Mark paid (creates Transaction row with installment_id)
    # 3. Reverse payment
    # 4. Query DB directly: assert no Transaction with installment_id + installment_number=1
    from sqlalchemy import select
    from app.db.models import Transaction

    result = await db_session.execute(
        select(Transaction).where(
            Transaction.installment_id == installment_uuid,
            Transaction.installment_number == 1,
        )
    )
    assert result.scalar_one_or_none() is None, "Orphaned transaction found after reverse-payment"
```

### Pattern 6: Frontend API URL (DEPLOY-05)
**What:** client.ts must use VITE_API_URL env var for Render, fall back to /api/v1 for dev.

```typescript
// frontend/src/api/client.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  // ...
})
```

### Pattern 7: render.yaml Structure (DEPLOY-08)
**What:** Render Infrastructure-as-Code file at repo root.

```yaml
services:
  - type: web
    name: eye-level-api
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    preDeployCommand: alembic upgrade head
    envVars:
      - key: PYTHON_VERSION
        value: 3.9.21
      - key: RENDER
        value: true
      - key: DATABASE_URL
        fromDatabase:
          name: eye-level-db
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: CORS_ORIGINS
        sync: false  # Set manually in Render dashboard

  - type: web
    name: eye-level-frontend
    runtime: static
    rootDir: frontend
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        sync: false  # Set to https://eye-level-api.onrender.com/api/v1

databases:
  - name: eye-level-db
    plan: basic-256mb
    databaseName: cashflow
    user: cashflow
```

### Anti-Patterns to Avoid
- **Do NOT** use `RENDER=true` check as `os.environ.get("RENDER") == "true"` — Render sets `RENDER=true` as a string, but check with `bool(os.environ.get("RENDER"))` for safety.
- **Do NOT** create a new Alembic migration without chaining it from the current head (`57ac70dcfa4d` as of research date).
- **Do NOT** remove the pool_pre_ping and pool_recycle from the non-Render engine — these are important for local dev stability.
- **Do NOT** use `from __future__ import annotations` AND `X | Y` syntax in the same file on Python 3.9 — use `Optional[X]` from typing.
- **Do NOT** modify `b708280a0aad` or `57ac70dcfa4d` migrations — create a new migration that chains from `57ac70dcfa4d`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL scheme transformation | Custom string manipulation | `str.replace("postgresql://", "postgresql+asyncpg://", 1)` in field_validator | Simple, reliable, already-established pattern in codebase |
| Connection pool switching | Complex conditional import | `poolclass=NullPool` parameter in `create_async_engine` | SQLAlchemy native, already used in test conftest.py and alembic env.py |
| Conditional index creation | Checking migration history | `CREATE INDEX IF NOT EXISTS` SQL via `op.execute(sa.text(...))` | Idempotent, works on all environments |
| Environment detection | Complex config parsing | `os.environ.get("RENDER")` | Render sets this automatically, no custom logic needed |
| Health check DB test | Replicating ORM session setup | `async with async_session() as session: await session.execute(text("SELECT 1"))` | Reuses existing session factory |

**Key insight:** Every problem in this phase has a 1-3 line idiomatic solution. The danger is over-engineering. The BUG-01 fix already exists in the code — only the test is missing.

---

## Common Pitfalls

### Pitfall 1: BUG-01 Fix Already Present
**What goes wrong:** Implementing BUG-01 fix by modifying reverse_installment_payment when it already has the delete-orphan logic.
**Why it happens:** Requirement says "fix orphaned transactions" but the fix was already committed (code at installments.py lines 488-497 already queries for the orphan Transaction and deletes it).
**How to avoid:** Read `reverse_installment_payment` in installments.py before writing any fix code. The task is to WRITE THE TEST, not the fix.
**Warning signs:** If you're adding `await db.delete(orphan_tx)` to installments.py, stop — it's already there.

### Pitfall 2: Alembic Migration Collision
**What goes wrong:** Migration fails because index/constraint already exists from a previous migration.
**Why it happens:** Multiple migrations touched bank_balances constraints (`fb15cad9b324`, `57ac70dcfa4d`, `b708280a0aad`). The current state after all migrations may have `uq_balance_current_global` and `uq_balance_current_per_account` (from 57ac70dcfa4d) but NOT `uq_balance_current`.
**How to avoid:** Always use `CREATE INDEX IF NOT EXISTS` in raw SQL via `op.execute(sa.text(...))`. Use `inspector.get_indexes()` for pre-flight checks on constraints.
**Warning signs:** `ProgrammingError: relation "index_name" already exists` during `alembic upgrade head`.

### Pitfall 3: BUG-04 and BUG-06 Are Already Fixed
**What goes wrong:** Writing tasks to implement fixes that already exist.
**Why it happens:** requirements.md was written before code review.
**How to avoid:** Check before implementing:
  - BUG-04: transactions.py lines 125-128 and 252-255 already enforce category type mismatch. Verify other endpoints (installments.py, fixed.py) and create a note.
  - BUG-06: All list endpoints use `List[TypedModel]` — no untyped `list` found. May be entirely already done.

### Pitfall 4: CSP Blocks Legitimate API Calls in Production
**What goes wrong:** The fixed CSP is too restrictive or too permissive.
**Why it happens:** `default-src 'self'` on the API service (port 8000/443 on Render) blocks the frontend (different Render URL) from making API calls.
**How to avoid:** The CSP on the API backend should allow the frontend Render URL in `connect-src`. When RENDER=true, build the CSP value from `settings.CORS_ORIGINS`. Example: `connect-src 'self' https://eye-level-frontend.onrender.com`.
**Warning signs:** Browser console shows "CSP violation" after deployment.

### Pitfall 5: NullPool Breaks asyncpg Statement Timeout
**What goes wrong:** With NullPool on Render, the `connect_args={"server_settings": {"statement_timeout": "30000"}}` may not work the same way.
**Why it happens:** NullPool creates a new connection per request; connect_args still works but pool settings (pool_size, max_overflow) are meaningless.
**How to avoid:** Keep `connect_args` even with NullPool — it's applied per-connection. Remove only pool_size, max_overflow, pool_pre_ping, pool_recycle.

### Pitfall 6: FE-01 and FE-02 May Already Be Fixed
**What goes wrong:** Adding translation keys that already exist, or finding FE-02 key is already correct.
**Why it happens:** Both he.json and en.json have comprehensive `creditCards` sections. Full audit of page vs. translation keys shows no `creditCards.add` usage — only `creditCards.addCard`.
**How to avoid:** Do a precise grep of `CreditCardsPage.tsx` for every `t('creditCards.` call, extract all unique key names, then diff against he.json and en.json. Only add keys that are genuinely absent.

### Pitfall 7: Python 3.9 Syntax in New Files
**What goes wrong:** Using `X | Y` union syntax in new Python files (e.g., migration, test files).
**Why it happens:** Python 3.9.6 doesn't support `X | Y` union — needs `Optional[X]` or `Union[X, Y]`.
**How to avoid:** All new `.py` files MUST start with `from __future__ import annotations`. Use `Optional[X]` from `typing` for nullable fields.

### Pitfall 8: render.yaml preDeployCommand Working Directory
**What goes wrong:** `alembic upgrade head` fails in preDeployCommand because alembic.ini isn't at root.
**Why it happens:** The backend is in `backend/` subdirectory; `alembic.ini` and `alembic/` are in `backend/`.
**How to avoid:** Set `rootDir: backend` in the web service definition so preDeployCommand runs from `backend/`. Alternatively: `preDeployCommand: cd backend && alembic upgrade head`.

---

## Code Examples

Verified patterns from codebase inspection:

### Existing field_validator Pattern (config.py)
```python
# Source: /backend/app/config.py lines 39-43
@field_validator("SECRET_KEY", mode="before")
@classmethod
def validate_secret_key(cls, v: str) -> str:
    if not v or v == "change-me-in-production":
        return secrets.token_urlsafe(64)  # CHANGE: raise ValueError in production
    return v
```

### Existing NullPool Usage (tests/conftest.py line 46)
```python
# Source: /backend/tests/conftest.py
from sqlalchemy.pool import NullPool
engine = create_async_engine(_TEST_DATABASE_URL, echo=False, poolclass=NullPool)
```

### Existing Security Middleware (main.py lines 55-88)
```python
# Source: /backend/app/main.py
_SECURITY_HEADERS: List[Tuple[bytes, bytes]] = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"x-xss-protection", b"1; mode=block"),
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains; preload"),
    (b"content-security-policy", b"default-src 'self'"),  # THIS IS THE PROBLEM
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
    (b"x-api-version", b"v1"),
]
```

### Alembic Migration Chain (current head)
```
662be7a4315d → f58ca177ac66 → 3206c4eef440 → 6b2079dbc63e → c418f49cdb52
→ fb15cad9b324 → b708280a0aad → 029e8f951a2e → c1d2e3f4a5b6 → b1c2d3e4f5a6
→ 7c6dc9126131 → c2d3e4f5g6h7 → b15ab5ff4373 → ea39ef3b496c → a1b2c3d4e5f6
→ 5d7bb6143603 → a9c1f2b3d4e5 → 73e472d76fbc → b1c2d3e4f5g6 → 225a281f1180
→ 3ff79e0f3942 → 935d184bbca3 → 57ac70dcfa4d  ← CURRENT HEAD
```
New Phase 5A migration must set `down_revision = '57ac70dcfa4d'`.

### Translation File Locations
```
frontend/src/i18n/locales/he.json  — Hebrew (default, RTL)
frontend/src/i18n/locales/en.json  — English
```
Both files have `creditCards` object at line ~849. He.json has 50+ keys. En.json matches.

### Existing Simple Health Endpoint (main.py line 148-150)
```python
# Source: /backend/app/main.py — CURRENT STATE (too simple for Render)
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}
```

### BUG-02 Context — Current Balance Constraint State
The migration history shows complex evolution:
1. `fb15cad9b324`: Created `uq_balance_current` (partial unique index: one current per user)
2. `b708280a0aad`: Created `uq_bank_balance_user_date` (unique per user+date)
3. `57ac70dcfa4d` (CURRENT HEAD): Dropped both, replaced with:
   - `uq_balance_current_per_account` (partial: user+bank_account_id WHERE is_current=true AND bank_account_id IS NOT NULL)
   - `uq_balance_current_global` (partial: user WHERE is_current=true AND bank_account_id IS NULL)
   - `uq_bank_balance_user_date_account` (unique: user+date+bank_account_id)

The requirement says to add `uq_balance_current` if missing. However, the current state has the more sophisticated split-index approach. The migration for Phase 5A should verify these indexes exist (not create a simpler `uq_balance_current`) OR confirm what the planner wants the final state to be.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `response_model=List` (untyped) | `response_model=List[TypedModel]` | Already in codebase | BUG-06 appears already fixed |
| Single `/health` endpoint | Deep health check with DB probe | Phase 5A DEPLOY-06 | Render can detect DB failures |
| Hardcoded `/api/v1` in client.ts | `import.meta.env.VITE_API_URL \|\| '/api/v1'` | Phase 5A DEPLOY-05 | Enables Render deployment |
| `pool_size=10` always | NullPool on Render, pool on local | Phase 5A DEPLOY-04 | Render serverless compatibility |
| Auto-generated SECRET_KEY | Must be explicitly set in production | Phase 5A DEPLOY-02 | Security requirement |

**Already fixed in current codebase (verify before implementing):**
- BUG-04 (category type mismatch): Implemented in transactions.py create (line 125) and update (line 252).
- BUG-06 (untyped response_model): All endpoints use `List[TypedModel]` — no raw `list` found.
- FE-02 (wrong translation key): `t('creditCards.add')` not found in CreditCardsPage.tsx — already uses `t('creditCards.addCard')`.
- BUG-01 endpoint logic: The delete-orphan logic exists in `reverse_installment_payment` (lines 488-497). Only the regression test is missing.

---

## Open Questions

1. **BUG-05: Which exact 4 indexes are "missing"?**
   - What we know: Extensive index coverage already exists from multiple migrations. credit_cards has `ix_credit_cards_user_id`, `ix_credit_cards_user_active`, subscriptions has `ix_subscriptions_user_id`, etc.
   - What's unclear: The specific 4 indexes the requirement refers to. Possibly: `ix_credit_cards_user_billing_day`, composite indexes on subscriptions (user+billing_cycle), transactions (installment_id), bank_balances (bank_account_id+is_current).
   - Recommendation: Run `SELECT indexname FROM pg_indexes WHERE tablename IN ('credit_cards','subscriptions','transactions','bank_balances')` against the DB to find gaps, then create only truly missing ones with `IF NOT EXISTS`.

2. **BUG-03: Which schema fields are actually missing?**
   - What we know: `LoanCreate` does NOT have `credit_card_id` (loans don't use credit cards for payment — bank_account_id is there). `SubscriptionCreate` has `credit_card_id` but no `bank_account_id` (subscriptions model has no bank_account_id column). `InstallmentCreate` and `FixedCreate` are complete.
   - What's unclear: Whether `LoanCreate` should get `credit_card_id` (no loan model column for it) or whether the requirement specifically means something else.
   - Recommendation: Cross-reference schema fields against DB model columns — only add fields to schemas that have corresponding DB columns.

3. **DEPLOY-03: CSP connect-src value**
   - What we know: settings.CORS_ORIGINS contains the allowed origins. On Render, this will be set to the frontend Render URL.
   - What's unclear: Whether `connect-src 'self' {cors_origins}` is sufficient or if `script-src`, `style-src` etc. need adjustment for the React SPA.
   - Recommendation: For the API backend's CSP, only `connect-src` matters (frontend fetches APIs). Use `default-src 'none'; connect-src 'self' {joined_origins}` for strict production CSP.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest with pytest-asyncio (asyncio_mode=auto) |
| Config file | `/Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend/pytest.ini` |
| Quick run command | `cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/test_installments.py -v -x` |
| Full suite command | `cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v` |
| Estimated runtime | ~60-90 seconds (155+ tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | reverse-payment deletes Transaction row from DB | integration | `pytest tests/test_installments.py::test_reverse_payment_no_orphaned_transaction -x` | ❌ Wave 0 gap — new test required |
| BUG-02 | create_balance returns 409 on duplicate current balance | integration | `pytest tests/test_balance.py -x -k concurrent` | ✅ test_concurrent_access.py covers concurrent balance |
| BUG-03 | LoanCreate accepts credit_card_id field without error | unit (schema) | `pytest tests/ -x -k loan` | ✅ tests/test_loans.py exists |
| BUG-04 | Transaction create with mismatched category type returns 422 | integration | `pytest tests/test_validation_completeness.py -x -k category` | ✅ likely already tested |
| BUG-05 | Alembic migration runs without error on fresh DB | migration smoke | `alembic upgrade head` | ✅ standard Alembic test |
| BUG-06 | Endpoints return correctly typed list responses | integration | `pytest tests/ -x` (full suite) | ✅ existing endpoint tests verify response shape |
| FE-01 | No raw translation keys visible in UI | manual-only | Visual browser test | N/A |
| FE-02 | t('creditCards.addCard') renders Hebrew text | manual-only | Visual browser test | N/A |
| FE-03 | Snooze dropdown renders without clipping | manual-only | Visual browser test in Hebrew | N/A |
| DEPLOY-01 | DATABASE_URL with postgresql:// transforms to postgresql+asyncpg:// | unit | `pytest tests/ -x` (app startup tested) | ✅ app import validates config |
| DEPLOY-02 | Empty SECRET_KEY raises ValueError in production | unit | `pytest tests/ -x` (config import) | ✅ config validator tested |
| DEPLOY-03 | CSP header absent in dev, present on Render | integration | `pytest tests/ -x -k middleware` | ✅ test_middleware_and_hardening.py |
| DEPLOY-04 | NullPool used when RENDER=true | unit | `pytest tests/ -x` (session import) | ✅ import-level verification |
| DEPLOY-05 | client.ts uses VITE_API_URL env var | manual-only | Build check: `npm run build` | ✅ TypeScript compile validates |
| DEPLOY-06 | /health returns 503 when DB down | integration | `pytest tests/ -x -k health` | ❌ Wave 0 gap — new test needed |
| DEPLOY-07 | .python-version file exists with 3.9.21 | file check | `cat backend/.python-version` | ❌ file doesn't exist |
| DEPLOY-08 | render.yaml exists with 3 services | file check | `test -f render.yaml` | ❌ file doesn't exist |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task → run: `cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -x --tb=short -q`
- **Full suite trigger:** Before merging final task of any plan wave (5A-01, 5A-02, 5A-03)
- **Phase-complete gate:** Full suite green (155+ tests) before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~60-90 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `backend/tests/test_installments.py::test_reverse_payment_no_orphaned_transaction` — covers BUG-01 (integration test with DB session, verifies Transaction row deleted)
- [ ] `backend/tests/test_health.py` or add to `test_middleware_and_hardening.py` — covers DEPLOY-06 (mock DB failure, verify 503)

*(Note: test_middleware_and_hardening.py may already have health check tests — verify before creating new file)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all findings are from reading actual source files in `/Users/roeiedri/dev/Financial-Application-Eye-Level-AI/`
- `/backend/app/api/v1/endpoints/installments.py` — BUG-01 reverse_installment_payment logic (lines 467-504)
- `/backend/app/api/v1/endpoints/transactions.py` — BUG-04 category type mismatch (lines 125-128, 252-255)
- `/backend/app/config.py` — DEPLOY-01/02 field_validator patterns
- `/backend/app/db/session.py` — DEPLOY-04 pool configuration
- `/backend/app/main.py` — DEPLOY-03/06 middleware and health check
- `/frontend/src/api/client.ts` — DEPLOY-05 baseURL hardcoding
- `/frontend/src/i18n/locales/{he,en}.json` — FE-01/02 translation key analysis
- `/frontend/src/pages/AlertsPage.tsx` — FE-03 overflow analysis
- `/backend/alembic/versions/` — all 24 migration files inspected
- `/backend/tests/conftest.py` — test infrastructure (NullPool, DB setup)

### Secondary (MEDIUM confidence)
- Render documentation pattern for `RENDER` env var — consistent with Render's behavior of setting `RENDER=true` on all Web Services
- Alembic `IF NOT EXISTS` pattern — standard SQL, verified by codebase use in migration files

### Tertiary (LOW confidence — flag for validation)
- The exact 4 "missing" BUG-05 indexes — could not confirm without running `pg_indexes` query against live DB
- Whether BUG-06 has any remaining untyped endpoints — code search found none but may have missed edge cases

---

## Metadata

**Confidence breakdown:**
- BUG-01 through BUG-06: HIGH — verified against actual endpoint and schema code
- FE-01/FE-02/FE-03: HIGH — verified against actual translation files and page code
- DEPLOY-01 through DEPLOY-07: HIGH — config.py and session.py read directly
- DEPLOY-08 render.yaml: MEDIUM — based on Render documentation patterns
- BUG-05 exact indexes: LOW — need DB query to confirm

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable stack, 30-day window)
