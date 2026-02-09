from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_installment(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/installments", json={
        "name": "New TV",
        "total_amount": 6000,
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2026-02-01",
        "day_of_month": 15,
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New TV"
    assert data["total_amount"] == "6000.00"
    assert data["monthly_amount"] == "500.00"
    assert data["number_of_payments"] == 12
    assert data["payments_completed"] == 0
    assert data["currency"] == "ILS"


@pytest.mark.asyncio
async def test_installment_uneven_split(client: AsyncClient, auth_headers: dict):
    """Test installment where total doesn't divide evenly."""
    response = await client.post("/api/v1/installments", json={
        "name": "Uneven Split",
        "total_amount": 1000,
        "number_of_payments": 3,
        "type": "expense",
        "start_date": "2026-03-01",
        "day_of_month": 10,
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["monthly_amount"] == "333.33"


@pytest.mark.asyncio
async def test_list_installments(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/installments", json={
        "name": "Item 1",
        "total_amount": 3000,
        "number_of_payments": 6,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 1,
    }, headers=auth_headers)

    response = await client.get("/api/v1/installments", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_get_installment_with_schedule(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/installments", json={
        "name": "Scheduled",
        "total_amount": 2400,
        "number_of_payments": 4,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 20,
    }, headers=auth_headers)
    iid = create_resp.json()["id"]

    response = await client.get(f"/api/v1/installments/{iid}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["installment"]["monthly_amount"] == "600.00"
    assert len(data["schedule"]) == 4
    # First payment should be on 2026-01-20
    assert data["schedule"][0]["date"] == "2026-01-20"
    assert data["schedule"][0]["payment_number"] == 1


@pytest.mark.asyncio
async def test_get_installment_payments(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/installments", json={
        "name": "Payment Test",
        "total_amount": 1200,
        "number_of_payments": 3,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 5,
    }, headers=auth_headers)
    iid = create_resp.json()["id"]

    response = await client.get(f"/api/v1/installments/{iid}/payments", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 3


@pytest.mark.asyncio
async def test_update_installment(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/installments", json={
        "name": "Update Me",
        "total_amount": 5000,
        "number_of_payments": 10,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 1,
    }, headers=auth_headers)
    iid = create_resp.json()["id"]

    response = await client.put(f"/api/v1/installments/{iid}", json={
        "name": "Updated Installment",
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Installment"


@pytest.mark.asyncio
async def test_delete_installment(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/installments", json={
        "name": "Delete Me",
        "total_amount": 2000,
        "number_of_payments": 4,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 10,
    }, headers=auth_headers)
    iid = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/installments/{iid}", headers=auth_headers)
    assert response.status_code == 200
