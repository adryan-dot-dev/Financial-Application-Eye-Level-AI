"""Kill stale connections to cashflow_test."""
from __future__ import annotations

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main():
    eng = create_async_engine(
        "postgresql+asyncpg://cashflow:cashflow@localhost:5432/cashflow_test",
        echo=False,
    )
    async with eng.begin() as conn:
        r = await conn.execute(
            text(
                "SELECT pg_terminate_backend(pid) "
                "FROM pg_stat_activity "
                "WHERE datname = 'cashflow_test' AND pid != pg_backend_pid()"
            )
        )
        print(f"Killed {r.rowcount} connections")
    await eng.dispose()


asyncio.run(main())
