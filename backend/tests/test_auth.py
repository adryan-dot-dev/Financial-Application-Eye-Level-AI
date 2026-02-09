from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_login_admin(client: AsyncClient):
    response = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "admin123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    response = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "wrong",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    # Register
    response = await client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "test123456",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "testuser"
    assert data["is_admin"] is False

    # Login
    response = await client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "test123456",
    })
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient):
    response = await client.post("/api/v1/auth/register", json={
        "username": "admin",
        "email": "other@example.com",
        "password": "test123456",
    })
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin"
    assert data["is_admin"] is True


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 403  # No auth header


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    # Login first
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "admin123",
    })
    refresh_token = login_resp.json()["refresh_token"]

    # Refresh
    response = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient, auth_headers: dict):
    response = await client.put("/api/v1/auth/password", json={
        "current_password": "admin123",
        "new_password": "newpass123",
    }, headers=auth_headers)
    assert response.status_code == 200

    # Login with new password
    response = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "newpass123",
    })
    assert response.status_code == 200

    # Restore password for other tests
    token = response.json()["access_token"]
    await client.put("/api/v1/auth/password", json={
        "current_password": "newpass123",
        "new_password": "admin123",
    }, headers={"Authorization": f"Bearer {token}"})
