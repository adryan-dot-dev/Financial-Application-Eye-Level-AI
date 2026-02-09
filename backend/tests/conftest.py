from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.base import Base
from app.db.models import Category, Settings, Transaction, User  # noqa: F401
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


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session() as session:
        yield session

    # Cleanup: delete test data (transactions first due to FK)
    async with test_session() as session:
        await session.execute(Transaction.__table__.delete())
        await session.execute(Category.__table__.delete().where(
            Category.user_id.notin_(
                # Keep admin categories
                [r[0] for r in (await session.execute(
                    User.__table__.select().where(User.__table__.c.username == "admin")
                )).fetchall()]
            )
        ))
        await session.execute(Settings.__table__.delete().where(
            Settings.user_id.notin_(
                [r[0] for r in (await session.execute(
                    User.__table__.select().where(User.__table__.c.username == "admin")
                )).fetchall()]
            )
        ))
        await session.execute(User.__table__.delete().where(
            User.__table__.c.username != "admin"
        ))
        await session.commit()


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
