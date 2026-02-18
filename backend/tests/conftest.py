from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert, text, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

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

engine = create_async_engine(_TEST_DATABASE_URL, echo=False)
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


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _ensure_admin_and_seed():
    """Ensure admin user, settings, and seed categories exist."""
    from app.core.security import hash_password

    async with test_session() as session:
        result = await session.execute(
            User.__table__.select().where(User.__table__.c.username == "admin")
        )
        admin_row = result.fetchone()

        if admin_row is None:
            admin_result = await session.execute(
                insert(User).values(
                    username="admin",
                    email="admin@eyelevel.ai",
                    password_hash=hash_password("Admin2026!"),
                    is_admin=True,
                    is_active=True,
                ).returning(User.__table__.c.id)
            )
            admin_id = admin_result.scalar_one()

            await session.execute(insert(Settings).values(user_id=admin_id))

            for cat in _SEED_CATEGORIES:
                await session.execute(
                    insert(Category).values(user_id=admin_id, **cat)
                )
            await session.commit()
        else:
            admin_id = admin_row[0]
            # Reset admin password and state (including password_changed_at
            # to prevent "Token invalidated by password change" errors)
            await session.execute(
                update(User).where(User.id == admin_id).values(
                    password_hash=hash_password("Admin2026!"),
                    is_active=True,
                    password_changed_at=None,
                )
            )
            # Ensure settings exist
            settings_result = await session.execute(
                Settings.__table__.select().where(Settings.user_id == admin_id)
            )
            if not settings_result.fetchone():
                await session.execute(insert(Settings).values(user_id=admin_id))

            # Reset admin settings to defaults
            await session.execute(
                update(Settings).where(Settings.user_id == admin_id).values(
                    currency="ILS",
                    language="he",
                    theme="light",
                    forecast_months_default=6,
                    notifications_enabled=True,
                    onboarding_completed=False,
                )
            )

            # Un-archive seed categories
            await session.execute(
                update(Category).where(
                    Category.user_id == admin_id,
                    Category.name.in_(_SEED_CATEGORY_NAMES),
                ).values(is_archived=False)
            )

            await session.commit()


async def _cleanup_test_data():
    """Clean up all test data, preserving admin user and seed categories."""
    async with test_session() as session:
        # Get admin user id
        admin_result = await session.execute(
            User.__table__.select().where(User.__table__.c.username == "admin")
        )
        admin_rows = admin_result.fetchall()
        admin_ids = [r[0] for r in admin_rows]

        # Audit logs (no FK cascade concerns)
        await session.execute(AuditLog.__table__.delete())

        # New tables that reference existing tables
        await session.execute(ExpenseApproval.__table__.delete())
        await session.execute(OrgReport.__table__.delete())
        await session.execute(OrgBudget.__table__.delete())

        # Organization members and orgs (FK deps on users)
        await session.execute(OrganizationMember.__table__.delete())
        # Clear current_organization_id FK before deleting organizations
        await session.execute(
            update(User).values(current_organization_id=None)
        )
        await session.execute(Organization.__table__.delete())

        # Subscriptions and backups
        await session.execute(Subscription.__table__.delete())
        await session.execute(Backup.__table__.delete())

        # Forecast scenarios
        await session.execute(ForecastScenario.__table__.delete())

        # Phase 2 tables (no FK dependencies to worry about)
        await session.execute(Alert.__table__.delete())
        await session.execute(ExpectedIncome.__table__.delete())
        await session.execute(BankBalance.__table__.delete())
        await session.execute(Loan.__table__.delete())
        await session.execute(Installment.__table__.delete())
        await session.execute(FixedIncomeExpense.__table__.delete())

        # Phase 1 tables
        await session.execute(Transaction.__table__.delete())

        # Tables referenced by the above (must come after)
        await session.execute(CreditCard.__table__.delete())
        await session.execute(BankAccount.__table__.delete())

        # Delete non-seed categories (created by tests)
        if admin_ids:
            await session.execute(
                Category.__table__.delete().where(
                    Category.user_id.notin_(admin_ids)
                )
            )
            await session.execute(
                Category.__table__.delete().where(
                    Category.user_id.in_(admin_ids),
                    Category.name.notin_(_SEED_CATEGORY_NAMES),
                )
            )

        # Delete non-admin settings and users
        if admin_ids:
            await session.execute(
                Settings.__table__.delete().where(
                    Settings.user_id.notin_(admin_ids)
                )
            )
        await session.execute(
            User.__table__.delete().where(User.__table__.c.username != "admin")
        )

        await session.commit()

    # Now ensure admin user is in correct state (separate session to avoid conflicts)
    await _ensure_admin_and_seed()


@pytest_asyncio.fixture(autouse=True)
async def cleanup():
    """Auto-cleanup before each test to ensure test isolation."""
    await _cleanup_test_data()
    yield
    # No cleanup after test - only before each test to avoid race conditions


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
