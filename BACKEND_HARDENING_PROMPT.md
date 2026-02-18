# Backend Hardening Prompt - Production Bulletproof

> העתק הכל מתחת ל-`---` לסשן חדש של Claude Code בתיקיית הפרויקט.

---

אתה ארכיטקט Backend בכיר. הבקנד עבר כבר סבב ראשון של תיקוני באגים (RED/ORANGE/YELLOW).
עכשיו המשימה: להקשיח הכל ל-**100% production-ready bulletproof**.

קרא את BACKEND_AUDIT_REPORT.md, AUDIT_REPORT.md, ו-PLAN.md לפני שאתה מתחיל.
הרץ `cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v --tb=short` כדי לראות מצב נוכחי.

## Tech Stack

- Python 3.9.6 - חובה `from __future__ import annotations` בכל קובץ
- לעולם לא `X | Y` → תמיד `Optional[X]` או `Union[X, Y]`
- FastAPI 0.115.6 + SQLAlchemy 2.0.36 async + PostgreSQL 16 + Alembic
- bcrypt==4.0.1 (לא לשדרג!)

## כללי ברזל

1. לא לגעת ב-`frontend/` בכלל
2. לא לשבור API contract קיים (אפשר להוסיף שדות, לא לשנות/למחוק)
3. שינויי DB רק דרך Alembic migration
4. כל תיקון = טסט חדש
5. `from __future__ import annotations` בכל קובץ חדש
6. הרץ טסטים אחרי כל שלב
7. אל תחכה לפידבק - עבוד ברצף עד הסוף

## סדר עבודה - 8 שלבים

```
שלב 1: Cross-Module Integration Tests (12 טסטים)
שלב 2: Security Hardening (OWASP)
שלב 3: Performance Optimization
שלב 4: Error Handling Standardization
שלב 5: Missing MEDIUM Issues from AUDIT_REPORT
שלב 6: Missing LOW Issues from AUDIT_REPORT
שלב 7: API Documentation & Validation Completeness
שלב 8: Final Full Test Run + Coverage Report
```

---

## שלב 1: Cross-Module Integration Tests

צור `tests/test_cross_module_integration.py` עם 12+ טסטים שבודקים flow-ים שלמים:

```python
# 1. Full Transaction Lifecycle
# צור user → צור category → צור transaction → עדכן → מחק
# וודא: category count מתעדכן, dashboard summary משתנה

# 2. Installment Full Cycle
# צור installment 3 תשלומים → mark-paid x3 → וודא completed
# וודא: transactions נוצרו, סכומים נכונים, rounding תקין

# 3. Loan Full Cycle
# צור loan → שלם 3 תשלומים → וודא remaining_balance
# וודא: amortization schedule מתעדכן, ריבית מחושבת נכון

# 4. Forecast Accuracy
# צור fixed income + fixed expense + installment + loan
# קרא forecast → וודא שהסכומים נכונים ל-3 חודשים

# 5. Alert Generation Flow
# הגדר threshold → צור forecast שלילי → וודא alert נוצר
# dismiss alert → וודא לא חוזר

# 6. Category Cascade
# צור category → צור 5 transactions → archive category
# וודא: transactions עדיין קיימות, category לא ניתנת לשימוש חדש

# 7. User Isolation
# צור 2 users → כל אחד עם transactions
# user A לא רואה data של user B (בכל endpoint!)

# 8. Settings Impact
# שנה currency → וודא שנשמר
# שנה week_start_day → וודא dashboard weekly מתעדכן

# 9. Balance History
# עדכן balance 5 פעמים → וודא history שלם
# וודא: רק 1 is_current=True

# 10. Automation Idempotency
# הרץ process-recurring פעמיים לאותו חודש
# וודא: לא נוצרו כפילויות

# 11. Bulk Operations
# bulk-create 50 transactions → bulk-delete 25
# וודא: pagination, count, data integrity

# 12. Payment Reversal Flow
# installment: mark-paid → reverse → mark-paid again
# loan: payment → reverse → payment again
# וודא: counts חוזרים, balances נכונים
```

## שלב 2: Security Hardening

### 2.1 OWASP Top 10 Checks
קרא כל endpoint ווודא:

**Injection Prevention:**
- [ ] כל query משתמש ב-parameterized (SQLAlchemy handles this - verify no raw SQL)
- [ ] strip_tags על כל text input (כבר מיושם - verify coverage)
- [ ] path parameters validated (UUID format)

