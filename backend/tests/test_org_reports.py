from __future__ import annotations

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_org(client: AsyncClient, auth_headers: dict) -> str:
    """Create a test organization and return its ID."""
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Test Org Reports"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _generate_report(
    client: AsyncClient,
    auth_headers: dict,
    org_id: str,
    report_type: str = "monthly",
    period_start: str = "2026-01-01",
    period_end: str = "2026-01-31",
) -> dict:
    """Generate a report and return the response JSON."""
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": report_type,
            "period_start": period_start,
            "period_end": period_end,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _register_and_login(
    client: AsyncClient, username: str, email: str
) -> tuple:
    """Register a new user, log in, and return (headers, user_id)."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": "TestPass123!",
        },
    )
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "TestPass123!"},
    )
    assert login_resp.status_code == 200, login_resp.text
    data = login_resp.json()
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    user_id = data["user"]["id"]
    return headers, user_id


# ---------------------------------------------------------------------------
# 1. Generate report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generate_report(client: AsyncClient, auth_headers: dict):
    """Generate a monthly report and verify it contains a data field."""
    org_id = await _create_org(client, auth_headers)
    data = await _generate_report(client, auth_headers, org_id)

    assert "data" in data
    assert data["report_type"] == "monthly"
    assert data["period_start"] == "2026-01-01"
    assert data["period_end"] == "2026-01-31"
    assert data["organization_id"] == org_id


# ---------------------------------------------------------------------------
# 2. Generate report with invalid type
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generate_report_invalid_type(client: AsyncClient, auth_headers: dict):
    """report_type='invalid' should fail with 422."""
    org_id = await _create_org(client, auth_headers)
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": "invalid",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 3. Generate report with invalid dates (end before start)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generate_report_invalid_dates(client: AsyncClient, auth_headers: dict):
    """period_end before period_start should fail with 422."""
    org_id = await _create_org(client, auth_headers)
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": "monthly",
            "period_start": "2026-02-28",
            "period_end": "2026-01-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 4. List reports
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_reports(client: AsyncClient, auth_headers: dict):
    """Generate 2 reports, list them, and verify count."""
    org_id = await _create_org(client, auth_headers)
    await _generate_report(
        client, auth_headers, org_id,
        period_start="2026-01-01", period_end="2026-01-31",
    )
    await _generate_report(
        client, auth_headers, org_id,
        report_type="quarterly",
        period_start="2026-01-01", period_end="2026-03-31",
    )

    resp = await client.get(
        f"/api/v1/organizations/{org_id}/reports",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


# ---------------------------------------------------------------------------
# 5. Get report by ID
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_report(client: AsyncClient, auth_headers: dict):
    """Generate a report, then fetch it by ID."""
    org_id = await _create_org(client, auth_headers)
    report = await _generate_report(client, auth_headers, org_id)

    resp = await client.get(
        f"/api/v1/organizations/{org_id}/reports/{report['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == report["id"]
    assert data["report_type"] == "monthly"
    assert "data" in data


# ---------------------------------------------------------------------------
# 6. Delete report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_report(client: AsyncClient, auth_headers: dict):
    """Generate a report, delete it, and verify 404 on subsequent GET."""
    org_id = await _create_org(client, auth_headers)
    report = await _generate_report(client, auth_headers, org_id)

    delete_resp = await client.delete(
        f"/api/v1/organizations/{org_id}/reports/{report['id']}",
        headers=auth_headers,
    )
    assert delete_resp.status_code == 200

    # Verify it is gone
    get_resp = await client.get(
        f"/api/v1/organizations/{org_id}/reports/{report['id']}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# 7. Member cannot generate report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_member_cannot_generate(client: AsyncClient, auth_headers: dict):
    """A member (non-admin, non-owner) should get 403 when generating a report."""
    org_id = await _create_org(client, auth_headers)

    user2_headers, user2_id = await _register_and_login(
        client, "report_member", "report_member@test.com"
    )
    await client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": user2_id, "role": "member"},
        headers=auth_headers,
    )

    # Switch user2 to org context
    await client.post(
        "/api/v1/organizations/switch",
        json={"organization_id": org_id},
        headers=user2_headers,
    )

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": "monthly",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
        },
        headers=user2_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 8. Requires auth
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient, auth_headers: dict):
    """Accessing reports without auth headers should return 403."""
    org_id = await _create_org(client, auth_headers)

    resp = await client.get(f"/api/v1/organizations/{org_id}/reports")
    assert resp.status_code == 403
