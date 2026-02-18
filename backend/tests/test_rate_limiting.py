from __future__ import annotations

"""Tests for rate limiting behavior (slowapi).

The rate limiter is globally disabled in conftest.py via ``limiter.enabled = False``.
Tests in this module temporarily re-enable it, exercise the limits, and disable it
again in teardown so other tests are not affected.

Configured limits (see app/api/v1/endpoints/auth.py):
    - /api/v1/auth/register  => 3/minute
    - /api/v1/auth/login     => 5/minute
    - /api/v1/auth/refresh   => 10/minute
"""

import pytest
from httpx import AsyncClient

from app.core.rate_limit import limiter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=False)
def enable_rate_limiting():
    """Temporarily enable rate limiting and reset counters for a single test."""
    limiter.enabled = True
    limiter.reset()
    yield
    limiter.enabled = False


# ---------------------------------------------------------------------------
# 1) Rate limiting is disabled by default (no enable_rate_limiting fixture)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_disabled_by_default(client: AsyncClient):
    """When the limiter is disabled (the default in tests), many rapid requests
    should all succeed without a 429."""
    # Send well over the 5/minute login limit -- all should succeed or get
    # normal auth errors, but never 429.
    for i in range(15):
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "Admin2026!"},
        )
        assert response.status_code != 429, (
            f"Request {i + 1} returned 429 even though rate limiting is disabled"
        )


# ---------------------------------------------------------------------------
# 2) Register rate limit exceeded (3/minute)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_register_exceeded(
    client: AsyncClient, enable_rate_limiting
):
    """After 3 registration requests within a minute the 4th should be 429."""
    url = "/api/v1/auth/register"

    statuses = []
    for i in range(6):
        response = await client.post(
            url,
            json={
                "username": f"ratelimituser{i}",
                "email": f"ratelimit{i}@example.com",
                "password": "SecurePass1",
            },
        )
        statuses.append(response.status_code)

    # First 3 should be allowed (201 or other non-429 status)
    for idx, status in enumerate(statuses[:3]):
        assert status != 429, (
            f"Register request {idx + 1} was rate-limited unexpectedly"
        )

    # At least one of the remaining requests must be 429
    assert 429 in statuses[3:], (
        f"Expected at least one 429 after 3 requests, got statuses: {statuses}"
    )


# ---------------------------------------------------------------------------
# 3) Login rate limit exceeded (5/minute)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_login_exceeded(
    client: AsyncClient, enable_rate_limiting
):
    """After 5 login requests within a minute the 6th should be 429."""
    url = "/api/v1/auth/login"

    statuses = []
    for i in range(10):
        response = await client.post(
            url,
            json={"username": "admin", "password": "Admin2026!"},
        )
        statuses.append(response.status_code)

    # First 5 requests should NOT be rate-limited
    for idx, status in enumerate(statuses[:5]):
        assert status != 429, (
            f"Login request {idx + 1} was rate-limited unexpectedly"
        )

    # At least one of requests 6-10 must be 429
    assert 429 in statuses[5:], (
        f"Expected at least one 429 after 5 requests, got statuses: {statuses}"
    )


# ---------------------------------------------------------------------------
# 4) Rate-limit response body and headers
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_response_body(
    client: AsyncClient, enable_rate_limiting
):
    """A 429 response should contain a JSON body with a rate-limit error message."""
    url = "/api/v1/auth/register"

    # Exhaust the 3/minute register limit
    for i in range(4):
        await client.post(
            url,
            json={
                "username": f"bodyuser{i}",
                "email": f"bodyuser{i}@example.com",
                "password": "SecurePass1",
            },
        )

    # Next request should be 429
    response = await client.post(
        url,
        json={
            "username": "bodyuser_extra",
            "email": "bodyuser_extra@example.com",
            "password": "SecurePass1",
        },
    )

    assert response.status_code == 429
    body = response.json()
    assert "error" in body, f"429 response body should contain 'error' key, got: {body}"
    assert "rate limit" in body["error"].lower(), (
        f"Error message should mention rate limit, got: {body['error']}"
    )


# ---------------------------------------------------------------------------
# 5) Different endpoints have independent rate limits
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_different_endpoints_independent(
    client: AsyncClient, enable_rate_limiting
):
    """Exhausting the login rate limit should NOT affect the register endpoint
    and vice-versa, because they have separate limit decorators."""
    # Exhaust the login limit (5/minute) with 6 requests
    for i in range(6):
        await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "Admin2026!"},
        )

    # Verify login is now rate-limited
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "Admin2026!"},
    )
    assert login_response.status_code == 429, "Login should be rate-limited"

    # Register should still work -- it has its own 3/minute limit
    reg_response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "independentuser",
            "email": "independent@example.com",
            "password": "SecurePass1",
        },
    )
    assert reg_response.status_code != 429, (
        "Register should NOT be rate-limited just because login limit was hit"
    )


# ---------------------------------------------------------------------------
# 6) Resetting the limiter clears rate limit counters
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_reset_clears_counters(
    client: AsyncClient, enable_rate_limiting
):
    """Calling limiter.reset() should clear all rate limit counters so that
    previously exhausted endpoints accept requests again."""
    url = "/api/v1/auth/register"

    # Exhaust the 3/minute register limit
    for i in range(4):
        await client.post(
            url,
            json={
                "username": f"resetuser{i}",
                "email": f"resetuser{i}@example.com",
                "password": "SecurePass1",
            },
        )

    # Confirm we are now rate-limited
    blocked = await client.post(
        url,
        json={
            "username": "resetuser_blocked",
            "email": "resetuser_blocked@example.com",
            "password": "SecurePass1",
        },
    )
    assert blocked.status_code == 429, "Should be rate-limited before reset"

    # Reset the limiter counters
    limiter.reset()

    # After reset, the same endpoint should accept requests again
    allowed = await client.post(
        url,
        json={
            "username": "resetuser_after",
            "email": "resetuser_after@example.com",
            "password": "SecurePass1",
        },
    )
    assert allowed.status_code != 429, (
        "After limiter.reset(), requests should no longer be rate-limited"
    )
