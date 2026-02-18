from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BANK_ACCOUNT_PAYLOAD = {
    "name": "Main Account",
    "bank_name": "Leumi",
    "account_last_digits": "5678",
    "overdraft_limit": 5000.00,
    "currency": "ILS",
    "is_primary": True,
    "notes": "test",
}


async def _create_account(
    client: AsyncClient, headers: dict, **overrides
) -> dict:
    """Create a bank account and return the httpx Response."""
    data = {**BANK_ACCOUNT_PAYLOAD, **overrides}
    resp = await client.post("/api/v1/bank-accounts", json=data, headers=headers)
    return resp


async def _register_and_login(
    client: AsyncClient, username: str, email: str, password: str
) -> dict:
    """Register a new user and return auth headers."""
    await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
    })
    resp = await client.post("/api/v1/auth/login", json={
        "username": username,
        "password": password,
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. Create bank account
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_bank_account(client: AsyncClient, auth_headers: dict):
    """POST /bank-accounts should return 201 with all expected fields."""
    resp = await _create_account(client, auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Main Account"
    assert data["bank_name"] == "Leumi"
    assert data["account_last_digits"] == "5678"
    assert data["overdraft_limit"] == "5000.00"
    assert data["currency"] == "ILS"
    assert data["is_primary"] is True
    assert "id" in data
    assert "created_at" in data


# ---------------------------------------------------------------------------
# 2. Negative overdraft limit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_bank_account_negative_overdraft(
    client: AsyncClient, auth_headers: dict
):
    """POST with overdraft_limit=-100 should fail with 422."""
    resp = await _create_account(client, auth_headers, overdraft_limit=-100)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 3. List bank accounts
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_bank_accounts(client: AsyncClient, auth_headers: dict):
    """Create 2 accounts, list them, verify both appear."""
    resp1 = await _create_account(
        client, auth_headers, name="Account A", is_primary=True
    )
    assert resp1.status_code == 201
    resp2 = await _create_account(
        client, auth_headers, name="Account B", is_primary=False
    )
    assert resp2.status_code == 201

    list_resp = await client.get("/api/v1/bank-accounts", headers=auth_headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    names = [a["name"] for a in data]
    assert "Account A" in names
    assert "Account B" in names


# ---------------------------------------------------------------------------
# 4. Get single bank account
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_bank_account(client: AsyncClient, auth_headers: dict):
    """Create then get by ID."""
    create_resp = await _create_account(client, auth_headers)
    assert create_resp.status_code == 201
    acct_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/bank-accounts/{acct_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == acct_id
    assert data["name"] == "Main Account"


# ---------------------------------------------------------------------------
# 5. Update bank account
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_bank_account(client: AsyncClient, auth_headers: dict):
    """Update name, verify the change."""
    create_resp = await _create_account(client, auth_headers)
    acct_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/bank-accounts/{acct_id}",
        json={"name": "Updated Account"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Account"


# ---------------------------------------------------------------------------
# 6. Delete bank account
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_bank_account(client: AsyncClient, auth_headers: dict):
    """Delete then verify 404 on get."""
    create_resp = await _create_account(client, auth_headers)
    acct_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"/api/v1/bank-accounts/{acct_id}", headers=auth_headers
    )
    assert del_resp.status_code == 200

    get_resp = await client.get(
        f"/api/v1/bank-accounts/{acct_id}", headers=auth_headers
    )
    assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# 7. Primary uniqueness
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_primary_uniqueness(client: AsyncClient, auth_headers: dict):
    """Creating a second primary account should unset the first one."""
    resp1 = await _create_account(
        client, auth_headers, name="Primary 1", is_primary=True
    )
    assert resp1.status_code == 201
    id1 = resp1.json()["id"]

    resp2 = await _create_account(
        client, auth_headers, name="Primary 2", is_primary=True
    )
    assert resp2.status_code == 201

    # Fetch the first account — it should no longer be primary
    get_resp = await client.get(
        f"/api/v1/bank-accounts/{id1}", headers=auth_headers
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["is_primary"] is False

    # The second account should be primary
    id2 = resp2.json()["id"]
    get_resp2 = await client.get(
        f"/api/v1/bank-accounts/{id2}", headers=auth_headers
    )
    assert get_resp2.status_code == 200
    assert get_resp2.json()["is_primary"] is True


# ---------------------------------------------------------------------------
# 8. Get not found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_not_found(client: AsyncClient, auth_headers: dict):
    """Random UUID should return 404."""
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/bank-accounts/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 9. Requires auth
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    """POST without auth should return 403."""
    resp = await client.post("/api/v1/bank-accounts", json=BANK_ACCOUNT_PAYLOAD)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 10. IDOR protection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_idor_protection(client: AsyncClient, auth_headers: dict):
    """Create as admin, try to get as user2 -> 404."""
    # Admin creates an account
    create_resp = await _create_account(
        client, auth_headers, name="Admin Bank"
    )
    assert create_resp.status_code == 201
    acct_id = create_resp.json()["id"]

    # Register a second user and get their auth headers
    user2_headers = await _register_and_login(
        client, "user2_bank", "user2_bank@test.com", "TestPass123!"
    )

    # User 2 tries to GET admin's account
    get_resp = await client.get(
        f"/api/v1/bank-accounts/{acct_id}", headers=user2_headers
    )
    assert get_resp.status_code == 404

    # User 2 tries to UPDATE admin's account
    put_resp = await client.put(
        f"/api/v1/bank-accounts/{acct_id}",
        json={"name": "Hacked"},
        headers=user2_headers,
    )
    assert put_resp.status_code == 404

    # User 2 tries to DELETE admin's account
    del_resp = await client.delete(
        f"/api/v1/bank-accounts/{acct_id}", headers=user2_headers
    )
    assert del_resp.status_code == 404
