from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_registration_creates_settings_with_onboarding_false(client: AsyncClient):
    """New user registration must create a settings row with onboarding_completed=false."""
    # Register a new user
    response = await client.post("/api/v1/auth/register", json={
        "username": "onboard_user",
        "email": "onboard@example.com",
        "password": "TestPass1",
    })
    assert response.status_code == 201
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch settings for this user
    settings_resp = await client.get("/api/v1/settings", headers=headers)
    assert settings_resp.status_code == 200
    data = settings_resp.json()
    assert data["onboarding_completed"] is False
    assert data["currency"] == "ILS"
    assert data["language"] == "he"


@pytest.mark.asyncio
async def test_settings_api_returns_200_for_new_user(client: AsyncClient):
    """Settings GET must return 200 (not 404) for a newly registered user."""
    # Register
    response = await client.post("/api/v1/auth/register", json={
        "username": "settings_user",
        "email": "settings@example.com",
        "password": "TestPass1",
    })
    assert response.status_code == 201
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Settings must exist and return 200
    settings_resp = await client.get("/api/v1/settings", headers=headers)
    assert settings_resp.status_code == 200
    assert "id" in settings_resp.json()
    assert "onboarding_completed" in settings_resp.json()


@pytest.mark.asyncio
async def test_onboarding_completion_updates_settings(client: AsyncClient):
    """After completing onboarding, settings.onboarding_completed must be true."""
    # Register
    response = await client.post("/api/v1/auth/register", json={
        "username": "complete_user",
        "email": "complete@example.com",
        "password": "TestPass1",
    })
    assert response.status_code == 201
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify starts as false
    settings_resp = await client.get("/api/v1/settings", headers=headers)
    assert settings_resp.status_code == 200
    assert settings_resp.json()["onboarding_completed"] is False

    # Complete onboarding (same as frontend handleComplete)
    update_resp = await client.put("/api/v1/settings", json={
        "currency": "ILS",
        "language": "he",
        "theme": "light",
        "onboarding_completed": True,
    }, headers=headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["onboarding_completed"] is True

    # Verify it persists
    settings_resp2 = await client.get("/api/v1/settings", headers=headers)
    assert settings_resp2.status_code == 200
    assert settings_resp2.json()["onboarding_completed"] is True


@pytest.mark.asyncio
async def test_settings_autocreate_on_get_if_missing(client: AsyncClient, db):
    """If a user somehow has no settings row, GET /settings should auto-create one."""
    from app.db.models.settings import Settings
    from sqlalchemy import delete

    # Register a user
    response = await client.post("/api/v1/auth/register", json={
        "username": "autocreate_user",
        "email": "autocreate@example.com",
        "password": "TestPass1",
    })
    assert response.status_code == 201
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get user id
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    user_id = me_resp.json()["id"]

    # Delete settings row directly in DB to simulate edge case
    await db.execute(
        delete(Settings).where(Settings.user_id == user_id)
    )
    await db.commit()

    # Settings GET should auto-create and return 200 (not 404)
    settings_resp = await client.get("/api/v1/settings", headers=headers)
    assert settings_resp.status_code == 200
    data = settings_resp.json()
    assert data["onboarding_completed"] is False


@pytest.mark.asyncio
async def test_onboarding_not_completed_blocks_dashboard_access(client: AsyncClient):
    """Verify that a new user with onboarding_completed=false has that state in settings.
    
    The frontend ProtectedRoute uses this to redirect to /onboarding.
    This test verifies the backend correctly returns onboarding_completed=false
    for a fresh registration, which the frontend relies on.
    """
    # Register
    response = await client.post("/api/v1/auth/register", json={
        "username": "dashboard_block_user",
        "email": "dashblock@example.com",
        "password": "TestPass1",
    })
    assert response.status_code == 201
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Settings must show onboarding not completed
    settings_resp = await client.get("/api/v1/settings", headers=headers)
    assert settings_resp.status_code == 200
    assert settings_resp.json()["onboarding_completed"] is False

    # After completing onboarding
    await client.put("/api/v1/settings", json={
        "onboarding_completed": True,
    }, headers=headers)

    # Now it should show completed
    settings_resp2 = await client.get("/api/v1/settings", headers=headers)
    assert settings_resp2.status_code == 200
    assert settings_resp2.json()["onboarding_completed"] is True


@pytest.mark.asyncio
async def test_second_user_gets_own_onboarding_state(client: AsyncClient):
    """A second registered user must have their own onboarding state, independent of others.
    
    This verifies the admin user's onboarding state doesn't affect a new user.
    """
    # Complete onboarding for admin
    admin_resp = await client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "Admin2026!",
    })
    assert admin_resp.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_resp.json()['access_token']}"}

    await client.put("/api/v1/settings", json={
        "onboarding_completed": True,
    }, headers=admin_headers)

    admin_settings = await client.get("/api/v1/settings", headers=admin_headers)
    assert admin_settings.json()["onboarding_completed"] is True

    # Register a new user - should have onboarding_completed=false
    response = await client.post("/api/v1/auth/register", json={
        "username": "second_user",
        "email": "second@example.com",
        "password": "TestPass1",
    })
    assert response.status_code == 201
    new_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    new_settings = await client.get("/api/v1/settings", headers=new_headers)
    assert new_settings.status_code == 200
    assert new_settings.json()["onboarding_completed"] is False
