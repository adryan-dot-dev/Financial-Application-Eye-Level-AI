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
        json={"name": "Test Org Approvals"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _submit_approval(
    client: AsyncClient,
    auth_headers: dict,
    org_id: str,
    amount: float = 1500.00,
    description: str = "Office supplies",
) -> dict:
    """Submit an expense approval and return the response JSON."""
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={
            "amount": amount,
            "currency": "ILS",
            "description": description,
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
# 1. Submit approval
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_submit_approval(client: AsyncClient, auth_headers: dict):
    """Submit an expense approval and verify status is pending."""
    org_id = await _create_org(client, auth_headers)
    data = await _submit_approval(client, auth_headers, org_id)
    assert data["status"] == "pending"
    assert data["amount"] == "1500.00"
    assert data["currency"] == "ILS"
    assert data["description"] == "Office supplies"
    assert data["organization_id"] == org_id


# ---------------------------------------------------------------------------
# 2. Submit approval with invalid (negative) amount
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_submit_approval_invalid_amount(client: AsyncClient, auth_headers: dict):
    """Negative amount should fail with 422."""
    org_id = await _create_org(client, auth_headers)
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": -100, "currency": "ILS", "description": "Bad amount"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 3. Submit approval with empty description
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_submit_approval_empty_description(client: AsyncClient, auth_headers: dict):
    """Empty description should fail with 422."""
    org_id = await _create_org(client, auth_headers)
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 500, "currency": "ILS", "description": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 4. List pending approvals
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_pending(client: AsyncClient, auth_headers: dict):
    """Submit 2 approvals, verify pending count is 2."""
    org_id = await _create_org(client, auth_headers)
    await _submit_approval(client, auth_headers, org_id, amount=100, description="Item 1")
    await _submit_approval(client, auth_headers, org_id, amount=200, description="Item 2")

    resp = await client.get(
        f"/api/v1/organizations/{org_id}/approvals/pending",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2
    assert len(data["items"]) == 2


# ---------------------------------------------------------------------------
# 5. List all approvals with pagination
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_all_approvals(client: AsyncClient, auth_headers: dict):
    """Submit 3 approvals, list all with pagination."""
    org_id = await _create_org(client, auth_headers)
    for i in range(3):
        await _submit_approval(
            client, auth_headers, org_id,
            amount=100 * (i + 1),
            description=f"Approval {i + 1}",
        )

    resp = await client.get(
        f"/api/v1/organizations/{org_id}/approvals?page=1&per_page=2",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["per_page"] == 2


# ---------------------------------------------------------------------------
# 6. Approve expense
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_approve_expense(client: AsyncClient, auth_headers: dict):
    """Approve an expense and verify status becomes approved with transaction_id set."""
    org_id = await _create_org(client, auth_headers)
    approval = await _submit_approval(client, auth_headers, org_id)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/approve",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"
    assert data["transaction_id"] is not None


# ---------------------------------------------------------------------------
# 7. Approve creates a transaction
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_approve_creates_transaction(client: AsyncClient, auth_headers: dict):
    """After approving, a matching transaction should exist in the transactions list."""
    org_id = await _create_org(client, auth_headers)
    approval = await _submit_approval(
        client, auth_headers, org_id, amount=750, description="Approved expense test",
    )

    # Approve the expense
    approve_resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/approve",
        headers=auth_headers,
    )
    assert approve_resp.status_code == 200
    tx_id = approve_resp.json()["transaction_id"]
    assert tx_id is not None

    # Switch to org context to see org transactions
    await client.post(
        "/api/v1/organizations/switch",
        json={"organization_id": org_id},
        headers=auth_headers,
    )

    # Verify transaction exists
    tx_resp = await client.get(
        f"/api/v1/transactions/{tx_id}",
        headers=auth_headers,
    )
    assert tx_resp.status_code == 200
    tx_data = tx_resp.json()
    assert tx_data["amount"] == "750.00"
    assert tx_data["type"] == "expense"


# ---------------------------------------------------------------------------
# 8. Reject expense
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reject_expense(client: AsyncClient, auth_headers: dict):
    """Reject an expense with a reason and verify status is rejected."""
    org_id = await _create_org(client, auth_headers)
    approval = await _submit_approval(client, auth_headers, org_id)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/reject",
        json={"rejection_reason": "Over budget"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data["rejection_reason"] == "Over budget"


# ---------------------------------------------------------------------------
# 9. Reject requires a reason
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reject_requires_reason(client: AsyncClient, auth_headers: dict):
    """Rejecting without a reason should fail with 422."""
    org_id = await _create_org(client, auth_headers)
    approval = await _submit_approval(client, auth_headers, org_id)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/reject",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 10. Cannot approve twice
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cannot_approve_twice(client: AsyncClient, auth_headers: dict):
    """Approving an already-approved expense should fail with 422."""
    org_id = await _create_org(client, auth_headers)
    approval = await _submit_approval(client, auth_headers, org_id)

    # First approve
    resp1 = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/approve",
        headers=auth_headers,
    )
    assert resp1.status_code == 200

    # Second approve should fail
    resp2 = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/approve",
        headers=auth_headers,
    )
    assert resp2.status_code == 422


# ---------------------------------------------------------------------------
# 11. Cannot reject an approved expense
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cannot_reject_approved(client: AsyncClient, auth_headers: dict):
    """Rejecting an already-approved expense should fail with 422."""
    org_id = await _create_org(client, auth_headers)
    approval = await _submit_approval(client, auth_headers, org_id)

    # Approve first
    resp1 = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/approve",
        headers=auth_headers,
    )
    assert resp1.status_code == 200

    # Try to reject
    resp2 = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/reject",
        json={"rejection_reason": "Changed my mind"},
        headers=auth_headers,
    )
    assert resp2.status_code == 422


