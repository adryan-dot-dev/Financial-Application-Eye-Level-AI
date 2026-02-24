# Cash Flow Management — Eye Level AI

## What This Is

אפליקציית ניהול תזרים מזומנים לשימוש לקוחות Eye Level AI. מאפשרת מעקב אחר הכנסות, הוצאות קבועות, תשלומים, הלוואות, כרטיסי אשראי וחשבונות בנק עם תחזיות אוטומטיות והתרעות. נבנתה בעברית (RTL) כברירת מחדל עם תמיכה באנגלית. Backend: FastAPI + PostgreSQL. Frontend: React 19 + TypeScript.

## Core Value

**המשתמש רואה תמונה מדויקת של התזרים שלו — מה יצא, מה יכנס, ומה מחכה לו בחודשים הקרובים — בלי נתונים שגויים.**

## Requirements

### Validated

מה האפליקציה כבר עושה (Phases 0–4, 155+ tests pass):

- ✓ JWT Authentication עם refresh tokens — Phase 1
- ✓ Multi-tenant isolation דרך DataContext (IDOR prevention) — Phase 1
- ✓ Transactions CRUD — filtering, pagination, sorting — Phase 1
- ✓ Categories עם soft delete (archive), color/icon picker — Phase 1
- ✓ Fixed expenses management (pause/resume, CRUD) — Phase 1
- ✓ Installments — payment scheduling, progress bars — Phase 2
- ✓ Loans — interest tracking, payment schedule, status — Phase 2
- ✓ Bank accounts + credit cards management — Phase 2
- ✓ Balance tracking עם היסטוריה — Phase 2
- ✓ Forecast system (monthly/weekly/summary + charts) — Phase 2
- ✓ Alert system (threshold-based, severity filtering) — Phase 2
- ✓ Dashboard — KPIs, forecast chart, upcoming payments — Phase 3
- ✓ Hebrew (RTL) + English i18n — Phase 3
- ✓ Dark/light/system theme — Phase 3
- ✓ Settings (language, currency, preferences) — Phase 4
- ✓ 67 API routes, 10 modules — Phase 2
- ✓ 155+ backend tests — Phase 2.5

### Active

Phase 5 — Bug Fixes + Production Deployment:

**Critical Bug Fixes:**
- [ ] B1: Orphaned transactions on installment reverse-payment — מחיקת Transaction בעת ביטול תשלום
- [ ] B3: Balance race condition — unique DB constraint + Python validation
- [ ] F3: Alerts snooze dropdown unclickable — overflow-hidden → overflow-visible

**High Priority Bug Fixes:**
- [ ] B4: Missing schema fields — credit_card_id, bank_account_id, currency, first_payment_made
- [ ] H1: Circular reference detection in categories — DFS full cycle detection
- [ ] H2: Category type mismatch validation — income category → income transaction only
- [ ] H3: Missing DB indexes — Alembic migration (4 indexes)
- [ ] H4: Schedule alert generation — APScheduler daily job
- [ ] H5: Exchange rate conversion direction — verify USD→ILS formula
- [ ] F1: 9 missing translation keys in he.json + en.json (CreditCardsPage)
- [ ] F2: Wrong translation key — t('creditCards.add') → t('creditCards.addCard')
- [ ] T1: Dashboard module tests — 11 sub-endpoints (0% coverage)

**Test Stability:**
- [ ] M1: Stabilize test suite — 0 flakiness across 3 sequential runs

**Production Deployment (Render):**
- [ ] GitHub repository — create + push code
- [ ] Render Web Service — FastAPI backend (Python runtime, uvicorn)
- [ ] Render Static Site — React/Vite frontend (build output)
- [ ] Render PostgreSQL — managed database (replaces Docker local)
- [ ] Environment variables — JWT secrets, DB URL, CORS origins on Render
- [ ] Production CORS — allow Render static site URL
- [ ] Alembic migrations — run on production DB
- [ ] Render auto-deploy — connect GitHub main → auto-deploy on push
- [ ] Smoke test — verify production app works end-to-end

**Medium (if time allows):**
- [ ] M3: Installment rounding — last payment absorbs remainder
- [ ] M4: Loan payment validation — monthly_payment >= monthly_interest
- [ ] M5: Date range validation — start_date <= end_date
- [ ] M8: Token blacklist on logout
- [ ] M9: Settings field validation — ISO 4217 currency, supported languages

### Out of Scope

- E2E testing (Playwright/Cypress) — Phase 6, after app is live
- Custom domain — render.com subdomain מספיק לעכשיו
- CI/CD pipeline מורכב — רק GitHub + Render auto-deploy
- פיצ'רים חדשים — Phase 5 הוא strictly bug fixes + deployment
- Email/SMS notifications — לא נדרש עדיין
- Mobile app / mobile redesign — לא בתכנית

## Context

**מה קיים:**
- Backend: `backend/` — FastAPI + SQLAlchemy 2.0 async + Alembic + asyncpg
- Frontend: `frontend/` — React 19 + Vite 7 + Tailwind CSS v4 + TanStack Query
- DB (local): PostgreSQL 16 דרך Docker
- Tests: 155+ tests בתיקיית `backend/tests/`
- Codebase map: `.planning/codebase/` (7 documents, 2,705 lines)

**42 issues זוהו ב-map-codebase:**
- 2 CRITICAL backend (B1, B3), 5 HIGH backend (B4, H1–H5), 3 HIGH frontend (F1–F3)
- 10 MEDIUM, 5 fragile areas, 3 security gaps, 2 performance, 2 test coverage gaps
- מסמך מלא: `.planning/codebase/CONCERNS.md`

**אילוצים טכניים:**
- Python 3.9.6 — NO `X | Y` union syntax, requires `from __future__ import annotations`
- Tailwind CSS v4 — `@theme` directive, NOT `@tailwind`
- `verbatimModuleSyntax: true` — `import type` לכל type-only imports

**Render deployment architecture:**
- Web Service: Python runtime, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Static Site: Vite build (`npm run build`), serve from `dist/`
- PostgreSQL: Render managed (connection via DATABASE_URL env var)
- Auto-deploy: GitHub main branch → Render

## Constraints

- **Python**: Python 3.9.6 — compat shims נדרשים (`from __future__ import annotations`)
- **Tests**: 155+ tests חייבים לעבור לפני כל deploy
- **Parallel**: Bug fixes + deployment setup מתבצעים במקביל (לא רציף)
- **No E2E**: אין Playwright/Cypress ב-Phase 5
- **Render free tier**: Render free tier ייכבה לאחר 15 דקות idle — לתעד בהתראה
- **No Docker in prod**: Render מנהל הכל, אין docker-compose בפרודקשן

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Render over AWS/GCP | פשוט, Git-connected, מספיק לפרויקט זה | — Pending |
| GitHub → Render auto-deploy | אין CI/CD מורכב, deploy אוטומטי = פחות friction | — Pending |
| No custom domain | Render subdomain מספיק לשלב הזה | — Pending |
| Bug fixes + deployment בו-זמנית | המשתמש בחר parallel — חוסך זמן | — Pending |
| E2E לאחר go-live | אין זמן, 155 backend tests = מספיק ל-deploy | — Pending |
| DataContext pattern | Multi-tenant isolation מונע IDOR — Phase 1 | ✓ Good |
| DECIMAL(15,2) | Financial precision — no float ever | ✓ Good |
| DELETE not TRUNCATE in tests | מניעת deadlocks עם async sessions | ✓ Good |

---
*Last updated: 2026-02-24 after Phase 5 initialization*
