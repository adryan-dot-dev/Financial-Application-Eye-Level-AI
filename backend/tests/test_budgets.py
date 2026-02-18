from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_expense_category_id(client: AsyncClient, auth_headers: dict) -> str:
    """Return the ID of the first expense category from seed data."""
    resp = await client.get("/api/v1/categories?type=expense", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) > 0, "No expense categories found"
    return items[0]["id"]


async def _create_budget(
    client: AsyncClient,
    auth_headers: dict,
    category_id: str,
    amount: float = 5000.00,
) -> dict:
    """Create a budget and return its JSON response."""
    resp = await client.post("/api/v1/budgets", json={
        "category_id": category_id,
        "period_type": "monthly",
        "amount": amount,
        "currency": "ILS",
        "start_date": "2026-01-01",
        "alert_at_percentage": 80,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_budget(client: AsyncClient, auth_headers: dict):
    """Create a budget with a valid category and verify response fields."""
    category_id = await _get_expense_category_id(client, auth_headers)
    data = await _create_budget(client, auth_headers, category_id)

    assert data["category_id"] == category_id
    assert data["period_type"] == "monthly"
    assert float(data["amount"]) == 5000.00
    assert data["currency"] == "ILS"
    assert data["is_active"] is True
    assert data["alert_at_percentage"] == 80
    assert "id" in data


@pytest.mark.asyncio
async def test_create_budget_invalid_category(client: AsyncClient, auth_headers: dict):
    """Creating a budget with a non-existent category should fail with 404."""
    fake_id = str(uuid.uuid4())
    resp = await client.post("/api/v1/budgets", json={
        "category_id": fake_id,
        "period_type": "monthly",
        "amount": 5000,
        "currency": "ILS",
        "start_date": "2026-01-01",
        "alert_at_percentage": 80,
    }, headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_budget_negative_amount(client: AsyncClient, auth_headers: dict):
    """Creating a budget with a negative amount should fail with 422."""
    category_id = await _get_expense_category_id(client, auth_headers)
    resp = await client.post("/api/v1/budgets", json={
        "category_id": category_id,
        "period_type": "monthly",
        "amount": -100,
        "currency": "ILS",
        "start_date": "2026-01-01",
        "alert_at_percentage": 80,
    }, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_budgets(client: AsyncClient, auth_headers: dict):
    """Create 2 budgets then list them."""
    cat_id = await _get_expense_category_id(client, auth_headers)

    # Get a second expense category for the second budget
    resp = await client.get("/api/v1/categories?type=expense", headers=auth_headers)
    items = resp.json()["items"]
    cat_id_2 = items[1]["id"] if len(items) > 1 else cat_id

    await _create_budget(client, auth_headers, cat_id, amount=3000)
    await _create_budget(client, auth_headers, cat_id_2, amount=4000)

    resp = await client.get("/api/v1/budgets", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_get_budget(client: AsyncClient, auth_headers: dict):
    """Create a budget, fetch it by ID, and verify computed fields."""
    cat_id = await _get_expense_category_id(client, auth_headers)
    created = await _create_budget(client, auth_headers, cat_id)
    budget_id = created["id"]

    resp = await client.get(f"/api/v1/budgets/{budget_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == budget_id
    # Computed fields should be present
    assert "actual_amount" in data
    assert "remaining" in data
    assert "usage_percentage" in data
    assert "is_over_budget" in data


@pytest.mark.asyncio
async def test_get_budget_summary(client: AsyncClient, auth_headers: dict):
    """Create 2 active budgets and verify the summary endpoint totals."""
    cat_id = await _get_expense_category_id(client, auth_headers)

    resp = await client.get("/api/v1/categories?type=expense", headers=auth_headers)
    items = resp.json()["items"]
    cat_id_2 = items[1]["id"] if len(items) > 1 else cat_id

    await _create_budget(client, auth_headers, cat_id, amount=3000)
    await _create_budget(client, auth_headers, cat_id_2, amount=7000)

    resp = await client.get("/api/v1/budgets/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_budgeted" in data
    assert "total_actual" in data
    assert "over_budget_count" in data
    assert "budgets" in data
    assert float(data["total_budgeted"]) >= 10000


@pytest.mark.asyncio
async def test_update_budget(client: AsyncClient, auth_headers: dict):
    """Update a budget amount and verify the change."""
    cat_id = await _get_expense_category_id(client, auth_headers)
    created = await _create_budget(client, auth_headers, cat_id, amount=5000)
    budget_id = created["id"]

    resp = await client.put(f"/api/v1/budgets/{budget_id}", json={
        "amount": 8000,
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["amount"]) == 8000


@pytest.mark.asyncio
async def test_delete_budget(client: AsyncClient, auth_headers: dict):
    """Delete a budget and verify it returns 404 on subsequent GET."""
    cat_id = await _get_expense_category_id(client, auth_headers)
    created = await _create_budget(client, auth_headers, cat_id)
    budget_id = created["id"]

    resp = await client.delete(f"/api/v1/budgets/{budget_id}", headers=auth_headers)
    assert resp.status_code == 200

    resp = await client.get(f"/api/v1/budgets/{budget_id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_budget_with_transactions(client: AsyncClient, auth_headers: dict):
    """Create a budget, add a transaction in the same category, verify actual_amount > 0."""
    cat_id = await _get_expense_category_id(client, auth_headers)
    created = await _create_budget(client, auth_headers, cat_id, amount=5000)
    budget_id = created["id"]

    # Create an expense transaction in the budget's category
    await client.post("/api/v1/transactions", json={
        "amount": 3000,
        "currency": "ILS",
        "type": "expense",
        "category_id": cat_id,
        "description": "Test expense",
        "date": "2026-02-15",
    }, headers=auth_headers)

    resp = await client.get(f"/api/v1/budgets/{budget_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["actual_amount"]) > 0
    assert float(data["remaining"]) < 5000


@pytest.mark.asyncio
async def test_budget_over_budget(client: AsyncClient, auth_headers: dict):
    """Create a small budget, add a bigger transaction, verify is_over_budget is true."""
    cat_id = await _get_expense_category_id(client, auth_headers)
    created = await _create_budget(client, auth_headers, cat_id, amount=100)
    budget_id = created["id"]

    # Create an expense that exceeds the budget
    await client.post("/api/v1/transactions", json={
        "amount": 500,
        "currency": "ILS",
        "type": "expense",
        "category_id": cat_id,
        "description": "Over budget expense",
        "date": "2026-02-10",
    }, headers=auth_headers)

    resp = await client.get(f"/api/v1/budgets/{budget_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_over_budget"] is True
    assert float(data["usage_percentage"]) > 100


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    """Budget endpoints without auth should return 403."""
    resp = await client.get("/api/v1/budgets")
    assert resp.status_code == 403

    resp = await client.post("/api/v1/budgets", json={})
    assert resp.status_code == 403

    resp = await client.get("/api/v1/budgets/summary")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_not_found(client: AsyncClient, auth_headers: dict):
    """Fetching a budget with a random UUID should return 404."""
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/budgets/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404
