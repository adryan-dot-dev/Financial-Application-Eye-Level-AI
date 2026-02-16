from __future__ import annotations

import logging
import time
import uuid
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("cashflow.requests")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs all HTTP requests with timing and user info."""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        # Extract user info from auth header if available
        user_id = "anonymous"
        
        # Add request_id to request state for downstream use
        request.state.request_id = request_id
        
        try:
            response = await call_next(request)
            duration_ms = round((time.time() - start_time) * 1000, 2)
            
            # Skip health check logging
            if request.url.path in ("/health", "/api/v1/health"):
                return response
            
            log_extra = {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "ip": request.client.host if request.client else "unknown",
            }
            
            if response.status_code >= 500:
                logger.error(
                    f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
                    extra=log_extra,
                )
            elif response.status_code >= 400:
                logger.warning(
                    f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
                    extra=log_extra,
                )
            else:
                logger.info(
                    f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
                    extra=log_extra,
                )
            
            return response
            
        except Exception as exc:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.exception(
                f"{request.method} {request.url.path} -> EXCEPTION ({duration_ms}ms)",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "ip": request.client.host if request.client else "unknown",
                },
            )
            raise
