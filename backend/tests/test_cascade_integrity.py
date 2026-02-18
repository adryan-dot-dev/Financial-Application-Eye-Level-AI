from __future__ import annotations

"""
Test data integrity and cascade behaviors.
Verifies that delete cascades, referential integrity, ordering,
and boundary conditions work correctly across the system.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Settings, Transaction, User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient, username: str) -> dict:
    """Register a new user and return auth headers."""
    r = await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": f"{username}@test.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _get_category_id(client: AsyncClient, auth_headers: dict, name: str) -> str:
    """Fetch all categories and return the id of the one matching *name*."""
    r = await client.get("/api/v1/categories?page_size=100", headers=auth_headers)
    assert r.status_code == 200
    for cat in r.json()["items"]:
        if cat["name"] == name:
            return cat["id"]
    raise AssertionError(f"Category '{name}' not found")


# ---------------------------------------------------------------------------
# 1. Delete user cascades settings
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_user_cascades_settings(
    client: AsyncClient, auth_headers: dict, db: AsyncSession,
):
    """When an admin deletes a user, that user's settings row should also be removed."""
    # Register a secondary user
    headers2 = await _register_and_login(client, "cascade_user1")

    # Get user2 id
    me_resp = await client.get("/api/v1/auth/me", headers=headers2)
    user2_id = me_resp.json()["id"]

    # Confirm settings exist
    result = await db.execute(select(Settings).where(Settings.user_id == user2_id))
    assert result.scalar_one_or_none() is not None

    # Admin deletes user2
    r = await client.delete(f"/api/v1/users/{user2_id}", headers=auth_headers)
    assert r.status_code == 200

    # Verify settings are gone (need a fresh query after the commit)
    await db.close()
    from tests.conftest import test_session
    async with test_session() as fresh_db:
        result = await fresh_db.execute(
            select(Settings).where(Settings.user_id == user2_id)
        )
        assert result.scalar_one_or_none() is None


# ---------------------------------------------------------------------------
# 2. Delete user cascades transactions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_user_cascades_transactions(
    client: AsyncClient, auth_headers: dict, db: AsyncSession,
):
    """When an admin deletes a user, all their transactions should be removed."""
    headers2 = await _register_and_login(client, "cascade_user2")
    me_resp = await client.get("/api/v1/auth/me", headers=headers2)
    user2_id = me_resp.json()["id"]

    # Create a transaction for user2
    r = await client.post("/api/v1/transactions", json={
        "amount": 500,
        "type": "expense",
        "description": "Will be cascaded",
        "date": "2026-02-01",
    }, headers=headers2)
    assert r.status_code == 201

    # Admin deletes user2
    r = await client.delete(f"/api/v1/users/{user2_id}", headers=auth_headers)
    assert r.status_code == 200

    # Verify transactions are gone
    from tests.conftest import test_session
    async with test_session() as fresh_db:
        result = await fresh_db.execute(
            select(Transaction).where(Transaction.user_id == user2_id)
        )
        assert result.scalars().all() == []


# ---------------------------------------------------------------------------
# 3. Archive category preserves transactions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_archive_category_preserves_transactions(
    client: AsyncClient, auth_headers: dict,
):
    """Archiving a category should NOT remove existing transactions linked to it."""
    cat_id = await _get_category_id(client, auth_headers, "rent")

    # Create transaction with this category
    r = await client.post("/api/v1/transactions", json={
        "amount": 3000,
        "type": "expense",
        "description": "Office rent",
        "date": "2026-02-01",
        "category_id": cat_id,
    }, headers=auth_headers)
    assert r.status_code == 201
    tx_id = r.json()["id"]

    # Archive the category (DELETE = soft delete / archive)
    r = await client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert r.status_code == 200

    # Transaction should still exist and retain the category_id
    r = await client.get(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["category_id"] == cat_id


# ---------------------------------------------------------------------------
# 4. Category with transactions cannot be hard-deleted (soft-delete only)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_category_with_transactions_cannot_hard_delete(
    client: AsyncClient, auth_headers: dict,
):
    """Deleting a category that has transactions should result in soft-delete (archive)."""
    cat_id = await _get_category_id(client, auth_headers, "software")

    # Create a transaction linked to this category
    r = await client.post("/api/v1/transactions", json={
        "amount": 100,
        "type": "expense",
        "description": "SaaS subscription",
        "date": "2026-02-05",
        "category_id": cat_id,
    }, headers=auth_headers)
    assert r.status_code == 201

    # Delete (which should archive, not hard delete)
    r = await client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert r.status_code == 200
    assert "archived" in r.json().get("message", "").lower()

    # The category should still be retrievable (archived)
    r = await client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_archived"] is True


