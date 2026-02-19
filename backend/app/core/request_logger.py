from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Callable, List, Tuple

logger = logging.getLogger("cashflow.requests")

# Paths to skip logging for
_SKIP_PATHS = frozenset(("/health", "/api/v1/health"))


class RequestLoggingMiddleware:
    """Pure ASGI middleware that logs HTTP requests with timing.

    Unlike BaseHTTPMiddleware, this does NOT wrap the request/response
    cycle in a task — so ``yield``-based FastAPI dependencies (like
    ``get_db``) are cleaned up correctly.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict, receive: Callable, send: Callable) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        path: str = scope.get("path", "")
        method: str = scope.get("method", "")

        # Resolve client IP
        client = scope.get("client")
        ip = client[0] if client else "unknown"

        status_code = 500  # default if exception before response starts

        async def send_wrapper(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
                # Inject X-Request-ID header into the response
                headers: List[Tuple[bytes, bytes]] = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.exception(
                "%s %s -> EXCEPTION (%.1fms)",
                method,
                path,
                duration_ms,
                extra={
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "ip": ip,
                },
            )
            raise
        else:
            if path not in _SKIP_PATHS:
                duration_ms = round((time.time() - start_time) * 1000, 2)
                log_extra = {
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "ip": ip,
                }
                msg = "%s %s -> %s (%.1fms)"
                args = (method, path, status_code, duration_ms)
                if status_code >= 500:
                    logger.error(msg, *args, extra=log_extra)
                elif status_code >= 400:
                    logger.warning(msg, *args, extra=log_extra)
                else:
                    logger.info(msg, *args, extra=log_extra)
