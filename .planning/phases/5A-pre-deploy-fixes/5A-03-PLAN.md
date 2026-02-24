---
phase: 5A-pre-deploy-fixes
plan: "03"
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/config.py
  - backend/app/db/session.py
  - backend/app/main.py
  - frontend/src/api/client.ts
  - backend/.python-version
  - render.yaml
autonomous: true
requirements:
  - DEPLOY-01
  - DEPLOY-02
  - DEPLOY-03
  - DEPLOY-04
  - DEPLOY-05
  - DEPLOY-06
  - DEPLOY-07
  - DEPLOY-08

must_haves:
  truths:
    - "DATABASE_URL with postgresql:// scheme is automatically transformed to postgresql+asyncpg:// (Render compatible)"
    - "Empty or missing SECRET_KEY raises ValueError in production instead of silently generating a random key"
    - "CSP header is absent in local development and present (with frontend origin in connect-src) when RENDER env var is set"
    - "NullPool connection pool is used when RENDER env var is set; standard pool_size=10 pool used otherwise"
    - "frontend API client uses VITE_API_URL env var with /api/v1 fallback"
    - "GET /health returns JSON with db:true and 200 when DB connected; db:false and 503 when DB is unreachable"
    - "backend/.python-version file exists containing 3.9.21"
    - "render.yaml exists at repo root defining eye-level-api, eye-level-frontend, eye-level-db services"
  artifacts:
    - path: "backend/app/config.py"
      provides: "DEPLOY-01 DATABASE_URL validator + DEPLOY-02 SECRET_KEY production guard"
      contains: "fix_database_url"
    - path: "backend/app/db/session.py"
      provides: "DEPLOY-04 NullPool on Render"
      contains: "NullPool"
    - path: "backend/app/main.py"
      provides: "DEPLOY-03 environment-aware CSP + DEPLOY-06 deep health check"
      contains: "db_healthy"
    - path: "frontend/src/api/client.ts"
      provides: "DEPLOY-05 VITE_API_URL env var"
      contains: "VITE_API_URL"
    - path: "backend/.python-version"
      provides: "DEPLOY-07 Python version pin"
      contains: "3.9.21"
    - path: "render.yaml"
      provides: "DEPLOY-08 IaC for all three Render services"
      contains: "eye-level-api"
  key_links:
    - from: "backend/app/config.py::fix_database_url"
      to: "backend/app/db/session.py::engine"
      via: "settings.DATABASE_URL used in create_async_engine"
      pattern: "postgresql\\+asyncpg://"
    - from: "backend/app/main.py::_IS_RENDER"
      to: "backend/app/db/session.py::_IS_RENDER"
      via: "same RENDER env var detection pattern"
      pattern: "os\\.environ\\.get\\(\"RENDER\"\\)"
    - from: "render.yaml::preDeployCommand"
      to: "backend/alembic"
      via: "alembic upgrade head runs from rootDir: backend"
      pattern: "alembic upgrade head"
---

<objective>
Add all Render-specific deployment code changes to make the application deployable on Render.com. These are code changes only — no infrastructure is created here. Phase 5B handles the actual Render account/service setup.

Purpose: Without these changes, the app cannot run on Render. DATABASE_URL scheme mismatch breaks asyncpg. Missing NullPool causes serverless connection exhaustion. Hardcoded /api/v1 in client.ts means the frontend cannot reach the production API.
Output: config.py with URL transformer and SECRET_KEY guard; session.py with NullPool on Render; main.py with environment-aware CSP and deep health check; client.ts with env var baseURL; .python-version file; render.yaml at repo root.
</objective>

<execution_context>
@/Users/roeiedri/.claude/get-shit-done/workflows/execute-plan.md
@/Users/roeiedri/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/5A-pre-deploy-fixes/5A-CONTEXT.md
@.planning/phases/5A-pre-deploy-fixes/5A-RESEARCH.md

@backend/app/config.py
@backend/app/db/session.py
@backend/app/main.py
@frontend/src/api/client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: DEPLOY-01, DEPLOY-02, DEPLOY-04 — config.py and session.py production settings</name>
  <files>
    backend/app/config.py
    backend/app/db/session.py
  </files>
  <action>
Read backend/app/config.py and backend/app/db/session.py in full before making any changes.

**DEPLOY-01 — DATABASE_URL transformer (config.py):**
Add a new `field_validator` for DATABASE_URL that transforms `postgresql://` to `postgresql+asyncpg://`. Place it BEFORE the existing CORS_ORIGINS validator:

```python
@field_validator("DATABASE_URL", mode="before")
@classmethod
def fix_database_url(cls, v: str) -> str:
    """Transform postgresql:// → postgresql+asyncpg:// for Render compatibility."""
    if isinstance(v, str) and v.startswith("postgresql://"):
        return v.replace("postgresql://", "postgresql+asyncpg://", 1)
    return v
```

If this validator already exists in config.py, skip and note.

**DEPLOY-02 — SECRET_KEY production guard (config.py):**
Find the existing `validate_secret_key` method (research found it auto-generates a random key if empty/default). Change it to raise `ValueError` if RENDER env var is set and SECRET_KEY is not explicitly provided:

