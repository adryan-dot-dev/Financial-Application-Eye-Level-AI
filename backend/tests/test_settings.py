from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_settings(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/settings", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["currency"] == "ILS"
    assert data["language"] == "he"
    assert data["theme"] == "light"


@pytest.mark.asyncio
async def test_update_settings(client: AsyncClient, auth_headers: dict):
    response = await client.put("/api/v1/settings", json={
        "theme": "dark",
        "forecast_months_default": 12,
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "dark"
    assert data["forecast_months_default"] == 12

    # Restore
    await client.put("/api/v1/settings", json={
        "theme": "light",
        "forecast_months_default": 6,
    }, headers=auth_headers)


@pytest.mark.asyncio
async def test_update_settings_invalid_theme(client: AsyncClient, auth_headers: dict):
    response = await client.put("/api/v1/settings", json={
        "theme": "blue",
    }, headers=auth_headers)
    assert response.status_code == 422
