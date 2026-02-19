from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from typing import Any, Callable, List, Tuple

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError, IntegrityError

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.config import settings
from app.core.rate_limit import limiter
from app.core.logging_config import setup_logging
from app.core.request_logger import RequestLoggingMiddleware

# Initialize structured logging before app creation
setup_logging(settings.DEBUG)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    logger.info("Application started - scheduler initialized")
    yield
    stop_scheduler()
    logger.info("Scheduler stopped")
    from app.db.session import engine
    await engine.dispose()


app = FastAPI(
    title="Cash Flow Management - Eye Level AI",
    description="Cash flow management system with forecasting and alerts",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ── Rate limiting ────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Security headers middleware (pure ASGI — no BaseHTTPMiddleware) ──
_SECURITY_HEADERS: List[Tuple[bytes, bytes]] = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"x-xss-protection", b"1; mode=block"),
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains; preload"),
    (b"content-security-policy", b"default-src 'self'"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
    (b"x-api-version", b"v1"),
]


class SecurityHeadersMiddleware:
    """Pure ASGI middleware that adds security headers to every HTTP response."""

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict, receive: Callable, send: Callable) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers: List[Tuple[bytes, bytes]] = list(message.get("headers", []))
                headers.extend(_SECURITY_HEADERS)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)

# API Routes
app.include_router(api_router)


@app.exception_handler(DataError)
async def data_error_handler(request: Request, exc: DataError):
    """Handle PostgreSQL data errors (null bytes, invalid encoding, etc.)."""
    logger.warning("Data error: %s", exc)
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid data: contains unsupported characters"},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """Handle database integrity violations (FK, unique, etc.)."""
    logger.warning("Integrity error: %s", exc)
    msg = str(exc.orig) if exc.orig else str(exc)
    if "foreign key" in msg.lower() or "fk_" in msg.lower():
        return JSONResponse(
            status_code=422,
            content={"detail": "Referenced entity does not exist"},
        )
    if "unique" in msg.lower() or "duplicate" in msg.lower():
        return JSONResponse(
            status_code=409,
            content={"detail": "Resource already exists"},
        )
    return JSONResponse(
        status_code=422,
        content={"detail": "Data integrity error"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions - never leak stack traces in production."""
    logger.exception("Unhandled exception: %s", exc)
    if settings.DEBUG:
        raise exc
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "0.1.0"}
