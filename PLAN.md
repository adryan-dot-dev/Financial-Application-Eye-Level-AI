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
| Frontend | React 19 + TypeScript 5.9 | Type safety, modern ecosystem |
| Styling | Tailwind CSS v4 | Flexible, RTL support, logical properties |
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

### Phase 2: Financial Features Backend (Days 8-14) ✅ COMPLETE

#### Tasks:
- [x] Fixed Income/Expenses model + API (כולל currency)
- [x] Installments model + חישוב לוח תשלומים (כולל currency)
- [x] Loans model + לוח סילוקין (כולל currency)
- [x] Bank Balance model + API
- [x] Expected Income model + API
- [x] **Forecast Service** - חישוב צפי תזרים (חודשי + שבועי)
- [x] **Alert Service** - זיהוי תזרים שלילי
- [x] Tests לחישובים פיננסיים (68 tests passing)

#### Edge Cases לטיפול:
- [x] פריסה שמתחילה באמצע חודש
- [x] הלוואה עם ריבית 0% (לא לחלק באפס)
- [x] חודש עם 31 ימים - day_of_month גדול מ-28
- [x] תזרים שלילי - יצירת התראה אוטומטית
- [x] מחיקת קטגוריה עם תנועות - soft delete בלבד

#### Definition of Done:
- [x] כל ה-CRUD APIs עובדים (fixed, installments, loans, balance, expected-income)
- [x] `/api/v1/forecast` מחזיר צפי נכון ל-6 חודשים
- [x] `/api/v1/forecast/weekly` מחזיר צפי שבועי
- [x] התראות נוצרות אוטומטית כשיש תזרים שלילי צפוי
- [x] Tests לחישובים פיננסיים עוברים
- [x] Edge cases מטופלים ונבדקים

---

### Phase 3: Frontend Foundation (Days 15-21) ✅ COMPLETE

#### Tasks:
- [x] React Router v7 setup with lazy loading
- [x] AuthContext + ProtectedRoute
- [x] Login/Register pages
- [x] AppLayout עם Sidebar (responsive, collapsible)
- [x] RTL support (direction, i18n, CSS logical properties)
- [x] i18n עם תרגומים לעברית (Hebrew default)
- [x] ThemeContext: light/dark/system with localStorage
- [x] Axios client עם interceptors (JWT, errors)
- [x] React Query (TanStack Query) setup

#### Definition of Done:
- [x] Login/Register עובדים עם ה-backend
- [x] Navigation עם RTL נכון
- [x] שפה עוברת מעברית לאנגלית ולהפך
- [x] Protected routes עובדים (redirect ל-login)
- [x] Dark/Light/System theme toggle

---

### Phase 4: Frontend CRUD Features (Days 22-28) ✅ COMPLETE

#### Tasks:
- [x] Transactions page:
  - [x] טבלה עם pagination
  - [x] מיון לפי עמודה
  - [x] סינון מתקדם (תאריך, קטגוריה, סכום, סוג, טקסט)
  - [x] יצירה/עריכה/מחיקה
  - [x] כפתור שכפול
  - [x] Bulk actions (מחיקה מרובה, שינוי קטגוריה)
- [x] Categories page:
  - [x] Two-column layout עם icon + color
  - [x] IconPicker + ColorPicker בטופס
  - [x] Archive/unarchive (soft delete)
- [x] Fixed entries page (card layout, pause/resume)
- [x] Installments page עם progress bars + payment schedule
- [x] Loans page עם payment tracking + status management
- [x] Balance page עם current balance card + history chart

#### Definition of Done:
- [x] כל דפי ה-CRUD עובדים מקצה לקצה
- [x] סינון וחיפוש מתקדם עובדים בתנועות
- [x] מיון לפי עמודות עובד
- [x] Bulk actions עובדים
- [x] Icon/Color picker עובדים

---

