# Cash Flow Management Application - Eye Level AI
## Project Implementation Plan

**Version:** 2.0
**Date:** February 9, 2026
**Status:** Ready for Implementation

---

## Core Principle: SELF-SERVICE

> **העיקרון המנחה:** המערכת חייבת להיות SELF-SERVICE מלא.
> המשתמש (שלא מתכנת) צריך לנהל הכל דרך ה-UI בלי לחזור למפתח לעולם.

---

## Tech Stack

| Category | Technology | Why |
|----------|------------|-----|
| Backend | FastAPI | Async, API-first, auto OpenAPI docs |
| Database | PostgreSQL | ACID, financial precision, scalability |
| ORM | SQLAlchemy 2.0 | Async support, type hints |
| Migrations | Alembic | SQLAlchemy integration |
| Auth | JWT | Stateless, refresh tokens |
| Frontend | React 18 + TypeScript | Type safety, modern ecosystem |
| Styling | Tailwind + shadcn/ui | Flexible, RTL support |
| Charts | Recharts | React-native integration |
| State | React Query (TanStack) | Server state management |
| i18n | i18next | Hebrew + RTL support |

---

## Implementation Phases

### Phase 0: Project Setup (Days 1-2) ✅ COMPLETE

#### Tasks:
- [x] יצירת מבנה תיקיות backend/ ו-frontend/
- [x] יצירת קובץ `.env.example` עם כל המשתנים
- [x] אתחול FastAPI עם endpoint `/health`
- [x] הגדרת CORS configuration
- [x] אתחול React עם Vite
- [x] הקמת PostgreSQL עם Docker (`docker-compose.yml`)
- [x] הגדרת Alembic למיגרציות
- [x] הגדרת ESLint, Prettier
- [x] יצירת `seed_data.py` עם:
  - [x] קטגוריות ברירת מחדל בעברית
  - [x] Admin user ראשוני (username: admin, password מ-.env)
- [x] יצירת README.md בסיסי עם הוראות התקנה

#### Definition of Done:
- [x] `docker-compose up` מרים PostgreSQL
- [x] `uvicorn app.main:app --reload` עובד ומחזיר 200 ב-`/health`
- [x] `npm run dev` מרים את ה-frontend
- [x] `.env.example` מתועד עם כל המשתנים
- [x] Alembic מאותחל ויכול ליצור migrations
- [x] README מסביר איך להתקין ולהריץ
- [x] Seed script יוצר admin user וקטגוריות

---

### Phase 1: Core Backend Infrastructure (Days 3-7) ✅ COMPLETE

#### Tasks:
- [x] מודל User + מיגרציה (כולל is_admin field)
- [x] מודל Settings + מיגרציה (הגדרות משתמש)
- [x] Build auth endpoints (register, login, JWT refresh)
- [x] JWT middleware לאימות
- [x] מודל Category + מיגרציה
- [x] Category CRUD API (כולל reorder)
- [x] מודל Transaction + מיגרציה (כולל currency field)
- [x] Transaction CRUD API (כולל duplicate + bulk ops)
- [x] Pydantic schemas
- [x] Unit tests ל-auth (9 tests)
- [x] Unit tests ל-CRUD (14 tests)
- [x] Users admin API (list, create, update, delete)

#### Definition of Done:
- [x] אפשר להירשם, להתחבר, ולהתנתק
- [x] JWT token עובד עם refresh
- [x] CRUD קטגוריות עובד (create, read, update, delete, reorder)
- [x] CRUD תנועות עובד (כולל duplicate + bulk)
- [x] Settings API עובד
- [x] Unit tests עוברים (`pytest -v` ירוק) - 23 tests passed
- [x] API מתועד אוטומטית ב-`/docs` - 33 routes

---

### Phase 2: Financial Features Backend (Days 8-14)

#### Tasks:
- [ ] Fixed Income/Expenses model + API (כולל currency)
- [ ] Installments model + חישוב לוח תשלומים (כולל currency)
- [ ] Loans model + לוח סילוקין (כולל currency)
- [ ] Bank Balance model + API
- [ ] Expected Income model + API
- [ ] **Forecast Service** - חישוב צפי תזרים (חודשי + שבועי)
- [ ] **Alert Service** - זיהוי תזרים שלילי
- [ ] Tests לחישובים פיננסיים

#### Edge Cases לטיפול:
- [ ] פריסה שמתחילה באמצע חודש
- [ ] הלוואה עם ריבית 0% (לא לחלק באפס)
- [ ] חודש עם 31 ימים - day_of_month גדול מ-28
- [ ] תזרים שלילי - יצירת התראה אוטומטית
- [ ] מחיקת קטגוריה עם תנועות - soft delete בלבד