**Authentication:**
- [ ] כל endpoint (חוץ מ-auth) דורש token
- [ ] Token expiry enforced (15 min access, 7 days refresh)
- [ ] Password minimum length enforced (min 8 chars)
- [ ] Password hashing with bcrypt (verify rounds >= 10)

**Authorization:**
- [ ] כל query מסונן ב-`user_id == current_user.id`
- [ ] Admin endpoints check `is_admin`
- [ ] User can't modify other user's data
- **בדיקה קריטית**: סרוק כל endpoint ב-`app/api/v1/endpoints/` ווודא שאין query בלי user_id filter

**Rate Limiting:**
- [ ] `/auth/login` - 5/minute
- [ ] `/auth/register` - 3/minute
- [ ] `/auth/refresh` - 10/minute
- [ ] Bulk endpoints - limit on batch size (max 100)
- [ ] הוסף rate limit על `/automation/process-recurring` (1/minute)

**Security Headers (app/main.py):**
וודא שכל ה-headers האלה קיימים:
```python
"X-Content-Type-Options": "nosniff"
"X-Frame-Options": "DENY"
"X-XSS-Protection": "1; mode=block"
"Strict-Transport-Security": "max-age=31536000; includeSubDomains"
"Content-Security-Policy": "default-src 'self'"
"Referrer-Policy": "strict-origin-when-cross-origin"
"Permissions-Policy": "camera=(), microphone=(), geolocation=()"
```

**CORS:**
- [ ] וודא ש-CORS_ORIGINS לא כולל `*` (wildcard)
- [ ] רק `http://localhost:5173` ב-development

### 2.2 Data Exposure Prevention
- [ ] Password hash לעולם לא מוחזר ב-response
- [ ] User responses לא כוללים sensitive fields
- [ ] Error messages לא חושפים internal details (no stack traces)
- [ ] DB connection string לא ב-logs

כתוב `tests/test_security_hardening.py`:
```python
# 1. Cross-user access attempts (user A tries to read/update/delete user B's data)
# 2. Expired token rejected
# 3. Blacklisted token rejected
# 4. Password not in response
# 5. Admin-only endpoint blocked for regular user
# 6. Rate limit enforced
# 7. SQL injection attempt handled
# 8. XSS in text field stripped
# 9. Oversized request body rejected
# 10. Invalid UUID in path returns 422 (not 500)
```

## שלב 3: Performance Optimization

### 3.1 Database Queries
- [ ] `selectinload` על כל relationship שנקרא (Transaction→Category כבר נעשה)
- [ ] Index audit: וודא שכל שדה שמסוננים/ממיינים לפיו has index:
  - `transactions.date` - index
  - `transactions.user_id` - index
  - `transactions.category_id` - index
  - `fixed_income_expenses.user_id + is_active` - composite index
  - `alerts.user_id + is_dismissed` - composite index
  - `bank_balances.user_id + is_current` - composite index
- [ ] No N+1 in dashboard endpoints (use subqueries or joins)
- [ ] Pagination upper bound `le=100` on ALL list endpoints

### 3.2 Connection Pool
וודא ב-`app/db/session.py`:
```python
pool_size=10
max_overflow=20
pool_pre_ping=True
pool_recycle=3600
```

### 3.3 Response Size
- [ ] List endpoints don't return nested relationships by default (only with `?include=` param)
- [ ] Dashboard summary uses aggregation queries (not fetch-all-then-calculate)

## שלב 4: Error Handling Standardization

### 4.1 Consistent Error Format
צור `app/core/error_response.py`:
```python
from __future__ import annotations

def error_response(status_code: int, message: str, detail: Optional[str] = None) -> dict:
    return {
        "error": {
            "status_code": status_code,
            "message": message,
            "detail": detail
        }
    }
```

### 4.2 Consistent Status Codes
וודא בכל ה-endpoints:
| מצב | Status Code |
|-----|------------|
| Not found | 404 |
| Validation error | 400 |
| Schema validation | 422 (Pydantic auto) |
| Already exists | 409 |
| Unauthorized | 401 |
| Forbidden | 403 |
| Rate limited | 429 |
| Server error | 500 |

### 4.3 Global Exception Handler
וודא ב-`app/main.py` שיש handlers ל:
- `IntegrityError` → 409
- `DataError` → 400
- `NoResultFound` → 404
- General `Exception` → 500 (log full trace, return generic message)

## שלב 5: MEDIUM Issues from AUDIT_REPORT

