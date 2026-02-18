from __future__ import annotations

import logging
import time

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("cashflow.slow_queries")

# Threshold in seconds
SLOW_QUERY_THRESHOLD = 0.5


def setup_slow_query_logging(engine: AsyncEngine) -> None:
    """Attach event listeners to the underlying sync engine to log slow queries."""
    sync_engine = engine.sync_engine

    @event.listens_for(sync_engine, "before_cursor_execute")
    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault("query_start_time", []).append(time.monotonic())

    @event.listens_for(sync_engine, "after_cursor_execute")
    def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        total = time.monotonic() - conn.info["query_start_time"].pop(-1)
        if total >= SLOW_QUERY_THRESHOLD:
            logger.warning(
                "Slow query (%.3fs): %s",
                total,
                statement[:500],
            )
