# Financial-Application-Eye-Level-AI

## Cash Flow Management System for Eye Level AI

---

## תיאור

אפליקציית ניהול תזרים מזומנים (Cash Flow Management) לחברת Eye Level AI.
מערכת SELF-SERVICE מלאה שמאפשרת למשתמש לנהל הכל דרך ה-UI בלי תלות במפתח.

**תכנית פרויקט מפורטת:** ראה [PLAN.md](./PLAN.md)

---

## Project Goals

**Primary Goal:** ניתוח וניהול תזרים מזומנים עם צפי קדימה

**Success Criteria:**
- [ ] הזנת הכנסות והוצאות (חד-פעמי, קבוע, פריסה)
- [ ] צפי תזרים 1-6 חודשים קדימה
- [ ] התראות אוטומטיות על תזרים שלילי צפוי
- [ ] דשבורדים (שבועי, חודשי, רבעוני, שנתי)
- [ ] ניהול הלוואות עם לוח סילוקין
- [ ] ייצוא דוחות (CSV, Excel, PDF)
- [ ] ייבוא נתונים מ-CSV
- [ ] RTL מלא בעברית
- [ ] Self-service מלא (הגדרות, קטגוריות, משתמשים)

**Out of Scope (MVP):**
- Multi-currency מלא (רק הכנה בשדות)
- חיבור לבנקים
- אפליקציית מובייל
- audit_log (Phase 8)

---

## Tech Stack

| קטגוריה | טכנולוגיה | סיבה |
|---------|----------|------|
| **Backend** | FastAPI | Async, API-first, auto OpenAPI docs, Pydantic validation |
| **Database** | PostgreSQL | ACID compliance, financial precision, scalability |
| **ORM** | SQLAlchemy 2.0 | Async support, type hints |
| **Migrations** | Alembic | SQLAlchemy native integration |
| **Auth** | JWT | Stateless, refresh tokens in httpOnly cookies |
| **Frontend** | React 18 + TypeScript | Type safety, modern ecosystem |
| **Styling** | Tailwind + shadcn/ui | Flexible, RTL support, modern design |
| **Charts** | Recharts | Native React integration |
| **State** | React Query (TanStack) | Server state management, caching |
| **i18n** | i18next | Hebrew + RTL support |
| **Testing Backend** | pytest + pytest-asyncio | Async support |
| **Testing Frontend** | Vitest + React Testing Library | Fast, modern |
| **Containerization** | Docker + docker-compose | Development consistency |

---

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://cashflow:cashflow@localhost:5432/cashflow

# Security
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=["http://localhost:5173"]

# Admin User (for seed script)
ADMIN_DEFAULT_PASSWORD=admin123

# Debug
DEBUG=true
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000/api/v1
```

---

## Setup & Run

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & docker-compose
- Git

### Installation

```bash
# Clone and enter project
cd Financial-Application-Eye-Level-AI

# Start PostgreSQL
docker-compose up -d

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings

# Run migrations
alembic upgrade head

# Seed data (creates admin user + default categories)
python scripts/seed_data.py

# Frontend setup
cd ../frontend
npm install
cp .env.example .env
```

### Development

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Testing

```bash
# Backend tests
cd backend
pytest -v

# Frontend tests
cd frontend
npm test
```

### Useful URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- API Docs (ReDoc): http://localhost:8000/redoc

---

## Multi-Agent Setup

פרויקט זה משתמש ב-5 סוכני AI:

| Tab | סוכן | תפקיד | קובץ הוראות |
|-----|------|-------|-------------|
| 1 | **Orchestrator** | מתכנן ומתאם | `agents/ORCHESTRATOR.md` |
| 2 | **Implementer** | כותב קוד | `agents/IMPLEMENTER.md` |
| 3 | **Tester** | כותב ומריץ טסטים | `agents/TESTER.md` |
| 4 | **Reviewer** | בודק איכות קוד | `agents/REVIEWER.md` |
| 5 | **Docs** | כותב תיעוד | `agents/DOCS.md` |

---

## מבנה תיקיות

```
Financial-Application-Eye-Level-AI/
├── CLAUDE.md              # קובץ זה
├── PLAN.md                # תכנית פרויקט מפורטת
├── README.md              # הוראות התקנה
│
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── api/           # Routes & schemas
│   │   ├── core/          # Security, config
│   │   ├── db/            # Models, session
│   │   ├── services/      # Business logic
│   │   └── repositories/  # Data access
│   ├── alembic/           # Migrations
│   ├── tests/             # Backend tests
│   └── scripts/           # Seed data
│
├── frontend/              # React frontend
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # UI components
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom hooks
│   │   ├── contexts/      # React contexts
│   │   └── types/         # TypeScript types
│   └── public/locales/    # i18n files
│
└── agents/                # Multi-agent system
    ├── ORCHESTRATOR.md
    ├── IMPLEMENTER.md
    ├── TESTER.md
    ├── REVIEWER.md
    ├── DOCS.md
    ├── tasks/             # Task files
    ├── status/            # Status files
    └── shared/            # Shared resources