#### Definition of Done:
- [ ] כל ה-CRUD APIs עובדים (fixed, installments, loans, balance, expected-income)
- [ ] `/api/v1/forecast` מחזיר צפי נכון ל-6 חודשים
- [ ] `/api/v1/forecast/weekly` מחזיר צפי שבועי
- [ ] התראות נוצרות אוטומטית כשיש תזרים שלילי צפוי
- [ ] Tests לחישובים פיננסיים עוברים
- [ ] Edge cases מטופלים ונבדקים

---

### Phase 3: Frontend Foundation (Days 15-21)

#### Tasks:
- [ ] React Router setup
- [ ] AuthContext + ProtectedRoute
- [ ] Login/Register pages
- [ ] AppLayout עם Sidebar
- [ ] RTL support (direction, i18n)
- [ ] i18n עם תרגומים לעברית
- [ ] Common components:
  - [ ] Button, Input, Modal, Card, Table
  - [ ] Spinner, Alert, DatePicker
  - [ ] CurrencyInput, EmptyState
  - [ ] IconPicker, ColorPicker (לקטגוריות)
- [ ] Axios client עם interceptors (JWT, errors)
- [ ] React Query setup

#### Definition of Done:
- [ ] Login/Register עובדים עם ה-backend
- [ ] Navigation עם RTL נכון
- [ ] שפה עוברת מעברית לאנגלית ולהפך
- [ ] כל Common components מוכנים ומעוצבים
- [ ] Protected routes עובדים (redirect ל-login)

---

### Phase 4: Frontend CRUD Features (Days 22-28)

#### Tasks:
- [ ] Transactions page:
  - [ ] טבלה עם pagination
  - [ ] מיון לפי עמודה
  - [ ] סינון מתקדם (תאריך, קטגוריה, סכום, סוג, טקסט)
  - [ ] יצירה/עריכה/מחיקה
  - [ ] כפתור שכפול
  - [ ] Bulk actions (מחיקה מרובה, שינוי קטגוריה)
- [ ] Categories page:
  - [ ] רשימה עם icon + color
  - [ ] IconPicker + ColorPicker בטופס
  - [ ] Drag & drop לשינוי סדר
- [ ] Fixed entries page
- [ ] Installments page עם לוח תשלומים
- [ ] Loans page עם פירוט חודשי
- [ ] Balance page

#### Definition of Done:
- [ ] כל דפי ה-CRUD עובדים מקצה לקצה
- [ ] סינון וחיפוש מתקדם עובדים בתנועות
- [ ] מיון לפי עמודות עובד
- [ ] Bulk actions עובדים
- [ ] Drag & drop קטגוריות עובד
- [ ] Icon/Color picker עובדים

---

### Phase 5: Self-Service Features (Days 29-35)

#### Tasks:
- [ ] Settings page:
  - [ ] שינוי מטבע ברירת מחדל
  - [ ] שינוי שפה
  - [ ] Light/Dark mode toggle
  - [ ] כמות חודשי צפי ברירת מחדל
  - [ ] הפעלה/כיבוי התראות
- [ ] User Management (admin):
  - [ ] רשימת משתמשים
  - [ ] הוספת משתמש חדש
  - [ ] שינוי סיסמה למשתמש
  - [ ] מחיקת משתמש
- [ ] Export:
  - [ ] ייצוא תנועות ל-CSV
  - [ ] ייצוא תנועות ל-Excel
  - [ ] ייצוא דוח חודשי ל-PDF
  - [ ] ייצוא דוח שנתי ל-PDF
  - [ ] כפתור "ייצוא" בכל דף רלוונטי
- [ ] Import:
  - [ ] העלאת קובץ CSV
  - [ ] מיפוי עמודות (wizard)
  - [ ] Preview לפני שמירה
  - [ ] דיווח על שורות שנכשלו

#### Definition of Done:
- [ ] Settings page עובד ושינויים נשמרים
- [ ] Dark mode מתחלף בזמן אמת
- [ ] Admin יכול להוסיף/לערוך/למחוק משתמשים
- [ ] ייצוא CSV/Excel עובד ומוריד קובץ
- [ ] ייצוא PDF מוריד דוח מעוצב
- [ ] ייבוא CSV עובד מקצה לקצה עם preview

---

### Phase 6: Dashboard & Reports (Days 36-42)

#### Tasks:
- [ ] Dashboard layout
- [ ] KPI cards (יתרה, הכנסות החודש, הוצאות החודש, צפי)
- [ ] Alert display component בולט
- [ ] Forecast page:
  - [ ] טבלה עם 6 חודשים
  - [ ] גרף קו
  - [ ] Expected Income inputs
- [ ] Weekly chart (הכנסות vs הוצאות)
- [ ] Monthly chart עם breakdown לפי קטגוריות
- [ ] Quarterly trends chart
- [ ] Yearly overview
- [ ] Category pie chart