### Phase 5: UI Polish, Accessibility & QA Sprint ✅ COMPLETE

#### Tasks:
- [x] Fix text overflow across all pages (truncate + title tooltips)
- [x] Replace RTL ternaries with CSS logical properties (start/end/ms/me)
- [x] Replace inline hover handlers with CSS hover: classes
- [x] Add accessibility: scope="col", aria-describedby, aria-invalid
- [x] Standardize modal backdrops (fixed inset-0 z-50 bg-black/50 backdrop-blur-sm)
- [x] Create ErrorBoundary + custom ErrorPage with logo + debug info
- [x] Add 404 catch-all route
- [x] Backend hardening: 22 missing indexes, CHECK constraints
- [x] Fix IDOR vulnerability (category ownership validation)
- [x] Fix forecast installment type handling (income vs expense)
- [x] Fix alert is_read state preservation on regeneration
- [x] Implement recurring charge automation service (loans, fixed, installments)
- [x] 176 backend tests passing (21 new automation tests)
- [x] TypeScript compilation clean (0 errors)

#### Definition of Done:
- [x] אין טקסט חופף בשום דף
- [x] אין RTL ternaries - הכל CSS logical properties
- [x] אין inline hover handlers - הכל CSS
- [x] WCAG accessibility attributes on all tables and forms
- [x] Error boundary catches render errors + 404 page
- [x] Backend hardened with indexes, constraints, IDOR fix
- [x] Automation service creates transactions from recurring items

---

### Phase 6: Self-Service Features (Future)

#### Tasks:
- [x] Settings page (theme, language, preferences auto-save)
- [x] User Management (admin CRUD)
- [ ] Export (CSV, Excel, PDF)
- [ ] Import (CSV upload, column mapping, preview)

---

### Phase 7: Dashboard & Reports ✅ COMPLETE (merged into Phase 4)

#### Tasks:
- [x] Dashboard layout with KPI cards, forecast chart, alerts panel, quick actions
- [x] Forecast page with monthly/weekly/summary tabs + Recharts
- [x] Alerts page with severity filtering, mark read/dismiss
- [x] Balance page with current balance card + history chart

---

### Phase 8: Future Polish & Features

#### Tasks:
- [ ] Export (CSV, Excel, PDF)
- [ ] Import (CSV upload, column mapping wizard, preview)
- [ ] Mobile responsive final polish
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Scheduled automation (cron/scheduler for recurring charges)
- [ ] Multi-currency full support
- [ ] Bank API integration
- [ ] User documentation / Help pages

---

### Phase 9 (Future): Advanced Features
- [ ] audit_log implementation
- [ ] Reports scheduling (email)
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
| Automation | process-recurring, preview |
| Export | CSV, Excel, PDF (planned) |
| Import | preview, transactions (planned) |

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

**Current Phase:** Phase 5 Complete, Phase 6 next (Export/Import)
**Last Updated:** February 9, 2026

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 | ✅ Complete | Project setup, Docker, FastAPI, React init |
| Phase 1 | ✅ Complete | Auth, Users, Settings, Categories, Transactions - 23 tests |
| Phase 2 | ✅ Complete | Fixed, Installments, Loans, Balance, Forecast, Alerts - 155 tests |
| Phase 2.5 | ✅ Complete | Security hardening + 88 edge case tests |
| Phase 3 | ✅ Complete | Frontend foundation: React Router v7, Auth, i18n, Theme |
| Phase 4 | ✅ Complete | All CRUD pages: Dashboard, Transactions, Fixed, Installments, Loans, Categories, Balance, Forecast, Settings, Alerts |
| Phase 5 | ✅ Complete | UI Polish, Accessibility, Backend Hardening, Automation - 176 tests |
| Phase 6 | Planned | Export/Import features |
| Phase 7 | ✅ Complete | Dashboard & Reports (merged into Phase 4) |
| Phase 8 | Planned | Future polish & features |
