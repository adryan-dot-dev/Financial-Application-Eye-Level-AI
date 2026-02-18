# Cash Flow Management - Backend & Database Guide

## מדריך מקיף לבקאנד ולבסיס הנתונים

**עדכון אחרון:** פברואר 2026
**גרסת Backend:** Phase 2.5 (67 API routes, 155+ tests)

---

## תוכן עניינים

1. [ארכיטקטורה כללית](#1-ארכיטקטורה-כללית)
2. [סכמת בסיס הנתונים](#2-סכמת-בסיס-הנתונים)
3. [מערכת ההרשאות והאימות](#3-מערכת-ההרשאות-והאימות)
4. [כל ה-API Endpoints](#4-כל-ה-api-endpoints)
5. [לוגיקה עסקית ותרחישים](#5-לוגיקה-עסקית-ותרחישים)
6. [מערכת המטבעות](#6-מערכת-המטבעות)
7. [מערכת הגיבויים](#7-מערכת-הגיבויים)
8. [מעקב פעולות - Audit Trail](#8-מעקב-פעולות---audit-trail)
9. [מערכת התזמון - Scheduler](#9-מערכת-התזמון---scheduler)
10. [אבטחת מידע](#10-אבטחת-מידע)
11. [ביצועים ואופטימיזציה](#11-ביצועים-ואופטימיזציה)
12. [Alembic Migrations](#12-alembic-migrations)
13. [פקודות שימושיות](#13-פקודות-שימושיות)

---

## 1. ארכיטקטורה כללית

### סקירה

המערכת בנויה בארכיטקטורת **3-Tier** עם הפרדה ברורה בין שכבות:

```
┌─────────────────────────────────────────────────────┐
│                     Frontend                         │
│            React 18 + TypeScript + Vite              │
│          Tailwind CSS v4 + shadcn/ui + Recharts      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────┐     HTTP/JSON      ┌────────────┐  │
│  │   Browser    │ ◄──────────────► │  FastAPI    │  │
│  │   (Axios)    │   JWT Bearer      │  Backend   │  │
│  └─────────────┘                    └─────┬──────┘  │
│                                           │          │
├───────────────────────────────────────────┼──────────┤
│                                           │          │
│  ┌────────────────────────────────────────┴───────┐  │
│  │              PostgreSQL 16                      │  │
│  │         SQLAlchemy 2.0 (Async) + Alembic       │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Stack טכנולוגי

| רכיב | טכנולוגיה | תפקיד |
|------|----------|-------|
| Web Framework | FastAPI | API-first, async, auto-docs, Pydantic |
| ORM | SQLAlchemy 2.0 (async) | Typed models, async queries |
| Database | PostgreSQL 16 | ACID, financial precision |
| Migrations | Alembic | Version control למבנה DB |
| Auth | JWT (python-jose) | Access + Refresh tokens |
| Password | bcrypt (passlib) | Hashing מאובטח |
| HTTP Client | httpx | שערי חליפין (async) |
| Scheduler | APScheduler | חיובים חוזרים, גיבויים |
| Validation | Pydantic v2 | Schema validation |

### מבנה תיקיות הבקאנד

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, startup/shutdown
│   ├── config.py                  # Pydantic Settings (env vars)
│   │
│   ├── api/
│   │   ├── deps.py                # Dependencies (auth, DataContext)
│   │   └── v1/
│   │       ├── endpoints/         # 20 endpoint files
│   │       │   ├── auth.py
│   │       │   ├── users.py
│   │       │   ├── transactions.py
│   │       │   ├── categories.py
│   │       │   ├── fixed.py
│   │       │   ├── installments.py
│   │       │   ├── loans.py
│   │       │   ├── balance.py
│   │       │   ├── forecast.py
│   │       │   ├── alerts.py
│   │       │   ├── settings.py
│   │       │   ├── dashboard.py
│   │       │   ├── backups.py
│   │       │   ├── currency.py
│   │       │   ├── organizations.py
│   │       │   ├── export.py
│   │       │   ├── subscriptions.py
│   │       │   ├── expected_income.py
│   │       │   └── automation.py
│   │       └── schemas/           # Pydantic schemas
│   │
│   ├── core/
│   │   ├── security.py            # JWT, bcrypt, blacklist
│   │   ├── exceptions.py          # Custom exceptions
│   │   └── slow_query_logger.py   # Slow query monitoring
│   │
│   ├── db/
│   │   ├── session.py             # Engine, session factory
│   │   └── models/                # 17 SQLAlchemy models
│   │       ├── __init__.py
│   │       ├── user.py
│   │       ├── settings.py
│   │       ├── category.py
│   │       ├── transaction.py
│   │       ├── fixed_income_expense.py
│   │       ├── installment.py
│   │       ├── loan.py
│   │       ├── bank_balance.py
│   │       ├── expected_income.py
│   │       ├── alert.py
│   │       ├── subscription.py
│   │       ├── backup.py
│   │       ├── organization.py
│   │       ├── org_member.py
│   │       ├── org_settings.py
│   │       ├── audit_log.py
│   │       └── forecast_scenario.py
│   │
│   └── services/                  # Business logic (8 services)
│       ├── forecast_service.py
│       ├── alert_service.py
│       ├── audit_service.py
│       ├── backup_service.py
│       ├── exchange_rate_service.py
│       ├── scheduler.py
│       ├── automation_service.py
│       └── financial_aggregator.py
│
├── alembic/                       # Migration files
├── tests/                         # pytest tests (155+)
├── scripts/                       # Seed data, utilities
└── requirements.txt
```

### Data Flow - איך בקשה זורמת במערכת

```
1. Client שולח HTTP Request עם JWT token
       │
2. FastAPI middleware (CORS, rate limit)
       │
3. Dependency Injection:
   ├── get_current_user()  → מאמת JWT, בודק blacklist, בודק is_active
   ├── get_data_context()  → קובע personal vs org context
   └── get_base_currency() → מושך מטבע בסיס מ-Settings
       │
4. Endpoint handler:
   ├── Validates input (Pydantic schema)
   ├── Applies ownership_filter() לכל query
   ├── Calls service layer (if complex logic)
   └── Returns response (Pydantic model)
       │
5. Audit logging (fire-and-forget)
       │
6. DB commit + response to client
```

---

## 2. סכמת בסיס הנתונים

### סקירת כל הטבלאות (17 מודלים)

```
┌──────────────────────────────────────────────────────────┐
│                     Core Tables                           │
│  ┌────────┐  ┌──────────┐  ┌──────────────┐             │
│  │ users  │  │ settings │  │ categories   │             │
│  └───┬────┘  └──────────┘  └──────────────┘             │
│      │                                                    │
│      ├──── Financial Tables ─────────────────────────────│
│      │  ┌──────────────┐  ┌───────────────────┐         │
│      ├─►│ transactions │  │ fixed_income_exp. │         │
│      │  └──────────────┘  └───────────────────┘         │
│      │  ┌──────────────┐  ┌──────────────┐              │
│      ├─►│ installments │  │    loans     │              │
│      │  └──────────────┘  └──────────────┘              │
│      │  ┌──────────────┐  ┌──────────────┐              │
│      ├─►│ subscriptions│  │ bank_balance │              │
│      │  └──────────────┘  └──────────────┘              │
│      │  ┌──────────────┐  ┌──────────────────┐          │
│      ├─►│   alerts     │  │ expected_income  │          │
│      │  └──────────────┘  └──────────────────┘          │
│      │  ┌──────────────────┐                             │
│      └─►│ forecast_scenario│                             │
│         └──────────────────┘                             │
│                                                           │
│      ├──── Organization Tables ──────────────────────────│
│      │  ┌──────────────┐  ┌──────────────┐              │
│      ├─►│organizations │  │ org_members  │              │
│      │  └──────────────┘  └──────────────┘              │
│      │  ┌──────────────┐                                 │
│      └─►│ org_settings │                                 │
│         └──────────────┘                                 │
│                                                           │
│      ├──── System Tables ────────────────────────────────│
│         ┌──────────────┐  ┌──────────────┐              │
│         │  audit_logs  │  │   backups    │              │
│         └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────┘
```

---

### 2.1 Users - משתמשים

**קובץ:** `app/db/models/user.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה ייחודי, נוצר אוטומטית |
| `username` | VARCHAR | שם משתמש, ייחודי |
| `email` | VARCHAR | אימייל, ייחודי |
| `password_hash` | VARCHAR | סיסמה מוצפנת (bcrypt) |
| `is_active` | BOOLEAN | פעיל/חסום (default: True) |
| `is_admin` | BOOLEAN | הרשאות אדמין (default: False) |
| `is_super_admin` | BOOLEAN | סופר-אדמין, לא ניתן למחיקה (default: False) |
| `current_organization_id` | UUID (FK) | ארגון נוכחי (None = אישי) |
| `password_changed_at` | DATETIME | מתי הסיסמה שונתה לאחרונה |
| `created_at` | DATETIME | תאריך יצירה |
| `updated_at` | DATETIME | תאריך עדכון אחרון |

**קשרים:**
- `transactions` - כל הטרנזקציות של המשתמש
- `categories` - הקטגוריות שיצר
- `fixed_items` - הכנסות/הוצאות קבועות
- `installments` - תשלומים בפריסה
- `loans` - הלוואות
- `subscriptions` - מנויים
- `settings` - הגדרות אישיות
- `bank_balances` - יתרות בנק
- `alerts` - התראות
- `expected_incomes` - הכנסות צפויות

**דגשים חשובים:**
- `is_super_admin` מגן על המשתמש ממחיקה או שינוי הרשאות
- `current_organization_id` קובע אם המשתמש עובד בהקשר אישי (None) או ארגוני
- `password_changed_at` משמש לביטול אוטומטי של טוקנים ישנים

---

### 2.2 Settings - הגדרות

**קובץ:** `app/db/models/settings.py`

| עמודה | סוג | ברירת מחדל | תיאור |
|-------|-----|-----------|-------|
| `id` | UUID (PK) | auto | מזהה |
| `user_id` | UUID (FK, unique) | - | משתמש (1:1) |
| `currency` | VARCHAR(3) | "ILS" | מטבע בסיס |
| `language` | VARCHAR(5) | "he" | שפת ממשק |
| `theme` | VARCHAR(10) | "light" | ערכת נושא |
| `notifications_enabled` | BOOLEAN | True | התראות פעילות |
| `forecast_months_default` | INTEGER | 6 | חודשי צפי ברירת מחדל |
| `week_start_day` | INTEGER | 0 | יום תחילת שבוע (0=ראשון) |
| `alert_warning_threshold` | DECIMAL | 5000 | סף אזהרה (שקלים) |
| `alert_critical_threshold` | DECIMAL | 1000 | סף קריטי (שקלים) |
| `onboarding_completed` | BOOLEAN | False | האם השלים הכשרה |

**התנהגות מיוחדת:**
- אם אין רשומת Settings למשתמש, ה-GET endpoint יוצר אחת אוטומטית עם ברירות מחדל
- Settings הן תמיד אישיות (per-user) ולא מושפעות מהקשר ארגוני

---

### 2.3 Categories - קטגוריות

**קובץ:** `app/db/models/category.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון (None = אישי) |
| `name` | VARCHAR | שם באנגלית |
| `name_he` | VARCHAR (nullable) | שם בעברית |
| `type` | VARCHAR | "income" / "expense" |
| `icon` | VARCHAR (nullable) | שם אייקון |
| `color` | VARCHAR (nullable) | צבע (hex) |
| `parent_id` | UUID (FK, nullable) | קטגוריית אב (self-referential) |
| `is_archived` | BOOLEAN | soft delete (default: False) |
| `display_order` | INTEGER | סדר תצוגה (default: 0) |

**דגשים:**
- **Soft Delete:** קטגוריות לא נמחקות - רק מסומנות `is_archived = True`
- **היררכיה:** תמיכה בקטגוריות אב-בן דרך `parent_id`
- **מניעת מעגליות:** הקוד בודק שלא נוצרים לולאות בהיררכיה
- **שינוי סוג:** לא ניתן לשנות `type` אם יש טרנזקציות מקושרות

---

### 2.4 Transactions - טרנזקציות

**קובץ:** `app/db/models/transaction.py`

זוהי הטבלה המרכזית במערכת - מכילה את כל התנועות הפיננסיות.

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `amount` | DECIMAL(15,2) | סכום (תמיד חיובי) |
| `currency` | VARCHAR(3) | מטבע (default: "ILS") |
| `original_currency_amount` | DECIMAL(15,2) | סכום מקורי (לפני המרה) |
| `original_currency` | VARCHAR(3) | מטבע מקורי |
| `exchange_rate` | DECIMAL(15,6) | שער חליפין ששימש |
| `type` | VARCHAR | "income" / "expense" |
| `entry_pattern` | VARCHAR | "one_time" / "recurring" / "installment" |
| `category_id` | UUID (FK, nullable) | קטגוריה |
| `description` | TEXT (nullable) | תיאור |
| `date` | DATE | תאריך הטרנזקציה |
| `tags` | ARRAY(VARCHAR) | תגיות (מערך) |
| `is_recurring` | BOOLEAN | האם נוצרה אוטומטית |
| `recurring_source_id` | UUID (nullable) | מזהה המקור הקבוע |
| `installment_id` | UUID (FK, nullable) | מזהה פריסה |
| `installment_number` | INTEGER (nullable) | מספר תשלום בפריסה |
| `loan_id` | UUID (FK, nullable) | מזהה הלוואה |

**Constraints:**
```sql
-- סכום חייב להיות חיובי
CHECK (amount > 0)  -- "positive_amount"
```

**Indexes (7 אינדקסים מורכבים):**
```
idx_tx_user_date        → (user_id, date)
idx_tx_user_type        → (user_id, type)
idx_tx_user_category    → (user_id, category_id)
idx_tx_date             → (date)
idx_tx_org              → (organization_id)
idx_tx_recurring_source → (recurring_source_id)
idx_tx_installment      → (installment_id)
```

**דגשים:**
- `amount` תמיד חיובי, הסוג (income/expense) קובע את הכיוון
- Multi-currency: הסכום ב-`amount` הוא תמיד במטבע הבסיס. הסכום המקורי נשמר ב-`original_currency_amount`
- `is_recurring = True` + `recurring_source_id` מסמנים טרנזקציה שנוצרה אוטומטית ע"י ה-Scheduler
- `installment_id` + `installment_number` מקשרים לפריסת תשלומים

---

### 2.5 FixedIncomeExpense - הכנסות/הוצאות קבועות

**קובץ:** `app/db/models/fixed_income_expense.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `name` | VARCHAR | שם (למשל "משכורת", "שכירות") |
| `amount` | DECIMAL(15,2) | סכום חודשי |
| `currency` | VARCHAR(3) | מטבע |
| `type` | VARCHAR | "income" / "expense" |
| `category_id` | UUID (FK, nullable) | קטגוריה |
| `day_of_month` | INTEGER | יום בחודש (1-31) |
| `start_date` | DATE | תאריך התחלה |
| `end_date` | DATE (nullable) | תאריך סיום (None = לתמיד) |
| `is_active` | BOOLEAN | פעיל (default: True) |
| `paused_at` | DATETIME (nullable) | מתי הושהה |
| `resumed_at` | DATETIME (nullable) | מתי חודש |
| `description` | TEXT (nullable) | הערות |

**תרחיש:**
משכורת של 25,000 שקל ב-10 לכל חודש:
```json
{
  "name": "משכורת",
  "amount": 25000,
  "type": "income",
  "day_of_month": 10,
  "start_date": "2026-01-01",
  "end_date": null,
  "is_active": true
}
```

---

### 2.6 Installments - תשלומים בפריסה

**קובץ:** `app/db/models/installment.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `name` | VARCHAR | שם (למשל "מזגן חדש") |
| `total_amount` | DECIMAL(15,2) | סכום כולל |
| `monthly_amount` | DECIMAL(15,2) | תשלום חודשי |
| `currency` | VARCHAR(3) | מטבע |
| `type` | VARCHAR | "income" / "expense" |
| `category_id` | UUID (FK, nullable) | קטגוריה |
| `number_of_payments` | INTEGER | מספר תשלומים |
| `payments_completed` | INTEGER | תשלומים ששולמו |
| `day_of_month` | INTEGER | יום חיוב |
| `start_date` | DATE | תאריך התחלה |
| `description` | TEXT (nullable) | הערות |

**חישוב תשלום חודשי:**
```python
# תשלום רגיל
monthly_amount = total_amount / number_of_payments

# תשלום אחרון - תיקון עיגול
# אם total_amount = 1000, payments = 3:
#   רגיל: 333.33 * 2 = 666.66
#   אחרון: 1000 - 666.66 = 333.34  (תיקון של 0.01)
```

---

### 2.7 Loans - הלוואות

**קובץ:** `app/db/models/loan.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `name` | VARCHAR | שם ההלוואה |
| `original_amount` | DECIMAL(15,2) | סכום מקורי |
| `monthly_payment` | DECIMAL(15,2) | תשלום חודשי |
| `interest_rate` | DECIMAL(5,2) | ריבית שנתית (%) |
| `total_payments` | INTEGER | סה"כ תשלומים |
| `payments_made` | INTEGER | תשלומים ששולמו |
| `remaining_balance` | DECIMAL(15,2) | יתרה לתשלום |
| `status` | VARCHAR | "active" / "completed" / "paused" |
| `day_of_month` | INTEGER | יום חיוב |
| `start_date` | DATE | תאריך התחלה |
| `category_id` | UUID (FK, nullable) | קטגוריה |
| `currency` | VARCHAR(3) | מטבע |

**לוח סילוקין (Amortization - שיטת שפיצר):**

כל תשלום מפוצל לקרן וריבית:
```python
# חישוב ריבית חודשית
monthly_rate = interest_rate / 100 / 12

# חישוב חלק הריבית בתשלום
interest_portion = remaining_balance * monthly_rate

# חישוב חלק הקרן
principal_portion = monthly_payment - interest_portion

# עדכון יתרה
new_remaining = remaining_balance - principal_portion

# תשלום אחרון: מסגר את כל היתרה
if payment_number == total_payments:
    principal_portion = remaining_balance
    actual_payment = remaining_balance + interest_portion
```

**סטטוסים בלוח סילוקין:**
| סטטוס | משמעות |
|--------|--------|
| `paid` | שולם (payment_number <= payments_made) |
| `overdue` | באיחור (תאריך עבר, טרם שולם) |
| `due` | לתשלום החודש |
| `future` | עתידי |

---

### 2.8 Subscriptions - מנויים

**קובץ:** `app/db/models/subscription.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `name` | VARCHAR | שם המנוי |
| `amount` | DECIMAL(15,2) | סכום |
| `currency` | VARCHAR(3) | מטבע |
| `type` | VARCHAR | "income" / "expense" |
| `category_id` | UUID (FK, nullable) | קטגוריה |
| `billing_cycle` | VARCHAR | "monthly" / "quarterly" / "semi_annual" / "annual" |
| `start_date` | DATE | תאריך התחלה |
| `next_renewal_date` | DATE | תאריך חידוש הבא |
| `auto_renew` | BOOLEAN | חידוש אוטומטי |
| `is_active` | BOOLEAN | פעיל |
| `provider` | VARCHAR (nullable) | ספק (למשל "Netflix") |
| `provider_url` | VARCHAR (nullable) | קישור לספק |

---

### 2.9 BankBalance - יתרות בנק

**קובץ:** `app/db/models/bank_balance.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `balance` | DECIMAL(15,2) | סכום היתרה |
| `currency` | VARCHAR(3) | מטבע |
| `effective_date` | DATE | תאריך תוקף |
| `is_current` | BOOLEAN | האם זו היתרה הנוכחית |
| `notes` | TEXT (nullable) | הערות |

**דגש חשוב:** רק יתרה אחת יכולה להיות `is_current = True` בכל רגע נתון לכל משתמש/ארגון. עדכון יתרה מבטל את הקודמת.

---

### 2.10 Alerts - התראות

**קובץ:** `app/db/models/alert.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `alert_type` | VARCHAR | סוג ההתראה (ראה רשימה) |
| `severity` | VARCHAR | "info" / "warning" / "critical" |
| `title` | VARCHAR | כותרת |
| `message` | TEXT | תוכן מפורט |
| `is_read` | BOOLEAN | נקראה |
| `is_dismissed` | BOOLEAN | בוטלה |
| `snoozed_until` | DATETIME (nullable) | דחייה עד |
| `expires_at` | DATETIME (nullable) | תפוגה |
| `related_entity_type` | VARCHAR (nullable) | סוג ישות קשורה |
| `related_entity_id` | UUID (nullable) | מזהה ישות קשורה |
| `related_month` | DATE (nullable) | חודש קשור |

**9 סוגי התראות:**

| סוג | מבוסס על | חומרה | תנאי |
|-----|---------|-------|------|
| `negative_cashflow` | צפי | warning/critical | יתרת סגירה שלילית |
| `high_expenses` | צפי | info | הפרש נטו < -10,000 |
| `approaching_negative` | צפי | info | יתרה 0 עד critical_threshold |
| `high_single_expense` | ישות | warning | הוצאה בודדת > 5,000 |
| `high_income` | ישות | info | הכנסה > 150% מממוצע 3 חודשים |
| `payment_overdue` | ישות | critical | תשלום שלא בוצע בזמן |
| `upcoming_payment` | ישות | info | תשלום בתוך 3 ימים |
| `loan_ending_soon` | ישות | info | פחות מ-3 תשלומים להלוואה |
| `installment_ending_soon` | ישות | info | פחות מ-2 תשלומים לפריסה |

---

### 2.11 ExpectedIncome - הכנסות צפויות

**קובץ:** `app/db/models/expected_income.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `month` | DATE | חודש (תמיד היום הראשון) |
| `expected_amount` | DECIMAL(15,2) | סכום צפוי |
| `notes` | TEXT (nullable) | הערות |

**UniqueConstraint:** `(user_id, month)` - רק ערך אחד לכל חודש/משתמש.

**התנהגות:** PUT = upsert (עדכון או יצירה).

---

### 2.12 ForecastScenario - תרחישי צפי

**קובץ:** `app/db/models/forecast_scenario.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (FK) | בעלים |
| `organization_id` | UUID (FK, nullable) | ארגון |
| `name` | VARCHAR | שם התרחיש |
| `description` | TEXT (nullable) | תיאור |
| `params` | JSONB | פרמטרים (income_change_pct, expense_change_pct וכו') |
| `months` | INTEGER | מספר חודשי צפי |
| `is_baseline` | BOOLEAN | האם תרחיש בסיס |

**דוגמה לפרמטרים:**
```json
{
  "income_change_pct": -20,
  "expense_change_pct": 10,
  "one_time_income": 50000,
  "one_time_expense": 0
}
```

---

### 2.13 Organization - ארגונים

**קובץ:** `app/db/models/organization.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `name` | VARCHAR | שם הארגון |
| `slug` | VARCHAR (unique) | slug אוטומטי (מבוסס שם) |
| `owner_id` | UUID (FK) | בעלים (יוצר) |
| `is_active` | BOOLEAN | פעיל |
| `description` | TEXT (nullable) | תיאור |

---

### 2.14 OrganizationMember - חברי ארגון

**קובץ:** `app/db/models/org_member.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `organization_id` | UUID (FK) | ארגון |
| `user_id` | UUID (FK) | משתמש |
| `role` | VARCHAR | "member" / "admin" / "owner" |
| `is_active` | BOOLEAN | פעיל |
| `joined_at` | DATETIME | תאריך הצטרפות |

**UniqueConstraint:** `(organization_id, user_id)` - משתמש לא יכול להיות חבר פעמיים באותו ארגון.

---

### 2.15 OrganizationSettings - הגדרות ארגון

**קובץ:** `app/db/models/org_settings.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `organization_id` | UUID (FK, unique) | ארגון (1:1) |
| `currency` | VARCHAR(3) | מטבע ברירת מחדל |
| `date_format` | VARCHAR | פורמט תאריך |
| `alert_warning_threshold` | DECIMAL | סף אזהרה |
| `alert_critical_threshold` | DECIMAL | סף קריטי |

---

### 2.16 AuditLog - לוג ביקורת

**קובץ:** `app/db/models/audit_log.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `user_id` | UUID (**ללא FK**) | מבצע הפעולה |
| `user_email` | VARCHAR (nullable) | אימייל (שרד מחיקת משתמש) |
| `action` | VARCHAR | פעולה (create/update/delete/payment) |
| `entity_type` | VARCHAR | סוג ישות |
| `entity_id` | VARCHAR (nullable) | מזהה ישות |
| `details` | JSONB (nullable) | פרטים נוספים |
| `ip_address` | VARCHAR (nullable) | כתובת IP |
| `user_agent` | VARCHAR (nullable) | דפדפן |
| `organization_id` | UUID (nullable) | ארגון |
| `created_at` | DATETIME | תאריך פעולה |

**למה אין FK ל-users?** כדי שה-audit log ישרוד מחיקת משתמשים. ה-`user_email` מאפשר לזהות מי ביצע את הפעולה גם אחרי שהמשתמש נמחק.

---

### 2.17 Backup - גיבויים

**קובץ:** `app/db/models/backup.py`

| עמודה | סוג | תיאור |
|-------|-----|-------|
| `id` | UUID (PK) | מזהה |
| `backup_type` | VARCHAR | סוג ("full") |
| `filename` | VARCHAR | שם קובץ |
| `file_path` | VARCHAR | נתיב מלא |
| `file_size` | BIGINT (nullable) | גודל בבייטים |
| `status` | VARCHAR | "in_progress" / "completed" / "failed" |
| `created_by` | UUID (nullable) | מי הפעיל (None = אוטומטי) |
| `verification_checksum` | VARCHAR (nullable) | SHA256 |
| `is_verified` | BOOLEAN | עבר אימות |
| `error_message` | TEXT (nullable) | הודעת שגיאה |
| `duration_seconds` | INTEGER (nullable) | זמן ביצוע |
| `completed_at` | DATETIME (nullable) | זמן סיום |

---

## 3. מערכת ההרשאות והאימות

### סקירה כללית

המערכת משתמשת ב-**JWT (JSON Web Tokens)** עם שני סוגי טוקנים:

| סוג | תפוגה | שימוש |
|-----|--------|------|
| Access Token | 15 דקות | כל בקשת API |
| Refresh Token | 7 ימים | חידוש Access Token |

### מבנה ה-JWT

```json
{
  "sub": "user-uuid-here",       // מזהה המשתמש
  "exp": 1708290000,              // תפוגה (Unix timestamp)
  "iat": 1708289100,              // זמן הנפקה
  "type": "access",               // סוג: "access" או "refresh"
  "jti": "unique-token-id"        // מזהה ייחודי (לצורך blacklist)
}
```

### תהליך אימות (קובץ `app/api/deps.py`)

```python
async def get_current_user(credentials, db):
    # 1. פענוח JWT
    payload = decode_token(credentials.credentials)

    # 2. בדיקת סוג טוקן (חייב להיות "access")
    if payload.get("type") != "access":
        raise UnauthorizedException

    # 3. בדיקת Blacklist (JTI)
    if is_token_blacklisted(payload.get("jti")):
        raise UnauthorizedException("Token has been revoked")

    # 4. שליפת משתמש מ-DB
    user = await db.get(User, payload["sub"])

    # 5. בדיקת חסימה
    if not user.is_active:
        raise UnauthorizedException("User is inactive")

    # 6. בדיקת שינוי סיסמה
    if is_token_issued_before_password_change(payload, user.password_changed_at):
        raise UnauthorizedException("Token invalidated by password change")

    return user
```

### Token Blacklist

**מצב נוכחי (MVP):** Set בזיכרון (in-memory).

```python
# security.py
_token_blacklist: Set[str] = set()

def blacklist_token(jti: str) -> None:
    _token_blacklist.add(jti)

def is_token_blacklisted(jti: str) -> bool:
    return jti in _token_blacklist
```

**חסרונות:**
- לא שורד restart של השרת
- לא משותף בין workers

**מסלול שדרוג (Redis):**
```python
# במקום Set בזיכרון:
await redis.setex(f"blacklist:{jti}", ACCESS_TOKEN_EXPIRE_MINUTES * 60, "1")

# בדיקה:
return await redis.exists(f"blacklist:{jti}")
```

### 3 רמות הרשאה

| רמה | Dependency | גישה |
|-----|-----------|------|
| **User** | `get_current_user` | כל endpoints רגילים |
| **Admin** | `get_current_admin` | ניהול משתמשים, גיבויים |
| **Super Admin** | `get_current_super_admin` | לא ניתן למחיקה/שינוי הרשאות |

### Rate Limiting (הגבלת קצב)

| Endpoint | מגבלה |
|----------|-------|
| `POST /auth/register` | 3 בקשות לדקה |
| `POST /auth/login` | 5 בקשות לדקה |
| `POST /auth/refresh` | 10 בקשות לדקה |

### DataContext - הפרדת נתונים אישי/ארגוני

**קובץ:** `app/api/deps.py`

ה-DataContext הוא מנגנון מרכזי שקובע האם המשתמש עובד בהקשר אישי או ארגוני:

```python
@dataclass
class DataContext:
    user_id: UUID                    # המשתמש המאומת
    organization_id: Optional[UUID]  # None = אישי, UUID = ארגוני
    is_org_context: bool             # דגל נוחות

    def ownership_filter(self, model_class):
        """מחזיר תנאי WHERE לשאילתות"""
        if self.is_org_context:
            # ארגוני: כל הנתונים של הארגון
            return model_class.organization_id == self.organization_id
        # אישי: רק הנתונים שלי, בלי ארגון
        return and_(
            model_class.user_id == self.user_id,
            model_class.organization_id.is_(None),
        )

    def create_fields(self) -> dict:
        """שדות ליצירת רשומה חדשה"""
        return {
            "user_id": self.user_id,
            "organization_id": self.organization_id,
        }
```

**כיצד נקבע ההקשר:**
1. אם `current_organization_id` של המשתמש הוא `None` -> הקשר אישי
2. אם יש `current_organization_id` **ויש** חברות פעילה -> הקשר ארגוני
3. אם יש `current_organization_id` **אבל אין** חברות -> fallback להקשר אישי

**שימוש בכל endpoint:**
```python
@router.get("/transactions")
async def list_transactions(
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    query = select(Transaction).where(ctx.ownership_filter(Transaction))
    # ownership_filter מבטיח שהמשתמש רואה רק את הנתונים שלו
```

---

## 4. כל ה-API Endpoints

### 4.1 Auth - אימות (`/api/v1/auth`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `POST` | `/register` | הרשמה (3/min) | פתוח |
| `POST` | `/login` | התחברות (5/min) | פתוח |
| `POST` | `/refresh` | חידוש טוקן (10/min) | Refresh Token |
| `POST` | `/logout` | התנתקות (blacklist) | User |
| `GET` | `/me` | פרטי המשתמש הנוכחי | User |
| `PUT` | `/me` | עדכון פרטים אישיים | User |
| `PUT` | `/password` | שינוי סיסמה | User |

**דוגמת Login:**
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

# Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "uuid-here",
    "username": "admin",
    "email": "admin@example.com",
    "is_admin": true
  }
}
```

---

### 4.2 Users - ניהול משתמשים (`/api/v1/users`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימת משתמשים | Admin |
| `POST` | `/` | יצירת משתמש | Admin |
| `GET` | `/{user_id}` | פרטי משתמש | Admin |
| `PUT` | `/{user_id}` | עדכון משתמש | Admin |
| `DELETE` | `/{user_id}` | מחיקת משתמש | Admin |
| `PUT` | `/{user_id}/reset-password` | איפוס סיסמה | Admin |

**הגנות:**
- לא ניתן למחוק super_admin
- לא ניתן לשנות הרשאות super_admin
- Admin לא יכול להסיר הרשאות admin מעצמו

---

### 4.3 Transactions - טרנזקציות (`/api/v1/transactions`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימה עם סינון ופילטרים | User |
| `POST` | `/` | יצירת טרנזקציה | User |
| `GET` | `/{id}` | פרטי טרנזקציה | User |
| `PUT` | `/{id}` | עדכון | User |
| `DELETE` | `/{id}` | מחיקה | User |
| `POST` | `/bulk` | יצירה מרובה | User |
| `PUT` | `/bulk` | עדכון מרובה | User |
| `DELETE` | `/bulk` | מחיקה מרובה | User |
| `POST` | `/{id}/duplicate` | שכפול טרנזקציה | User |

**פרמטרי סינון (GET):**

| פרמטר | סוג | דוגמה | תיאור |
|--------|-----|-------|-------|
| `date_from` | date | 2026-01-01 | מתאריך |
| `date_to` | date | 2026-01-31 | עד תאריך |
| `type` | string | income | הכנסה/הוצאה |
| `category_id` | UUID | uuid | לפי קטגוריה |
| `amount_min` | decimal | 100 | סכום מינימלי |
| `amount_max` | decimal | 5000 | סכום מקסימלי |
| `search` | string | "משכורת" | חיפוש בתיאור |
| `sort_by` | string | date | שדה מיון |
| `sort_order` | string | desc | כיוון מיון |
| `page` | int | 1 | דף |
| `page_size` | int | 20 | גודל דף |

**דוגמת יצירה עם multi-currency:**
```bash
POST /api/v1/transactions
{
  "amount": 100,
  "currency": "USD",
  "type": "expense",
  "description": "תשלום Stripe",
  "date": "2026-02-15",
  "category_id": "uuid-of-category"
}

# המערכת תמיר אוטומטית ל-ILS (אם זה מטבע הבסיס)
# ותשמור את הסכום המקורי ב-original_currency_amount
```

---

### 4.4 Categories - קטגוריות (`/api/v1/categories`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימת קטגוריות | User |
| `POST` | `/` | יצירה | User |
| `GET` | `/{id}` | פרטים | User |
| `PUT` | `/{id}` | עדכון | User |
| `DELETE` | `/{id}` | מחיקה (soft delete) | User |
| `POST` | `/reorder` | סידור מחדש | User |

**Soft Delete:**
מחיקת קטגוריה מסמנת `is_archived = True` ולא מוחקת מ-DB.

**Reorder:**
```bash
POST /api/v1/categories/reorder
{
  "ordered_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
# מעדכן display_order לכל קטגוריה לפי הסדר
```

---

### 4.5 Fixed Income/Expense - קבועים (`/api/v1/fixed`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימה | User |
| `POST` | `/` | יצירה | User |
| `GET` | `/{id}` | פרטים | User |
| `PUT` | `/{id}` | עדכון | User |
| `DELETE` | `/{id}` | מחיקה | User |
| `POST` | `/{id}/pause` | השהייה | User |
| `POST` | `/{id}/resume` | חידוש | User |

**תרחיש השהייה:**
```bash
# למשל, עובד יצא לחופשה ללא תשלום
POST /api/v1/fixed/{salary-id}/pause

# המערכת מעדכנת:
# is_active = False
# paused_at = datetime.now()

# כשחוזר:
POST /api/v1/fixed/{salary-id}/resume
# is_active = True
# resumed_at = datetime.now()
```

---

### 4.6 Installments - תשלומים (`/api/v1/installments`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימה | User |
| `POST` | `/` | יצירה | User |
| `GET` | `/{id}` | פרטים (עם schedule) | User |
| `PUT` | `/{id}` | עדכון | User |
| `DELETE` | `/{id}` | מחיקה | User |
| `POST` | `/{id}/mark-paid` | סימון תשלום כשולם | User |
| `POST` | `/{id}/reverse-payment` | ביטול תשלום אחרון | User |
| `GET` | `/{id}/schedule` | לוח תשלומים | User |

**Mark-paid עם נעילה אופטימיסטית:**
```python
# הקוד משתמש ב-FOR UPDATE כדי למנוע race condition:
select(Installment).where(...).with_for_update()

# אם שני requests מגיעים בו-זמנית, השני ימתין לשחרור הנעילה
```

**תיקון עיגול בתשלום אחרון:**
```python
if payment_number == number_of_payments:
    # תשלום אחרון = יתרה שנותרה (לא monthly_amount)
    actual_payment = remaining_balance
```

---

### 4.7 Loans - הלוואות (`/api/v1/loans`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימה | User |
| `POST` | `/` | יצירה | User |
| `GET` | `/{id}` | פרטים + לוח סילוקין | User |
| `PUT` | `/{id}` | עדכון | User |
| `DELETE` | `/{id}` | מחיקה | User |
| `POST` | `/{id}/payment` | רישום תשלום | User |
| `POST` | `/{id}/reverse-payment` | ביטול תשלום | User |
| `GET` | `/{id}/breakdown` | לוח סילוקין מלא | User |

**ולידציות ביצירה:**
```python
# תשלום חודשי חייב לכסות את הריבית החודשית
if interest_rate > 0:
    monthly_interest = amount * (interest_rate / 12 / 100)
    if monthly_payment <= monthly_interest:
        raise HTTPException(400, "Monthly payment must exceed monthly interest")
```

**מעברי סטטוס מותרים:**
```
active → completed  (רק אם כל התשלומים בוצעו)
active → paused     (מותר)
completed → active  (אסור!)
```

---

### 4.8 Balance - יתרות (`/api/v1/balance`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/current` | יתרה נוכחית | User |
| `PUT` | `/current` | עדכון יתרה | User |
| `POST` | `/` | יצירת רשומת יתרה | User |
| `GET` | `/history` | היסטוריית יתרות | User |

**התנהגות עדכון (PUT):**
1. מחפש יתרה נוכחית (`is_current = True`)
2. מסמן את הישנה `is_current = False` (הופכת להיסטוריה)
3. יוצר רשומה חדשה עם `is_current = True`
4. משתמש ב-`with_for_update()` למניעת race condition

---

### 4.9 Forecast - צפי תזרים (`/api/v1/forecast`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/monthly` | צפי חודשי (1-12 חודשים) | User |
| `GET` | `/weekly` | צפי שבועי | User |
| `GET` | `/summary` | סיכום + יצירת התראות | User |
| `POST` | `/what-if` | ניתוח what-if | User |
| `GET` | `/scenarios` | רשימת תרחישים | User |
| `POST` | `/scenarios` | יצירת תרחיש | User |
| `GET` | `/scenarios/{id}` | פרטי תרחיש | User |
| `PUT` | `/scenarios/{id}` | עדכון תרחיש | User |
| `DELETE` | `/scenarios/{id}` | מחיקת תרחיש | User |
| `GET` | `/scenarios/{id}/compute` | חישוב תרחיש | User |
| `GET` | `/scenarios/compare` | השוואת תרחישים | User |

**כיצד מחושב הצפי החודשי:**

```
לכל חודש עתידי:
1. נקודת פתיחה = יתרת סגירה של חודש קודם (או bank_balance)
2. הכנסות צפויות:
   + Fixed income (הכנסות קבועות)
   + Expected income (הכנסות שהוזנו ידנית)
   + Installment income (תשלומים נכנסים)
   + One-time income (טרנזקציות עתידיות)
   + Subscription income (מנויים נכנסים)
3. הוצאות צפויות:
   + Fixed expenses (הוצאות קבועות)
   + Installment expenses (תשלומי פריסה)
   + Loan payments (תשלומי הלוואה)
   + One-time expenses (טרנזקציות עתידיות)
   + Subscription expenses (מנויים יוצאים)
4. יתרת סגירה = פתיחה + הכנסות - הוצאות

* Financial Aggregator מדדפליק כדי לא לספור פעמיים
  items שכבר הופכו לטרנזקציות ע"י ה-Scheduler
```

**What-If Analysis:**
```bash
POST /api/v1/forecast/what-if
{
  "months": 6,
  "income_change_pct": -20,     # הפחתת הכנסות ב-20%
  "expense_change_pct": 10,      # הגדלת הוצאות ב-10%
  "one_time_income": 50000,      # הכנסה חד-פעמית
  "one_time_expense": 0
}
```

---

### 4.10 Alerts - התראות (`/api/v1/alerts`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימת התראות | User |
| `GET` | `/unread-count` | מספר התראות שלא נקראו | User |
| `POST` | `/{id}/read` | סימון כנקראה | User |
| `POST` | `/{id}/unread` | סימון כלא נקראה | User |
| `POST` | `/mark-all-read` | סימון הכל כנקרא | User |
| `POST` | `/{id}/snooze` | דחיית התראה | User |
| `POST` | `/{id}/dismiss` | ביטול התראה | User |

**Auto-dismiss:** בכל GET, התראות עם `expires_at` שעבר נמחקות אוטומטית.

**Upsert Logic:** התראות משתמשות ב-deterministic key כדי לא ליצור כפילויות:
```
Key: "negative_cashflow:2026-03-01"
Key: "payment_overdue:loan:uuid-123"
Key: "high_single_expense:tx-uuid-456"
```
אם כבר קיימת התראה עם אותו key, המערכת מעדכנת את התוכן **בלי לאפס** את `is_read`.

---

### 4.11 Settings - הגדרות (`/api/v1/settings`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | הגדרות (auto-create) | User |
| `PUT` | `/` | עדכון הגדרות | User |

---

### 4.12 Dashboard - לוח בקרה (`/api/v1/dashboard`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/summary` | KPI ראשי (הכנסות, הוצאות, יתרה, מגמה) | User |
| `GET` | `/weekly` | תצוגה שבועית | User |
| `GET` | `/monthly` | תצוגה חודשית | User |
| `GET` | `/quarterly` | תצוגה רבעונית | User |
| `GET` | `/category-breakdown` | פילוח לפי קטגוריות | User |
| `GET` | `/upcoming-payments` | תשלומים קרובים | User |
| `GET` | `/financial-health` | ציון בריאות פיננסית | User |
| `GET` | `/installments-summary` | סיכום תשלומים | User |
| `GET` | `/loans-summary` | סיכום הלוואות | User |
| `GET` | `/subscriptions-summary` | סיכום מנויים | User |
| `GET` | `/top-expenses` | הוצאות גדולות | User |

**Financial Health Score:**

ציון בריאות פיננסי (0-100) מחושב מ-5 מרכיבים:

| מרכיב | משקל | מה נבדק |
|--------|------|---------|
| יחס הכנסות/הוצאות | 30% | הכנסות > הוצאות = 100 |
| יתרה חיובית | 25% | יתרה > 0 = 100 |
| אחוז שינוי הכנסות | 20% | שיפור לעומת חודש קודם |
| אחוז שינוי הוצאות | 15% | ירידה = חיובי |
| יציבות (חיסכון) | 10% | הפרש חיובי לאורך זמן |

**Upcoming Payments:**
מושך את כל התשלומים הקרובים מ-4 מקורות:
- Fixed (הוצאות/הכנסות קבועות)
- Installments (פריסות)
- Loans (הלוואות)
- Subscriptions (מנויים)

---

### 4.13 Backups - גיבויים (`/api/v1/backups`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימת גיבויים | Admin |
| `POST` | `/trigger` | הפעלת גיבוי ידני | Admin |
| `GET` | `/schedule` | מידע על תזמון | Admin |
| `GET` | `/{id}` | פרטי גיבוי | Admin |
| `DELETE` | `/{id}` | מחיקת גיבוי | Admin |
| `POST` | `/{id}/verify` | אימות שלמות | Admin |

---

### 4.14 Currency - מטבעות (`/api/v1/currency`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/rates` | שערי חליפין עדכניים | User |
| `GET` | `/convert` | המרת סכום | User |
| `GET` | `/supported` | רשימת מטבעות נתמכים | User |

---

### 4.15 Organizations - ארגונים (`/api/v1/organizations`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `POST` | `/` | יצירת ארגון | User |
| `GET` | `/` | הארגונים שלי | User |
| `GET` | `/{id}` | פרטי ארגון | User |
| `PUT` | `/{id}` | עדכון ארגון | Org Admin |
| `DELETE` | `/{id}` | מחיקת ארגון | Org Owner |
| `POST` | `/{id}/members` | הוספת חבר | Org Admin |
| `GET` | `/{id}/members` | רשימת חברים | User |
| `PUT` | `/{id}/members/{user_id}` | שינוי תפקיד | Org Admin |
| `DELETE` | `/{id}/members/{user_id}` | הסרת חבר | Org Admin |
| `POST` | `/{id}/switch` | מעבר לארגון | User |
| `GET` | `/{id}/audit-log` | לוג ביקורת | Org Admin |

**תרחיש מעבר הקשר:**
```bash
# עבודה אישית:
POST /api/v1/organizations/switch
{ "organization_id": null }
# current_organization_id = None → כל הנתונים אישיים

# עבודה ארגונית:
POST /api/v1/organizations/switch
{ "organization_id": "org-uuid" }
# current_organization_id = org-uuid → כל הנתונים של הארגון
```

---

### 4.16 Export - ייצוא נתונים (`/api/v1/export`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/transactions` | ייצוא טרנזקציות (CSV/JSON) | User |
| `GET` | `/all` | ייצוא כל הנתונים (JSON) | User |
| `GET` | `/users` | ייצוא משתמשים (CSV) | Admin |

**הגנה מפני CSV Injection:**
```python
# תווים מסוכנים בתחילת תא מוחלפים:
dangerous_chars = ['=', '+', '-', '@', '\t', '\r']
# למשל: "=CMD('hack')" → "'=CMD('hack')"
```

**תמיכה בעברית:**
```python
# CSV עם BOM לפתיחה תקינה באקסל:
output.write('\ufeff')  # UTF-8 BOM
```

---

### 4.17 Subscriptions - מנויים (`/api/v1/subscriptions`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימה (עם סינון) | User |
| `POST` | `/` | יצירה | User |
| `GET` | `/{id}` | פרטים | User |
| `PUT` | `/{id}` | עדכון | User |
| `DELETE` | `/{id}` | מחיקה | User |
| `POST` | `/{id}/pause` | השהייה | User |
| `POST` | `/{id}/resume` | חידוש | User |
| `GET` | `/upcoming-renewals` | חידושים קרובים | User |

---

### 4.18 Expected Income - הכנסות צפויות (`/api/v1/expected-income`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `GET` | `/` | רשימה | User |
| `PUT` | `/{month}` | עדכון/יצירה (upsert) | User |
| `DELETE` | `/{month}` | מחיקה | User |

---

### 4.19 Automation - אוטומציה (`/api/v1/automation`)

| Method | Path | תיאור | הרשאה |
|--------|------|-------|-------|
| `POST` | `/process` | הפעלת חיובים חוזרים | User |
| `POST` | `/sync-now` | סנכרון מיידי | User |
| `GET` | `/scheduler-status` | סטטוס ה-Scheduler | User |

**Preview Mode:**
```bash
POST /api/v1/automation/process
{ "preview": true, "reference_date": "2026-03-01" }

# מחזיר מה היה נוצר בלי לבצע באמת:
{
  "loans_charged": 2,
  "fixed_charged": 5,
  "installments_charged": 3,
  "skipped": 1,
  "preview_transactions": [...]
}
```

---

## 5. לוגיקה עסקית ותרחישים

### 5.1 יצירת הלוואה עם תשלום ראשון

כשמשתמש יוצר הלוואה ומסמן `first_payment_made = true`:

```python
# 1. המרת מטבע (אם צריך)
conv = await prepare_currency_fields(original_amount, currency, base_currency)

# 2. חישוב תשלום ראשון
monthly_rate = interest_rate / 100 / 12
interest_portion = (converted_principal * monthly_rate).quantize(...)
principal_portion = monthly_payment - interest_portion
remaining_balance = max(0, converted_principal - principal_portion)

# 3. עדכון מצב
payments_made = 1
status = "completed" if remaining <= 0 or payments_made >= total_payments else "active"
```

### 5.2 רישום תשלום בהלוואה

```python
# 1. נעילת שורה (FOR UPDATE) - מניעת race condition
select(Loan).where(...).with_for_update()

# 2. ולידציות
if loan.status == "completed": raise "Loan already completed"
if data.amount > loan.remaining_balance: raise "Exceeds balance"

# 3. עדכון
loan.payments_made += 1
loan.remaining_balance = max(0, remaining - data.amount)
if payments_made >= total_payments or remaining <= 0:
    loan.status = "completed"
    loan.remaining_balance = 0
```

### 5.3 Financial Aggregator - מניעת ספירה כפולה

**בעיה:** ה-Scheduler יוצר טרנזקציות מ-Fixed/Installments/Loans. אם הצפי סופר גם את הטרנזקציה וגם את ה-Fixed item, יהיה כפל.

**פתרון:**
```python
# 1. שלוף מזהי טרנזקציות שכבר נוצרו (materialized)
mat_result = await db.execute(
    select(
        Transaction.recurring_source_id,    # מזהה fixed
        Transaction.installment_id,          # מזהה installment
        Transaction.loan_id,                 # מזהה loan
        Transaction.date,
    )
    .where(Transaction.date >= start, Transaction.date <= end)
)

# 2. בנה sets של (source_id, year, month)
mat_fixed = {(source_id, year, month)}
mat_installment = {(inst_id, year, month)}
mat_loan = {(loan_id, year, month)}

# 3. בפרויקציה - דלג על entries שכבר materialized:
for entry in fixed_items:
    for year, month in months_range:
        if (entry.id, year, month) in materialized:
            continue  # כבר קיימת טרנזקציה - לא לספור שוב
```

### 5.4 יצירת התראות - Deterministic Upsert

**בעיה:** כל פעם שמחשבים צפי, רוצים לעדכן התראות. אבל אם רק מוחקים ויוצרים מחדש, מאבדים את `is_read`.

**פתרון:**
```python
# 1. שלוף התראות קיימות ובנה מפה לפי key
existing_map = {}
for alert in existing_alerts:
    key = _entity_alert_key(alert)  # "negative_cashflow:2026-03-01"
    existing_map[key] = alert

# 2. ליצירת כל התראה חדשה - בדוק אם יש קיימת
key = "negative_cashflow:2026-03-01"
if key in existing_map:
    existing = existing_map[key]
    existing.title = new_title      # עדכן תוכן
    existing.message = new_message
    # שמר is_read ו-is_dismissed!
else:
    db.add(Alert(...))  # צור חדשה

# 3. מחק התראות שכבר לא רלוונטיות
for key, alert in existing_map.items():
    if key not in seen_keys:
        await db.delete(alert)
```

### 5.5 חיובים חוזרים אוטומטיים

ה-`automation_service.py` מעבד 3 סוגי חיובים חוזרים:

**1. הלוואות:**
```
- מחפש הלוואות active שה-day_of_month == היום
- בודק idempotency (האם כבר נוצרה טרנזקציה)
- יוצר Transaction + מעדכן payments_made + remaining_balance
- נעילת FOR UPDATE
```

**2. הכנסות/הוצאות קבועות:**
```
- מחפש fixed items פעילים שה-day_of_month == היום
- בודק start_date <= היום
- בודק end_date (אם יש) >= היום
- בודק idempotency
- יוצר Transaction
```

**3. פריסות:**
```
- מחפש installments שה-day_of_month == היום
- בודק payments_completed < number_of_payments
- בודק idempotency
- יוצר Transaction + מעדכן payments_completed
- נעילת FOR UPDATE
```

**Idempotency - למה חשוב?**
```python
# מגן מפני יצירת כפילויות אם ה-Scheduler רץ פעמיים ביום
async def _find_existing_loan_transaction(db, user_id, loan_id, ref_date):
    result = await db.execute(
        select(Transaction.id).where(
            Transaction.user_id == user_id,
            Transaction.loan_id == loan_id,
            Transaction.date == ref_date,
            Transaction.is_recurring == True,
        )
    )
    return result.scalar_one_or_none() is not None
```

---

## 6. מערכת המטבעות

### מטבעות נתמכים

| קוד | שם | סימן |
|-----|-----|------|
| ILS | Israeli New Shekel | &#8362; |
| USD | US Dollar | $ |
| EUR | Euro | &#8364; |

### ארכיטקטורה

```
┌──────────────┐     HTTP/JSON     ┌──────────────────────┐
│   Backend    │ ◄───────────────► │  Frankfurter API     │
│              │                    │  (free, no auth)     │
└──────┬───────┘                    └──────────────────────┘
       │
       │ in-memory cache
       │ TTL = 1 hour
       │
┌──────┴───────────────────────────────────────┐
│                _RateCache                     │
│  Dict[(from, to)] → (Decimal rate, float ts) │
│                                               │
│  Fallback chain:                              │
│  1. Fresh cache (< 1 hour)                    │
│  2. API refresh                               │
│  3. Expired cache (any age)                   │
│  4. Last resort: rate = 1.0                   │
└───────────────────────────────────────────────┘
```

### prepare_currency_fields - פונקציית המרה

כל Endpoint שמקבל סכום עם מטבע משתמש בפונקציה זו:

```python
conv = await prepare_currency_fields(
    input_amount=100,          # הסכום שהמשתמש הזין
    input_currency="USD",      # המטבע שהמשתמש בחר
    base_currency="ILS",       # מטבע הבסיס
)

# התוצאה:
{
    "converted_amount": Decimal("367.00"),   # סכום ב-ILS
    "original_amount": Decimal("100.00"),    # סכום מקורי
    "original_currency": "USD",              # מטבע מקורי
    "exchange_rate": Decimal("3.67"),         # שער שנשמר
}

# מה נשמר ב-DB:
# amount = 367.00 (ILS)
# original_currency_amount = 100.00
# original_currency = "USD"
# exchange_rate = 3.67
# currency = "ILS"
```

### Cache ו-Inverse Rate

```python
# כשמקבלים שער USD→ILS, מחשבים גם את ההפוך:
if rate != Decimal("0"):
    inverse = (Decimal("1") / rate).quantize(Decimal("0.000001"))
    _cache.set("ILS", "USD", inverse)
```

---

## 7. מערכת הגיבויים

### קובץ: `app/services/backup_service.py`

### תהליך גיבוי

```
1. יצירת רשומת Backup ב-DB (status: "in_progress")
2. הרצת pg_dump:
   pg_dump -h host -p port -U user -d dbname --no-owner --no-acl -F c
3. דחיסה עם gzip (compresslevel=6)
4. חישוב SHA256 checksum
5. עדכון: status = "completed", file_size, checksum
6. שמירת קובץ: /backups/cashflow_backup_YYYYMMDD_HHMMSS.sql.gz
```

### ספריית גיבויים

```python
# סדר עדיפויות:
1. BACKUP_DIR מ-.env (ברירת מחדל: "/backups")
2. Fallback: "/tmp/backups" (אם אין הרשאת כתיבה)
```

### אימות גיבוי (Verify)

```python
# מחשב SHA256 מחדש ומשווה לערך השמור
current_checksum = _calculate_sha256(backup.file_path)
if current_checksum == backup.verification_checksum:
    backup.is_verified = True
else:
    backup.is_verified = False
    backup.error_message = "Checksum mismatch"
```

### ניקוי אוטומטי

```python
# מוחק גיבויים ישנים מ-30 ימים (BACKUP_RETENTION_DAYS)
cutoff = datetime.now() - timedelta(days=30)
# מוחק קובץ + רשומה ב-DB
```

---

## 8. מעקב פעולות - Audit Trail

### קובץ: `app/services/audit_service.py`

### עקרונות

1. **Fire-and-Forget:** שגיאה ב-audit לא עוצרת את הפעולה
2. **ללא FK:** user_id הוא UUID פשוט, לא Foreign Key - כך ה-log שורד מחיקת משתמש
3. **user_email נשמר:** מאפשר זיהוי גם אחרי מחיקת המשתמש

### כל הפעולות הנרשמות

| Endpoint Module | פעולות |
|----------------|--------|
| transactions | create, update, delete, bulk_create, bulk_update, bulk_delete |
| categories | create, update, delete (archive), reorder |
| fixed | create, update, delete, pause, resume |
| installments | create, update, delete, mark_paid, reverse_payment |
| loans | create, update, delete, payment, reverse_payment |
| balance | create, update |
| settings | update |
| organizations | create, update, delete, add_member, remove_member, change_role |
| auth | register, login |
| users | create, update, delete, reset_password |

### דוגמת שימוש ב-Endpoint

```python
@router.post("/transactions")
async def create_transaction(...):
    # ... יצירת הטרנזקציה ...

    await log_action(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="transaction",
        entity_id=str(transaction.id),
        user_email=current_user.email,
        organization_id=ctx.organization_id,
    )

    await db.commit()
    return transaction
```

### מבנה פנימי של log_action

```python
async def log_action(
    db: AsyncSession,
    user_id: UUID,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[dict] = None,
    user_email: Optional[str] = None,
    organization_id: Optional[UUID] = None,
) -> None:
    try:
        log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            user_email=user_email,
            organization_id=organization_id,
            # ip_address ו-user_agent מתמלאים מ-request context
        )
        db.add(log)
        # לא עושים commit כאן - ה-commit של ה-endpoint כולל את ה-log
    except Exception:
        # Fire-and-forget: שגיאת audit לא תהרוס את הפעולה
        logger.exception("Failed to log audit action")
```

---

## 9. מערכת התזמון - Scheduler

### קובץ: `app/services/scheduler.py`

### ספרייה: APScheduler (AsyncIOScheduler)

### 3 ג'ובים יומיים

| ג'וב | שעה (ישראל) | מה עושה |
|------|-------------|---------|
| `daily_recurring_charges` | 00:05 | מעבד חיובים חוזרים לכל המשתמשים |
| `daily_backup` | 02:00 | יוצר גיבוי מלא של ה-DB |
| `daily_backup_cleanup` | 03:00 | מוחק גיבויים ישנים מ-30 ימים |

### הגדרות

```python
_scheduler = AsyncIOScheduler(timezone="Asia/Jerusalem")

_scheduler.add_job(
    _process_all_users_recurring,
    trigger=CronTrigger(hour=0, minute=5, timezone="Asia/Jerusalem"),
    misfire_grace_time=3600,  # עד שעה איחור מותר
    replace_existing=True,
)
```

### תהליך הג'וב היומי

```
00:05 (ישראל):
  1. שלוף את כל המשתמשים הפעילים
  2. לכל משתמש:
     a. פתח DB session חדש
     b. process_recurring_charges(user_id, reference_date=today)
        - _process_loans (הלוואות ליום X)
        - _process_fixed (קבועים ליום X)
        - _process_installments (פריסות ליום X)
     c. אם משתמש נכשל - לוג שגיאה, המשך לבא
  3. סיכום:
     - users_processed: X
     - users_failed: Y
     - total_loans_charged: N
     - total_fixed_charged: N
     - total_installments_charged: N
     - total_skipped: N (כפילויות/סיומים)
```

### מעקב סטטוס

```python
# מידע על הרצה אחרונה
get_scheduler_status() → {
    "running": True,
    "next_run_time": "2026-02-19T00:05:00+02:00",
    "last_run_time": "2026-02-18T00:05:02",
    "last_run_result": {
        "date": "2026-02-18",
        "users_processed": 15,
        "users_failed": 0,
        "total_loans_charged": 8,
        "total_fixed_charged": 30,
        "total_installments_charged": 12,
        "total_skipped": 5,
    }
}
```

---

## 10. אבטחת מידע

### 10.1 IDOR Protection (Insecure Direct Object Reference)

**כל שאילתה** כוללת `ownership_filter`:

```python
# נכון - עם ownership_filter:
result = await db.execute(
    select(Transaction).where(
        Transaction.id == transaction_id,
        ctx.ownership_filter(Transaction),  # מבטיח שהנתון שייך למשתמש
    )
)

# שגוי - בלי ownership_filter:
result = await db.execute(
    select(Transaction).where(Transaction.id == transaction_id)
)
# משתמש A יכול לראות נתונים של משתמש B!
```

### 10.2 CORS Policy

```python
# אסור wildcard:
if "*" in origins:
    raise ValueError("CORS_ORIGINS must not contain '*'")

# רק origins מפורשים:
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]
```

### 10.3 Password Security

```python
# bcrypt עם passlib:
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash:
hash_password("my-password") → "$2b$12$..."

# Verify:
verify_password("my-password", hash) → True/False
```

### 10.4 Token Invalidation

3 מנגנונים לביטול טוקנים:

1. **Blacklist:** Logout שם את ה-JTI ב-blacklist
2. **Password Change:** טוקנים שהונפקו לפני שינוי סיסמה נדחים (iat < password_changed_at)
3. **User Deactivation:** משתמש לא פעיל (is_active = False) נדחה

### 10.5 Super Admin Protection

```python
# לא ניתן למחוק super admin:
if target_user.is_super_admin:
    raise HTTPException(403, "Cannot delete super admin")

# לא ניתן לשנות הרשאות:
if target_user.is_super_admin:
    raise HTTPException(403, "Cannot modify super admin permissions")
```

### 10.6 CSV Injection Prevention

```python
# בייצוא CSV, תווים מסוכנים בתחילת תא מנוטרלים:
dangerous = ['=', '+', '-', '@', '\t', '\r']
if value and str(value)[0] in dangerous:
    value = "'" + str(value)  # הוספת גרש מנטרלת Formula Injection
```

### 10.7 SQL Injection

- כל השאילתות דרך SQLAlchemy (parameterized queries)
- אין raw SQL בקוד
- Pydantic מוודא סוגי נתונים לפני שמגיעים ל-DB

### 10.8 Financial Precision

```python
# DECIMAL(15,2) - לא floating point
amount = Column(Numeric(15, 2))

# Python Decimal:
from decimal import Decimal, ROUND_HALF_UP
total = (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
```

---

## 11. ביצועים ואופטימיזציה

### 11.1 Connection Pooling

```python
# session.py
engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,          # 10 חיבורים קבועים
    max_overflow=20,       # עד 20 נוספים בעומס
    pool_pre_ping=True,    # בדיקת חיבור לפני שימוש
    pool_recycle=3600,     # חידוש חיבור כל שעה
    connect_args={
        "server_settings": {
            "statement_timeout": "30000"  # timeout של 30 שניות
        }
    },
)
```

### 11.2 Database Indexes

**טרנזקציות (7 אינדקסים):**
```
idx_tx_user_date        → חיפוש לפי תאריך (הנפוץ ביותר)
idx_tx_user_type        → סינון הכנסות/הוצאות
idx_tx_user_category    → סינון לפי קטגוריה
idx_tx_date             → מיון גלובלי לפי תאריך
idx_tx_org              → חיפוש ארגוני
idx_tx_recurring_source → deduplication של חיובים חוזרים
idx_tx_installment      → קישור לפריסות
```

### 11.3 Slow Query Logger

```python
# slow_query_logger.py
setup_slow_query_logging(engine)

# מדפיס אזהרה לשאילתות שלוקחות > X ms
# מאפשר לזהות בעיות ביצועים
```

### 11.4 Query Optimization

**1. Pagination בכל רשימה:**
```python
query = (
    select(Transaction)
    .where(...)
    .order_by(Transaction.date.desc())
    .offset((page - 1) * page_size)
    .limit(page_size)
)
```

**2. SELECT רק שדות נדרשים (aggregations):**
```python
# במקום לשלוף שורות מלאות:
select(
    Transaction.type,
    func.sum(Transaction.amount),
).group_by(Transaction.type)
```

**3. FOR UPDATE רק כשצריך:**
```python
# נעילה רק ב-mutation operations:
select(Loan).where(...).with_for_update()  # record_payment
# לא ב-reads:
select(Loan).where(...)                     # list_loans
```

### 11.5 Exchange Rate Caching

```python
# in-memory cache עם TTL של שעה
# מונע קריאות חוזרות ל-API חיצוני
# Fallback chain: fresh → API → expired → 1.0
```

### 11.6 Session Management

```python
async def get_db():
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()  # rollback אוטומטי בשגיאה
            raise
        finally:
            await session.close()     # סגירה מובטחת
```

---

## 12. Alembic Migrations

### מבנה

```
backend/
└── alembic/
    ├── alembic.ini        # הגדרות
    ├── env.py             # סביבת migration
    └── versions/          # קבצי migration
```

### פקודות עיקריות

```bash
# הרצת כל ה-migrations
cd backend && source venv/bin/activate
PYTHONPATH=. alembic upgrade head

# יצירת migration חדש (אחרי שינוי model)
PYTHONPATH=. alembic revision --autogenerate -m "add_new_column"

# חזרה migration אחד
PYTHONPATH=. alembic downgrade -1

# ראה מצב נוכחי
PYTHONPATH=. alembic current

# ראה היסטוריה
PYTHONPATH=. alembic history
```

### כללים חשובים

1. **אחרי כל שינוי model** - צור migration חדש
2. **בדוק את הקובץ שנוצר** - autogenerate לא תמיד מושלם
3. **אל תערוך migrations ישנים** - צור חדש
4. **Column defaults** - הוסף `server_default` לעמודות חדשות בטבלאות קיימות
5. **Non-nullable columns** - הוסף עם nullable=True, מלא נתונים, ואז שנה ל-False

### דוגמה: הוספת עמודה לטבלה קיימת

```python
# alembic/versions/xxxx_add_provider_url.py
def upgrade():
    op.add_column(
        'subscriptions',
        sa.Column('provider_url', sa.String(), nullable=True)
    )

def downgrade():
    op.drop_column('subscriptions', 'provider_url')
```

---

## 13. פקודות שימושיות

### הרצת הבקאנד

```bash
# הפעלת PostgreSQL
docker-compose up -d

# הפעלת הבקאנד
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
source venv/bin/activate
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

### הרצת טסטים

```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
source venv/bin/activate
PYTHONPATH=. pytest tests/ -v

# טסט ספציפי
PYTHONPATH=. pytest tests/test_transactions.py -v

# עם coverage
PYTHONPATH=. pytest tests/ --cov=app --cov-report=html
```

### Migrations

```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
source venv/bin/activate

# הרצה
PYTHONPATH=. alembic upgrade head

# יצירת migration חדש
PYTHONPATH=. alembic revision --autogenerate -m "description"

# בדיקת מצב
PYTHONPATH=. alembic current
```

### Seed Data

```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
source venv/bin/activate
PYTHONPATH=. python scripts/seed_data.py
```

### כתובות שימושיות

| שירות | כתובת |
|-------|-------|
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Frontend | http://localhost:5173 |

### בדיקת API עם cURL

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# שמור את ה-token:
TOKEN="eyJhbGciOiJI..."

# רשימת טרנזקציות
curl http://localhost:8000/api/v1/transactions \
  -H "Authorization: Bearer $TOKEN"

# יצירת טרנזקציה
curl -X POST http://localhost:8000/api/v1/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "type": "expense",
    "description": "שכירות",
    "date": "2026-02-01",
    "currency": "ILS"
  }'

# צפי תזרים
curl "http://localhost:8000/api/v1/forecast/monthly?months=6" \
  -H "Authorization: Bearer $TOKEN"

# סטטוס scheduler
curl http://localhost:8000/api/v1/automation/scheduler-status \
  -H "Authorization: Bearer $TOKEN"
```

### Environment Variables

```env
# .env
DATABASE_URL=postgresql+asyncpg://cashflow:cashflow@localhost:5432/cashflow
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:5173"]
ADMIN_DEFAULT_PASSWORD=admin123
BACKUP_DIR=/backups
BACKUP_RETENTION_DAYS=30
DEBUG=true
```

**דגש:** אם `SECRET_KEY` ריק או "change-me-in-production", המערכת מייצרת מפתח אקראי אוטומטית:
```python
@field_validator("SECRET_KEY", mode="before")
def validate_secret_key(cls, v):
    if not v or v == "change-me-in-production":
        return secrets.token_urlsafe(64)
    return v
```

---

## סיכום מספרים

| מדד | ערך |
|-----|-----|
| מודלים (טבלאות) | 17 |
| API Endpoints | 67+ |
| שירותים (Services) | 8 |
| סוגי התראות | 9 |
| אינדקסים בטרנזקציות | 7 |
| טסטים | 155+ |
| מטבעות נתמכים | 3 (ILS, USD, EUR) |
| ג'ובים מתוזמנים | 3 |
| רמות הרשאה | 3 (User, Admin, Super Admin) |
