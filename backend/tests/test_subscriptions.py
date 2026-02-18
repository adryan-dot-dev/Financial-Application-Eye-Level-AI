from __future__ import annotations

from datetime import date, timedelta

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_subscription(client: AsyncClient, headers: dict, **overrides) -> dict:
    """Create a subscription and return the parsed JSON response."""
    data = {
        "name": "Netflix",
        "amount": 49.90,
        "billing_cycle": "monthly",
        "next_renewal_date": "2026-03-01",
        **overrides,
    }
    resp = await client.post("/api/v1/subscriptions", json=data, headers=headers)
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
# 1. Create subscription
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_subscription(client: AsyncClient, auth_headers: dict):
    """POST /subscriptions should return 201 with all expected fields."""
    resp = await _create_subscription(
        client,
        auth_headers,
        name="Spotify",
        amount=29.90,
        billing_cycle="monthly",
        next_renewal_date="2026-04-01",
        currency="ILS",
        auto_renew=True,
        provider="Spotify AB",
        notes="Family plan",
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Spotify"
    assert data["amount"] == "29.90"
    assert data["currency"] == "ILS"
    assert data["billing_cycle"] == "monthly"
    assert data["next_renewal_date"] == "2026-04-01"
    assert data["auto_renew"] is True
    assert data["is_active"] is True
    assert data["provider"] == "Spotify AB"
    assert data["notes"] == "Family plan"
    assert "id" in data
    assert "created_at" in data


# ---------------------------------------------------------------------------
# 2. List subscriptions — empty
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_subscriptions_empty(client: AsyncClient, auth_headers: dict):
    """GET /subscriptions with no data should return 200 and an empty (or default) list."""
    resp = await client.get("/api/v1/subscriptions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# 3. List subscriptions — with data
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_subscriptions_with_data(client: AsyncClient, auth_headers: dict):
    """Create 2 subscriptions, then list — both should appear."""
    await _create_subscription(client, auth_headers, name="Netflix")
    await _create_subscription(client, auth_headers, name="Spotify")

    resp = await client.get("/api/v1/subscriptions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    names = [s["name"] for s in data]
    assert "Netflix" in names
    assert "Spotify" in names


# ---------------------------------------------------------------------------
# 4. List subscriptions — filter by active status
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_subscriptions_filter_active(client: AsyncClient, auth_headers: dict):
    """Create active + paused subscriptions, filter status=active returns only active."""
    # Create an active subscription
    active_resp = await _create_subscription(client, auth_headers, name="Active Sub")
    assert active_resp.status_code == 201

    # Create a subscription and then pause it
    paused_resp = await _create_subscription(client, auth_headers, name="Paused Sub")
    assert paused_resp.status_code == 201
    paused_id = paused_resp.json()["id"]
    pause_resp = await client.post(
        f"/api/v1/subscriptions/{paused_id}/pause", headers=auth_headers
    )
    assert pause_resp.status_code == 200

    # Filter active only
    resp = await client.get(
        "/api/v1/subscriptions?status=active", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    for sub in data:
        assert sub["is_active"] is True

    names = [s["name"] for s in data]
    assert "Active Sub" in names
    assert "Paused Sub" not in names


# ---------------------------------------------------------------------------
# 5. Get single subscription
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_subscription(client: AsyncClient, auth_headers: dict):
    """GET /subscriptions/{id} should return the matching subscription."""
    create_resp = await _create_subscription(
        client, auth_headers, name="Get Me", amount=99.99
    )
    assert create_resp.status_code == 201
    sub_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/subscriptions/{sub_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == sub_id
    assert data["name"] == "Get Me"
    assert data["amount"] == "99.99"


# ---------------------------------------------------------------------------
# 6. Update subscription
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_subscription(client: AsyncClient, auth_headers: dict):
    """PUT /subscriptions/{id} should update the specified fields."""
    create_resp = await _create_subscription(
        client, auth_headers, name="Update Me", amount=30.00
    )
    sub_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/subscriptions/{sub_id}",
        json={"name": "Updated Name", "amount": 59.90},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["amount"] == "59.90"


# ---------------------------------------------------------------------------
# 7. Delete subscription
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_subscription(client: AsyncClient, auth_headers: dict):
    """DELETE /subscriptions/{id} should remove it; subsequent GET should 404."""
    create_resp = await _create_subscription(client, auth_headers, name="Delete Me")
    sub_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"/api/v1/subscriptions/{sub_id}", headers=auth_headers
    )
    assert del_resp.status_code == 200

    get_resp = await client.get(
        f"/api/v1/subscriptions/{sub_id}", headers=auth_headers
    )
    assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# 8. Pause and resume
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pause_resume_subscription(client: AsyncClient, auth_headers: dict):
    """POST /pause sets is_active=False; POST /resume sets is_active=True."""
    create_resp = await _create_subscription(client, auth_headers, name="Pausable")
    sub_id = create_resp.json()["id"]

    # Pause
    pause_resp = await client.post(
        f"/api/v1/subscriptions/{sub_id}/pause", headers=auth_headers
    )
    assert pause_resp.status_code == 200
    assert pause_resp.json()["is_active"] is False
    assert pause_resp.json()["paused_at"] is not None

    # Resume
    resume_resp = await client.post(
        f"/api/v1/subscriptions/{sub_id}/resume", headers=auth_headers
    )
    assert resume_resp.status_code == 200
    assert resume_resp.json()["is_active"] is True
    assert resume_resp.json()["resumed_at"] is not None
    assert resume_resp.json()["paused_at"] is None


# ---------------------------------------------------------------------------
# 9. Upcoming renewals
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_upcoming_renewals(client: AsyncClient, auth_headers: dict):
    """GET /upcoming?days=7 should include subscriptions renewing within 7 days."""
    soon = (date.today() + timedelta(days=3)).isoformat()
    far = (date.today() + timedelta(days=60)).isoformat()

    await _create_subscription(
        client, auth_headers, name="Soon Sub", next_renewal_date=soon
    )
    await _create_subscription(
        client, auth_headers, name="Far Sub", next_renewal_date=far
    )

    resp = await client.get(
        "/api/v1/subscriptions/upcoming?days=7", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    names = [s["name"] for s in data]
    assert "Soon Sub" in names
    assert "Far Sub" not in names


# ---------------------------------------------------------------------------
# 10. Invalid billing cycle → 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_subscription_invalid_billing_cycle(
    client: AsyncClient, auth_headers: dict
):
    """POST with an invalid billing_cycle should return 422."""
    resp = await _create_subscription(
        client, auth_headers, billing_cycle="weekly"
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 11. IDOR prevention — user2 cannot access user1's subscription
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_subscription_idor_prevention(client: AsyncClient, auth_headers: dict):
    """User 2 should get 404 when trying to access User 1's subscription."""
    # Admin (user 1) creates a subscription
    create_resp = await _create_subscription(
        client, auth_headers, name="Admin Only"
    )
    assert create_resp.status_code == 201
    sub_id = create_resp.json()["id"]

    # Register a second user and get their auth headers
    user2_headers = await _register_and_login(
        client, "user2_sub", "user2_sub@example.com", "TestPass1"
    )

    # User 2 tries to GET admin's subscription
    get_resp = await client.get(
        f"/api/v1/subscriptions/{sub_id}", headers=user2_headers
    )
    assert get_resp.status_code == 404

    # User 2 tries to UPDATE admin's subscription
    put_resp = await client.put(
        f"/api/v1/subscriptions/{sub_id}",
        json={"name": "Hacked"},
        headers=user2_headers,
    )
    assert put_resp.status_code == 404

    # User 2 tries to DELETE admin's subscription
    del_resp = await client.delete(
        f"/api/v1/subscriptions/{sub_id}", headers=user2_headers
    )
    assert del_resp.status_code == 404

    # User 2 tries to PAUSE admin's subscription
    pause_resp = await client.post(
        f"/api/v1/subscriptions/{sub_id}/pause", headers=user2_headers
    )
    assert pause_resp.status_code == 404


# ---------------------------------------------------------------------------
# 12. Subscription with category
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_subscription_with_category(client: AsyncClient, auth_headers: dict):
    """Creating a subscription with a valid category_id should link them."""
    # Fetch existing categories for admin (seeded in conftest)
    cat_resp = await client.get("/api/v1/categories", headers=auth_headers)
    assert cat_resp.status_code == 200
    categories = cat_resp.json()["items"]
    assert len(categories) > 0
    category_id = categories[0]["id"]

    # Create subscription with category
    resp = await _create_subscription(
        client,
        auth_headers,
        name="Categorised Sub",
        category_id=category_id,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["category_id"] == category_id
