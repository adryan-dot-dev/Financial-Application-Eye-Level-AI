# Backend Production Readiness Audit — Cashflow.ai

## הוראות לסוכן

אתה **Backend Production Readiness Auditor** עבור אפליקציית Cashflow.ai.

**מיקום הפרויקט:** `/Users/roeiedri/dev/Financial-Application-Eye-Level-AI`

**המשימה שלך:** בצע ביקורת מקיפה לפני פרודקשן על ה-Backend, תקן כל מה שנמצא, והריץ מחדש עד שהכל מושלם.

---

## שלב 1: Discovery (הרץ קודם!)

```bash
bash ~/.claude/skills/fastapi-prod-readiness/scripts/discover.sh /Users/roeiedri/dev/Financial-Application-Eye-Level-AI
```

## שלב 2: הרץ את כל הטסטים הקיימים

```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v --tb=short 2>&1
```

רשום כמה טסטים עברו, כמה נכשלו, ומה השגיאות.

## שלב 3: סריקת אבטחה

```bash
bash ~/.claude/skills/fastapi-prod-readiness/scripts/security_scan.sh /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
```

## שלב 4: בדיקת DB

```bash
bash ~/.claude/skills/fastapi-prod-readiness/scripts/db_check.sh /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
```

## שלב 5: ביקורת קוד מעמיקה (AI Analysis)

קרא את הקבצים הבאים וחפש בעיות:

### 5.1 Python 3.9 Compatibility
- חפש `list[`, `dict[`, `tuple[`, `X | Y` בכל קבצי `.py` תחת `app/`
- ודא ש-`from __future__ import annotations` קיים בכל קובץ

### 5.2 Endpoint Security
- בדוק שכל endpoint (חוץ מ-register/login/health) משתמש ב-`Depends(get_current_user)`
- חפש endpoints שלא מסננים לפי `user_id`

### 5.3 Financial Precision
- ודא ש-`DECIMAL(15,2)` בכל עמודות כספיות
- בדוק שאין `float()` על סכומים
- ודא שיש `currency` בכל טבלה כספית

### 5.4 Pagination
- ודא שכל endpoint שמחזיר רשימה יש `page_size: int = Query(X, ge=1, le=100)`

### 5.5 Error Handling
- אין `bare except:`
- אין stack traces ב-production responses
- פורמט שגיאה אחיד

## שלב 6: תיקונים (CRITICAL → HIGH → MEDIUM)

לכל בעיה שנמצאה:
1. תקן את הקוד
2. הריץ `PYTHONPATH=. pytest tests/ -v` לוודא שלא שברת כלום
3. אם הטסט נשבר — תקן גם אותו

**חוקים קריטיים:**
- Python 3.9.6 — אין `X | Y` union syntax
- `from __future__ import annotations` בכל קובץ
- DECIMAL(15,2) לכל סכום כספי
- `user_id == current_user.id` בכל query
- Auth required בכל endpoint
- Pagination enforced (le=100)
- bcrypt 4.0.1 (pinned)
- Async everywhere

## שלב 7: טסטים חדשים

כתוב טסטים עבור מודולים שאין להם:
- `tests/test_users_admin.py` — 15 טסטים
- `tests/test_subscriptions.py` — 12 טסטים
- `tests/test_backups.py` — 8 טסטים
- `tests/test_export.py` — 8 טסטים
- `tests/test_currency.py` — 5 טסטים
- `tests/test_rate_limiting.py` — 6 טסטים

**יעד:** 60+ טסטים חדשים, 0 failures.

## שלב 8: Re-test Loop

```
WHILE failures > 0 AND iteration < 3:
    1. הרץ pytest
    2. תקן כשלים
    3. הרץ שוב
    iteration++
```

## שלב 9: דוח סופי

כתוב דוח ל-`docs/prod_readiness_report.md` עם:
- ציון כולל (X/10)
- Verdict: PASS / CONCERNS / FAIL
- רשימת תיקונים שבוצעו
- פריטים שנותרו לטיפול ידני

---

## מה "סיים" נראה כמו

- [ ] 0 Python 3.9 compatibility issues
- [ ] כל ה-endpoints מפוגנים (auth + pagination)
- [ ] 60+ טסטים חדשים
- [ ] `pytest tests/ -v` = 0 failures
- [ ] סריקת אבטחה = 0 Critical, 0 High
- [ ] בדיקת DB = 0 Critical issues
- [ ] דוח prod_readiness_report.md נכתב
- [ ] כל תיקון אומת עם טסט

---

## הערות לפרונט (אל תעשה — רק תעדכן!)

אם מצאת בעיות שנוגעות לפרונט (API contracts, response formats), רשום אותן ב-`docs/frontend_notes.md` אבל **אל תשנה קוד פרונט**.
