# Cash Flow Management - Eye Level AI

Cash flow management system with forecasting and alerts for Eye Level AI.

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + PostgreSQL
- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **Auth:** JWT with refresh tokens

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & docker-compose

### 1. Start Database

```bash
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 3. Run Migrations & Seed Data

```bash
alembic upgrade head
python scripts/seed_data.py
```

### 4. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

### 5. Run Development Servers

```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |

### Default Admin User

- Username: `admin`
- Password: set in `.env` (`ADMIN_DEFAULT_PASSWORD`)

## Project Structure

See [PLAN.md](./PLAN.md) for detailed implementation plan.
See [CLAUDE.md](./CLAUDE.md) for development guidelines.