# ---------------------------------------------------------------------------
# 5. Transaction with invalid category_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_transaction_invalid_category_id(
    client: AsyncClient, auth_headers: dict,
):
    """Creating a transaction with a non-existent category_id should return 422."""
    r = await client.post("/api/v1/transactions", json={
        "amount": 200,
        "type": "expense",
        "description": "Bad category",
        "date": "2026-02-01",
        "category_id": str(uuid4()),
    }, headers=auth_headers)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 6. Transaction with wrong type category
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_transaction_wrong_type_category(
    client: AsyncClient, auth_headers: dict,
):
    """Creating an expense transaction with an income category should fail."""
    # 'salary' is an income category
    income_cat_id = await _get_category_id(client, auth_headers, "salary")

    r = await client.post("/api/v1/transactions", json={
        "amount": 100,
        "type": "expense",
        "description": "Wrong type",
        "date": "2026-02-01",
        "category_id": income_cat_id,
    }, headers=auth_headers)
    assert r.status_code == 422
    assert "type" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 7. Fixed entry with invalid category_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fixed_invalid_category_id(
    client: AsyncClient, auth_headers: dict,
):
    """Creating a fixed income/expense with a non-existent category_id should fail."""
    r = await client.post("/api/v1/fixed", json={
        "name": "Ghost category fixed",
        "amount": 500,
        "type": "expense",
        "frequency": "monthly",
        "day_of_month": 1,
        "start_date": "2026-02-01",
        "category_id": str(uuid4()),
    }, headers=auth_headers)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 8. Loan overpayment rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_loan_overpayment_rejected(
    client: AsyncClient, auth_headers: dict,
):
    """A loan payment exceeding the remaining balance should be rejected."""
    # Create a small loan
    r = await client.post("/api/v1/loans", json={
        "name": "Tiny loan",
        "original_amount": "1000.00",
        "interest_rate": "0",
        "monthly_payment": "500.00",
        "total_payments": 2,
        "start_date": "2026-01-01",
        "day_of_month": 1,
    }, headers=auth_headers)
    assert r.status_code == 201
    loan_id = r.json()["id"]

    # Make one payment of 500
    r = await client.post(f"/api/v1/loans/{loan_id}/payment", json={
        "amount": "500.00",
    }, headers=auth_headers)
    assert r.status_code == 200

    # Try to pay more than remaining (500 remaining, try 600)
    r = await client.post(f"/api/v1/loans/{loan_id}/payment", json={
        "amount": "600.00",
    }, headers=auth_headers)
    assert r.status_code == 422
    assert "exceeds" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 9. Installment payment count boundary
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_installment_payment_count_boundary(
    client: AsyncClient, auth_headers: dict,
):
    """Marking paid on an installment with exactly max payments should complete it,
    and a subsequent mark-paid should fail."""
    # Create an installment with 2 payments
    r = await client.post("/api/v1/installments", json={
        "name": "Two-pay installment",
        "total_amount": "200.00",
        "number_of_payments": 2,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 15,
    }, headers=auth_headers)
    assert r.status_code == 201
    inst_id = r.json()["id"]

    # Mark paid twice
    r = await client.post(f"/api/v1/installments/{inst_id}/mark-paid", headers=auth_headers)
    assert r.status_code == 200
    r = await client.post(f"/api/v1/installments/{inst_id}/mark-paid", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "completed"

    # Third mark-paid should fail
    r = await client.post(f"/api/v1/installments/{inst_id}/mark-paid", headers=auth_headers)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 10. Duplicate transaction creates independent copy
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_duplicate_transaction_creates_independent_copy(
    client: AsyncClient, auth_headers: dict,
):
    """Duplicating a transaction should create a fully independent copy.
    Modifying the original after duplication must not affect the copy."""
    # Create original
    r = await client.post("/api/v1/transactions", json={
        "amount": 999,
        "type": "expense",
        "description": "Original for dup test",
        "date": "2026-03-01",
    }, headers=auth_headers)
    assert r.status_code == 201
    original_id = r.json()["id"]

    # Duplicate
    r = await client.post(
        f"/api/v1/transactions/{original_id}/duplicate", headers=auth_headers,
    )
    assert r.status_code == 201
    dup_id = r.json()["id"]
    assert dup_id != original_id
    assert r.json()["amount"] == "999.00"

    # Modify original
    r = await client.put(f"/api/v1/transactions/{original_id}", json={
        "amount": 1,
        "description": "Modified original",
    }, headers=auth_headers)
    assert r.status_code == 200

    # Verify duplicate is unchanged
    r = await client.get(f"/api/v1/transactions/{dup_id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["amount"] == "999.00"
    assert r.json()["description"] == "Original for dup test"


# ---------------------------------------------------------------------------
# 11. Balance history ordering
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_balance_history_ordering(
    client: AsyncClient, auth_headers: dict,
):
    """Multiple balance entries should be returned ordered by effective_date descending."""
    # Create first balance
    r = await client.post("/api/v1/balance", json={
        "balance": "10000.00",
        "effective_date": "2026-01-01",
    }, headers=auth_headers)
    assert r.status_code == 201

    # Create second (newer) balance - this marks the first as non-current
    r = await client.post("/api/v1/balance", json={
        "balance": "12000.00",
        "effective_date": "2026-02-01",
    }, headers=auth_headers)
    assert r.status_code == 201

    # Create third (newest) balance
    r = await client.post("/api/v1/balance", json={
        "balance": "15000.00",
        "effective_date": "2026-03-01",
    }, headers=auth_headers)
    assert r.status_code == 201

    # Fetch history
    r = await client.get("/api/v1/balance/history", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 3

    # Should be descending by effective_date
    dates = [item["effective_date"] for item in items]
    assert dates == sorted(dates, reverse=True)


# ---------------------------------------------------------------------------
# 12. Concurrent balance updates (last one wins)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_balance_updates(
    client: AsyncClient, auth_headers: dict,
):
    """Two rapid balance updates should result in the last value being current."""
    # Create initial balance
    r = await client.post("/api/v1/balance", json={
        "balance": "5000.00",
        "effective_date": "2026-02-15",
    }, headers=auth_headers)
    assert r.status_code == 201

    # Rapid update 1
    r1 = await client.put("/api/v1/balance", json={
        "balance": "6000.00",
    }, headers=auth_headers)
    assert r1.status_code == 200

    # Rapid update 2
    r2 = await client.put("/api/v1/balance", json={
        "balance": "7000.00",
    }, headers=auth_headers)
    assert r2.status_code == 200

    # Current balance should be the last update
    r = await client.get("/api/v1/balance", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["balance"] == "7000.00"
