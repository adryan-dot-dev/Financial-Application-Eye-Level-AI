# Implementer Tasks

> קובץ זה מנוהל ע"י **Orchestrator**.
> אל תערוך ידנית אלא אם אתה ה-Orchestrator.

---

## הוראות ל-Implementer

1. מצא את המשימה העליונה עם `PENDING`
2. שנה ל-`IN PROGRESS`
3. בצע
4. עדכן סטטוס ב-`status/implement.md`
5. שנה ל-`DONE`

---

## משימות

## Task-001: Fix text overflow across all pages

**Status:** DONE (Sprint 2)
**Priority:** HIGH
**Depends on:** -

### תיאור
תקן טקסט חופף/גולש בכל הדפים. הבעיות העיקריות:

1. **CategoriesPage.tsx** - שמות קטגוריות חופפים. הוסף `min-w-0` ו-`max-w-full` ל-flex containers
2. **TransactionsPage.tsx:765** - Description column overflow. הוסף `overflow-hidden`
3. **BalancePage.tsx:501** - Notes field overflow
4. **FixedPage.tsx:391** - Card headers need `min-w-0 flex-1` wrapper
5. **InstallmentsPage.tsx:515** - Card headers need `min-w-0 flex-1` wrapper
6. **LoansPage.tsx:465** - Card headers need `min-w-0 flex-1` wrapper
7. הוסף `title` attribute לכל טקסט עם `truncate` כדי שאפשר לראות את הטקסט המלא ב-hover

### קבצים
- `frontend/src/pages/CategoriesPage.tsx`
- `frontend/src/pages/TransactionsPage.tsx`
- `frontend/src/pages/BalancePage.tsx`
- `frontend/src/pages/FixedPage.tsx`
- `frontend/src/pages/InstallmentsPage.tsx`
- `frontend/src/pages/LoansPage.tsx`

### קריטריונים להצלחה
- [ ] אין טקסט חופף בשום דף
- [ ] כל טקסט ארוך נחתך עם ellipsis
- [ ] hover על טקסט חתוך מציג tooltip עם הטקסט המלא
- [ ] עובד נכון ב-RTL ו-LTR

---

## Task-002: Replace RTL ternaries with CSS logical properties

**Status:** DONE (Sprint 1)
**Priority:** HIGH
**Depends on:** -

### תיאור
החלף את כל ה-`isRtl ? 'left-X' : 'right-X'` ב-Tailwind logical properties.

**מיפוי:**
- `left-X` / `right-X` → `start-X` / `end-X`
- `ml-X` / `mr-X` → `ms-X` / `me-X`
- `pl-X` / `pr-X` → `ps-X` / `pe-X`
- `text-left` / `text-right` → `text-start` / `text-end`
- `rounded-l` / `rounded-r` → `rounded-s` / `rounded-e`

**קבצים לתיקון:**
1. `Sidebar.tsx:117,153` - Active indicator & mobile positioning
2. `RegisterPage.tsx:152,292,345,398,434,497,541` - Input icons
3. `LoginPage.tsx:76,226,267,297` - Input icons
4. `TransactionsPage.tsx:424` - Search icon
5. `index.css:337-341` - Select dropdown arrow CSS (use `padding-inline`)

### קבצים
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/TransactionsPage.tsx`
- `frontend/src/index.css`

### קריטריונים להצלחה
- [ ] אין `isRtl ? 'left' : 'right'` בשום קובץ TSX
- [ ] כל הפוזישנים משתמשים ב-logical properties
- [ ] RTL ו-LTR עובדים נכון בכל הדפים

---

## Task-003: Replace inline hover handlers with CSS

**Status:** DONE (Sprint 2)
**Priority:** MEDIUM
**Depends on:** -

### תיאור
החלף את כל ה-`onMouseEnter/onMouseLeave` inline handlers ב-Tailwind `hover:` classes.

**דפוס נוכחי (בעייתי):**
```tsx
<button
  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)' }}
  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
>
```

**דפוס חדש:**
```tsx
<button className="hover:bg-[var(--bg-tertiary)] transition-colors">
```

### קבצים
- כל הדפים עם כפתורי action (CategoriesPage, TransactionsPage, FixedPage, InstallmentsPage, LoansPage, BalancePage, AlertsPage)

### קריטריונים להצלחה
- [ ] אין onMouseEnter/onMouseLeave inline handlers בשום קובץ
- [ ] כל ה-hover effects דרך CSS classes
- [ ] Hover effects עובדים גם ב-dark mode

---

## Task-004: Fix dark mode issues

**Status:** DONE (Sprint 2) - Modal backdrops standardized
**Priority:** MEDIUM
**Depends on:** -

### תיאור
1. וודא contrast ratio תקין ב-dark mode לכל form inputs
2. תקן modal backdrop - שונה ל-dark mode (`bg-black/40` → `bg-black/50` ב-dark)
3. וודא שכל הצבעים מתחלפים נכון

### קבצים
- `frontend/src/index.css`
- כל הדפים עם modals

### קריטריונים להצלחה
- [ ] WCAG AA contrast ratio בכל form inputs ב-dark mode
- [ ] Modal backdrop ברור ב-dark mode
- [ ] אין טקסט שקשה לקרוא ב-dark mode

---

## Task-005: Fix hardcoded English month labels

**Status:** PENDING
**Priority:** MEDIUM
**Depends on:** -

### תיאור
DashboardPage.tsx:80-87 משתמש ב-`en-US` hardcoded. צריך להשתמש ב-locale של i18n.

**תיקון:**
```tsx
// לפני:
date.toLocaleDateString('en-US', { month: 'short' })
// אחרי:
date.toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US', { month: 'short' })
```

צריך לבדוק גם ForecastPage ו-BalancePage לאותה בעיה.

### קבצים
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/ForecastPage.tsx`
- `frontend/src/pages/BalancePage.tsx`

