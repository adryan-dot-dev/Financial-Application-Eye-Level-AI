from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_transaction(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/transactions", json={
        "amount": 1500.50,
        "type": "expense",
        "description": "Office rent",
        "date": "2026-02-01",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "1500.50"
    assert data["type"] == "expense"
    assert data["currency"] == "ILS"


@pytest.mark.asyncio
async def test_list_transactions_paginated(client: AsyncClient, auth_headers: dict):
    # Create a few
    for i in range(3):
        await client.post("/api/v1/transactions", json={
            "amount": 100 * (i + 1),
            "type": "income",
            "description": f"Item {i}",
            "date": f"2026-02-0{i+1}",
        }, headers=auth_headers)

    response = await client.get("/api/v1/transactions?page=1&page_size=2", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["page_size"] == 2
    assert len(data["items"]) <= 2
    assert data["total"] >= 3


@pytest.mark.asyncio
async def test_filter_transactions_by_type(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/transactions", json={
        "amount": 500,
        "type": "income",
        "description": "Salary",
        "date": "2026-02-01",
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 200,
        "type": "expense",
        "description": "Food",
        "date": "2026-02-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/transactions?type=income", headers=auth_headers)
    assert response.status_code == 200
    for item in response.json()["items"]:
        assert item["type"] == "income"


@pytest.mark.asyncio
async def test_duplicate_transaction(client: AsyncClient, auth_headers: dict):
    # Create original
    create_resp = await client.post("/api/v1/transactions", json={
        "amount": 999,
        "type": "expense",
        "description": "Duplicate me",
        "date": "2026-03-01",
    }, headers=auth_headers)
    original_id = create_resp.json()["id"]

    # Duplicate
    response = await client.post(f"/api/v1/transactions/{original_id}/duplicate", headers=auth_headers)
    assert response.status_code == 201
    dup = response.json()
    assert dup["id"] != original_id
    assert dup["amount"] == "999.00"
    assert dup["description"] == "Duplicate me"


@pytest.mark.asyncio
async def test_update_transaction(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/transactions", json={
        "amount": 100,
        "type": "income",
        "description": "Update me",
        "date": "2026-02-01",
    }, headers=auth_headers)
    tid = create_resp.json()["id"]

    response = await client.put(f"/api/v1/transactions/{tid}", json={
        "amount": 250,
        "description": "Updated",
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["amount"] == "250.00"
    assert response.json()["description"] == "Updated"


@pytest.mark.asyncio
async def test_delete_transaction(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/transactions", json={
        "amount": 50,
        "type": "expense",
        "description": "Delete me",
        "date": "2026-02-01",
    }, headers=auth_headers)
    tid = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/transactions/{tid}", headers=auth_headers)
    assert response.status_code == 200

    # Verify deleted
    response = await client.get(f"/api/v1/transactions/{tid}", headers=auth_headers)
    assert response.status_code == 404
