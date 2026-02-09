from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_fixed_income(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/fixed", json={
        "name": "Monthly Salary",
        "amount": 15000,
        "type": "income",
        "day_of_month": 10,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Monthly Salary"
    assert data["amount"] == "15000.00"
    assert data["type"] == "income"
    assert data["day_of_month"] == 10
    assert data["is_active"] is True
    assert data["currency"] == "ILS"


@pytest.mark.asyncio
async def test_create_fixed_expense(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/fixed", json={
        "name": "Office Rent",
        "amount": 5000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Office Rent"
    assert data["end_date"] == "2026-12-31"


@pytest.mark.asyncio
async def test_list_fixed(client: AsyncClient, auth_headers: dict):
    # Create two entries
    await client.post("/api/v1/fixed", json={
        "name": "Salary",
        "amount": 10000,
        "type": "income",
        "day_of_month": 10,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    await client.post("/api/v1/fixed", json={
        "name": "Rent",
        "amount": 3000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/fixed", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_list_fixed_by_type(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/fixed", json={
        "name": "Income1",
        "amount": 5000,
        "type": "income",
        "day_of_month": 15,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/fixed?type=income", headers=auth_headers)
    assert response.status_code == 200
    for item in response.json():
        assert item["type"] == "income"


@pytest.mark.asyncio
async def test_update_fixed(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/fixed", json={
        "name": "Update Me",
        "amount": 2000,
        "type": "expense",
        "day_of_month": 5,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    fid = create_resp.json()["id"]

    response = await client.put(f"/api/v1/fixed/{fid}", json={
        "name": "Updated Name",
        "amount": 2500,
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"
    assert response.json()["amount"] == "2500.00"


@pytest.mark.asyncio
async def test_delete_fixed(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/fixed", json={
        "name": "Delete Me",
        "amount": 1000,
        "type": "income",
        "day_of_month": 20,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    fid = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/fixed/{fid}", headers=auth_headers)
    assert response.status_code == 200

    get_resp = await client.get(f"/api/v1/fixed/{fid}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_pause_and_resume_fixed(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/fixed", json={
        "name": "Pausable",
        "amount": 3000,
        "type": "expense",
        "day_of_month": 15,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    fid = create_resp.json()["id"]

    # Pause
    response = await client.post(f"/api/v1/fixed/{fid}/pause", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    # Resume
    response = await client.post(f"/api/v1/fixed/{fid}/resume", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_active"] is True
