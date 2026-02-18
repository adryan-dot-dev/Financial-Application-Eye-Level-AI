from __future__ import annotations

from typing import Optional


def error_response(status_code: int, message: str, detail: Optional[str] = None) -> dict:
    """Standardized error response format for the API."""
    return {
        "error": {
            "status_code": status_code,
            "message": message,
            "detail": detail,
        }
    }
