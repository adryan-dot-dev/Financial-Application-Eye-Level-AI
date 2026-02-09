from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_categories(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/categories", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 13  # 4 income + 9 expense from seed


@pytest.mark.asyncio
async def test_list_categories_by_type(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/categories?type=income", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 4
    assert all(c["type"] == "income" for c in data)


@pytest.mark.asyncio
async def test_create_category(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/categories", json={
        "name": "test_cat",
        "name_he": "קטגוריית בדיקה",
        "type": "expense",
        "icon": "star",
        "color": "#FF0000",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test_cat"
    assert data["name_he"] == "קטגוריית בדיקה"
    assert data["icon"] == "star"
    return data["id"]


@pytest.mark.asyncio
async def test_update_category(client: AsyncClient, auth_headers: dict):
    # Create first
    create_resp = await client.post("/api/v1/categories", json={
        "name": "update_me",
        "name_he": "עדכן אותי",
        "type": "income",
    }, headers=auth_headers)
    cat_id = create_resp.json()["id"]

    # Update
    response = await client.put(f"/api/v1/categories/{cat_id}", json={
        "name": "updated_name",
        "color": "#00FF00",
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "updated_name"
    assert response.json()["color"] == "#00FF00"


@pytest.mark.asyncio
async def test_delete_category_soft(client: AsyncClient, auth_headers: dict):
    # Create
    create_resp = await client.post("/api/v1/categories", json={
        "name": "delete_me",
        "name_he": "מחק אותי",
        "type": "expense",
    }, headers=auth_headers)
    cat_id = create_resp.json()["id"]

    # Delete (soft)
    response = await client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert response.status_code == 200

    # Should not appear in default listing
    list_resp = await client.get("/api/v1/categories", headers=auth_headers)
    ids = [c["id"] for c in list_resp.json()]
    assert cat_id not in ids

    # Should appear with include_archived
    list_resp = await client.get("/api/v1/categories?include_archived=true", headers=auth_headers)
    ids = [c["id"] for c in list_resp.json()]
    assert cat_id in ids
