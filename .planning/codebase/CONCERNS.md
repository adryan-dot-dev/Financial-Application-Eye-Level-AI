# CONCERNS.md — Technical Debt & Issues

## Focus: concerns
**Codebase:** Financial-Application-Eye-Level-AI

---

## CRITICAL (Fix Before Production)

### 1. In-Memory Token Blacklist
- **File:** `backend/app/core/security.py`
- **Issue:** Logout uses in-memory set — doesn't work in multi-worker production; tokens lost on process restart
- **Fix:** Replace with Redis-backed blacklist

### 2. APScheduler on Multiple Workers
- **File:** `backend/app/core/scheduler.py` (or similar)
- **Issue:** Recurring charges execute multiple times when running multiple uvicorn workers — duplicate transactions
- **Fix:** Add distributed lock (Redis) or migrate to Celery Beat

### 3. Known Validation Bugs (Documented in tests)
- **File:** `backend/tests/api_test.py`
- **Issues:**
  - Zero/negative amounts accepted (should be rejected)
  - Non-admin users can list all users (authorization bypass)
  - Data isolation broken between users in some endpoints
  - Duplicate categories allowed without error

---

## HIGH PRIORITY

### 4. Multi-Organization Data Isolation — Fragile
- **Issue:** User-scoped data filtering not consistently enforced across all endpoints
- **Risk:** Data leakage between users if filter is missed in a new endpoint

### 5. Admin Promotion Tool
- **Issue:** May fail silently during deployment/setup
- **Risk:** System could be deployed without admin access

### 6. Decimal Precision Handling
- **Issue:** Vulnerable to float conversion bugs when converting between Python float and DECIMAL(15,2)
- **Fix:** Always use `Decimal` type from Python `decimal` module, never `float`

---

## MEDIUM PRIORITY (Maintainability)

### 7. Large Monolithic Modules
- `backend/app/api/dashboard.py` — ~1,236 lines (needs modularization)
- `backend/app/services/alert_service.py` — ~1,098 lines (needs splitting)
- **Risk:** Hard to maintain, test, and reason about

### 8. N+1 Query Risks
- **Location:** Organizations/users endpoints
- **Issue:** Related records loaded in Python loop instead of JOIN
- **Fix:** Use `selectinload` or explicit JOIN with SQLAlchemy

### 9. Rate Limiter Monkey-Patching
- **File:** Likely in `backend/app/main.py` or middleware
- **Issue:** Fragile workaround for slowapi integration
- **Risk:** Breaks silently on dependency updates

---

## TECH DEBT

### 10. Unmaintained Dependencies
- `slowapi==0.1.9` — last updated Oct 2023, effectively unmaintained
- **Risk:** No security patches; consider `fastapi-limiter` with Redis

### 11. APScheduler — Single-Instance Only
- Not suitable for production multi-worker deployments
- **Migration path:** Celery + Celery Beat, or use pg_cron for DB-level scheduling

### 12. Hardcoded Database Connection Pool Settings
- Connection pool size not configurable via environment variables
- **Fix:** Expose `pool_size`, `max_overflow`, `pool_timeout` as env vars

---

## SECURITY NOTES

- JWT secret must be strong and rotated — verify it's not a default/weak value in production
- CORS origins — ensure `allow_origins` is not `["*"]` in production config
- No CSP or security headers middleware observed — add `starlette-middleware` or similar

---

## NOTES

- Phase 2.5 added security hardening and 88 edge case tests
- Known bugs in `api_test.py` are documented but NOT yet fixed — they are test assertions that currently fail or are skipped
- Dashboard and alert service size is the most immediate refactoring need before Phase 5 polish
