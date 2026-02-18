from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _create_transaction(
    client: AsyncClient, auth_headers: dict, idx: int = 0
) -> dict:
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "amount": 100 + idx,
            "type": "expense",
            "description": f"Bulk helper {idx}",
            "date": "2026-02-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def _get_expense_category_id(
    client: AsyncClient, auth_headers: dict
) -> str:
    """Return the id of the first expense category (seed data)."""
    resp = await client.get(
        "/api/v1/categories?type=expense", headers=auth_headers
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) > 0
    return items[0]["id"]


# ---------------------------------------------------------------------------
# 1. Bulk create 5 transactions at once
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_create_transactions(client: AsyncClient, auth_headers: dict):
    transactions = [
        {
            "amount": 100 + i,
            "type": "expense",
            "description": f"Bulk {i}",
            "date": "2026-01-01",
        }
        for i in range(5)
    ]
    resp = await client.post(
        "/api/v1/transactions/bulk",
        json={"transactions": transactions},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data) == 5
    # Verify all have unique IDs
    ids = [item["id"] for item in data]
    assert len(set(ids)) == 5


# ---------------------------------------------------------------------------
# 2. Bulk create validates each item — one invalid should fail the whole batch
#    (invalid = missing required field 'type')
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_create_validates_each(client: AsyncClient, auth_headers: dict):
    transactions = [
        {"amount": 100, "type": "expense", "description": "Valid", "date": "2026-01-01"},
        {"amount": 200, "description": "Missing type", "date": "2026-01-01"},  # no type
    ]
    resp = await client.post(
        "/api/v1/transactions/bulk",
        json={"transactions": transactions},
        headers=auth_headers,
    )
    assert resp.status_code == 422  # Pydantic validation failure


# ---------------------------------------------------------------------------
# 3. Bulk delete multiple transactions
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_delete_multiple(client: AsyncClient, auth_headers: dict):
    # Create 3 transactions
    ids = []
    for i in range(3):
        t = await _create_transaction(client, auth_headers, idx=i)
        ids.append(t["id"])

    resp = await client.post(
        "/api/v1/transactions/bulk-delete",
        json={"ids": ids},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "3" in data["message"] or data["message"].endswith("transactions")

    # Verify they're gone
    for tid in ids:
        get_resp = await client.get(
            f"/api/v1/transactions/{tid}", headers=auth_headers
        )
        assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# 4. Bulk delete with a non-existent ID — should not error, just delete 0
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_delete_nonexistent_id(client: AsyncClient, auth_headers: dict):
    fake_id = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/transactions/bulk-delete",
        json={"ids": [fake_id]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "0" in data["message"]  # Deleted 0 transactions


# ---------------------------------------------------------------------------
# 5. Bulk delete with another user's transaction ID — should be ignored
#    (the ownership filter excludes IDs not belonging to the current user)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_delete_other_users_ids(client: AsyncClient, auth_headers: dict):
    # Create a transaction as admin
    t = await _create_transaction(client, auth_headers, idx=0)
    tid = t["id"]

    # Register a second user
    await client.post("/api/v1/auth/register", json={
        "username": "otheruser",
        "email": "other@test.com",
        "password": "Other2026!",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "otheruser",
        "password": "Other2026!",
    })
    other_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # Other user tries to bulk-delete admin's transaction
    resp = await client.post(
        "/api/v1/transactions/bulk-delete",
        json={"ids": [tid]},
        headers=other_headers,
    )
    assert resp.status_code == 200
    assert "0" in resp.json()["message"]  # Deleted 0 — not owned by other user

    # Admin can still see it
    get_resp = await client.get(
        f"/api/v1/transactions/{tid}", headers=auth_headers
    )
    assert get_resp.status_code == 200


# ---------------------------------------------------------------------------
# 6. Bulk update category for multiple transactions
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_update_category(client: AsyncClient, auth_headers: dict):
    # Create 3 transactions (expense)
    ids = []
    for i in range(3):
        t = await _create_transaction(client, auth_headers, idx=i)
        ids.append(t["id"])

    category_id = await _get_expense_category_id(client, auth_headers)

    resp = await client.put(
        "/api/v1/transactions/bulk-update",
        json={"ids": ids, "category_id": category_id},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    # Verify each transaction now has the category
    for tid in ids:
        get_resp = await client.get(
            f"/api/v1/transactions/{tid}", headers=auth_headers
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["category_id"] == category_id


# ---------------------------------------------------------------------------
# 7. Bulk update with non-existent IDs — succeeds but updates 0
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_update_nonexistent_ids(client: AsyncClient, auth_headers: dict):
    category_id = await _get_expense_category_id(client, auth_headers)
    fake_ids = [str(uuid.uuid4()), str(uuid.uuid4())]

    resp = await client.put(
        "/api/v1/transactions/bulk-update",
        json={"ids": fake_ids, "category_id": category_id},
        headers=auth_headers,
    )
    # Should succeed — it just updates 0 rows
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 8. Bulk create with empty list should be rejected (min_length=1)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_empty_list(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/transactions/bulk",
        json={"transactions": []},
        headers=auth_headers,
    )
    assert resp.status_code == 422  # min_length=1

    # Also test empty ids for bulk-delete
    resp2 = await client.post(
        "/api/v1/transactions/bulk-delete",
        json={"ids": []},
        headers=auth_headers,
    )
    assert resp2.status_code == 422  # min_length=1


# ---------------------------------------------------------------------------
# 9. Bulk create with too many items — max_length=500 on TransactionBulkCreate
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bulk_too_many_items(client: AsyncClient, auth_headers: dict):
    transactions = [
        {
            "amount": 10,
            "type": "expense",
            "description": f"Over limit {i}",
            "date": "2026-01-01",
        }
        for i in range(501)  # 501 > max 500
    ]
    resp = await client.post(
        "/api/v1/transactions/bulk",
        json={"transactions": transactions},
        headers=auth_headers,
    )
    assert resp.status_code == 422  # max_length=500 exceeded


# ---------------------------------------------------------------------------
# 10. Duplicate a transaction (POST /transactions/{id}/duplicate)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_duplicate_transaction(client: AsyncClient, auth_headers: dict):
    original = await _create_transaction(client, auth_headers, idx=42)
    original_id = original["id"]

    resp = await client.post(
        f"/api/v1/transactions/{original_id}/duplicate",
        headers=auth_headers,
    )
    assert resp.status_code == 201
    dup = resp.json()

    # New ID, same data
    assert dup["id"] != original_id
    assert dup["amount"] == original["amount"]
    assert dup["type"] == original["type"]
    assert dup["description"] == original["description"]
    assert dup["date"] == original["date"]