### M-1: Inconsistent error messages
סטנדרטיזציה: כל error message באנגלית, descriptive, actionable.
```python
# BAD: "error"
# GOOD: "Category not found with id: {category_id}"
```

### M-2: Pagination upper bound
כבר מכוסה (le=100) - verify על כל endpoint.

### M-4: Request ID tracking
הוסף middleware שמייצר UUID לכל request ומוסיף ל-response headers:
```python
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

### M-5: Alembic migrations testable
וודא שכל migration יש לה `upgrade()` ו-`downgrade()` תקינים.

### M-6: DB connection pool
כבר מכוסה בשלב 3.

### M-10: Settings schema arbitrary keys
וודא ש-Settings schema מקבל רק שדות מוגדרים (Pydantic `model_config = ConfigDict(extra='forbid')`).

### M-11: Cascade delete
וודא שכל relationship מוגדר עם cascade מתאים:
- User → all children: `cascade="all, delete-orphan"`
- Category → transactions: `SET NULL` (not cascade delete)

### M-12: Test fixtures
וודא שכל test fixture יוצר data נקי ולא משתף state בין טסטים.

## שלב 6: LOW Issues from AUDIT_REPORT

### L-1: Timezone info
הוסף `timezone=True` לכל DateTime column, או וודא שכל datetime saved as UTC.

### L-2: Settings validation completeness
כבר מכוסה (ORANGE-8 regex patterns).

### L-3: Audit logging for mutations
הוסף logging.info לכל create/update/delete operation:
```python
logger.info(f"User {user_id} created transaction {transaction.id}")
```

### L-4: Response size limit
הוסף max response size middleware או limit on list endpoints.

### L-5: Query timeout
הוסף `statement_timeout` לדatabase connection:
```python
connect_args={"server_settings": {"statement_timeout": "30000"}}  # 30 seconds
```

### L-6: API versioning header
הוסף `X-API-Version: v1` header לכל response.

## שלב 7: API Validation Completeness

### 7.1 Schema Audit
קרא כל schema ב-`app/api/v1/schemas/` ווודא:
- [ ] כל שדה חובה marked as required
- [ ] כל שדה אופציונלי has default value
- [ ] Financial amounts: `Field(ge=0, max_digits=15, decimal_places=2)`
- [ ] Strings: `Field(min_length=1, max_length=X)`
- [ ] Dates: proper validation
- [ ] Enums: pattern validation or Literal types

### 7.2 Missing Validations
- [ ] Transaction amount > 0
- [ ] Category name unique per user+type
- [ ] Fixed end_date >= start_date
- [ ] Installment number_of_payments >= 1
- [ ] Loan total_payments >= 1
- [ ] Loan interest_rate >= 0
- [ ] Balance amount can be negative (valid for overdraft)
- [ ] Alert title and message not empty

### 7.3 API Response Consistency
- [ ] All list endpoints return `{ items: [...], total: N, page: N, page_size: N }`
- [ ] All single-item endpoints return the item directly
- [ ] All create endpoints return 201 (not 200)
- [ ] All delete endpoints return 204 (no content) or 200 with confirmation

## שלב 8: Final Full Test Run

```bash
cd backend && source venv/bin/activate
PYTHONPATH=. pytest tests/ -v --tb=short 2>&1 | tail -50
```

אם יש failures - תקן אותם. חזור על הריצה עד 0 failures.

לאחר מכן כתוב סיכום סופי:

```
=== BACKEND HARDENING COMPLETE ===

Tests:
- Total tests: XXX
- Passing: XXX
- Failing: 0

Files modified: [list]
Files created: [list]
Migrations added: [list]

Security:
- [ ] OWASP Top 10 addressed
- [ ] Cross-user isolation verified
- [ ] Rate limiting on all sensitive endpoints
- [ ] Token revocation working
- [ ] HTML sanitization on all text fields
- [ ] Security headers complete

Performance:
- [ ] No N+1 queries
- [ ] All list endpoints paginated (max 100)
- [ ] Connection pool configured
- [ ] Indexes verified

Quality:
- [ ] Consistent error format
- [ ] Request ID tracking
- [ ] Structured logging
- [ ] Schema validation complete
- [ ] All endpoints tested

Issues remaining: [list any that couldn't be fixed + reason]
```

עבוד ברצף. אל תחכה לפידבק. לפני כל edit קרא את הקובץ.
הרץ טסטים אחרי כל שלב.

---

> **END OF PROMPT**