#### Definition of Done:
- [ ] Dashboard מציג KPIs בזמן אמת
- [ ] התראות מוצגות בבולטות
- [ ] Forecast מציג טבלה + גרף
- [ ] כל סוגי הגרפים עובדים (Bar, Line, Pie)
- [ ] תצוגות שבועי/חודשי/רבעוני/שנתי עובדות

---

### Phase 7: Polish & Testing (Days 43-49)

#### Tasks:
- [ ] Error handling מקיף:
  - [ ] Error boundaries
  - [ ] Toast notifications בעברית
- [ ] Loading states + skeletons
- [ ] Form validation messages בעברית
- [ ] Mobile responsive testing & fixes
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Security review:
  - [ ] XSS prevention
  - [ ] CSRF protection
  - [ ] Input sanitization
- [ ] Performance optimization
- [ ] Integration tests לכל ה-APIs
- [ ] E2E tests לתהליכים קריטיים
- [ ] Bug fixes מכל הבדיקות
- [ ] API documentation final review
- [ ] User documentation / Help pages

#### Definition of Done:
- [ ] אין שגיאות UI לא מטופלות
- [ ] כל הטפסים עם validation בעברית
- [ ] עובד טוב במובייל
- [ ] כל Integration tests עוברים
- [ ] E2E tests עוברים
- [ ] Security review checklist מלא
- [ ] Documentation complete

---

### Phase 8 (Future): Advanced Features
- [ ] audit_log implementation
- [ ] Multi-currency support (full)
- [ ] Reports scheduling (email)
- [ ] Bank API integration
- [ ] Mobile app (React Native)

---

## Database Schema Summary

### Core Tables:
- **users** - משתמשים (כולל is_admin)
- **settings** - הגדרות משתמש (מטבע, שפה, theme)
- **categories** - קטגוריות דינאמיות
- **transactions** - תנועות הכנסה/הוצאה

### Financial Tables:
- **fixed_income_expenses** - הכנסות/הוצאות קבועות
- **installments** - פריסות תשלומים
- **loans** - הלוואות
- **bank_balances** - יתרות בנק
- **expected_income** - הכנסות צפויות (הערכות)
- **alerts** - התראות

### Future (Phase 8):
- **audit_log** - לוג שינויים

---

## API Endpoints Summary

| Resource | Endpoints |
|----------|-----------|
| Auth | register, login, logout, refresh, me, password |
| Users | list, create, update, delete (admin) |
| Settings | get, update |
| Categories | CRUD + reorder |
| Transactions | CRUD + duplicate + bulk actions + filtering |
| Fixed | CRUD + pause/resume |
| Installments | CRUD + payments |
| Loans | CRUD + payment + breakdown |
| Balance | get, update, history |
| Expected Income | get, set, delete |
| Forecast | monthly, weekly, summary |
| Dashboard | summary, weekly, monthly, quarterly, yearly |
| Alerts | list, read, dismiss |
| Export | CSV, Excel, PDF |
| Import | preview, transactions |

---

## Edge Cases & Error Handling

### מקרי קצה:
1. פריסה שמתחילה באמצע חודש
2. הלוואה עם ריבית 0%
3. חודש עם 31 ימים vs 28 ימים
4. תזרים שלילי - התראה אוטומטית
5. מחיקת קטגוריה עם תנועות - soft delete
6. ייבוא CSV עם שורות לא תקינות
7. ייצוא עם 0 תנועות
8. משתמש מוחק את עצמו - למנוע

### Custom Exceptions:
- CashFlowException (base)
- InsufficientDataException
- InvalidDateRangeException
- NegativeAmountException
- ImportValidationException

---

## Verification Checklist

### Backend:
- [ ] `curl http://localhost:8000/health` returns 200
- [ ] `/docs` shows all endpoints
- [ ] Auth flow works (register → login → protected)
- [ ] All CRUD operations work
- [ ] Forecast calculation is accurate
- [ ] Alerts are generated for negative cash flow

### Frontend:
- [ ] Login/Register work
- [ ] RTL displays correctly
- [ ] Language switching works
- [ ] All CRUD pages functional
- [ ] Charts render correctly
- [ ] Export downloads files
- [ ] Import processes CSV

### Tests:
- [ ] `pytest -v` all green
- [ ] `npm test` all green

---

## Progress Tracking

**Current Phase:** Not Started
**Last Updated:** February 9, 2026

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 | Not Started | |
| Phase 1 | Not Started | |
| Phase 2 | Not Started | |
| Phase 3 | Not Started | |
| Phase 4 | Not Started | |
| Phase 5 | Not Started | |
| Phase 6 | Not Started | |
| Phase 7 | Not Started | |
