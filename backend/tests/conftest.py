from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.base import Base
from app.db.models import (  # noqa: F401
    Alert, AuditLog, BankAccount, BankBalance, Backup, Category,
    CreditCard, ExpectedIncome, ExpenseApproval,
    FixedIncomeExpense, ForecastScenario, Installment, Loan, Organization,
    OrganizationMember, OrgBudget, OrgReport, Settings, Subscription,
    Transaction, User,
)
from app.core.rate_limit import limiter
from app.core.security import _token_blacklist
from app.db.session import get_db
from app.main import app

# Disable rate limiting during tests
limiter.enabled = False


# ---------------------------------------------------------------------------
# Test database engine – uses a SEPARATE database (cashflow_test) to avoid
# interfering with the production / development database.
# The test database is set up via:
#   DATABASE_URL="...cashflow_test" alembic upgrade head
# ---------------------------------------------------------------------------
def _make_test_database_url(url: str) -> str:
    """Replace only the database name (last path component) in the URL."""
    last_slash = url.rfind("/")
    return url[:last_slash] + "/cashflow_test"


_TEST_DATABASE_URL = _make_test_database_url(settings.DATABASE_URL)

engine = create_async_engine(_TEST_DATABASE_URL, echo=False, poolclass=NullPool)
test_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Default seed category names
_SEED_CATEGORY_NAMES = [
    "salary", "freelance", "investments", "other_income",
    "rent", "software", "car", "restaurants", "insurance",
    "marketing", "salaries", "office", "general",
]

_SEED_CATEGORIES = [
    {"name": "salary", "name_he": "משכורת", "type": "income", "icon": "briefcase", "color": "#10B981", "display_order": 1},
    {"name": "freelance", "name_he": "פרילנס", "type": "income", "icon": "laptop", "color": "#3B82F6", "display_order": 2},
    {"name": "investments", "name_he": "השקעות", "type": "income", "icon": "trending-up", "color": "#8B5CF6", "display_order": 3},
    {"name": "other_income", "name_he": "הכנסה אחרת", "type": "income", "icon": "plus-circle", "color": "#6B7280", "display_order": 4},
    {"name": "rent", "name_he": "שכירות", "type": "expense", "icon": "home", "color": "#EF4444", "display_order": 1},
    {"name": "software", "name_he": "תוכנה", "type": "expense", "icon": "code", "color": "#7C3AED", "display_order": 2},
    {"name": "car", "name_he": "רכב", "type": "expense", "icon": "car", "color": "#F59E0B", "display_order": 3},
    {"name": "restaurants", "name_he": "מסעדות", "type": "expense", "icon": "utensils", "color": "#EC4899", "display_order": 4},
    {"name": "insurance", "name_he": "ביטוח", "type": "expense", "icon": "shield", "color": "#64748B", "display_order": 5},
    {"name": "marketing", "name_he": "שיווק", "type": "expense", "icon": "megaphone", "color": "#06B6D4", "display_order": 6},
    {"name": "salaries", "name_he": "שכר עובדים", "type": "expense", "icon": "users", "color": "#F97316", "display_order": 7},
    {"name": "office", "name_he": "משרד", "type": "expense", "icon": "building", "color": "#6366F1", "display_order": 8},
    {"name": "general", "name_he": "כללי", "type": "expense", "icon": "more-horizontal", "color": "#6B7280", "display_order": 9},
]


def pytest_configure(config):
    """Run once before any test collection — full DB reset.

    Terminates stale connections from prior pytest runs, then TRUNCATEs all
    tables so every ``pytest`` invocation starts from a blank slate.
    """
    import asyncio as _aio
    from sqlalchemy import text as _text
    from sqlalchemy.ext.asyncio import create_async_engine as _create

    async def _full_reset():
        _eng = _create(_TEST_DATABASE_URL, echo=False, pool_size=1, max_overflow=0)
        async with _eng.begin() as conn:
            # Kill lingering connections from prior test runs / dev server
            await conn.execute(_text(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = 'cashflow_test' AND pid != pg_backend_pid()"
            ))
            result = await conn.execute(_text(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' "
                "AND tablename != 'alembic_version'"
            ))
            tables = [row[0] for row in result.fetchall()]
            if tables:
                quoted = ", ".join(f'"{t}"' for t in tables)
                await conn.execute(_text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
        await _eng.dispose()

    try:
        loop = _aio.get_event_loop()
        if loop.is_closed():
            loop = _aio.new_event_loop()
    except RuntimeError:
        loop = _aio.new_event_loop()
    loop.run_until_complete(_full_reset())


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# Cache bcrypt hash for performance (bcrypt is slow, ~0.3s per call)
_ADMIN_HASH: str = ""


def _admin_password_hash() -> str:
    global _ADMIN_HASH
    if not _ADMIN_HASH:
        from app.core.security import hash_password
        _ADMIN_HASH = hash_password("Admin2026!")
    return _ADMIN_HASH


async def _cleanup_test_data():
    """Fast cleanup: TRUNCATE all tables then re-seed admin + categories.

    Uses a single TRUNCATE CASCADE (fast, atomic) instead of 20+ DELETEs.
    The DB trigger trg_prevent_admin_delete is temporarily disabled so
    TRUNCATE can clear the users table completely.
    """
    async with test_session() as session:
        # Disable the admin-delete prevention trigger for TRUNCATE
        await session.execute(text(
            "ALTER TABLE users DISABLE TRIGGER trg_prevent_admin_delete"
        ))

        # Single TRUNCATE for all tables — orders of magnitude faster
        result = await session.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' "
            "AND tablename != 'alembic_version'"
        ))
        tables = [row[0] for row in result.fetchall()]
        if tables:
            quoted = ", ".join(f'"{t}"' for t in tables)
            await session.execute(text(
                f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"
            ))

        # Re-enable trigger
        await session.execute(text(
            "ALTER TABLE users ENABLE TRIGGER trg_prevent_admin_delete"
        ))

        # Insert admin user
        admin_stmt = insert(User.__table__).values(
            username="admin",
            email="admin@eyelevel.ai",
            password_hash=_admin_password_hash(),
            is_admin=True,
            is_active=True,
        ).returning(User.__table__.c.id)
        result = await session.execute(admin_stmt)
        admin_id = result.scalar_one()

        # Insert admin settings
        await session.execute(insert(Settings.__table__).values(
            user_id=admin_id,
        ))

        # Bulk insert seed categories
        await session.execute(
            insert(Category.__table__),
            [{"user_id": admin_id, **cat} for cat in _SEED_CATEGORIES],
        )

        await session.commit()


@pytest_asyncio.fixture(autouse=True)
async def cleanup():
    """Auto-cleanup before each test to ensure test isolation."""
    _token_blacklist.clear()
    await _cleanup_test_data()
    yield


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session() as session:
        yield session


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict:
    """Login as admin and return auth headers."""
    response = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "Admin2026!",
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
