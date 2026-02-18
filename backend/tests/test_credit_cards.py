from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CREDIT_CARD_PAYLOAD = {
    "name": "Visa Gold",
    "last_four_digits": "1234",
    "card_network": "visa",
    "issuer": "Leumi",
    "credit_limit": 10000.00,
    "billing_day": 15,
    "currency": "ILS",
    "color": "#6366F1",
    "notes": "test",
}


async def _create_card(
    client: AsyncClient, headers: dict, **overrides
) -> dict:
    """Create a credit card and return the parsed JSON response."""
    data = {**CREDIT_CARD_PAYLOAD, **overrides}
    resp = await client.post("/api/v1/credit-cards", json=data, headers=headers)
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
# 1. Create credit card
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_credit_card(client: AsyncClient, auth_headers: dict):
    """POST /credit-cards should return 201 with utilization fields."""
    resp = await _create_card(client, auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Visa Gold"
    assert data["last_four_digits"] == "1234"
    assert data["card_network"] == "visa"
    assert data["issuer"] == "Leumi"
    assert data["credit_limit"] == "10000.00"
    assert data["billing_day"] == 15
    assert data["currency"] == "ILS"
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data
    # Utilization computed fields
    assert "utilization_amount" in data
    assert "utilization_percentage" in data
    assert "available_credit" in data
    assert "total_monthly_charges" in data


# ---------------------------------------------------------------------------
# 2. Invalid billing day (>28)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_credit_card_invalid_billing_day(
    client: AsyncClient, auth_headers: dict
):
    """POST with billing_day=35 should return 422."""
    resp = await _create_card(client, auth_headers, billing_day=35)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 3. Negative credit limit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_credit_card_negative_limit(
    client: AsyncClient, auth_headers: dict
):
    """POST with credit_limit=-100 should return 422."""
    resp = await _create_card(client, auth_headers, credit_limit=-100)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 4. List credit cards
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_credit_cards(client: AsyncClient, auth_headers: dict):
    """Create 2 cards, list them, verify count."""
    resp1 = await _create_card(client, auth_headers, name="Card A", last_four_digits="1111")
    assert resp1.status_code == 201
    resp2 = await _create_card(client, auth_headers, name="Card B", last_four_digits="2222")
    assert resp2.status_code == 201

    list_resp = await client.get("/api/v1/credit-cards", headers=auth_headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    names = [c["name"] for c in data]
    assert "Card A" in names
    assert "Card B" in names


# ---------------------------------------------------------------------------
# 5. Credit card summary
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_credit_card_summary(client: AsyncClient, auth_headers: dict):
    """Create 2 active cards, verify summary totals."""
    await _create_card(client, auth_headers, name="Sum A", last_four_digits="3333", credit_limit=10000)
    await _create_card(client, auth_headers, name="Sum B", last_four_digits="4444", credit_limit=20000)

    resp = await client.get("/api/v1/credit-cards/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "cards" in data
    assert len(data["cards"]) == 2
    assert "total_credit_limit" in data
    assert "total_utilization" in data
    assert "total_available" in data
    assert "average_utilization_pct" in data
    # Total limit should be the sum of both cards
    assert float(data["total_credit_limit"]) == 30000.00


# ---------------------------------------------------------------------------
# 6. Get single credit card
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_credit_card(client: AsyncClient, auth_headers: dict):
    """Create then get by ID."""
    create_resp = await _create_card(client, auth_headers)
    assert create_resp.status_code == 201
    card_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/credit-cards/{card_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == card_id
    assert data["name"] == "Visa Gold"


# ---------------------------------------------------------------------------
# 7. Get credit card not found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_credit_card_not_found(client: AsyncClient, auth_headers: dict):
    """Random UUID should return 404."""
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/credit-cards/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 8. Update credit card
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_credit_card(client: AsyncClient, auth_headers: dict):
    """Create, update name and limit, verify."""
    create_resp = await _create_card(client, auth_headers)
    card_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/credit-cards/{card_id}",
        json={"name": "Updated Card", "credit_limit": 20000.00},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Card"
    assert data["credit_limit"] == "20000.00"


# ---------------------------------------------------------------------------
# 9. Delete credit card
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_credit_card(client: AsyncClient, auth_headers: dict):
    """Create, delete, verify 404 on get."""
    create_resp = await _create_card(client, auth_headers)
    card_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"/api/v1/credit-cards/{card_id}", headers=auth_headers
    )
    assert del_resp.status_code == 200

    get_resp = await client.get(
        f"/api/v1/credit-cards/{card_id}", headers=auth_headers
    )
    assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# 10. Get charges — empty for new card
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_charges_empty(client: AsyncClient, auth_headers: dict):
    """New card should have empty charges list."""
    create_resp = await _create_card(client, auth_headers)
    card_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/credit-cards/{card_id}/charges", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 0


# ---------------------------------------------------------------------------
# 11. Get next billing
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_next_billing(client: AsyncClient, auth_headers: dict):
    """Create card and verify next-billing response structure."""
    create_resp = await _create_card(client, auth_headers)
    card_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/credit-cards/{card_id}/next-billing", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "card" in data
    assert "billing_date" in data
    assert "charges" in data
    assert "total_charge" in data
    assert "remaining_after_charge" in data
    assert data["card"]["id"] == card_id


# ---------------------------------------------------------------------------
# 12. Requires auth
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_requires_auth(client: AsyncClient):
    """POST without auth should return 403."""
    resp = await client.post("/api/v1/credit-cards", json=CREDIT_CARD_PAYLOAD)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 13. IDOR — user2 cannot access user1's card
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_idor_get_other_user_card(client: AsyncClient, auth_headers: dict):
    """Create card as admin, register user2, try to get card as user2 -> 404."""
    # Admin creates a card
    create_resp = await _create_card(client, auth_headers, name="Admin Only Card")
    assert create_resp.status_code == 201
    card_id = create_resp.json()["id"]

    # Register a second user and get their auth headers
    user2_headers = await _register_and_login(
        client, "user2_cc", "user2_cc@test.com", "TestPass123!"
    )

    # User 2 tries to GET admin's card
    get_resp = await client.get(
        f"/api/v1/credit-cards/{card_id}", headers=user2_headers
    )
    assert get_resp.status_code == 404

    # User 2 tries to UPDATE admin's card
    put_resp = await client.put(
        f"/api/v1/credit-cards/{card_id}",
        json={"name": "Hacked"},
        headers=user2_headers,
    )
    assert put_resp.status_code == 404

    # User 2 tries to DELETE admin's card
    del_resp = await client.delete(
        f"/api/v1/credit-cards/{card_id}", headers=user2_headers
    )
    assert del_resp.status_code == 404
