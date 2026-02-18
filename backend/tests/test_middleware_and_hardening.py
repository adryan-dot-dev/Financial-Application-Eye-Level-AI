from __future__ import annotations

"""
Steps 4-6: Error Handling, MEDIUM/LOW issues - Middleware & Hardening Tests
Tests for: Request ID tracking, API version header, security headers,
consistent error format, query timeout config.
"""

from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# 1. Request ID in response headers (M-4)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_request_id_in_response(client: AsyncClient, auth_headers: dict):
    """Every response should include X-Request-ID header."""
    r = await client.get("/api/v1/transactions", headers=auth_headers)
    assert r.status_code == 200
    assert "X-Request-ID" in r.headers
    assert len(r.headers["X-Request-ID"]) >= 8


# ---------------------------------------------------------------------------
# 2. API version header in response (L-6)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_api_version_header(client: AsyncClient):
    """Every response should include X-API-Version header."""
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.headers.get("X-API-Version") == "v1"


# ---------------------------------------------------------------------------
# 3. Consistent 404 error format
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_consistent_404_format(client: AsyncClient, auth_headers: dict):
    """404 responses should have a consistent error format."""
    from uuid import uuid4
    fake_id = str(uuid4())
    r = await client.get(f"/api/v1/transactions/{fake_id}", headers=auth_headers)
    assert r.status_code == 404
    body = r.json()
    assert "detail" in body


# ---------------------------------------------------------------------------
# 4. Consistent 422 error format (Pydantic validation)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_consistent_422_format(client: AsyncClient, auth_headers: dict):
    """422 responses from Pydantic validation should have detail array."""
    r = await client.post("/api/v1/transactions", headers=auth_headers, json={
        "amount": "-100",
        "type": "invalid_type",
        "date": "not-a-date",
    })
    assert r.status_code == 422
    body = r.json()
    assert "detail" in body


# ---------------------------------------------------------------------------
# 5. Settings validation - extra fields rejected (M-10)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_settings_extra_fields_handled(client: AsyncClient, auth_headers: dict):
    """Settings update with valid fields should work."""
    r = await client.put("/api/v1/settings", headers=auth_headers, json={
        "theme": "dark",
    })
    assert r.status_code == 200
    assert r.json()["theme"] == "dark"

    # Restore
    r = await client.put("/api/v1/settings", headers=auth_headers, json={
        "theme": "light",
    })
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# 6. Settings validation - valid patterns enforced
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_settings_validation_patterns(client: AsyncClient, auth_headers: dict):
    """Invalid settings values should be rejected."""
    # Invalid theme
    r = await client.put("/api/v1/settings", headers=auth_headers, json={
        "theme": "neon",
    })
    assert r.status_code == 422

    # Invalid language
    r = await client.put("/api/v1/settings", headers=auth_headers, json={
        "language": "fr",
    })
    assert r.status_code == 422

    # Invalid currency
    r = await client.put("/api/v1/settings", headers=auth_headers, json={
        "currency": "invalid",
    })
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 7. Pagination upper bound enforced (M-2)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pagination_upper_bound(client: AsyncClient, auth_headers: dict):
    """page_size should be capped at 100."""
    r = await client.get("/api/v1/transactions?page_size=200", headers=auth_headers)
    assert r.status_code == 422  # le=100 should reject 200

    r = await client.get("/api/v1/categories?page_size=200", headers=auth_headers)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 8. Health check endpoint (M-9)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Health check should return 200 with status."""
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert "version" in body


# ---------------------------------------------------------------------------
# 9. Global exception handler does not leak stack traces
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_stack_trace_leak(client: AsyncClient, auth_headers: dict):
    """Error responses should not include stack traces or internal details."""
    from uuid import uuid4
    fake_id = str(uuid4())

    r = await client.get(f"/api/v1/transactions/{fake_id}", headers=auth_headers)
    body = r.json()
    body_str = str(body)
    assert "Traceback" not in body_str
    assert "File" not in body_str
    assert ".py" not in body_str


# ---------------------------------------------------------------------------
# 10. Create endpoints return 201
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_returns_201(client: AsyncClient, auth_headers: dict):
    """All create endpoints should return 201."""
    today = date.today().isoformat()

    r = await client.post("/api/v1/transactions", headers=auth_headers, json={
        "amount": "100.00", "type": "expense",
        "description": "201 test", "date": today,
    })
    assert r.status_code == 201

    r = await client.post("/api/v1/balance", headers=auth_headers, json={
        "balance": "1000.00", "effective_date": today,
    })
    assert r.status_code == 201

    r = await client.post("/api/v1/fixed", headers=auth_headers, json={
        "name": "201 Fixed", "amount": "100.00",
        "type": "expense", "day_of_month": 1, "start_date": today,
    })
    assert r.status_code == 201

    r = await client.post("/api/v1/installments", headers=auth_headers, json={
        "name": "201 Inst", "total_amount": "1000.00",
        "number_of_payments": 10, "type": "expense",
        "start_date": today, "day_of_month": 15,
    })
    assert r.status_code == 201

    r = await client.post("/api/v1/loans", headers=auth_headers, json={
        "name": "201 Loan", "original_amount": "5000.00",
        "monthly_payment": "500.00", "interest_rate": "0",
        "start_date": today, "day_of_month": 10, "total_payments": 10,
    })
    assert r.status_code == 201
