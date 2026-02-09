from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_balance(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/balance", json={
        "balance": 50000,
        "effective_date": "2026-02-01",
        "notes": "Opening balance",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["balance"] == "50000.00"
    assert data["is_current"] is True
    assert data["notes"] == "Opening balance"


@pytest.mark.asyncio
async def test_get_current_balance(client: AsyncClient, auth_headers: dict):
    # Create first
    await client.post("/api/v1/balance", json={
        "balance": 25000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/balance", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["balance"] == "25000.00"


@pytest.mark.asyncio
async def test_update_balance(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/balance", json={
        "balance": 10000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    response = await client.put("/api/v1/balance", json={
        "balance": 12000,
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["balance"] == "12000.00"


@pytest.mark.asyncio
async def test_new_balance_replaces_current(client: AsyncClient, auth_headers: dict):
    """Creating a new balance should mark the old one as not current."""
    await client.post("/api/v1/balance", json={
        "balance": 10000,
        "effective_date": "2026-01-01",
    }, headers=auth_headers)
    await client.post("/api/v1/balance", json={
        "balance": 15000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    # Current should be the latest
    response = await client.get("/api/v1/balance", headers=auth_headers)
    assert response.json()["balance"] == "15000.00"

    # History should have both
    history = await client.get("/api/v1/balance/history", headers=auth_headers)
    assert len(history.json()["items"]) >= 2


@pytest.mark.asyncio
async def test_balance_history(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/balance", json={
        "balance": 5000,
        "effective_date": "2026-01-01",
    }, headers=auth_headers)
    await client.post("/api/v1/balance", json={
        "balance": 7000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/balance/history", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 2
