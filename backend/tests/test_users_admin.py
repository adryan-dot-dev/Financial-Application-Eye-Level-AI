from __future__ import annotations

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user_via_admin(
    client: AsyncClient,
    auth_headers: dict,
    username: str = "newuser",
    email: str = "newuser@test.com",
    password: str = "TestPass1",
    is_admin: bool = False,
) -> dict:
    """Create a user through the admin endpoint and return the response JSON."""
    resp = await client.post("/api/v1/users", json={
        "username": username,
        "email": email,
        "password": password,
        "is_admin": is_admin,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _get_regular_user_headers(
    client: AsyncClient,
    auth_headers: dict,
) -> dict:
    """Create a regular (non-admin) user and return their auth headers."""
    await _create_user_via_admin(
        client, auth_headers,
        username="regularuser",
        email="regular@test.com",
        password="TestPass1",
        is_admin=False,
    )
    resp = await client.post("/api/v1/auth/login", json={
        "username": "regularuser",
        "password": "TestPass1",
    })
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# GET /api/v1/users — List users
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_users_default_pagination(client: AsyncClient, auth_headers: dict):
    """GET /users with defaults returns at least the admin user."""
    resp = await client.get("/api/v1/users", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["total"] >= 1
    assert len(data["items"]) >= 1
    # Admin user should be present
    usernames = [u["username"] for u in data["items"]]
    assert "admin" in usernames


@pytest.mark.asyncio
async def test_list_users_custom_page_size(client: AsyncClient, auth_headers: dict):
    """page_size=1 returns exactly 1 item."""
    # Create a second user so total > 1
    await _create_user_via_admin(client, auth_headers, username="extra1", email="extra1@test.com")

    resp = await client.get("/api/v1/users?page=1&page_size=1", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["page_size"] == 1
    assert len(data["items"]) == 1
    assert data["total"] >= 2
    assert data["pages"] >= 2


@pytest.mark.asyncio
async def test_list_users_search_by_username(client: AsyncClient, auth_headers: dict):
    """search=admin filters to just the admin user."""
    resp = await client.get("/api/v1/users?search=admin", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert "admin" in item["username"].lower() or "admin" in item["email"].lower()


@pytest.mark.asyncio
async def test_list_users_search_no_match(client: AsyncClient, auth_headers: dict):
    """search for a nonexistent user returns total=0."""
    resp = await client.get("/api/v1/users?search=nonexistent_xyz_999", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0


@pytest.mark.asyncio
async def test_list_users_requires_admin(client: AsyncClient, auth_headers: dict):
    """Regular (non-admin) user gets 403 when listing users."""
    regular_headers = await _get_regular_user_headers(client, auth_headers)

    resp = await client.get("/api/v1/users", headers=regular_headers)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/v1/users — Create user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_user_as_admin(client: AsyncClient, auth_headers: dict):
    """Admin can create a new user, which is returned with correct fields."""
    data = await _create_user_via_admin(
        client, auth_headers,
        username="brandnew",
        email="brandnew@test.com",
        password="BrandNew1",
        is_admin=False,
    )
    assert data["username"] == "brandnew"
    assert data["email"] == "brandnew@test.com"
    assert data["is_admin"] is False
    assert data["is_active"] is True
    assert "id" in data

    # Verify the user shows up in the list
    resp = await client.get("/api/v1/users?search=brandnew", headers=auth_headers)
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_create_user_duplicate_username(client: AsyncClient, auth_headers: dict):
    """Creating a user with an existing username returns 409."""
    await _create_user_via_admin(
        client, auth_headers,
        username="dupuser",
        email="dup1@test.com",
    )
    resp = await client.post("/api/v1/users", json={
        "username": "dupuser",
        "email": "dup2@test.com",
        "password": "TestPass1",
        "is_admin": False,
    }, headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_user_duplicate_email(client: AsyncClient, auth_headers: dict):
    """Creating a user with an existing email returns 409."""
    await _create_user_via_admin(
        client, auth_headers,
        username="emaildup1",
        email="same@test.com",
    )
    resp = await client.post("/api/v1/users", json={
        "username": "emaildup2",
        "email": "same@test.com",
        "password": "TestPass1",
        "is_admin": False,
    }, headers=auth_headers)
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# PUT /api/v1/users/{user_id} — Update user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_user_username(client: AsyncClient, auth_headers: dict):
    """Admin can update a user's username."""
    user = await _create_user_via_admin(
        client, auth_headers,
        username="oldname",
        email="oldname@test.com",
    )
    user_id = user["id"]

    resp = await client.put(f"/api/v1/users/{user_id}", json={
        "username": "newname",
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == "newname"


@pytest.mark.asyncio
async def test_update_user_deactivate(client: AsyncClient, auth_headers: dict):
    """Admin can deactivate a user by setting is_active=False."""
    user = await _create_user_via_admin(
        client, auth_headers,
        username="tobedeactivated",
        email="deactivate@test.com",
    )
    user_id = user["id"]

    resp = await client.put(f"/api/v1/users/{user_id}", json={
        "is_active": False,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


@pytest.mark.asyncio
async def test_update_nonexistent_user(client: AsyncClient, auth_headers: dict):
    """Updating a user that does not exist returns 404."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    resp = await client.put(f"/api/v1/users/{fake_uuid}", json={
        "username": "ghost",
    }, headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/v1/users/{user_id} — Delete user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient, auth_headers: dict):
    """Admin can delete another user."""
    user = await _create_user_via_admin(
        client, auth_headers,
        username="tobedeleted",
        email="delete@test.com",
    )
    user_id = user["id"]

    resp = await client.delete(f"/api/v1/users/{user_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert "deleted" in resp.json().get("message", "").lower()

    # Verify user no longer appears in list
    list_resp = await client.get(f"/api/v1/users?search=tobedeleted", headers=auth_headers)
    assert list_resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_delete_self_forbidden(client: AsyncClient, auth_headers: dict):
    """Admin cannot delete themselves — returns 403."""
    # Get admin's own user id
    me_resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me_resp.status_code == 200
    admin_id = me_resp.json()["id"]

    resp = await client.delete(f"/api/v1/users/{admin_id}", headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_nonexistent_user(client: AsyncClient, auth_headers: dict):
    """Deleting a user that does not exist returns 404."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    resp = await client.delete(f"/api/v1/users/{fake_uuid}", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/v1/users/{user_id}/reset-password — Admin password reset
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_password(client: AsyncClient, auth_headers: dict):
    """Admin can reset another user's password; user can then login with it."""
    user = await _create_user_via_admin(
        client, auth_headers,
        username="pwreset",
        email="pwreset@test.com",
        password="OldPass1",
    )
    user_id = user["id"]

    # Reset password
    resp = await client.post(f"/api/v1/users/{user_id}/reset-password", json={
        "new_password": "NewSecure1",
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert "reset" in resp.json().get("message", "").lower()

    # Verify old password no longer works
    login_old = await client.post("/api/v1/auth/login", json={
        "username": "pwreset",
        "password": "OldPass1",
    })
    assert login_old.status_code == 401

    # Verify new password works
    login_new = await client.post("/api/v1/auth/login", json={
        "username": "pwreset",
        "password": "NewSecure1",
    })
    assert login_new.status_code == 200
    assert "access_token" in login_new.json()
