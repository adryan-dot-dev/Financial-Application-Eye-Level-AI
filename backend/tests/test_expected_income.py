from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_set_expected_income(client: AsyncClient, auth_headers: dict):
    response = await client.put("/api/v1/expected-income/2026-03-01", json={
        "expected_amount": 20000,
        "notes": "March estimate",
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["expected_amount"] == "20000.00"
    assert data["month"] == "2026-03-01"
    assert data["notes"] == "March estimate"


@pytest.mark.asyncio
async def test_update_expected_income(client: AsyncClient, auth_headers: dict):
    # Create
    await client.put("/api/v1/expected-income/2026-04-01", json={
        "expected_amount": 15000,
    }, headers=auth_headers)

    # Update
    response = await client.put("/api/v1/expected-income/2026-04-01", json={
        "expected_amount": 18000,
        "notes": "Updated estimate",
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["expected_amount"] == "18000.00"


@pytest.mark.asyncio
async def test_list_expected_income(client: AsyncClient, auth_headers: dict):
    await client.put("/api/v1/expected-income/2026-05-01", json={
        "expected_amount": 12000,
    }, headers=auth_headers)
    await client.put("/api/v1/expected-income/2026-06-01", json={
        "expected_amount": 13000,
    }, headers=auth_headers)

    response = await client.get("/api/v1/expected-income", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()["items"]) >= 2


@pytest.mark.asyncio
async def test_delete_expected_income(client: AsyncClient, auth_headers: dict):
    await client.put("/api/v1/expected-income/2026-07-01", json={
        "expected_amount": 10000,
    }, headers=auth_headers)

    response = await client.delete("/api/v1/expected-income/2026-07-01", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_normalizes_to_first_of_month(client: AsyncClient, auth_headers: dict):
    """Setting expected income for 2026-08-15 should normalize to 2026-08-01."""
    response = await client.put("/api/v1/expected-income/2026-08-15", json={
        "expected_amount": 9000,
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["month"] == "2026-08-01"
