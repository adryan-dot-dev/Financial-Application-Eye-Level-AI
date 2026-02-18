from __future__ import annotations

"""
Test endpoint coverage for modules with 0 tests:
Subscriptions, Organizations, Expected Income, Automation.
"""

from datetime import date

import pytest
from httpx import AsyncClient


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


# ===========================================================================
# Subscriptions (5 tests)
# ===========================================================================


@pytest.mark.asyncio
async def test_create_subscription(client: AsyncClient, auth_headers: dict):
    """Create a subscription and verify the returned data."""
    r = await client.post("/api/v1/subscriptions", json={
        "name": "Netflix",
        "amount": "49.90",
        "billing_cycle": "monthly",
        "next_renewal_date": "2026-03-01",
        "provider": "Netflix Inc.",
    }, headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Netflix"
    assert data["is_active"] is True
    assert data["billing_cycle"] == "monthly"


@pytest.mark.asyncio
async def test_list_subscriptions(client: AsyncClient, auth_headers: dict):
    """Create subscriptions and verify list endpoint returns them."""
    for name in ["Spotify", "GitHub"]:
        r = await client.post("/api/v1/subscriptions", json={
            "name": name,
            "amount": "29.90",
            "billing_cycle": "monthly",
            "next_renewal_date": "2026-03-15",
        }, headers=auth_headers)
        assert r.status_code == 201

    r = await client.get("/api/v1/subscriptions", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 2


@pytest.mark.asyncio
async def test_pause_resume_subscription(client: AsyncClient, auth_headers: dict):
    """Pause and then resume a subscription."""
    # Create
    r = await client.post("/api/v1/subscriptions", json={
        "name": "Gym Membership",
        "amount": "199.00",
        "billing_cycle": "monthly",
        "next_renewal_date": "2026-04-01",
    }, headers=auth_headers)
    assert r.status_code == 201
    sub_id = r.json()["id"]

    # Pause
    r = await client.post(
        f"/api/v1/subscriptions/{sub_id}/pause", headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["is_active"] is False
    assert r.json()["paused_at"] is not None

    # Resume
    r = await client.post(
        f"/api/v1/subscriptions/{sub_id}/resume", headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["is_active"] is True


@pytest.mark.asyncio
async def test_delete_subscription(client: AsyncClient, auth_headers: dict):
    """Delete a subscription and verify it is removed."""
    r = await client.post("/api/v1/subscriptions", json={
        "name": "Temp Sub",
        "amount": "10.00",
        "billing_cycle": "annual",
        "next_renewal_date": "2027-01-01",
    }, headers=auth_headers)
    assert r.status_code == 201
    sub_id = r.json()["id"]

    r = await client.delete(
        f"/api/v1/subscriptions/{sub_id}", headers=auth_headers,
    )
    assert r.status_code == 200

    # Verify it's gone
    r = await client.get(
        f"/api/v1/subscriptions/{sub_id}", headers=auth_headers,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_subscription_idor(client: AsyncClient, auth_headers: dict):
    """User B should NOT be able to access user A's subscription."""
    # Admin creates a subscription
    r = await client.post("/api/v1/subscriptions", json={
        "name": "Admin Only Sub",
        "amount": "50.00",
        "billing_cycle": "monthly",
        "next_renewal_date": "2026-05-01",
    }, headers=auth_headers)
    assert r.status_code == 201
    sub_id = r.json()["id"]

    # Register user B
    headers_b = await _register_and_login(client, "idor_sub_user")

    # User B tries to access admin's subscription
    r = await client.get(
        f"/api/v1/subscriptions/{sub_id}", headers=headers_b,
    )
    assert r.status_code == 404  # Not found (data isolation)

    # User B tries to delete admin's subscription
    r = await client.delete(
        f"/api/v1/subscriptions/{sub_id}", headers=headers_b,
    )
    assert r.status_code == 404


# ===========================================================================
# Organizations (5 tests)
# ===========================================================================


@pytest.mark.asyncio
async def test_create_organization(client: AsyncClient, auth_headers: dict):
    """Create an organization and verify the response."""
    r = await client.post("/api/v1/organizations", json={
        "name": "Test Corp",
    }, headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Test Corp"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_organizations(client: AsyncClient, auth_headers: dict):
    """Create orgs and verify they appear in the list."""
    for name in ["Org Alpha", "Org Beta"]:
        r = await client.post("/api/v1/organizations", json={
            "name": name,
        }, headers=auth_headers)
        assert r.status_code == 201

    r = await client.get("/api/v1/organizations", headers=auth_headers)
    assert r.status_code == 200
    orgs = r.json()
    assert isinstance(orgs, list)
    org_names = [o["name"] for o in orgs]
    assert "Org Alpha" in org_names
    assert "Org Beta" in org_names


@pytest.mark.asyncio
async def test_add_member_to_organization(client: AsyncClient, auth_headers: dict):
    """Add a second user as member to an organization."""
    # Create org
    r = await client.post("/api/v1/organizations", json={
        "name": "Member Test Org",
    }, headers=auth_headers)
    assert r.status_code == 201
    org_id = r.json()["id"]

    # Register second user
    headers2 = await _register_and_login(client, "org_member_user")
    me_resp = await client.get("/api/v1/auth/me", headers=headers2)
    user2_id = me_resp.json()["id"]

    # Admin adds user2 to the org
    r = await client.post(f"/api/v1/organizations/{org_id}/members", json={
        "user_id": user2_id,
        "role": "member",
    }, headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["role"] == "member"

    # Verify user2 appears in members list
    r = await client.get(
        f"/api/v1/organizations/{org_id}/members", headers=auth_headers,
    )
    assert r.status_code == 200
    member_ids = [m["user_id"] for m in r.json()]
    assert user2_id in member_ids


@pytest.mark.asyncio
async def test_switch_organization_context(client: AsyncClient, auth_headers: dict):
    """Switch to an org context and then back to personal."""
    # Create org
    r = await client.post("/api/v1/organizations", json={
        "name": "Switch Context Org",
    }, headers=auth_headers)
    assert r.status_code == 201
    org_id = r.json()["id"]

    # Switch to org context
    r = await client.post("/api/v1/organizations/switch", json={
        "organization_id": org_id,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["current_organization_id"] == org_id

    # Switch back to personal
    r = await client.post("/api/v1/organizations/switch", json={
        "organization_id": None,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["current_organization_id"] is None


@pytest.mark.asyncio
async def test_org_data_isolation(client: AsyncClient, auth_headers: dict):
    """Data created in org context should not be visible in personal context."""
    # Create org
    r = await client.post("/api/v1/organizations", json={
        "name": "Isolation Test Org",
    }, headers=auth_headers)
    assert r.status_code == 201
    org_id = r.json()["id"]

    # Switch to org context
    r = await client.post("/api/v1/organizations/switch", json={
        "organization_id": org_id,
    }, headers=auth_headers)
    assert r.status_code == 200

    # Create a transaction in org context
    r = await client.post("/api/v1/transactions", json={
        "amount": 7777,
        "type": "expense",
        "description": "Org-only transaction",
        "date": "2026-02-10",
    }, headers=auth_headers)
    assert r.status_code == 201
    org_tx_id = r.json()["id"]

    # Switch back to personal
    r = await client.post("/api/v1/organizations/switch", json={
        "organization_id": None,
    }, headers=auth_headers)
    assert r.status_code == 200

    # The org transaction should NOT be visible in personal context
    r = await client.get(
        f"/api/v1/transactions/{org_tx_id}", headers=auth_headers,
    )
    assert r.status_code == 404


# ===========================================================================
# Expected Income (3 tests)
# ===========================================================================


@pytest.mark.asyncio
async def test_set_expected_income(client: AsyncClient, auth_headers: dict):
    """Set expected income for a month."""
    r = await client.put("/api/v1/expected-income/2026-03-01", json={
        "expected_amount": "25000.00",
        "notes": "March salary + freelance",
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["expected_amount"] == "25000.00"
    assert data["notes"] == "March salary + freelance"


@pytest.mark.asyncio
async def test_update_expected_income(client: AsyncClient, auth_headers: dict):
    """Update an existing expected income entry."""
    # Create
    r = await client.put("/api/v1/expected-income/2026-04-01", json={
        "expected_amount": "20000.00",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["expected_amount"] == "20000.00"

    # Update
    r = await client.put("/api/v1/expected-income/2026-04-01", json={
        "expected_amount": "22000.00",
        "notes": "Got a raise",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["expected_amount"] == "22000.00"
    assert r.json()["notes"] == "Got a raise"


@pytest.mark.asyncio
async def test_delete_expected_income(client: AsyncClient, auth_headers: dict):
    """Delete an expected income entry."""
    # Create
    r = await client.put("/api/v1/expected-income/2026-05-01", json={
        "expected_amount": "18000.00",
    }, headers=auth_headers)
    assert r.status_code == 200

    # Delete
    r = await client.delete(
        "/api/v1/expected-income/2026-05-01", headers=auth_headers,
    )
    assert r.status_code == 200

    # Verify it's gone from the list
    r = await client.get("/api/v1/expected-income", headers=auth_headers)
    assert r.status_code == 200
    months = [item["month"] for item in r.json()["items"]]
    assert "2026-05-01" not in months


# ===========================================================================
# Automation (2 tests)
# ===========================================================================


@pytest.mark.asyncio
async def test_automation_preview(client: AsyncClient, auth_headers: dict):
    """Preview recurring charges without committing (preview mode)."""
    # First create a fixed expense so there's something to preview
    r = await client.post("/api/v1/fixed", json={
        "name": "Monthly Internet",
        "amount": "150.00",
        "type": "expense",
        "frequency": "monthly",
        "day_of_month": 18,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    assert r.status_code == 201

    # Preview using the /process endpoint with preview=true
    r = await client.post(
        "/api/v1/automation/process?preview=true", headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    # Response should be a dict with summary info
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_automation_process(client: AsyncClient, auth_headers: dict):
    """Process recurring charges (actual commit)."""
    # Create a fixed expense
    r = await client.post("/api/v1/fixed", json={
        "name": "Monthly Rent Auto",
        "amount": "5000.00",
        "type": "expense",
        "frequency": "monthly",
        "day_of_month": 18,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    assert r.status_code == 201

    # Process recurring charges for today
    r = await client.post(
        "/api/v1/automation/process?preview=false", headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)

    # Running again should be idempotent (no duplicate transactions)
    r2 = await client.post(
        "/api/v1/automation/process?preview=false", headers=auth_headers,
    )
    assert r2.status_code == 200
