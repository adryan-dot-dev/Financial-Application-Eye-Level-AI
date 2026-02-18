from __future__ import annotations

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


async def _setup_org_with_roles(
    client: AsyncClient, auth_headers: dict
) -> tuple:
    """Create an org (admin is owner), a member user, and a viewer user.

    Returns (org_id, member_headers, viewer_headers).
    """
    # Create org (admin is owner)
    org_resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Perm Test Org"},
        headers=auth_headers,
    )
    assert org_resp.status_code == 201, org_resp.text
    org_id = org_resp.json()["id"]

    # Create member user
    member_headers, member_id = await _register_and_login(
        client, "perm_member", "perm_member@test.com"
    )
    await client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": member_id, "role": "member"},
        headers=auth_headers,
    )

    # Switch member to org context
    await client.post(
        "/api/v1/organizations/switch",
        json={"organization_id": org_id},
        headers=member_headers,
    )

    # Create viewer user
    viewer_headers, viewer_id = await _register_and_login(
        client, "perm_viewer", "perm_viewer@test.com"
    )
    await client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": viewer_id, "role": "viewer"},
        headers=auth_headers,
    )

    # Switch viewer to org context
    await client.post(
        "/api/v1/organizations/switch",
        json={"organization_id": org_id},
        headers=viewer_headers,
    )

    return org_id, member_headers, viewer_headers


# ---------------------------------------------------------------------------
# 1. Owner can generate reports
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_owner_can_generate_reports(client: AsyncClient, auth_headers: dict):
    """Owner generates a report -- should succeed with 201."""
    org_id, _, _ = await _setup_org_with_roles(client, auth_headers)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": "monthly",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# 2. Member cannot generate reports
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_member_cannot_generate_reports(client: AsyncClient, auth_headers: dict):
    """Member tries to generate a report -- should get 403."""
    org_id, member_headers, _ = await _setup_org_with_roles(client, auth_headers)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": "monthly",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
        },
        headers=member_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 3. Viewer cannot generate reports
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_viewer_cannot_generate_reports(client: AsyncClient, auth_headers: dict):
    """Viewer tries to generate a report -- should get 403."""
    org_id, _, viewer_headers = await _setup_org_with_roles(client, auth_headers)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": "monthly",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
        },
        headers=viewer_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 4. Owner can approve expense
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_owner_can_approve(client: AsyncClient, auth_headers: dict):
    """Owner approves an expense -- should succeed with 200."""
    org_id, member_headers, _ = await _setup_org_with_roles(client, auth_headers)

    # Member submits an approval
    submit_resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 500, "currency": "ILS", "description": "Test expense"},
        headers=member_headers,
    )
    assert submit_resp.status_code == 201
    approval_id = submit_resp.json()["id"]

    # Owner approves
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval_id}/approve",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


# ---------------------------------------------------------------------------
# 5. Member cannot approve
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_member_cannot_approve(client: AsyncClient, auth_headers: dict):
    """Member tries to approve an expense -- should get 403."""
    org_id, member_headers, _ = await _setup_org_with_roles(client, auth_headers)

    # Owner submits an approval
    submit_resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 500, "currency": "ILS", "description": "Test expense"},
        headers=auth_headers,
    )
    assert submit_resp.status_code == 201
    approval_id = submit_resp.json()["id"]

    # Member tries to approve
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval_id}/approve",
        headers=member_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 6. Member can submit approval
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_member_can_submit_approval(client: AsyncClient, auth_headers: dict):
    """Member submits an approval request -- should succeed with 201."""
    org_id, member_headers, _ = await _setup_org_with_roles(client, auth_headers)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 250, "currency": "ILS", "description": "Member request"},
        headers=member_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


# ---------------------------------------------------------------------------
# 7. Viewer cannot submit approval
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_viewer_cannot_submit_approval(client: AsyncClient, auth_headers: dict):
    """Viewer tries to submit an approval -- should get 403."""
    org_id, _, viewer_headers = await _setup_org_with_roles(client, auth_headers)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 100, "currency": "ILS", "description": "Viewer attempt"},
        headers=viewer_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 8. Owner can view audit log
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_owner_can_view_audit_log(client: AsyncClient, auth_headers: dict):
    """Owner views the audit log -- should succeed with 200."""
    org_id, _, _ = await _setup_org_with_roles(client, auth_headers)

    resp = await client.get(
        f"/api/v1/organizations/{org_id}/audit-log",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


# ---------------------------------------------------------------------------
# 9. Member cannot view audit log
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_member_cannot_view_audit_log(client: AsyncClient, auth_headers: dict):
    """Member tries to view the audit log -- should get 403."""
    org_id, member_headers, _ = await _setup_org_with_roles(client, auth_headers)

    resp = await client.get(
        f"/api/v1/organizations/{org_id}/audit-log",
        headers=member_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 10. Viewer cannot view audit log
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_viewer_cannot_view_audit_log(client: AsyncClient, auth_headers: dict):
    """Viewer tries to view the audit log -- should get 403."""
    org_id, _, viewer_headers = await _setup_org_with_roles(client, auth_headers)

    resp = await client.get(
        f"/api/v1/organizations/{org_id}/audit-log",
        headers=viewer_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 11. Non-member cannot access org endpoints
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_non_member_cannot_access(client: AsyncClient, auth_headers: dict):
    """A user who is not a member of the org should get 403 on org endpoints."""
    org_id, _, _ = await _setup_org_with_roles(client, auth_headers)

    # Register a random user who is NOT a member
    random_headers, _ = await _register_and_login(
        client, "perm_random", "perm_random@test.com"
    )

    # Try to submit an approval
    resp_approval = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 100, "currency": "ILS", "description": "Random attempt"},
        headers=random_headers,
    )
    assert resp_approval.status_code == 403

    # Try to generate a report
    resp_report = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": "monthly",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
        },
        headers=random_headers,
    )
    assert resp_report.status_code == 403

    # Try to view audit log
    resp_audit = await client.get(
        f"/api/v1/organizations/{org_id}/audit-log",
        headers=random_headers,
    )
    assert resp_audit.status_code == 403


# ---------------------------------------------------------------------------
# 12. Owner can delete report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_owner_can_delete_report(client: AsyncClient, auth_headers: dict):
    """Owner deletes a report -- should succeed with 200."""
    org_id, _, _ = await _setup_org_with_roles(client, auth_headers)

    # Generate a report
    gen_resp = await client.post(
        f"/api/v1/organizations/{org_id}/reports",
        json={
            "report_type": "monthly",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
        },
        headers=auth_headers,
    )
    assert gen_resp.status_code == 201
    report_id = gen_resp.json()["id"]

    # Delete it
    resp = await client.delete(
        f"/api/v1/organizations/{org_id}/reports/{report_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
