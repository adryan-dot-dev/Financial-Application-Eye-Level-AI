from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.base import Base
from app.db.models import (  # noqa: F401
    Alert, BankBalance, Category, ExpectedIncome,
    FixedIncomeExpense, Installment, Loan,
    Settings, Transaction, User,
)
from app.db.session import get_db
from app.main import app


# Use the same DB but with a test schema or just use the same DB for tests
engine = create_async_engine(settings.DATABASE_URL, echo=False)
test_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _cleanup_test_data():
    """Clean up all test data, preserving admin user and seed categories."""
    async with test_session() as session:
        # Get admin user id
        admin_result = await session.execute(
            User.__table__.select().where(User.__table__.c.username == "admin")
        )
        admin_rows = admin_result.fetchall()
        admin_ids = [r[0] for r in admin_rows]

        # Phase 2 tables (no FK dependencies to worry about)
        await session.execute(Alert.__table__.delete())
        await session.execute(ExpectedIncome.__table__.delete())
        await session.execute(BankBalance.__table__.delete())
        await session.execute(Loan.__table__.delete())
        await session.execute(Installment.__table__.delete())
        await session.execute(FixedIncomeExpense.__table__.delete())

        # Phase 1 tables
        await session.execute(Transaction.__table__.delete())

        # Delete non-seed categories (created by tests)
        if admin_ids:
            await session.execute(
                Category.__table__.delete().where(
                    Category.user_id.notin_(admin_ids)
                )
            )
            # Also remove test-created categories for admin user (not the seed ones)
            # Seed categories have specific names: salary, freelance, etc.
            seed_names = [
                "salary", "freelance", "investments", "other_income",
                "rent", "software", "car", "restaurants", "insurance",
                "marketing", "salaries", "office", "general",
            ]
            await session.execute(
                Category.__table__.delete().where(
                    Category.user_id.in_(admin_ids),
                    Category.name.notin_(seed_names),
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


@pytest_asyncio.fixture(autouse=True)
async def cleanup():
    """Auto-cleanup before each test to ensure test isolation."""
    await _cleanup_test_data()
    yield
    # Cleanup after test too
    await _cleanup_test_data()


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session() as session:
        yield session


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session() as session:
        yield session


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
        "password": "admin123",
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