```python
@field_validator("SECRET_KEY", mode="before")
@classmethod
def validate_secret_key(cls, v: str) -> str:
    import os
    if not v or v == "change-me-in-production":
        if os.environ.get("RENDER"):
            raise ValueError(
                "SECRET_KEY must be explicitly set in production. "
                "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        # Local dev: auto-generate (acceptable)
        import secrets
        return secrets.token_urlsafe(64)
    return v
```

All new code in config.py must have `from __future__ import annotations` at the top of file (check if already present). Python 3.9 — no `X | Y` unions.

**DEPLOY-04 — NullPool on Render (session.py):**
At the top of session.py, add:
```python
import os
_IS_RENDER = bool(os.environ.get("RENDER"))
```

Replace the single `create_async_engine(...)` call with a conditional:
```python
if _IS_RENDER:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        poolclass=NullPool,
        connect_args={"server_settings": {"statement_timeout": "30000"}},
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

Add `from sqlalchemy.pool import NullPool` to imports if not already present. Keep ALL existing imports — do not remove pool_pre_ping/pool_recycle from the else branch.

After both files are edited, run the full backend test suite to confirm no regressions:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -x --tb=short -q 2>&1 | tail -10
```
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/test_middleware_and_hardening.py tests/test_security_hardening.py -x -v --tb=short 2>&1 | tail -20</automated>
    <manual>Confirm config.py has fix_database_url validator. Confirm session.py has _IS_RENDER conditional. Confirm NullPool is imported.</manual>
  </verify>
  <done>config.py has fix_database_url (postgresql:// → postgresql+asyncpg://) validator and validate_secret_key raises ValueError on Render if key not set. session.py uses NullPool when RENDER env var is set, standard pool otherwise. All backend tests still pass.</done>
</task>

<task type="auto">
  <name>Task 2: DEPLOY-03, DEPLOY-06 — Environment-aware CSP and deep health check (main.py)</name>
  <files>backend/app/main.py</files>
  <action>
Read backend/app/main.py in full before making changes. Focus on:
1. The `_SECURITY_HEADERS` list (lines ~55-88 per research — contains hardcoded CSP)
2. The `/health` endpoint (lines ~148-150 per research — returns basic dict)

**DEPLOY-03 — Environment-aware CSP:**
The current `_SECURITY_HEADERS` list has a hardcoded `content-security-policy` entry with `default-src 'self'`. This blocks the frontend (different Render URL) from making API calls in production.

At the top of the SecurityHeadersMiddleware section (or near the import area), add:
```python
import os as _os
_IS_RENDER = bool(_os.environ.get("RENDER"))
```

(Use `_os` to avoid shadowing any existing `os` import, or use the existing `os` import if already present.)

Modify the `_SECURITY_HEADERS` list to REMOVE the hardcoded CSP entry:
```python
# Remove this line:
# (b"content-security-policy", b"default-src 'self'"),
```

In the SecurityHeadersMiddleware `__call__` method (or wherever headers are applied), add dynamic CSP only when on Render:
```python
# After existing headers are set, add CSP only on Render
if _IS_RENDER:
    allowed_origins = " ".join(settings.CORS_ORIGINS) if isinstance(settings.CORS_ORIGINS, list) else settings.CORS_ORIGINS
    csp = f"default-src 'none'; connect-src 'self' {allowed_origins}; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"
    # Add to response headers
    headers.append((b"content-security-policy", csp.encode()))
```

Adjust implementation to match how `_SECURITY_HEADERS` is used in the middleware — may be a list that's appended to the response or a dict. Follow the existing pattern exactly.

**DEPLOY-06 — Deep health check endpoint:**
Find the existing `/health` endpoint. Replace the entire function body with a DB connectivity check:

```python
from sqlalchemy import text as _sa_text

@app.get("/health")
async def health_check():
    """Deep health check: verifies DB connectivity for Render health monitoring."""
    db_healthy = False
    try:
        async with async_session() as session:
            await session.execute(_sa_text("SELECT 1"))
            db_healthy = True
    except Exception:
        pass

    payload = {
        "status": "ok" if db_healthy else "degraded",
        "db": db_healthy,
        "version": "1.0.0",
    }
    status_code = 200 if db_healthy else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(content=payload, status_code=status_code)
```

Import `async_session` from `app.db.session` if not already imported in main.py. Check existing imports first.

After changes, run backend test suite:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -x --tb=short -q 2>&1 | tail -10
```

If test_middleware_and_hardening.py has tests for the CSP header or /health endpoint that now fail, update those tests to match the new behavior:
- CSP test: assert CSP header is absent when RENDER is not set; assert it's present with connect-src when RENDER=true
- Health test: assert /health returns 200 with `{"db": true}` when DB is connected
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -x --tb=short -q 2>&1 | tail -10</automated>
    <manual>Check main.py: (1) _SECURITY_HEADERS no longer contains hardcoded CSP. (2) /health endpoint queries DB. (3) _IS_RENDER conditional exists for CSP injection.</manual>
  </verify>
  <done>main.py CSP is environment-aware: absent in dev (RENDER not set), present with connect-src when RENDER=true. /health returns JSON with db:true/200 on success, db:false/503 on DB failure. All backend tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: DEPLOY-05, DEPLOY-07, DEPLOY-08 — Frontend API URL, Python version pin, render.yaml</name>
  <files>
    frontend/src/api/client.ts
    backend/.python-version
    render.yaml
  </files>
  <action>
**DEPLOY-05 — Frontend API URL (client.ts):**
Read frontend/src/api/client.ts. Find the axios/fetch client baseURL.
Current state (per research): `baseURL: '/api/v1'` (hardcoded).

Change to:
```typescript
baseURL: import.meta.env.VITE_API_URL || '/api/v1',
```

This single line change enables the production frontend to point to the Render API URL via VITE_API_URL env var, while keeping local development working with the proxy fallback.

After change, verify TypeScript compiles:
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -5
```

**DEPLOY-07 — Python version pin:**
Create backend/.python-version with content:
```
3.9.21
```
(Single line, no trailing newline issues — just the version string.)

Verify:
```bash
cat /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend/.python-version
```
Expected output: `3.9.21`

**DEPLOY-08 — render.yaml:**
Create render.yaml at the project ROOT (not in backend/ or frontend/):

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
        sync: false
      - key: ADMIN_DEFAULT_PASSWORD
        sync: false
      - key: ACCESS_TOKEN_EXPIRE_MINUTES
        value: 15
      - key: REFRESH_TOKEN_EXPIRE_DAYS
        value: 7
      - key: DEBUG
        value: false

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
        sync: false

databases:
  - name: eye-level-db
    plan: basic-256mb
    databaseName: cashflow
    user: cashflow
```

Notes on render.yaml:
- `preDeployCommand: alembic upgrade head` runs from rootDir (backend/) so alembic.ini is found automatically
- `sync: false` means the value must be set manually in Render Dashboard — this is intentional for secrets (CORS_ORIGINS, VITE_API_URL, ADMIN_DEFAULT_PASSWORD)
- `generateValue: true` for SECRET_KEY lets Render generate a stable secret (NOTE: DEPLOY-02's ValueError guard will catch this if SECRET_KEY is somehow not set — generateValue ensures it IS set on Render)
- `eye-level-db` must match the databases[].name exactly for `fromDatabase` to resolve

Verify render.yaml is valid YAML:
```bash
python3 -c "import yaml; yaml.safe_load(open('/Users/roeiedri/dev/Financial-Application-Eye-Level-AI/render.yaml'))" && echo "render.yaml valid YAML"
```
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | grep -E "error|built in" | head -5 && test -f /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend/.python-version && echo ".python-version exists" && python3 -c "import yaml; yaml.safe_load(open('/Users/roeiedri/dev/Financial-Application-Eye-Level-AI/render.yaml'))" && echo "render.yaml valid"</automated>
    <manual>Check client.ts for VITE_API_URL. Verify render.yaml has 3 services (eye-level-api, eye-level-frontend, eye-level-db). Verify .python-version contains 3.9.21.</manual>
  </verify>
  <done>client.ts uses `import.meta.env.VITE_API_URL || '/api/v1'`. backend/.python-version exists with content `3.9.21`. render.yaml exists at repo root, is valid YAML, defines all 3 services with correct names and preDeployCommand. Frontend TypeScript build passes.</done>
</task>

</tasks>

<verification>
Backend test suite (must pass after all deployment changes):
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ --tb=short -q 2>&1 | tail -10
```
Expected: All 155+ tests pass.

Frontend build (must compile cleanly):
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -5
```
Expected: "built in X.Xs" with no errors.

File existence checks:
```bash
test -f /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/render.yaml && echo "render.yaml OK" && test -f /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend/.python-version && echo ".python-version OK"
```
</verification>

<success_criteria>
- config.py: DATABASE_URL field_validator transforms postgresql:// to postgresql+asyncpg:// (DEPLOY-01)
- config.py: SECRET_KEY validator raises ValueError when RENDER=true and key not set (DEPLOY-02)
- main.py: CSP header injected only when RENDER env var set, with frontend origin in connect-src (DEPLOY-03)
- session.py: NullPool used when RENDER=true, standard pool otherwise (DEPLOY-04)
- client.ts: baseURL uses import.meta.env.VITE_API_URL || '/api/v1' (DEPLOY-05)
- main.py /health: returns 200 + db:true when DB connected, 503 + db:false when down (DEPLOY-06)
- backend/.python-version: contains "3.9.21" (DEPLOY-07)
- render.yaml: valid YAML at repo root with eye-level-api, eye-level-frontend, eye-level-db (DEPLOY-08)
- All 155+ backend tests pass with no regressions
- Frontend TypeScript build passes
</success_criteria>

<output>
After completion, create `.planning/phases/5A-pre-deploy-fixes/5A-03-SUMMARY.md` with:
- Each DEPLOY-XX item: file changed, specific change made, line numbers if relevant
- Backend test count: 155+ passing
- Frontend build: passing
- Any test updates needed for CSP/health check behavior changes
</output>
