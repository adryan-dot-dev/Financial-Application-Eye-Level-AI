---
phase: 5A-pre-deploy-fixes
plan: "03"
subsystem: deployment
tags: [render, production, config, health-check, csp, nullpool]
dependency_graph:
  requires: []
  provides: [DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DEPLOY-07, DEPLOY-08]
  affects: [backend/app/config.py, backend/app/db/session.py, backend/app/main.py, frontend/src/api/client.ts]
tech_stack:
  added: [NullPool, SQLAlchemy text, render.yaml IaC]
  patterns: [environment-aware CSP, Render NullPool, DATABASE_URL transformer, deep health check]
key_files:
  created:
    - backend/.python-version
    - render.yaml
  modified:
    - backend/app/config.py
    - backend/app/db/session.py
    - backend/app/main.py
    - frontend/src/api/client.ts
    - backend/tests/test_middleware_and_hardening.py
    - backend/tests/test_security_hardening.py
decisions:
  - NullPool on Render to prevent serverless connection exhaustion
  - Environment-aware CSP absent in dev dynamic with connect-src on Render
  - Deep health check via SELECT 1 to enable Render health monitoring
  - generateValue for SECRET_KEY in render.yaml lets Render manage stable secrets
metrics:
  duration: ~20 min
  completed: 2026-02-24
---

# Phase 5A Plan 03: Render Deployment Code Changes Summary

**One-liner:** All 8 Render deployment blockers resolved - DATABASE_URL transformer, NullPool, environment-aware CSP, deep health check, VITE_API_URL, Python pin, and render.yaml IaC.

## What Was Built

Added all code changes required for the application to run on Render.com. These changes eliminate the 8 blockers (DEPLOY-01 through DEPLOY-08) that would have prevented successful deployment. No infrastructure is created here - Phase 5B handles the actual Render account/service setup.

## Tasks Completed

### Task 1: DEPLOY-01, DEPLOY-02, DEPLOY-04 — config.py and session.py
**Commit:** `0a7febc`
**Files:** `backend/app/config.py`, `backend/app/db/session.py`

**DEPLOY-01 — DATABASE_URL transformer (config.py):**
Added `fix_database_url` field_validator that transforms `postgresql://` to `postgresql+asyncpg://` before Pydantic validation. Render provides connection strings with the `postgresql://` scheme; asyncpg requires `postgresql+asyncpg://`. This validator silently handles the mismatch.

**DEPLOY-02 — SECRET_KEY production guard (config.py):**
Modified `validate_secret_key` to raise `ValueError` when the `RENDER` env var is set and no explicit `SECRET_KEY` is provided. In local dev, auto-generation continues. On Render, a missing key is a hard error preventing silent security failures. Added `import os` at module level.

**DEPLOY-04 — NullPool on Render (session.py):**
Added `_IS_RENDER = bool(os.environ.get("RENDER"))` and conditional engine creation. When `_IS_RENDER` is True, uses `NullPool` to prevent connection exhaustion on Render's ephemeral containers. Standard pool (`pool_size=10, max_overflow=20, pool_pre_ping=True, pool_recycle=3600`) retained for local environments. Added `from sqlalchemy.pool import NullPool` import.

### Task 2: DEPLOY-03, DEPLOY-06 — Environment-aware CSP and deep health check (main.py)
**Commit:** `f6b64a9`
**Files:** `backend/app/main.py`, `backend/tests/test_middleware_and_hardening.py`, `backend/tests/test_security_hardening.py`

**DEPLOY-03 — Environment-aware CSP (main.py):**
Removed hardcoded CSP from `_SECURITY_HEADERS`. Added `_IS_RENDER` detection at module level. In `SecurityHeadersMiddleware.__call__`, conditionally appends dynamic CSP when `_IS_RENDER` is True. The CSP includes `connect-src 'self' {CORS_ORIGINS}` allowing the frontend to make API calls. In dev/test, no CSP header is sent.

**DEPLOY-06 — Deep health check (main.py):**
Replaced trivial health check with async DB connectivity check using `SELECT 1` via `async_session()`. Returns `{"status": "ok", "db": True, "version": "1.0.0"}` with HTTP 200 when DB is reachable, or `{"status": "degraded", "db": False}` with HTTP 503 when unreachable. Render uses `/health` for health monitoring.

**Test updates:**
- `test_health_check`: asserts `status == "ok"` and `db is True`
- `test_security_headers_present`: asserts CSP header is None in test env

### Task 3: DEPLOY-05, DEPLOY-07, DEPLOY-08 — Frontend API URL, Python pin, render.yaml
**Commit:** `208c49f`
**Files:** `frontend/src/api/client.ts`, `backend/.python-version`, `render.yaml`

**DEPLOY-05 — Frontend API URL (client.ts):**
Changed `baseURL: '/api/v1'` to `baseURL: import.meta.env.VITE_API_URL || '/api/v1'`. Local dev falls back to `/api/v1` (Vite proxy). TypeScript build verified clean in 2.13s.

**DEPLOY-07 — Python version pin:**
Created `backend/.python-version` with content `3.9.21`. Render reads this file to select the Python version.

**DEPLOY-08 — render.yaml IaC:**
Created `render.yaml` at repo root defining: `eye-level-api` (web Python with preDeployCommand alembic upgrade head), `eye-level-frontend` (static SPA with rewrite), `eye-level-db` (postgres basic-256mb). Secrets configured via `sync: false` for manual Dashboard setup, `generateValue: true` for SECRET_KEY.

## Verification

Backend tests (target files): 24/24 passed
Frontend build: Clean in 2.13s (no TypeScript errors)
File checks: .python-version contains 3.9.21, render.yaml is valid YAML, client.ts has VITE_API_URL

## Deviations from Plan

**1. [Rule 2 - Test update] Updated health check and CSP tests to match new behavior**
- Found during: Task 2
- Issue: Tests asserted old behavior (hardcoded CSP, status healthy)
- Fix: Updated assertions to match new environment-aware behavior (plan-directed)
- Files: test_middleware_and_hardening.py, test_security_hardening.py
- Commit: f6b64a9

## Self-Check: PASSED

Files exist:
- backend/app/config.py - FOUND (has fix_database_url, validate_secret_key with RENDER guard)
- backend/app/db/session.py - FOUND (has NullPool, _IS_RENDER)
- backend/app/main.py - FOUND (has _IS_RENDER, dynamic CSP, deep health check)
- frontend/src/api/client.ts - FOUND (has VITE_API_URL)
- backend/.python-version - FOUND (contains 3.9.21)
- render.yaml - FOUND (valid YAML, defines eye-level-api, eye-level-frontend, eye-level-db)

Commits exist:
- 0a7febc: feat(5A-03): DEPLOY-01/02/04
- f6b64a9: feat(5A-03): DEPLOY-03/06
- 208c49f: feat(5A-03): DEPLOY-05/07/08
