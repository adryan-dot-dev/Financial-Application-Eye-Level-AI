# Tester Tasks

> קובץ זה מנוהל ע"י **Orchestrator**.
> אל תערוך ידנית אלא אם אתה ה-Orchestrator.

---

## הוראות ל-Tester

1. מצא את המשימה העליונה עם `PENDING`
2. שנה ל-`IN PROGRESS`
3. כתוב טסטים והרץ
4. עדכן סטטוס ב-`status/test.md`
5. שנה ל-`DONE`

---

## משימות

## Task-T001: Backend API E2E QA - Run all existing tests

**Status:** PENDING
**Priority:** HIGH
**Depends on:** -

### תיאור
הרץ את כל הטסטים הקיימים של ה-backend ווודא שהכל עובר.

```bash
cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v --tb=long
```

### מה לבדוק
- [ ] כל הטסטים עוברים
- [ ] אין warnings חדשים
- [ ] אין deprecation notices

---

## Task-T002: Backend API QA - Verify all endpoints manually

**Status:** PENDING
**Priority:** HIGH
**Depends on:** Task-T001

### תיאור
בדוק ידנית כל endpoint של ה-API דרך curl/httpie:

1. **Auth flow:** register → login → get token → refresh → logout
2. **Categories:** create → list → update → reorder → archive
3. **Transactions:** create → list (with filters) → update → duplicate → bulk delete
4. **Fixed:** create → list → pause → resume → update → delete
5. **Installments:** create → list → view payments → update → delete
6. **Loans:** create → list → make payment → view breakdown → delete
7. **Balance:** set → get → history
8. **Forecast:** monthly → weekly → summary
9. **Alerts:** list → mark read → dismiss
10. **Settings:** get → update
11. **Dashboard:** summary

### מה לבדוק
- [ ] כל endpoint מחזיר status code נכון
- [ ] כל endpoint מחזיר data בפורמט הנכון
- [ ] Error handling עובד (400, 401, 404, 422)
- [ ] Pagination עובד
- [ ] Filtering עובד

---

## Task-T003: Frontend Visual QA - All pages

**Status:** PENDING
**Priority:** HIGH
**Depends on:** Implement Tasks 001-006

### תיאור
בדיקה ויזואלית של כל הדפים. צור רשימת בעיות מפורטת.

### מה לבדוק
- [ ] Dashboard: KPI cards, charts, alerts panel
- [ ] Transactions: table, filters, sorting, pagination, create/edit modal
- [ ] Categories: card list, icons, colors, create/edit modal
- [ ] Fixed: cards, pause/resume, create/edit modal
- [ ] Installments: cards, progress bars, payment schedule, modal
- [ ] Loans: cards, payment tracking, modal
- [ ] Balance: current balance card, history chart, update modal
- [ ] Forecast: monthly/weekly/summary tabs, charts
- [ ] Settings: theme toggle, language toggle
- [ ] Alerts: severity filtering, mark read/dismiss
- [ ] Login/Register: forms, validation
- [ ] כל דף ב-RTL (עברית) ו-LTR (אנגלית)
- [ ] כל דף ב-Light mode ו-Dark mode
- [ ] אין טקסט חופף
- [ ] אין overflow

---

## Task-T004: Accessibility testing

**Status:** PENDING
**Priority:** HIGH
**Depends on:** Implement Tasks

### תיאור
בדוק נגישות בכל הדפים.

### מה לבדוק
- [ ] כל אלמנט אינטראקטיבי נגיש ב-Tab navigation
- [ ] Focus indicators ברורים
- [ ] Screen reader: כל תמונה עם alt, כל כפתור עם aria-label
- [ ] Forms: labels מחוברים ל-inputs
- [ ] Error messages מחוברים ל-fields (aria-describedby)
- [ ] Modals: focus trap, Escape key, focus restoration
- [ ] Tables: scope attributes על headers
- [ ] Color contrast WCAG AA