# ---------------------------------------------------------------------------
# 12. Non-member cannot submit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_non_member_cannot_submit(client: AsyncClient, auth_headers: dict):
    """A user who is not a member of the org should get 403 on submit."""
    org_id = await _create_org(client, auth_headers)

    user2_headers, _ = await _register_and_login(
        client, "user2_nonmember", "user2_nonmember@test.com"
    )

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 500, "currency": "ILS", "description": "Unauthorized"},
        headers=user2_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 13. Viewer cannot approve
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_viewer_cannot_approve(client: AsyncClient, auth_headers: dict):
    """A viewer should get 403 when trying to approve an expense."""
    org_id = await _create_org(client, auth_headers)
    approval = await _submit_approval(client, auth_headers, org_id)

    # Register user2 and add as viewer
    user2_headers, user2_id = await _register_and_login(
        client, "user2_viewer_appr", "user2_viewer_appr@test.com"
    )
    await client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": user2_id, "role": "viewer"},
        headers=auth_headers,
    )

    # Switch user2 to org context
    await client.post(
        "/api/v1/organizations/switch",
        json={"organization_id": org_id},
        headers=user2_headers,
    )

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals/{approval['id']}/approve",
        headers=user2_headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 14. Member can submit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_member_can_submit(client: AsyncClient, auth_headers: dict):
    """A member should be able to submit an approval request."""
    org_id = await _create_org(client, auth_headers)

    # Register user2 and add as member
    user2_headers, user2_id = await _register_and_login(
        client, "user2_member_sub", "user2_member_sub@test.com"
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
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 300, "currency": "ILS", "description": "Member expense"},
        headers=user2_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


# ---------------------------------------------------------------------------
# 15. Requires auth
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient, auth_headers: dict):
    """Submitting without auth headers should return 403."""
    org_id = await _create_org(client, auth_headers)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/approvals",
        json={"amount": 100, "currency": "ILS", "description": "No auth"},
    )
    assert resp.status_code == 403