### קריטריונים להצלחה
- [ ] חודשים מוצגים בעברית כשהשפה עברית
- [ ] חודשים מוצגים באנגלית כשהשפה אנגלית

---

## Task-006: Add responsive improvements

**Status:** PENDING
**Priority:** LOW
**Depends on:** Task-001

### תיאור
1. הוסף `overflow-hidden` לכל card containers
2. וודא שטבלאות גוללות אופקית במובייל
3. וודא שה-sidebar לא חוסם תוכן במובייל

### קבצים
- כל דפי Cards (Fixed, Installments, Loans)
- כל דפי Tables (Transactions, Balance)
- `frontend/src/components/layout/Sidebar.tsx`

### קריטריונים להצלחה
- [ ] אין overflow במסכים קטנים (320px+)
- [ ] טבלאות ניתנות לגלילה אופקית
- [ ] Sidebar לא חוסם תוכן

---

## Task-007: Create ErrorBoundary + Custom Error Page

**Status:** DONE (Sprint 2)
**Priority:** HIGH
**Depends on:** -

### תיאור
1. ErrorBoundary class component - catches React render errors
2. ErrorPage component - professional design with logo, error details (dev mode), go home/retry buttons
3. 404 catch-all route in App.tsx
4. Integration with App.tsx wrapping

### קבצים
- `frontend/src/components/ErrorBoundary.tsx` (NEW)
- `frontend/src/pages/ErrorPage.tsx` (NEW)
- `frontend/src/App.tsx` (MODIFY)

### קריטריונים להצלחה
- [ ] Error boundary catches render errors
- [ ] 404 page shows for unknown routes
- [ ] Logo displayed on error page
- [ ] Dev mode shows full stack trace
- [ ] Works in dark/light mode
- [ ] Works in RTL/LTR

---

## Task-008: Backend + DB Hardening (33 findings)

**Status:** DONE (Sprint 2)
**Priority:** CRITICAL
**Depends on:** -

### תיאור
Based on comprehensive backend audit with 33 findings:

**Critical:**
1. Create Alembic migration for 22 missing indexes
2. Fix category ownership IDOR in transactions, fixed, installments, loans
3. Fix installment type ignored in forecast (income counted as expense)

**High:**
4. Add CHECK constraints (day_of_month, amounts, payment counts)
5. Fix FixedUpdate date range validation
6. Fix LoanUpdate status manipulation
7. Fix weekly forecast week alignment
8. Fix alert is_read state lost on regeneration

**Medium:**
9. Fix bulk_delete count reporting

### קבצים
- `backend/alembic/versions/` (NEW migration)
- `backend/app/api/v1/endpoints/transactions.py`
- `backend/app/api/v1/endpoints/fixed.py`
- `backend/app/api/v1/endpoints/installments.py`
- `backend/app/api/v1/endpoints/loans.py`
- `backend/app/services/forecast_service.py`
- `backend/app/services/alert_service.py`
- `backend/app/api/v1/schemas/fixed.py`

### קריטריונים להצלחה
- [ ] כל 155 הטסטים הקיימים עוברים
- [ ] 22 אינדקסים חסרים נוספו ל-migration
- [ ] IDOR vulnerability תוקן
- [ ] Forecast מטפל נכון בהכנסות installment

---

## Task-009: Loan Auto-Charge Automation

**Status:** DONE (Sprint 2)
**Priority:** HIGH
**Depends on:** -

### תיאור
Implement recurring charge automation:
1. automation_service.py - processes loans, fixed entries, installments on their day_of_month
2. API endpoints: POST /automation/process-recurring + preview
3. Idempotency - won't duplicate if run twice on same day
4. Tests

### קבצים
- `backend/app/services/automation_service.py` (NEW)
- `backend/app/api/v1/endpoints/automation.py` (NEW)
- `backend/app/api/v1/router.py` (MODIFY)
- `backend/tests/test_automation.py` (NEW)

### קריטריונים להצלחה
- [ ] Loans auto-charge creates expense transaction
- [ ] Fixed income/expense creates matching transaction
- [ ] Installments auto-charge with counter increment
- [ ] Idempotent - no duplicates
- [ ] Preview endpoint works
- [ ] כל הטסטים עוברים
