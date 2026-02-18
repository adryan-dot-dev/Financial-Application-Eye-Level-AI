from __future__ import annotations

from fastapi import Response


def set_cache_headers(
    response: Response,
    max_age: int = 60,
    public: bool = False,
) -> None:
    """Set Cache-Control headers on a FastAPI response.

    Args:
        response: FastAPI Response object.
        max_age: Cache duration in seconds.
        public: If True, allows shared caches (CDN). Otherwise private (browser only).
    """
    visibility = "public" if public else "private"
    response.headers["Cache-Control"] = f"{visibility}, max-age={max_age}"
