from __future__ import annotations

"""
Test authentication and authorization edge cases.
Covers expired tokens, malformed headers, password rules, refresh flow,
password change, and admin-only endpoint guards.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from jose import jwt

from app.config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_expired_token(user_id: str) -> str:
    """Create a JWT access token that is already expired."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "exp": now - timedelta(minutes=5),
        "iat": now - timedelta(minutes=20),
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def _register_and_login(client: AsyncClient, username: str) -> dict:
    """Register a new user and return auth headers + token response."""
    r = await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": f"{username}@test.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    assert r.status_code == 201, r.text
    data = r.json()
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return headers


async def _register_and_get_tokens(client: AsyncClient, username: str) -> dict:
    """Register a new user and return the full token response."""
    r = await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": f"{username}@test.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# 1. Expired token rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_expired_token_rejected(client: AsyncClient, auth_headers: dict):
    """A token that has already expired should be rejected with 401/403."""
    # Get the admin user id first
    me_resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me_resp.json()["id"]

    expired_token = _create_expired_token(user_id)
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 2. Invalid token format
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invalid_token_format(client: AsyncClient):
    """Sending a malformed Authorization header should return 401/403."""
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-real-jwt-token"},
    )
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 3. Missing auth header
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_auth_header(client: AsyncClient):
    """Request without Authorization header should return 401/403."""
    r = await client.get("/api/v1/auth/me")
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 4. Wrong password login
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_wrong_password_login(client: AsyncClient):
    """Login with wrong password should return 401."""
    r = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "WrongPassword999!",
    })
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# 5. Register duplicate username
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient):
    """Registering with an existing username should fail with 409."""
    # 'admin' already exists
    r = await client.post("/api/v1/auth/register", json={
        "username": "admin",
        "email": "different@test.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# 6. Register duplicate email
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Registering with an existing email should fail with 409."""
    r = await client.post("/api/v1/auth/register", json={
        "username": "uniqueuser999",
        "email": "admin@eyelevel.ai",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# 7. Register weak password
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    """Registering with a short / weak password should fail with 422."""
    # Too short
    r = await client.post("/api/v1/auth/register", json={
        "username": "weakpwduser",
        "email": "weakpwd@test.com",
        "password": "Ab1!",
        "password_confirm": "Ab1!",
    })
    assert r.status_code == 422

    # No uppercase
    r = await client.post("/api/v1/auth/register", json={
        "username": "weakpwduser2",
        "email": "weakpwd2@test.com",
        "password": "alllower123!",
        "password_confirm": "alllower123!",
    })
    assert r.status_code == 422

    # No digits
    r = await client.post("/api/v1/auth/register", json={
        "username": "weakpwduser3",
        "email": "weakpwd3@test.com",
        "password": "NoDigitsHere!",
        "password_confirm": "NoDigitsHere!",
    })
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 8. Refresh token works
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_token_works(client: AsyncClient):
    """Using a valid refresh token should return a new access token."""
    tokens = await _register_and_get_tokens(client, "refreshuser")
    refresh_token = tokens["refresh_token"]

    r = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Verify the new access token works
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# 9. Change password success
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_change_password_success(client: AsyncClient):
    """Changing password with valid current password should succeed."""
    headers = await _register_and_login(client, "chgpwduser")

    r = await client.put("/api/v1/auth/password", json={
        "current_password": "TestPass123!",
        "new_password": "NewPass456!",
    }, headers=headers)
    assert r.status_code == 200
    assert "updated" in r.json()["message"].lower() or "success" in r.json()["message"].lower()

    # Login with new password should work
    r = await client.post("/api/v1/auth/login", json={
        "username": "chgpwduser",
        "password": "NewPass456!",
    })
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# 10. Change password with wrong old password
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_change_password_wrong_old(client: AsyncClient):
    """Changing password with wrong current password should fail with 401."""
    headers = await _register_and_login(client, "wrongoldpwd")

    r = await client.put("/api/v1/auth/password", json={
        "current_password": "NotTheRightOne1!",
        "new_password": "NewPass456!",
    }, headers=headers)
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# 11. Non-admin cannot list users
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_non_admin_cannot_list_users(client: AsyncClient):
    """Regular (non-admin) user accessing /api/v1/users should get 403."""
    headers = await _register_and_login(client, "regularuser1")

    r = await client.get("/api/v1/users", headers=headers)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# 12. Non-admin cannot delete users
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_non_admin_cannot_delete_users(
    client: AsyncClient, auth_headers: dict,
):
    """Regular user trying to DELETE another user should get 403."""
    headers = await _register_and_login(client, "regularuser2")

    # Get admin id to try and delete
    me_resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    admin_id = me_resp.json()["id"]

    r = await client.delete(
        f"/api/v1/users/{admin_id}", headers=headers,
    )
    assert r.status_code == 403