```

---

## Git & GitHub Rules

### Conventional Commits
```
feat: add user authentication
fix: correct forecast calculation for leap years
docs: update API documentation
refactor: extract forecast service
test: add integration tests for loans API
chore: update dependencies
```

### Branch Strategy
```
main          - production ready
develop       - integration branch (if needed)
feature/xxx   - new features
fix/xxx       - bug fixes
```

### Commit Policy
- Commit אחרי כל משימה שלמה שעובדת
- Push אחרי כל Phase שלם
- לעולם לא לעשות commit לקבצים רגישים:
  - `.env`
  - `secrets/`
  - API keys
  - Passwords
- ודא ש-`.gitignore` מעודכן לפני כל push

### .gitignore Must Include
```
# Environment
.env
.env.local
.env.*.local

# Python
__pycache__/
*.py[cod]
venv/
.venv/

# Node
node_modules/
dist/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Test
.coverage
htmlcov/
.pytest_cache/
```

---

## כללים לכל הסוכנים

1. **קרא את הקובץ שלך** לפני שמתחיל (`agents/[AGENT].md`)
2. **קרא את PLAN.md** להבנת ההקשר הכללי
3. **עדכן סטטוס** אחרי כל משימה
4. **אל תעשה עבודה של סוכן אחר**
5. **אם נתקעת** - כתוב ל-`agents/shared/blockers.md`
6. **עקוב אחרי** `agents/shared/conventions.md`
7. **עשה commit** אחרי כל משימה שעובדת

---

## פרומפטים להפעלה

**Tab 1 - Orchestrator:**
```
אתה Orchestrator. קרא agents/ORCHESTRATOR.md ו-PLAN.md והתחל לעבוד.
```

**Tab 2 - Implementer:**
```
אתה Implementer. קרא agents/IMPLEMENTER.md
```

**Tab 3 - Tester:**
```
אתה Tester. קרא agents/TESTER.md
```

**Tab 4 - Reviewer:**
```
אתה Reviewer. קרא agents/REVIEWER.md
```

**Tab 5 - Docs:**
```
אתה Docs. קרא agents/DOCS.md
```

---

## Architecture Overview

### Components:
- **Backend API** (FastAPI): REST API, business logic, authentication
- **Frontend** (React): User interface, RTL, charts
- **Database** (PostgreSQL): Data persistence, ACID compliance
- **Auth** (JWT): Stateless authentication with refresh tokens

### Data Flow:
```
User → React Frontend → Axios → FastAPI Backend → SQLAlchemy → PostgreSQL
                                      ↓
                              Pydantic Schemas
                                      ↓
                              Business Services
                                      ↓
                              Repositories (CRUD)
```

### Key Decisions:
- ראה `agents/shared/decisions.md` לפירוט מלא
- ראה `PLAN.md` לארכיטקטורה מפורטת

---

## התקדמות נוכחית

**שלב נוכחי:** Phase 0 - Project Setup

**עדכון אחרון:** February 9, 2026

ראה [PLAN.md](./PLAN.md) למעקב מפורט אחרי משימות

---

## הערות חשובות

### Self-Service Principle
המערכת חייבת להיות SELF-SERVICE מלא:
- המשתמש מנהל קטגוריות בעצמו (CRUD + icon + color)
- המשתמש מגדיר הגדרות בעצמו (שפה, מטבע, theme)
- Admin מנהל משתמשים בעצמו
- ייצוא/ייבוא נתונים בעצמאות מלאה

### RTL Support
- כל הטקסט בעברית זורם מימין לשמאל
- מספרים נשארים LTR בתוך קונטקסט RTL
- פורמט תאריך: DD/MM/YYYY
- מטבע ברירת מחדל: ₪ (ILS)

### Financial Precision
- כל הסכומים נשמרים כ-DECIMAL(15,2)
- אין floating point לנתונים פיננסיים
- כל הטבלאות הפיננסיות כוללות שדה currency להכנה עתידית
