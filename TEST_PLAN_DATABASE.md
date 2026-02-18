# TEST PLAN - Database & Infrastructure
## CashFlow Management System - Eye Level AI

> **תאריך יצירה:** 18 בפברואר 2026
> **גרסה:** 1.0
> **סטטוס:** Phase 5 - QA & Production Readiness
> **סה"כ טסטים:** 247

---

## תוכן עניינים

1. [סקירת ארכיטקטורה](#1-סקירת-ארכיטקטורה)
2. [בדיקות שלמות סכמה (Schema Integrity)](#2-בדיקות-שלמות-סכמה) — 58 טסטים
3. [בדיקות מיגרציות (Migrations)](#3-בדיקות-מיגרציות) — 27 טסטים
4. [בדיקות שלמות נתונים (Data Integrity)](#4-בדיקות-שלמות-נתונים) — 52 טסטים
5. [בדיקות ביצועים (Performance)](#5-בדיקות-ביצועים) — 28 טסטים
6. [בדיקות אבטחה (Security)](#6-בדיקות-אבטחה) — 35 טסטים
7. [בדיקות גיבוי ושחזור (Backup & Recovery)](#7-בדיקות-גיבוי-ושחזור) — 12 טסטים
8. [בדיקות קונפיגורציה (Configuration)](#8-בדיקות-קונפיגורציה) — 18 טסטים
9. [בדיקות Docker ותשתית (Infrastructure)](#9-בדיקות-docker-ותשתית) — 17 טסטים

---

## 1. סקירת ארכיטקטורה

### 1.1 טבלאות בסיס הנתונים (17 טבלאות)

| # | טבלה | תיאור | FK ל-users | FK ל-organizations |
|---|-------|--------|------------|-------------------|
| 1 | `users` | משתמשים | - | SET NULL (current_organization_id) |
| 2 | `settings` | הגדרות משתמש | CASCADE | - |
| 3 | `categories` | קטגוריות | CASCADE | CASCADE |
| 4 | `transactions` | עסקאות | CASCADE | CASCADE |
| 5 | `fixed_income_expenses` | הכנסות/הוצאות קבועות | CASCADE | CASCADE |
| 6 | `installments` | תשלומים | CASCADE | CASCADE |
| 7 | `loans` | הלוואות | CASCADE | CASCADE |
| 8 | `bank_balances` | יתרות בנק | CASCADE | CASCADE |
| 9 | `expected_income` | הכנסה צפויה | CASCADE | CASCADE |
| 10 | `alerts` | התראות | CASCADE | CASCADE |
| 11 | `subscriptions` | מנויים | CASCADE | CASCADE |
| 12 | `backups` | גיבויים | - (created_by, no FK) | - |
| 13 | `organizations` | ארגונים | FK owner_id (no cascade) | - |
| 14 | `organization_members` | חברי ארגון | CASCADE | CASCADE |
| 15 | `organization_settings` | הגדרות ארגון | - | CASCADE |
| 16 | `audit_logs` | לוג ביקורת | - (no FK, append-only) | - |
| 17 | `forecast_scenarios` | תרחישי תחזית | CASCADE | CASCADE |
| (+) | `audit_log` (trigger table) | לוג טריגרים | - | - |

### 1.2 שרשרת מיגרציות (21 מיגרציות)

```
662be7a4315d (initial)
    └── 3206c4eef440 (phase 2 tables)
        └── f58ca177ac66 (indexes + checks)
            └── c418f49cdb52 (currency to bank_balances)
                └── fb15cad9b324 (constraints + indexes)
                    ├── ea39ef3b496c (snoozed_until)
                    └── a1b2c3d4e5f6 (onboarding_completed)
                        └── 5d7bb6143603 (MERGE)
                            └── 225a281f1180 (full_name, phone_number)
                                └── 029e8f951a2e (remove duplicate checks)
                                    └── b708280a0aad (production hardening)
                                        └── c1d2e3f4a5b6 (alert thresholds, paused_at)
                                            └── 73e472d76fbc (is_super_admin)
                                                └── a9c1f2b3d4e5 (password_changed_at)
                                                    └── b1c2d3e4f5a6 (subscriptions)
                                                        └── b1c2d3e4f5g6 (backups)
                                                            └── c2d3e4f5g6h7 (organizations + members)
                                                                └── b15ab5ff4373 (audit_logs table)
                                                                    └── 3ff79e0f3942 (drop audit_logs FK)
                                                                        └── 7c6dc9126131 (org_id, multicurrency, forecast_scenarios)
```

### 1.3 Trigger Functions (4 פונקציות)

| פונקציה | טבלאות | תיאור |
|---------|--------|-------|
| `fn_update_updated_at()` | users, settings, categories, transactions, fixed_income_expenses, installments, loans, expected_income | עדכון אוטומטי של `updated_at` |
| `fn_prevent_admin_delete()` | users | מניעת מחיקת משתמש admin |
| `fn_audit_balance_change()` | bank_balances | לוג שינויי יתרה ל-`audit_log` |
| `fn_audit_large_transaction()` | transactions | לוג עסקאות >= 10,000 ל-`audit_log` |
| `fn_audit_loan_status()` | loans | לוג שינויי סטטוס הלוואה ל-`audit_log` |

### 1.4 Connection Pool

| פרמטר | ערך |
|--------|-----|
| `pool_size` | 10 |
| `max_overflow` | 20 |
| `pool_pre_ping` | True |
| `pool_recycle` | 3600 (שעה) |
| `statement_timeout` | 30,000ms (30 שניות) |
| `slow_query_threshold` | 0.5 שניות |

---

## 2. בדיקות שלמות סכמה (Schema Integrity)

**סה"כ: 58 טסטים**

### 2.1 קיום טבלאות (17 טסטים)

```python
# test_schema_tables.py

@pytest.mark.parametrize("table_name", [
    "users", "settings", "categories", "transactions",
    "fixed_income_expenses", "installments", "loans",
    "bank_balances", "expected_income", "alerts",
    "subscriptions", "backups", "organizations",
    "organization_members", "organization_settings",
    "audit_logs", "forecast_scenarios",
])
async def test_table_exists(db, table_name):
    """T-SCH-{i}: טבלה {table_name} קיימת אחרי מיגרציה."""
    result = await db.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = :name)"
    ), {"name": table_name})
    assert result.scalar() is True
```

| # | מזהה | טסט |
|---|------|------|
| 1 | T-SCH-01 | טבלת `users` קיימת |
| 2 | T-SCH-02 | טבלת `settings` קיימת |
| 3 | T-SCH-03 | טבלת `categories` קיימת |
| 4 | T-SCH-04 | טבלת `transactions` קיימת |
| 5 | T-SCH-05 | טבלת `fixed_income_expenses` קיימת |
| 6 | T-SCH-06 | טבלת `installments` קיימת |
| 7 | T-SCH-07 | טבלת `loans` קיימת |
| 8 | T-SCH-08 | טבלת `bank_balances` קיימת |
| 9 | T-SCH-09 | טבלת `expected_income` קיימת |
| 10 | T-SCH-10 | טבלת `alerts` קיימת |
| 11 | T-SCH-11 | טבלת `subscriptions` קיימת |
| 12 | T-SCH-12 | טבלת `backups` קיימת |
| 13 | T-SCH-13 | טבלת `organizations` קיימת |
| 14 | T-SCH-14 | טבלת `organization_members` קיימת |
| 15 | T-SCH-15 | טבלת `organization_settings` קיימת |
| 16 | T-SCH-16 | טבלת `audit_logs` קיימת |
| 17 | T-SCH-17 | טבלת `forecast_scenarios` קיימת |

### 2.2 סוגי עמודות ו-NULL constraints (18 טסטים)

```sql
-- שאילתת בדיקה לכל טבלה:
SELECT column_name, data_type, is_nullable, column_default,
       numeric_precision, numeric_scale, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;
```

| # | מזהה | טסט |
|---|------|------|
| 18 | T-SCH-18 | `users` — כל 13 עמודות קיימות עם סוגים נכונים (id UUID, username VARCHAR(50), email VARCHAR(255), full_name VARCHAR(100) NULLABLE, phone_number VARCHAR(20) NULLABLE, password_hash VARCHAR(255), is_admin BOOLEAN, is_super_admin BOOLEAN, is_active BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, last_login_at TIMESTAMPTZ NULLABLE, password_changed_at TIMESTAMPTZ NULLABLE, current_organization_id UUID NULLABLE) |
| 19 | T-SCH-19 | `settings` — כל 13 עמודות: id UUID, user_id UUID NOT NULL, currency VARCHAR(3), language VARCHAR(2), date_format VARCHAR(20), theme VARCHAR(10), notifications_enabled BOOLEAN, forecast_months_default INTEGER, week_start_day INTEGER, alert_warning_threshold NUMERIC(15,2), alert_critical_threshold NUMERIC(15,2), onboarding_completed BOOLEAN, created_at/updated_at TIMESTAMPTZ |
| 20 | T-SCH-20 | `transactions` — כל 18 עמודות כולל ARRAY(String) ל-tags, NUMERIC(15,2) ל-amount, NUMERIC(15,6) ל-exchange_rate |
| 21 | T-SCH-21 | `fixed_income_expenses` — כל 17 עמודות כולל paused_at/resumed_at NULLABLE TIMESTAMPTZ |
| 22 | T-SCH-22 | `installments` — כל 16 עמודות כולל NUMERIC(15,2) ל-total_amount ו-monthly_amount |
| 23 | T-SCH-23 | `loans` — כל 18 עמודות כולל NUMERIC(5,2) ל-interest_rate, original_currency_amount NULLABLE |
| 24 | T-SCH-24 | `bank_balances` — כל 8 עמודות כולל NUMERIC(15,2) ל-balance |
| 25 | T-SCH-25 | `expected_income` — כל 8 עמודות כולל UniqueConstraint(user_id, month) |
| 26 | T-SCH-26 | `alerts` — כל 12 עמודות כולל snoozed_until, expires_at NULLABLE |
| 27 | T-SCH-27 | `subscriptions` — כל 19 עמודות כולל billing_cycle, next_renewal_date, auto_renew |
| 28 | T-SCH-28 | `backups` — כל 12 עמודות כולל BigInteger ל-file_size, verification_checksum VARCHAR(64) |
| 29 | T-SCH-29 | `organizations` — כל 6 עמודות כולל name UNIQUE, slug UNIQUE |
| 30 | T-SCH-30 | `organization_members` — כל 6 עמודות כולל UniqueConstraint(organization_id, user_id) |
| 31 | T-SCH-31 | `organization_settings` — כל 10 עמודות, organization_id UNIQUE |
| 32 | T-SCH-32 | `audit_logs` — כל 10 עמודות כולל user_email VARCHAR(255), NO FK on user_id |
| 33 | T-SCH-33 | `forecast_scenarios` — כל 9 עמודות כולל JSONB ל-params |
| 34 | T-SCH-34 | `audit_log` (trigger table) — טבלה קיימת עם BIGSERIAL id, JSONB old_values/new_values |
| 35 | T-SCH-35 | **DECIMAL precision:** כל שדות כספיים הם NUMERIC(15,2) — לא FLOAT, לא REAL, לא DOUBLE |

### 2.3 Foreign Keys (13 טסטים)

```sql
-- שאילתת בדיקה:
SELECT
    tc.constraint_name, tc.table_name, kcu.column_name,
    ccu.table_name AS foreign_table, ccu.column_name AS foreign_column,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
```

| # | מזהה | טסט | FK | ON DELETE |
|---|------|------|-----|-----------|
| 36 | T-SCH-36 | settings.user_id → users.id | CASCADE |
| 37 | T-SCH-37 | categories.user_id → users.id | CASCADE |
| 38 | T-SCH-38 | categories.parent_id → categories.id | NO ACTION (self-ref) |
| 39 | T-SCH-39 | transactions.user_id → users.id | CASCADE |
| 40 | T-SCH-40 | transactions.category_id → categories.id | SET NULL |
| 41 | T-SCH-41 | fixed_income_expenses.category_id → categories.id | SET NULL |
| 42 | T-SCH-42 | installments.category_id → categories.id | SET NULL |
| 43 | T-SCH-43 | loans.category_id → categories.id | SET NULL |
| 44 | T-SCH-44 | subscriptions.category_id → categories.id | SET NULL |
| 45 | T-SCH-45 | organizations.owner_id → users.id | NO ACTION |
| 46 | T-SCH-46 | organization_members.organization_id → organizations.id | CASCADE |
| 47 | T-SCH-47 | organization_members.user_id → users.id | CASCADE |
| 48 | T-SCH-48 | users.current_organization_id → organizations.id | SET NULL |

### 2.4 Unique Constraints (5 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 49 | T-SCH-49 | `users.username` — UNIQUE |
| 50 | T-SCH-50 | `users.email` — UNIQUE |
| 51 | T-SCH-51 | `settings.user_id` — UNIQUE (one settings per user) |
| 52 | T-SCH-52 | `expected_income(user_id, month)` — UNIQUE composite (`uq_user_month`) |
| 53 | T-SCH-53 | `organization_members(organization_id, user_id)` — UNIQUE composite (`uq_org_member_org_user`) |

### 2.5 CHECK Constraints (5 טסטים - נותרו אחרי deduplication)

```sql
-- שאילתת בדיקה:
SELECT conname, conrelid::regclass, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'c' AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;
```

| # | מזהה | טסט |
|---|------|------|
| 54 | T-SCH-54 | `positive_amount` (transactions) — amount > 0 |
| 55 | T-SCH-55 | `ck_fixed_amount` (fixed) — amount > 0 |
| 56 | T-SCH-56 | `ck_installment_positive_amount` (installments) — total_amount > 0 |
| 57 | T-SCH-57 | `ck_loan_positive_principal` (loans) — original_amount > 0 |
| 58 | T-SCH-58 | קיום כל CHECK constraints מיידי — ספירה >= 30 constraints ב-DB |

---

## 3. בדיקות מיגרציות (Migrations)

**סה"כ: 27 טסטים**

### 3.1 מיגרציה מ-scratch (5 טסטים)

```bash
# סקריפט בדיקה:
dropdb cashflow_migration_test 2>/dev/null
createdb cashflow_migration_test
DATABASE_URL="postgresql+asyncpg://cashflow:cashflow@localhost:5432/cashflow_migration_test" \
  alembic upgrade head
```

| # | מזהה | טסט |
|---|------|------|
| 1 | T-MIG-01 | `alembic upgrade head` מ-DB ריק — מצליח בלי שגיאות |
| 2 | T-MIG-02 | אחרי upgrade head — כל 17 טבלאות קיימות |
| 3 | T-MIG-03 | אחרי upgrade head — כל triggers קיימים (5 trigger functions) |
| 4 | T-MIG-04 | אחרי upgrade head — `alembic_version` מכיל revision `7c6dc9126131` (האחרון) |
| 5 | T-MIG-05 | אחרי upgrade head — כל indexes קיימים (ספירה >= 60) |

### 3.2 Downgrade לכל מיגרציה (14 טסטים)

```bash
# סקריפט בדיקה לכל revision:
alembic downgrade -1  # downgrade step by step
```

| # | מזהה | טסט |
|---|------|------|
| 6 | T-MIG-06 | downgrade מ-`7c6dc9126131` ל-`3ff79e0f3942` — מצליח |
| 7 | T-MIG-07 | downgrade מ-`3ff79e0f3942` ל-`b15ab5ff4373` — מצליח |
| 8 | T-MIG-08 | downgrade מ-`b15ab5ff4373` ל-`c2d3e4f5g6h7` — מצליח |
| 9 | T-MIG-09 | downgrade מ-`c2d3e4f5g6h7` ל-`b1c2d3e4f5g6` — מצליח |
| 10 | T-MIG-10 | downgrade מ-`b1c2d3e4f5g6` ל-`b1c2d3e4f5a6` — מצליח |
| 11 | T-MIG-11 | downgrade מ-`b1c2d3e4f5a6` ל-`a9c1f2b3d4e5` — מצליח |
| 12 | T-MIG-12 | downgrade מ-`a9c1f2b3d4e5` ל-`73e472d76fbc` — מצליח |
| 13 | T-MIG-13 | downgrade מ-`73e472d76fbc` ל-`c1d2e3f4a5b6` — מצליח |
| 14 | T-MIG-14 | downgrade מ-`c1d2e3f4a5b6` ל-`b708280a0aad` — מצליח |
| 15 | T-MIG-15 | downgrade מ-`b708280a0aad` ל-`029e8f951a2e` — מצליח |
| 16 | T-MIG-16 | downgrade עד `662be7a4315d` — רק 4 טבלאות נותרות (users, categories, settings, transactions) |
| 17 | T-MIG-17 | downgrade ל-base (empty) — `alembic downgrade base` מצליח, DB ריק |
| 18 | T-MIG-18 | Round-trip: `downgrade base` ואז `upgrade head` — מצליח ללא שגיאות |
| 19 | T-MIG-19 | Merge migration `5d7bb6143603` — עובר בלי שגיאות (merge of two branches) |

### 3.3 Backfill ו-Data Integrity (4 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 20 | T-MIG-20 | מיגרציה `c418f49cdb52` — bank_balances שקיימים מקבלים currency = 'ILS' default |
| 21 | T-MIG-21 | מיגרציה `7c6dc9126131` — backfill original_amount = amount, exchange_rate = 1.0 לכל טבלאות פיננסיות |
| 22 | T-MIG-22 | מיגרציה `7c6dc9126131` — loans: original_currency_amount = original_amount (לא amount!) |
| 23 | T-MIG-23 | מיגרציה `a1b2c3d4e5f6` — settings.onboarding_completed server_default = false |

### 3.4 סדר תלויות ואידמפוטנטיות (4 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 24 | T-MIG-24 | `alembic history` — שרשרת מלאה ללא פערים |
| 25 | T-MIG-25 | `alembic check` — מודלים תואמים ל-DB (no pending migrations) |
| 26 | T-MIG-26 | הרצה כפולה של `alembic upgrade head` — לא נכשלת (idempotent) |
| 27 | T-MIG-27 | `alembic current` — מחזיר את ה-revision הנוכחי בצורה נכונה |

---

## 4. בדיקות שלמות נתונים (Data Integrity)

**סה"כ: 52 טסטים**

### 4.1 CASCADE DELETE — מחיקת משתמש (10 טסטים)

```python
# test_cascade_delete_user.py

async def test_delete_user_cascades_all_data(db):
    """מחיקת משתמש מוחקת את כל הנתונים שלו."""
    # Create user with data in ALL tables
    user = await create_user_with_full_data(db)
    user_id = user.id

    # Delete user
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()

    # Verify ALL related data is gone
    for Model in [Settings, Category, Transaction, FixedIncomeExpense,
                  Installment, Loan, BankBalance, ExpectedIncome,
                  Alert, Subscription]:
        result = await db.execute(
            select(Model).where(Model.user_id == user_id)
        )
        assert result.scalars().all() == []
```

| # | מזהה | טסט |
|---|------|------|
| 1 | T-INT-01 | מחיקת user → settings נמחקים (CASCADE) |
| 2 | T-INT-02 | מחיקת user → categories נמחקים (CASCADE) |
| 3 | T-INT-03 | מחיקת user → transactions נמחקים (CASCADE) |
| 4 | T-INT-04 | מחיקת user → fixed_income_expenses נמחקים (CASCADE) |
| 5 | T-INT-05 | מחיקת user → installments נמחקים (CASCADE) |
| 6 | T-INT-06 | מחיקת user → loans נמחקים (CASCADE) |
| 7 | T-INT-07 | מחיקת user → bank_balances נמחקים (CASCADE) |
| 8 | T-INT-08 | מחיקת user → expected_income נמחקים (CASCADE) |
| 9 | T-INT-09 | מחיקת user → alerts נמחקים (CASCADE) |
| 10 | T-INT-10 | מחיקת user → subscriptions נמחקים (CASCADE) |

### 4.2 CASCADE DELETE — מחיקת ארגון (5 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 11 | T-INT-11 | מחיקת organization → organization_members נמחקים (CASCADE) |
| 12 | T-INT-12 | מחיקת organization → organization_settings נמחקים (CASCADE) |
| 13 | T-INT-13 | מחיקת organization → forecast_scenarios עם org_id נמחקים (CASCADE) |
| 14 | T-INT-14 | מחיקת organization → users.current_organization_id הופך ל-NULL (SET NULL) |
| 15 | T-INT-15 | מחיקת organization → transactions/fixed/installments עם org_id נמחקים |

### 4.3 SET NULL — מחיקת קטגוריה (5 טסטים)

```python
async def test_delete_category_sets_null(db):
    """מחיקת קטגוריה → category_id הופך NULL בעסקאות."""
    category = await create_category(db, user_id=user.id)
    transaction = await create_transaction(db, user_id=user.id, category_id=category.id)

    await db.execute(delete(Category).where(Category.id == category.id))
    await db.commit()

    await db.refresh(transaction)
    assert transaction.category_id is None
```

| # | מזהה | טסט |
|---|------|------|
| 16 | T-INT-16 | מחיקת category → transactions.category_id = NULL |
| 17 | T-INT-17 | מחיקת category → fixed_income_expenses.category_id = NULL |
| 18 | T-INT-18 | מחיקת category → installments.category_id = NULL |
| 19 | T-INT-19 | מחיקת category → loans.category_id = NULL |
| 20 | T-INT-20 | מחיקת category → subscriptions.category_id = NULL |

### 4.4 Unique Constraint Violations (6 טסטים)

```python
async def test_duplicate_username_rejected(db):
    """שם משתמש כפול נדחה."""
    await create_user(db, username="test")
    with pytest.raises(IntegrityError):
        await create_user(db, username="test")
```

| # | מזהה | טסט |
|---|------|------|
| 21 | T-INT-21 | שם משתמש כפול (`users.username`) → IntegrityError |
| 22 | T-INT-22 | אימייל כפול (`users.email`) → IntegrityError |
| 23 | T-INT-23 | settings כפולים לאותו user → IntegrityError |
| 24 | T-INT-24 | expected_income כפול לאותו user+month → IntegrityError |
| 25 | T-INT-25 | organization_member כפול (org_id+user_id) → IntegrityError |
| 26 | T-INT-26 | bank_balance כפול לאותו user+effective_date → IntegrityError (uq_bank_balance_user_date) |

### 4.5 CHECK Constraint Violations (12 טסטים)

```python
async def test_negative_amount_rejected(db):
    """סכום שלילי בעסקה נדחה."""
    with pytest.raises(IntegrityError):
        await create_transaction(db, amount=Decimal("-100"))
```

| # | מזהה | טסט |
|---|------|------|
| 27 | T-INT-27 | transaction.amount = 0 → נדחה (positive_amount) |
| 28 | T-INT-28 | transaction.amount = -100 → נדחה |
| 29 | T-INT-29 | fixed.day_of_month = 0 → נדחה (ck_fixed_day) |
| 30 | T-INT-30 | fixed.day_of_month = 32 → נדחה |
| 31 | T-INT-31 | loan.payments_made > loan.total_payments → נדחה (ck_loans_payments) |
| 32 | T-INT-32 | installment.payments_completed > number_of_payments → נדחה |
| 33 | T-INT-33 | loan.status = 'invalid' → נדחה (ck_loan_status_valid) |
| 34 | T-INT-34 | transaction.type = 'transfer' → נדחה (ck_transaction_type_valid) |
| 35 | T-INT-35 | category.color = 'red' → נדחה (ck_category_color_format, must be #XXXXXX) |
| 36 | T-INT-36 | settings.language = 'fr' → נדחה (ck_settings_language_valid) |
| 37 | T-INT-37 | settings.theme = 'auto' → נדחה (ck_settings_theme_valid, must be light/dark/system) |
| 38 | T-INT-38 | currency = 'ABCD' (4 chars) → נדחה (ck_*_currency_len, must be 3) |

### 4.6 Trigger Tests (6 טסטים)

```python
async def test_updated_at_trigger(db):
    """Trigger מעדכן updated_at אוטומטית."""
    user = await create_user(db)
    original_updated_at = user.updated_at

    await asyncio.sleep(0.01)
    user.full_name = "Updated"
    await db.commit()
    await db.refresh(user)

    assert user.updated_at > original_updated_at
```

| # | מזהה | טסט |
|---|------|------|
| 39 | T-INT-39 | `fn_update_updated_at` — עדכון user משנה updated_at |
| 40 | T-INT-40 | `fn_update_updated_at` — עדכון transaction משנה updated_at |
| 41 | T-INT-41 | `fn_prevent_admin_delete` — מחיקת admin נכשלת עם exception |
| 42 | T-INT-42 | `fn_prevent_admin_delete` — מחיקת non-admin מצליחה |
| 43 | T-INT-43 | `fn_audit_balance_change` — INSERT ל-bank_balance יוצר רשומה ב-audit_log |
| 44 | T-INT-44 | `fn_audit_large_transaction` — INSERT עם amount >= 10000 יוצר רשומה ב-audit_log |

### 4.7 Transaction Isolation & Concurrency (4 טסטים)

```python
async def test_concurrent_balance_updates(db):
    """שני עדכוני יתרה בו-זמנית — לא נשחתים."""
    # Use SELECT ... FOR UPDATE pattern
    balance = await create_bank_balance(db, balance=Decimal("10000"))

    async def update_balance(amount):
        async with test_session() as s:
            await s.execute(
                text("UPDATE bank_balances SET balance = balance + :amt WHERE id = :id"),
                {"amt": amount, "id": str(balance.id)}
            )
            await s.commit()

    await asyncio.gather(
        update_balance(Decimal("100")),
        update_balance(Decimal("200")),
    )

    await db.refresh(balance)
    assert balance.balance == Decimal("10300")
```

| # | מזהה | טסט |
|---|------|------|
| 45 | T-INT-45 | שני עדכוני יתרה בו-זמנית — סכום סופי נכון |
| 46 | T-INT-46 | שתי יצירות expected_income לאותו חודש — רק אחת מצליחה |
| 47 | T-INT-47 | Transaction rollback — שגיאה באמצע לא משאירה נתונים חלקיים |
| 48 | T-INT-48 | Session.rollback() אחרי IntegrityError — DB תקין |

### 4.8 Decimal Arithmetic (4 טסטים)

```python
async def test_decimal_precision_maintained(db):
    """סכומי כסף נשמרים בדיוק DECIMAL(15,2)."""
    t = await create_transaction(db, amount=Decimal("99999999999.99"))
    await db.refresh(t)
    assert t.amount == Decimal("99999999999.99")
    assert type(t.amount) == Decimal  # Not float!
```

| # | מזהה | טסט |
|---|------|------|
| 49 | T-INT-49 | סכום מקסימלי DECIMAL(15,2) = 9999999999999.99 — נשמר בדיוק |
| 50 | T-INT-50 | סכום עם שלושה מקומות עשרוניים (99.999) — מעוגל ל-100.00 |
| 51 | T-INT-51 | סכום תשלומי installment * מספר תשלומים = total_amount (בלי floating point drift) |
| 52 | T-INT-52 | exchange_rate NUMERIC(15,6) — שומר 6 ספרות עשרוניות (1.234567) |

---

## 5. בדיקות ביצועים (Performance)

**סה"כ: 28 טסטים**

### 5.1 Index Effectiveness (12 טסטים)

```sql
-- שאילתת בדיקה:
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE user_id = '...' AND date BETWEEN '2026-01-01' AND '2026-01-31'
ORDER BY date DESC;

-- יש לוודא: "Index Scan using ix_transactions_user_date"
-- לא: "Seq Scan"
```

| # | מזהה | טסט |
|---|------|------|
| 1 | T-PRF-01 | SELECT transactions WHERE user_id AND date range → משתמש ב-`ix_transactions_user_date` |
| 2 | T-PRF-02 | SELECT categories WHERE user_id AND is_archived = false → משתמש ב-`ix_categories_active` |
| 3 | T-PRF-03 | SELECT alerts WHERE user_id AND is_read = false AND is_dismissed = false → משתמש ב-`ix_alerts_unread` |
| 4 | T-PRF-04 | SELECT fixed WHERE user_id AND is_active = true → משתמש ב-`ix_fixed_active_only` |
| 5 | T-PRF-05 | SELECT loans WHERE user_id AND status = 'active' → משתמש ב-`ix_loans_active` |
| 6 | T-PRF-06 | SELECT installments WHERE user_id AND payments_completed < number_of_payments → משתמש ב-`ix_installments_active` |
| 7 | T-PRF-07 | SELECT bank_balances WHERE user_id AND is_current = true → משתמש ב-`uq_balance_current` |
| 8 | T-PRF-08 | SELECT subscriptions WHERE next_renewal_date < NOW() → משתמש ב-`ix_subscriptions_next_renewal_date` |
| 9 | T-PRF-09 | SELECT audit_logs WHERE created_at range → משתמש ב-`ix_audit_logs_created_at` |
| 10 | T-PRF-10 | SELECT transactions WHERE user_id AND type = 'expense' → משתמש ב-`ix_transactions_user_type` |
| 11 | T-PRF-11 | SELECT transactions WHERE organization_id AND date → משתמש ב-`ix_transactions_org_date` |
| 12 | T-PRF-12 | DELETE category → SET NULL on FK columns uses index (`ix_fixed_category_id`, `ix_loans_category_id`, `ix_installments_category_id`) |

### 5.2 N+1 Detection (5 טסטים)

```python
# שימוש ב-SQLAlchemy event listener לספירת queries
async def test_no_n_plus_1_on_transactions_list(client, auth_headers):
    """GET /transactions לא מבצע יותר מ-5 queries."""
    query_count = 0
    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def count_queries(conn, cursor, stmt, params, context, executemany):
        nonlocal query_count
        query_count += 1

    response = await client.get("/api/v1/transactions", headers=auth_headers)
    assert response.status_code == 200
    assert query_count <= 5  # Main query + count + auth = ~3-4
```

| # | מזהה | טסט |
|---|------|------|
| 13 | T-PRF-13 | GET /api/v1/transactions (50 רשומות) — <= 5 queries |
| 14 | T-PRF-14 | GET /api/v1/dashboard — <= 10 queries (KPIs + aggregations) |
| 15 | T-PRF-15 | GET /api/v1/categories — <= 3 queries |
| 16 | T-PRF-16 | GET /api/v1/forecast — <= 8 queries |
| 17 | T-PRF-17 | GET /api/v1/alerts — <= 4 queries |

### 5.3 Large Dataset (5 טסטים)

```python
async def test_pagination_with_10k_transactions(db, client, auth_headers):
    """Pagination עם 10,000 עסקאות — תגובה < 200ms."""
    # Bulk insert 10K transactions
    await db.execute(
        insert(Transaction),
        [make_transaction(i) for i in range(10000)]
    )
    await db.commit()

    start = time.monotonic()
    response = await client.get(
        "/api/v1/transactions?page=1&page_size=50",
        headers=auth_headers,
    )
    elapsed = time.monotonic() - start

    assert response.status_code == 200
    assert elapsed < 0.2  # 200ms
    assert len(response.json()["items"]) == 50
```

| # | מזהה | טסט |
|---|------|------|
| 18 | T-PRF-18 | 10,000 transactions + pagination (page_size=50) — תגובה < 200ms |
| 19 | T-PRF-19 | 10,000 transactions + filter by date range — תגובה < 200ms |
| 20 | T-PRF-20 | 10,000 transactions + GROUP BY category (dashboard) — תגובה < 300ms |
| 21 | T-PRF-21 | 1,000 categories per user + list active only — תגובה < 100ms |
| 22 | T-PRF-22 | 500 alerts (unread) — list endpoint < 100ms |

### 5.4 Connection Pool (3 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 23 | T-PRF-23 | pool_size=10, max_overflow=20 — 30 concurrent requests succeed |
| 24 | T-PRF-24 | pool_pre_ping — stale connections automatically refreshed |
| 25 | T-PRF-25 | pool_recycle=3600 — connections older than 1 hour recycled |

### 5.5 Slow Query Detection (3 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 26 | T-PRF-26 | statement_timeout = 30s — query > 30s canceled with error |
| 27 | T-PRF-27 | slow_query_logger — query > 500ms logged as WARNING |
| 28 | T-PRF-28 | כל queries ב-API endpoints רגילים — < 100ms (בדיקה עם EXPLAIN ANALYZE) |

---

## 6. בדיקות אבטחה (Security)

**סה"כ: 35 טסטים**

### 6.1 SQL Injection (5 טסטים)

```python
async def test_sql_injection_in_filter(client, auth_headers):
    """SQL injection בפרמטרי filter נדחה."""
    response = await client.get(
        "/api/v1/transactions?type=' OR '1'='1",
        headers=auth_headers,
    )
    # Should either return empty or 422, NOT all records
    assert response.status_code in (200, 422)
    if response.status_code == 200:
        # Results should be empty, not all transactions
        assert len(response.json()["items"]) == 0
```

| # | מזהה | טסט |
|---|------|------|
| 1 | T-SEC-01 | SQL injection ב-transaction filter (type param) — לא מחזיר נתונים לא מורשים |
| 2 | T-SEC-02 | SQL injection ב-search query — parameterized query |
| 3 | T-SEC-03 | SQL injection ב-login username — לא עוקף auth |
| 4 | T-SEC-04 | SQL injection ב-category name — נשמר כטקסט, לא מופעל |
| 5 | T-SEC-05 | Null byte injection ב-string fields — נדחה עם 422 (DataError handler) |

### 6.2 IDOR — Insecure Direct Object Reference (8 טסטים)

```python
async def test_idor_transactions(client, auth_headers_user1, auth_headers_user2):
    """User1 לא יכול לגשת לעסקאות של User2."""
    # Create transaction for user1
    t = await create_transaction_for_user(1)

    # Try to access as user2
    response = await client.get(
        f"/api/v1/transactions/{t.id}",
        headers=auth_headers_user2,
    )
    assert response.status_code == 404  # Not 200!
```

| # | מזהה | טסט |
|---|------|------|
| 6 | T-SEC-06 | GET /transactions/{id} של משתמש אחר → 404 |
| 7 | T-SEC-07 | PUT /transactions/{id} של משתמש אחר → 404 |
| 8 | T-SEC-08 | DELETE /transactions/{id} של משתמש אחר → 404 |
| 9 | T-SEC-09 | GET /categories/{id} של משתמש אחר → 404 |
| 10 | T-SEC-10 | GET /loans/{id} של משתמש אחר → 404 |
| 11 | T-SEC-11 | GET /settings של משתמש אחר (via ID manipulation) → 404 |
| 12 | T-SEC-12 | PUT /bank-balance/{id} של משתמש אחר → 404 |
| 13 | T-SEC-13 | GET /alerts של משתמש אחר → 404 |

### 6.3 Password Security (5 טסטים)

```python
async def test_password_never_in_response(client, auth_headers):
    """Password hash אף פעם לא מוחזר ב-response."""
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    data = response.json()
    assert "password" not in str(data).lower()
    assert "hash" not in str(data).lower()
```

| # | מזהה | טסט |
|---|------|------|
| 14 | T-SEC-14 | Password stored as bcrypt hash — not plain text |
| 15 | T-SEC-15 | password_hash never returned in ANY API response |
| 16 | T-SEC-16 | bcrypt round count >= 12 (passlib default) |
| 17 | T-SEC-17 | Password change → password_changed_at updated |
| 18 | T-SEC-18 | Token issued before password change → rejected (is_token_issued_before_password_change) |

### 6.4 JWT Token Security (7 טסטים)

```python
async def test_expired_token_rejected(client):
    """Expired token נדחה."""
    expired_token = create_test_token(expired=True)
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
```

| # | מזהה | טסט |
|---|------|------|
| 19 | T-SEC-19 | Expired access token → 401 |
| 20 | T-SEC-20 | Expired refresh token → 401 |
| 21 | T-SEC-21 | Invalid JWT signature → 401 |
| 22 | T-SEC-22 | Token without 'sub' claim → 401 |
| 23 | T-SEC-23 | Token with wrong algorithm → 401 |
| 24 | T-SEC-24 | Blacklisted token (after logout) → 401 |
| 25 | T-SEC-25 | Access token used as refresh token → rejected (type != 'refresh') |

### 6.5 CORS (3 טסטים)

```python
async def test_cors_wildcard_rejected():
    """CORS wildcard '*' נדחה בקונפיגורציה."""
    with pytest.raises(ValueError, match="must not contain"):
        Settings(CORS_ORIGINS=["*"])
```

| # | מזהה | טסט |
|---|------|------|
| 26 | T-SEC-26 | CORS_ORIGINS = ["*"] → ValueError בטעינת config |
| 27 | T-SEC-27 | Preflight OPTIONS מ-origin לא מורשה → no Access-Control-Allow-Origin header |
| 28 | T-SEC-28 | Request מ-origin מורשה (localhost:5173) → Access-Control-Allow-Origin set |

### 6.6 Rate Limiting (3 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 29 | T-SEC-29 | Rate limiter initialized on app.state.limiter |
| 30 | T-SEC-30 | Rate limit exceeded → 429 Too Many Requests |
| 31 | T-SEC-31 | Rate limiter disabled in tests (limiter.enabled = False) |

### 6.7 Security Headers (4 טסטים)

```python
async def test_security_headers_present(client, auth_headers):
    """כל Security headers קיימים."""
    response = await client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "Strict-Transport-Security" in response.headers
    assert "Content-Security-Policy" in response.headers
```

| # | מזהה | טסט |
|---|------|------|
| 32 | T-SEC-32 | X-Content-Type-Options: nosniff |
| 33 | T-SEC-33 | X-Frame-Options: DENY |
| 34 | T-SEC-34 | Strict-Transport-Security: max-age=31536000 |
| 35 | T-SEC-35 | Content-Security-Policy: default-src 'self' |

---

## 7. בדיקות גיבוי ושחזור (Backup & Recovery)

**סה"כ: 12 טסטים**

### 7.1 Database Backup (4 טסטים)

```bash
# סקריפט בדיקה:
docker exec cashflow-db pg_dump -U cashflow cashflow > /backups/test_backup.sql
echo $?  # Should be 0
ls -la /backups/test_backup.sql  # Should be non-empty
```

| # | מזהה | טסט |
|---|------|------|
| 1 | T-BAK-01 | `pg_dump` — יוצר קובץ backup תקין (exit code 0) |
| 2 | T-BAK-02 | `pg_dump --format=custom` — יוצר binary backup |
| 3 | T-BAK-03 | Backup file > 0 bytes — לא ריק |
| 4 | T-BAK-04 | טבלת `backups` מתועדת — record נוצר עם status, filename, checksum |

### 7.2 Restore from Backup (4 טסטים)

```bash
# סקריפט בדיקה:
createdb cashflow_restore_test
psql -U cashflow cashflow_restore_test < /backups/test_backup.sql
echo $?  # Should be 0
psql -U cashflow cashflow_restore_test -c "SELECT count(*) FROM users;"
```

| # | מזהה | טסט |
|---|------|------|
| 5 | T-BAK-05 | `pg_restore` — שחזור מוצלח מ-backup (exit code 0) |
| 6 | T-BAK-06 | אחרי restore — כל טבלאות קיימות |
| 7 | T-BAK-07 | אחרי restore — כל triggers קיימים |
| 8 | T-BAK-08 | אחרי restore — ספירת רשומות תואמת למקור |

### 7.3 Backup Management (4 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 9 | T-BAK-09 | BACKUP_DIR setting — ברירת מחדל `/backups` |
| 10 | T-BAK-10 | BACKUP_RETENTION_DAYS setting — ברירת מחדל 30 יום |
| 11 | T-BAK-11 | backup volume mounted in Docker — `backup_data:/backups` |
| 12 | T-BAK-12 | `backups.verification_checksum` — checksum תואם SHA-256 של הקובץ |

---

## 8. בדיקות קונפיגורציה (Configuration)

**סה"כ: 18 טסטים**

### 8.1 Environment Variables (8 טסטים)

```python
# test_config.py

def test_default_database_url():
    """Default DATABASE_URL is set."""
    s = Settings()
    assert "postgresql+asyncpg" in s.DATABASE_URL
    assert "cashflow" in s.DATABASE_URL

def test_secret_key_auto_generated():
    """Empty SECRET_KEY generates random key."""
    s = Settings(SECRET_KEY="")
    assert len(s.SECRET_KEY) > 32
```

| # | מזהה | טסט |
|---|------|------|
| 1 | T-CFG-01 | DATABASE_URL — ברירת מחדל `postgresql+asyncpg://cashflow:cashflow@localhost:5432/cashflow` |
| 2 | T-CFG-02 | SECRET_KEY ריק → נוצר אוטומטית (secrets.token_urlsafe(64)) |
| 3 | T-CFG-03 | SECRET_KEY = "change-me-in-production" → נוצר אוטומטית |
| 4 | T-CFG-04 | ALGORITHM — ברירת מחדל HS256 |
| 5 | T-CFG-05 | ACCESS_TOKEN_EXPIRE_MINUTES — ברירת מחדל 15 |
| 6 | T-CFG-06 | REFRESH_TOKEN_EXPIRE_DAYS — ברירת מחדל 7 |
| 7 | T-CFG-07 | CORS_ORIGINS — JSON array parsing works |
| 8 | T-CFG-08 | CORS_ORIGINS — comma-separated parsing works |

### 8.2 Connection String (3 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 9 | T-CFG-09 | Database URL uses `asyncpg` driver (not psycopg2) |
| 10 | T-CFG-10 | alembic.ini URL overridden by config.py (settings.DATABASE_URL) |
| 11 | T-CFG-11 | Test DB URL replaces only database name → `cashflow_test` |

### 8.3 Pool Settings (4 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 12 | T-CFG-12 | pool_size = 10 — מוגדר |
| 13 | T-CFG-13 | max_overflow = 20 — מוגדר |
| 14 | T-CFG-14 | pool_pre_ping = True — מוגדר |
| 15 | T-CFG-15 | pool_recycle = 3600 — מוגדר |

### 8.4 Debug/Production Mode (3 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 16 | T-CFG-16 | DEBUG = False (production) → /docs disabled (None) |
| 17 | T-CFG-17 | DEBUG = False (production) → /redoc disabled (None) |
| 18 | T-CFG-18 | DEBUG = False → unhandled exceptions return generic "Internal server error" (no stack trace) |

---

## 9. בדיקות Docker ותשתית (Infrastructure)

**סה"כ: 17 טסטים**

### 9.1 Docker Compose (5 טסטים)

```bash
# סקריפט בדיקה:
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI
docker-compose up -d
docker-compose ps  # Both services should be "Up"
```

| # | מזהה | טסט |
|---|------|------|
| 1 | T-INF-01 | `docker-compose up -d` — כל services עולים (db + pgadmin) |
| 2 | T-INF-02 | PostgreSQL container — image `postgres:16-alpine` |
| 3 | T-INF-03 | pgadmin container — depends_on db (service_healthy) |
| 4 | T-INF-04 | DB port 5432 exposed — `psql` connects from host |
| 5 | T-INF-05 | pgadmin port 5050 exposed — HTTP 200 on `http://localhost:5050` |

### 9.2 Health Checks (3 טסטים)

```bash
# סקריפט בדיקה:
docker inspect cashflow-db --format='{{.State.Health.Status}}'
# Should return: "healthy"
```

| # | מזהה | טסט |
|---|------|------|
| 6 | T-INF-06 | DB healthcheck — `pg_isready -U cashflow` returns 0 |
| 7 | T-INF-07 | DB healthcheck interval = 5s, timeout = 5s, retries = 5 |
| 8 | T-INF-08 | Application `/health` endpoint — returns `{"status": "healthy"}` |

### 9.3 Volumes & Persistence (4 טסטים)

```bash
# סקריפט בדיקה:
# Create data, restart, verify data persists
docker-compose down
docker-compose up -d
psql -U cashflow -c "SELECT count(*) FROM users;"  # Should still have data
```

| # | מזהה | טסט |
|---|------|------|
| 9 | T-INF-09 | Volume `postgres_data` mounted at `/var/lib/postgresql/data` |
| 10 | T-INF-10 | Volume `backup_data` mounted at `/backups` |
| 11 | T-INF-11 | Data persists after `docker-compose down && up` |
| 12 | T-INF-12 | pgadmin data persists in `pgadmin_data` volume |

### 9.4 Resource Limits (2 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 13 | T-INF-13 | DB container — memory limit 512M, reservation 256M |
| 14 | T-INF-14 | pgadmin container — memory limit 256M, reservation 128M |

### 9.5 Environment Isolation (3 טסטים)

| # | מזהה | טסט |
|---|------|------|
| 15 | T-INF-15 | `.env` — development config (DEBUG=true) |
| 16 | T-INF-16 | `.env.production` — production config (DEBUG=false, strong SECRET_KEY) |
| 17 | T-INF-17 | Test database — uses `cashflow_test` (separated from dev/prod) |

---

## סיכום כמותי

| סעיף | תיאור | מספר טסטים |
|-------|--------|------------|
| 2 | Schema Integrity | **58** |
| 3 | Migrations | **27** |
| 4 | Data Integrity | **52** |
| 5 | Performance | **28** |
| 6 | Security | **35** |
| 7 | Backup & Recovery | **12** |
| 8 | Configuration | **18** |
| 9 | Docker & Infrastructure | **17** |
| **סה"כ** | | **247** |

---

## ממצאים ותובנות מהניתוח

### ממצאים חיוביים
1. **DECIMAL(15,2)** בכל שדות כספיים — ללא float leakage
2. **CASCADE DELETE** מוגדר נכון בכל ה-FK של user_id
3. **SET NULL** מוגדר נכון עבור category_id (קטגוריה נמחקת, עסקה נשארת)
4. **30+ CHECK constraints** — data validation ברמת ה-DB
5. **5 trigger functions** — auto-update, admin protection, audit logging
6. **Partial indexes** — ביצועים מיטביים לשאילתות נפוצות (active records)
7. **Security headers** — X-Frame-Options, HSTS, CSP מוגדרים
8. **Rate limiting** — slowapi מוגדר
9. **Slow query logging** — threshold 500ms
10. **Connection pooling** — pool_pre_ping, pool_recycle מוגדרים

### נקודות לתשומת לב (לא בהכרח באגים)
1. **`audit_log` (trigger) vs `audit_logs` (model)** — שתי טבלאות audit שונות. `audit_log` נוצרת על ידי trigger (BIGSERIAL, JSONB), `audit_logs` נוצרת על ידי Alembic migration (UUID, Text). יש לוודא שאין כפילות לוגית.
2. **`backups.created_by`** — אין FK constraint ל-users. עלול להכיל UUID שכבר לא קיים.
3. **`organizations.owner_id`** — FK ללא ON DELETE. מחיקת user שהוא owner תיכשל עם FK violation (אולי מכוון).
4. **Token blacklist in-memory** — לא שורד restart, לא shared בין workers. מתועד לשדרוג ל-Redis.
5. **`datetime.utcnow`** — deprecated ב-Python 3.12+. כרגע תואם ל-Python 3.9 אבל יש לשדרג ל-`datetime.now(timezone.utc)` בעתיד.
6. **Duplicate CHECK constraints** — migration `029e8f951a2e` מנקה constraints כפולים שנוצרו ב-`f58ca177ac66` ו-`fb15cad9b324`. חשוב לוודא שנוקה בהצלחה.
7. **`c418f49cdb52`** — מוסיף `currency` ל-bank_balances כ-NOT NULL ללא server_default. עלול להיכשל אם יש נתונים קיימים.
8. **`.env.production` committed** — מכיל SECRET_KEY אמיתי. יש לוודא שלא ב-Git.

---

## סדר עדיפות להרצה

### P0 — Critical (חובה לפני deploy)
- T-SCH (Schema) — כל 58
- T-INT (Data Integrity) — כל 52
- T-SEC (Security) — כל 35
- T-MIG-01 עד T-MIG-05 (Fresh migration)

### P1 — High (חובה לפני production)
- T-MIG (Migrations) — 06-27
- T-CFG (Configuration) — כל 18
- T-PRF-01 עד T-PRF-12 (Index effectiveness)
- T-BAK (Backup) — כל 12

### P2 — Medium (מומלץ)
- T-PRF-13 עד T-PRF-22 (N+1, large dataset)
- T-INF (Docker) — כל 17

### P3 — Nice to have
- T-PRF-23 עד T-PRF-28 (Pool, slow query)

---

## הפקודות להרצת הטסטים

```bash
# הרצת כל טסטי ה-DB
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
source venv/bin/activate
PYTHONPATH=. pytest tests/test_database/ -v --tb=short

# הרצת רק schema tests
PYTHONPATH=. pytest tests/test_database/test_schema.py -v

# הרצת רק migration tests
PYTHONPATH=. pytest tests/test_database/test_migrations.py -v

# הרצת רק integrity tests
PYTHONPATH=. pytest tests/test_database/test_integrity.py -v

# הרצת רק security tests
PYTHONPATH=. pytest tests/test_database/test_security.py -v

# הרצת רק performance tests
PYTHONPATH=. pytest tests/test_database/test_performance.py -v --timeout=60
```

---

> **מסמך זה נוצר אוטומטית על ידי Database & Infrastructure QA Architect**
> **תאריך:** 18.02.2026 | **גרסה:** 1.0
