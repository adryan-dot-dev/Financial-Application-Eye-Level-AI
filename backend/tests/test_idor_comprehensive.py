from __future__ import annotations

"""
Comprehensive IDOR (Insecure Direct Object Reference) tests.

Verifies that user A cannot access, update, or delete user B's data
for every entity type in the system.  Each test:
  1. User A (admin) creates a resource.
  2. User B (second user) attempts to access it.
  3. The response MUST be 404 (the endpoint pretends the resource does not exist).
"""

import uuid
from datetime import date, datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Alert


# ---------------------------------------------------------------------------
# Helper: register a second user and return auth headers
# ---------------------------------------------------------------------------

async def _register_second_user(client: AsyncClient) -> dict:
    """Register user2 and return their auth headers."""
    await client.post("/api/v1/auth/register", json={
        "username": "user2_idor",
        "email": "user2_idor@test.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    login = await client.post("/api/v1/auth/login", json={
        "username": "user2_idor",
        "password": "TestPass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Helpers: get admin user_id from /auth/me
# ---------------------------------------------------------------------------

async def _get_user_id(client: AsyncClient, headers: dict) -> str:
    """Return the UUID of the currently authenticated user."""
    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    return resp.json()["id"]


# ===========================================================================
# IDOR test class
# ===========================================================================

class TestIDORComprehensive:
    """Comprehensive IDOR prevention tests for every entity type."""

    TODAY = date.today().isoformat()

    # -----------------------------------------------------------------------
    # 1. Transaction GET
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_transaction_get(self, client: AsyncClient, auth_headers: dict):
        """User B cannot GET user A's transaction."""
        user_b = await _register_second_user(client)

        # User A creates a transaction
        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "500.00", "type": "expense", "description": "Admin tx", "date": self.TODAY,
        })
        assert resp.status_code == 201
        tx_id = resp.json()["id"]

        # User B tries to GET it
        resp = await client.get(f"/api/v1/transactions/{tx_id}", headers=user_b)
        assert resp.status_code == 404

    # -----------------------------------------------------------------------
    # 2. Transaction UPDATE
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_transaction_update(self, client: AsyncClient, auth_headers: dict):
        """User B cannot PUT user A's transaction."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "300.00", "type": "income", "description": "Admin income", "date": self.TODAY,
        })
        assert resp.status_code == 201
        tx_id = resp.json()["id"]

        resp = await client.put(f"/api/v1/transactions/{tx_id}", headers=user_b, json={
            "amount": "1.00",
        })
        assert resp.status_code == 404

    # -----------------------------------------------------------------------
    # 3. Transaction DELETE
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_transaction_delete(self, client: AsyncClient, auth_headers: dict):
        """User B cannot DELETE user A's transaction."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "200.00", "type": "expense", "description": "To delete", "date": self.TODAY,
        })
        assert resp.status_code == 201
        tx_id = resp.json()["id"]

        resp = await client.delete(f"/api/v1/transactions/{tx_id}", headers=user_b)
        assert resp.status_code == 404

        # Verify admin can still see it (not actually deleted)
        resp = await client.get(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
        assert resp.status_code == 200

    # -----------------------------------------------------------------------
    # 4. Category GET
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_category_get(self, client: AsyncClient, auth_headers: dict):
        """User B cannot GET user A's custom category."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/categories", headers=auth_headers, json={
            "name": "admin_private_cat",
            "name_he": "קטגוריה_פרטית",
            "type": "expense",
        })
        assert resp.status_code == 201
        cat_id = resp.json()["id"]

        resp = await client.get(f"/api/v1/categories/{cat_id}", headers=user_b)
        assert resp.status_code == 404

    # -----------------------------------------------------------------------
    # 5. Category UPDATE
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_category_update(self, client: AsyncClient, auth_headers: dict):
        """User B cannot PUT user A's category."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/categories", headers=auth_headers, json={
            "name": "admin_cat_upd",
            "name_he": "קטגוריה_עדכון",
            "type": "income",
        })
        assert resp.status_code == 201
        cat_id = resp.json()["id"]

        resp = await client.put(f"/api/v1/categories/{cat_id}", headers=user_b, json={
            "name": "hacked_name",
        })
        assert resp.status_code == 404

        # Verify original name is unchanged
        resp = await client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "admin_cat_upd"

    # -----------------------------------------------------------------------
    # 6. Category DELETE (archive)
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_category_delete(self, client: AsyncClient, auth_headers: dict):
        """User B cannot DELETE (archive) user A's category."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/categories", headers=auth_headers, json={
            "name": "admin_cat_del",
            "name_he": "קטגוריה_מחיקה",
            "type": "expense",
        })
        assert resp.status_code == 201
        cat_id = resp.json()["id"]

        resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=user_b)
        assert resp.status_code == 404

        # Verify not archived
        resp = await client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["is_archived"] is False

    # -----------------------------------------------------------------------
    # 7. Fixed GET
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_fixed_get(self, client: AsyncClient, auth_headers: dict):
        """User B cannot GET user A's fixed entry."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "Admin Salary",
            "amount": "15000.00",
            "type": "income",
            "day_of_month": 10,
            "start_date": self.TODAY,
        })
        assert resp.status_code == 201
        fixed_id = resp.json()["id"]

        resp = await client.get(f"/api/v1/fixed/{fixed_id}", headers=user_b)
        assert resp.status_code == 404

    # -----------------------------------------------------------------------
    # 8. Fixed UPDATE
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_fixed_update(self, client: AsyncClient, auth_headers: dict):
        """User B cannot PUT user A's fixed entry."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "Admin Rent",
            "amount": "5000.00",
            "type": "expense",
            "day_of_month": 1,
            "start_date": self.TODAY,
        })
        assert resp.status_code == 201
        fixed_id = resp.json()["id"]

        resp = await client.put(f"/api/v1/fixed/{fixed_id}", headers=user_b, json={
            "amount": "1.00",
        })
        assert resp.status_code == 404

        # Verify unchanged
        resp = await client.get(f"/api/v1/fixed/{fixed_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["amount"] == "5000.00"

    # -----------------------------------------------------------------------
    # 9. Installment GET
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_installment_get(self, client: AsyncClient, auth_headers: dict):
        """User B cannot GET user A's installment."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/installments", headers=auth_headers, json={
            "name": "Admin Installment",
            "total_amount": "12000.00",
            "number_of_payments": 12,
            "type": "expense",
            "start_date": self.TODAY,
            "day_of_month": 15,
        })
        assert resp.status_code == 201
        inst_id = resp.json()["id"]

        resp = await client.get(f"/api/v1/installments/{inst_id}", headers=user_b)
        assert resp.status_code == 404

    # -----------------------------------------------------------------------
    # 10. Installment UPDATE
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_installment_update(self, client: AsyncClient, auth_headers: dict):
        """User B cannot PUT user A's installment."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/installments", headers=auth_headers, json={
            "name": "Admin Inst Update",
            "total_amount": "6000.00",
            "number_of_payments": 6,
            "type": "expense",
            "start_date": self.TODAY,
            "day_of_month": 5,
        })
        assert resp.status_code == 201
        inst_id = resp.json()["id"]

        resp = await client.put(f"/api/v1/installments/{inst_id}", headers=user_b, json={
            "name": "Hacked Installment",
        })
        assert resp.status_code == 404

    # -----------------------------------------------------------------------
    # 11. Loan GET
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_loan_get(self, client: AsyncClient, auth_headers: dict):
        """User B cannot GET user A's loan."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Admin Loan",
            "original_amount": "50000.00",
            "monthly_payment": "2000.00",
            "interest_rate": "5",
            "start_date": self.TODAY,
            "day_of_month": 10,
            "total_payments": 30,
        })
        assert resp.status_code == 201
        loan_id = resp.json()["id"]

        resp = await client.get(f"/api/v1/loans/{loan_id}", headers=user_b)
        assert resp.status_code == 404

    # -----------------------------------------------------------------------
    # 12. Loan PAYMENT
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_loan_payment(self, client: AsyncClient, auth_headers: dict):
        """User B cannot POST payment on user A's loan."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Admin Loan Payment",
            "original_amount": "10000.00",
            "monthly_payment": "1000.00",
            "interest_rate": "0",
            "start_date": self.TODAY,
            "day_of_month": 5,
            "total_payments": 10,
        })
        assert resp.status_code == 201
        loan_id = resp.json()["id"]

        resp = await client.post(f"/api/v1/loans/{loan_id}/payment", headers=user_b, json={
            "amount": "1000.00",
        })
        assert resp.status_code == 404

        # Verify no payment was made
        resp = await client.get(f"/api/v1/loans/{loan_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["loan"]["payments_made"] == 0

    # -----------------------------------------------------------------------
    # 13. Balance ACCESS
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_balance_access(self, client: AsyncClient, auth_headers: dict):
        """User B cannot see user A's balance.

        The balance endpoint is user-scoped (no ID in URL), so user B's GET
        should return their own balance (or 404 if none set), never user A's.
        """
        user_b = await _register_second_user(client)

        # User A creates a balance
        resp = await client.post("/api/v1/balance", headers=auth_headers, json={
            "balance": "50000.00",
            "effective_date": self.TODAY,
        })
        assert resp.status_code == 201
        admin_balance = resp.json()["balance"]

        # User B requests balance -- should get 404 (no balance set) or a different value
        resp = await client.get("/api/v1/balance", headers=user_b)
        if resp.status_code == 200:
            # If user B somehow has a balance, it must NOT be admin's balance
            assert resp.json()["balance"] != admin_balance
        else:
            assert resp.status_code == 404

        # Also verify user B cannot see admin's balance history
        resp = await client.get("/api/v1/balance/history", headers=user_b)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 0

    # -----------------------------------------------------------------------
    # 14. Alert MARK AS READ
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_alert_read(self, client: AsyncClient, auth_headers: dict, db: AsyncSession):
        """User B cannot mark user A's alert as read."""
        user_b = await _register_second_user(client)

        # Get admin's user_id to create an alert for them
        admin_id = await _get_user_id(client, auth_headers)

        # Create an alert directly in the DB for the admin user
        alert = Alert(
            id=uuid.uuid4(),
            user_id=uuid.UUID(admin_id),
            alert_type="negative_cashflow",
            severity="warning",
            title="Test Alert",
            message="This is a test alert for IDOR testing",
            is_read=False,
            is_dismissed=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)
        alert_id = str(alert.id)

        # User B tries to mark admin's alert as read
        resp = await client.put(f"/api/v1/alerts/{alert_id}/read", headers=user_b)
        assert resp.status_code == 404

        # Verify alert is still unread for admin
        resp = await client.get("/api/v1/alerts", headers=auth_headers)
        assert resp.status_code == 200
        admin_alerts = [a for a in resp.json()["items"] if a["id"] == alert_id]
        assert len(admin_alerts) == 1
        assert admin_alerts[0]["is_read"] is False

    # -----------------------------------------------------------------------
    # 15. Subscription GET
    # -----------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_idor_subscription_get(self, client: AsyncClient, auth_headers: dict):
        """User B cannot GET user A's subscription."""
        user_b = await _register_second_user(client)

        resp = await client.post("/api/v1/subscriptions", headers=auth_headers, json={
            "name": "Admin Netflix",
            "amount": "49.90",
            "billing_cycle": "monthly",
            "next_renewal_date": self.TODAY,
        })
        assert resp.status_code == 201
        sub_id = resp.json()["id"]

        resp = await client.get(f"/api/v1/subscriptions/{sub_id}", headers=user_b)
        assert resp.status_code == 404

        # Also verify user B cannot update or delete it
        resp = await client.put(f"/api/v1/subscriptions/{sub_id}", headers=user_b, json={
            "name": "Hacked Sub",
        })
        assert resp.status_code == 404

        resp = await client.delete(f"/api/v1/subscriptions/{sub_id}", headers=user_b)
        assert resp.status_code == 404
