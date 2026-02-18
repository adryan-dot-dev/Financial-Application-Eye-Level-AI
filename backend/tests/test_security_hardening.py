from __future__ import annotations

"""
Step 2: Security Hardening Tests
Covers OWASP Top 10, cross-user access, token security, XSS, headers, etc.
"""

from datetime import date
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, username: str) -> dict:
    r = await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": f"{username}@test.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. Cross-user access attempts
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cross_user_access_all_endpoints(client: AsyncClient, auth_headers: dict):
    """User A tries to read/update/delete user B's resources - should get 404."""
    admin_headers = auth_headers
    user_b = await _register_and_login(client, "sec_user_b")
    today = date.today().isoformat()

    # Admin creates resources
    r = await client.post("/api/v1/transactions", headers=admin_headers, json={
        "amount": "100.00", "type": "expense", "description": "Admin tx", "date": today,
    })
    assert r.status_code == 201
    admin_tx_id = r.json()["id"]

    r = await client.post("/api/v1/fixed", headers=admin_headers, json={
        "name": "Admin Fixed", "amount": "500.00", "type": "expense",
        "day_of_month": 1, "start_date": today,
    })
    assert r.status_code == 201
    admin_fixed_id = r.json()["id"]

    r = await client.post("/api/v1/installments", headers=admin_headers, json={
        "name": "Admin Inst", "total_amount": "1000.00", "number_of_payments": 10,
        "type": "expense", "start_date": today, "day_of_month": 15,
    })
    assert r.status_code == 201
    admin_inst_id = r.json()["id"]

    r = await client.post("/api/v1/loans", headers=admin_headers, json={
        "name": "Admin Loan", "original_amount": "5000.00", "monthly_payment": "500.00",
        "interest_rate": "0", "start_date": today, "day_of_month": 10, "total_payments": 10,
    })
    assert r.status_code == 201
    admin_loan_id = r.json()["id"]

    # User B tries to access admin's resources → 404
    for endpoint in [
        f"/api/v1/transactions/{admin_tx_id}",
        f"/api/v1/fixed/{admin_fixed_id}",
        f"/api/v1/installments/{admin_inst_id}",
        f"/api/v1/loans/{admin_loan_id}",
    ]:
        r = await client.get(endpoint, headers=user_b)
        assert r.status_code == 404, f"Expected 404 for GET {endpoint}, got {r.status_code}"

    # User B tries to update admin's transaction
    r = await client.put(f"/api/v1/transactions/{admin_tx_id}", headers=user_b, json={
        "amount": "1.00",
    })
    assert r.status_code == 404

    # User B tries to delete admin's transaction
    r = await client.delete(f"/api/v1/transactions/{admin_tx_id}", headers=user_b)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 2. Expired token rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_expired_token_rejected(client: AsyncClient):
    """A manually crafted expired token should be rejected."""
    from datetime import datetime, timezone, timedelta
    from jose import jwt
    from app.config import settings

    expired_token = jwt.encode(
        {
            "sub": str(uuid4()),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=5),
            "type": "access",
            "jti": str(uuid4()),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    r = await client.get(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 3. Blacklisted token rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_blacklisted_token_rejected(client: AsyncClient):
    """After logout, the token should be blacklisted and rejected."""
    # Register and get tokens
    r = await client.post("/api/v1/auth/register", json={
        "username": "blacklist_user",
        "email": "blacklist@test.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    assert r.status_code == 201
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Token works before logout
    r = await client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200

    # Logout
    r = await client.post("/api/v1/auth/logout", headers=headers)
    assert r.status_code == 200

    # Token should now be rejected
    r = await client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 4. Password not in response
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_password_not_in_response(client: AsyncClient, auth_headers: dict):
    """User response should never include password_hash."""
    r = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "password_hash" not in body
    assert "password" not in body
    assert "hashed_password" not in body


# ---------------------------------------------------------------------------
# 5. Admin-only endpoint blocked for regular user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_only_blocked_for_regular_user(client: AsyncClient):
    """Regular user cannot access admin endpoints."""
    headers = await _register_and_login(client, "regular_user_admin_test")

    r = await client.get("/api/v1/users", headers=headers)
    assert r.status_code in (403, 404, 405)


# ---------------------------------------------------------------------------
# 6. SQL injection attempt handled
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sql_injection_attempt_handled(client: AsyncClient, auth_headers: dict):
    """SQL injection in search/filter fields should be safely handled."""
    headers = auth_headers

    # SQL injection in search param
    r = await client.get(
        "/api/v1/transactions?search=' OR 1=1 --",
        headers=headers,
    )
    assert r.status_code == 200  # Should return empty, not error
    assert r.json()["total"] == 0

    # SQL injection in description
    r = await client.post("/api/v1/transactions", headers=headers, json={
        "amount": "100.00",
        "type": "expense",
        "description": "'; DROP TABLE transactions; --",
        "date": date.today().isoformat(),
    })
    assert r.status_code == 201  # Created but safely parameterized


# ---------------------------------------------------------------------------
# 7. XSS in text field stripped
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_xss_in_text_field_stripped(client: AsyncClient, auth_headers: dict):
    """HTML/script tags in text fields should be stripped."""
    headers = auth_headers

    r = await client.post("/api/v1/transactions", headers=headers, json={
        "amount": "100.00",
        "type": "expense",
        "description": "<script>alert('xss')</script>Clean text",
        "date": date.today().isoformat(),
    })
    assert r.status_code == 201
    desc = r.json()["description"]
    assert "<script>" not in desc
    assert "Clean text" in desc


# ---------------------------------------------------------------------------
# 8. Invalid UUID in path returns 422 (not 500)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invalid_uuid_returns_422(client: AsyncClient, auth_headers: dict):
    """Invalid UUID format in path should return 422, not 500."""
    headers = auth_headers

    r = await client.get("/api/v1/transactions/not-a-uuid", headers=headers)
    assert r.status_code == 422

    r = await client.get("/api/v1/categories/not-a-uuid", headers=headers)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 9. Security headers present
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient):
    """All required security headers should be in responses."""
    r = await client.get("/health")
    assert r.status_code == 200

    # Check all required headers
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert r.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "max-age=" in r.headers.get("Strict-Transport-Security", "")
    assert r.headers.get("Content-Security-Policy") == "default-src 'self'"
    assert r.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "camera=()" in r.headers.get("Permissions-Policy", "")
    assert r.headers.get("X-API-Version") == "v1"


# ---------------------------------------------------------------------------
# 10. Non-existent resource returns 404
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_nonexistent_resource_returns_404(client: AsyncClient, auth_headers: dict):
    """Accessing a valid UUID that doesn't exist returns 404."""
    headers = auth_headers
    fake_id = str(uuid4())

    r = await client.get(f"/api/v1/transactions/{fake_id}", headers=headers)
    assert r.status_code == 404

    r = await client.get(f"/api/v1/categories/{fake_id}", headers=headers)
    assert r.status_code == 404

    r = await client.get(f"/api/v1/loans/{fake_id}", headers=headers)
    assert r.status_code == 404

    r = await client.get(f"/api/v1/installments/{fake_id}", headers=headers)
    assert r.status_code == 404

    r = await client.get(f"/api/v1/fixed/{fake_id}", headers=headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 11. Refresh token with access token type rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_with_access_token_rejected(client: AsyncClient):
    """Using an access token for refresh should be rejected."""
    r = await client.post("/api/v1/auth/login", json={
        "username": "admin", "password": "Admin2026!",
    })
    assert r.status_code == 200
    access_token = r.json()["access_token"]

    r = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": access_token,
    })
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 12. Password change with wrong old password rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_password_change_wrong_old_rejected(client: AsyncClient, auth_headers: dict):
    """Changing password with wrong current password should fail."""
    r = await client.put("/api/v1/auth/password", headers=auth_headers, json={
        "current_password": "WrongPassword123!",
        "new_password": "NewPass123!",
    })
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 13. Unauthenticated request rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(client: AsyncClient):
    """Endpoints requiring auth should reject unauthenticated requests."""
    endpoints = [
        ("GET", "/api/v1/transactions"),
        ("GET", "/api/v1/categories"),
        ("GET", "/api/v1/fixed"),
        ("GET", "/api/v1/installments"),
        ("GET", "/api/v1/loans"),
        ("GET", "/api/v1/settings"),
        ("GET", "/api/v1/dashboard/summary"),
        ("GET", "/api/v1/forecast"),
        ("GET", "/api/v1/alerts"),
    ]
    for method, path in endpoints:
        if method == "GET":
            r = await client.get(path)
        assert r.status_code in (401, 403), f"Expected 401/403 for {method} {path}, got {r.status_code}"


# ---------------------------------------------------------------------------
# 14. Weak password rejected on register
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_weak_password_rejected(client: AsyncClient):
    """Weak passwords should be rejected during registration."""
    # Too short
    r = await client.post("/api/v1/auth/register", json={
        "username": "weak1", "email": "weak1@test.com",
        "password": "Ab1!", "password_confirm": "Ab1!",
    })
    assert r.status_code == 422

    # No uppercase
    r = await client.post("/api/v1/auth/register", json={
        "username": "weak2", "email": "weak2@test.com",
        "password": "alllower123!", "password_confirm": "alllower123!",
    })
    assert r.status_code == 422

    # No digit
    r = await client.post("/api/v1/auth/register", json={
        "username": "weak3", "email": "weak3@test.com",
        "password": "NoDigitHere!", "password_confirm": "NoDigitHere!",
    })
    assert r.status_code == 422
