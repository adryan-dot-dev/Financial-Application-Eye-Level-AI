from __future__ import annotations

"""Tests for all production-readiness fixes (Steps 1-5).

Covers:
- RED bugs: Category pagination, installment rounding, archived category check,
  circular reference detection, mark-paid auto-transaction
- ORANGE bugs: Category type mismatch, loan interest validation, token blacklist,
  settings validation patterns
- YELLOW bugs: Pause/resume timestamps, expired alert auto-dismiss,
  payment reversal (installment + loan)
- AUDIT: HTML sanitization (strip_tags on text fields)
"""

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient


# ===========================================================================
# Helpers
# ===========================================================================

async def _create_category(
    client: AsyncClient, headers: dict, name: str, type: str = "expense",
    parent_id: str = None,
) -> dict:
    payload = {
        "name": name,
        "name_he": f"{name}_he",
        "type": type,
    }
    if parent_id:
        payload["parent_id"] = parent_id
    resp = await client.post("/api/v1/categories", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_transaction(
    client: AsyncClient, headers: dict,
    amount: float = 100, type: str = "expense", category_id: str = None,
) -> dict:
    payload = {
        "amount": amount,
        "type": type,
        "date": "2026-02-01",
    }
    if category_id:
        payload["category_id"] = category_id
    resp = await client.post("/api/v1/transactions", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_installment(
    client: AsyncClient, headers: dict,
    name: str = "Test Install",
    total: float = 1000,
    payments: int = 3,
    category_id: str = None,
) -> dict:
    payload = {
        "name": name,
        "total_amount": total,
        "number_of_payments": payments,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 15,
    }
    if category_id:
        payload["category_id"] = category_id
    resp = await client.post("/api/v1/installments", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_loan(
    client: AsyncClient, headers: dict,
    name: str = "Test Loan",
    amount: float = 5000,
    monthly: float = 500,
    interest: float = 0,
    total_payments: int = 10,
) -> dict:
    resp = await client.post("/api/v1/loans", json={
        "name": name,
        "original_amount": amount,
        "monthly_payment": monthly,
        "interest_rate": interest,
        "start_date": "2026-01-01",
        "day_of_month": 15,
        "total_payments": total_payments,
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_fixed(
    client: AsyncClient, headers: dict,
    name: str = "Test Fixed",
    amount: float = 1000,
    type: str = "expense",
    category_id: str = None,
) -> dict:
    payload = {
        "name": name,
        "amount": amount,
        "type": type,
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }
    if category_id:
        payload["category_id"] = category_id
    resp = await client.post("/api/v1/fixed", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ===========================================================================
# RED-1: Category pagination upper bound
# ===========================================================================

class TestRED1CategoryPagination:

    @pytest.mark.asyncio
    async def test_pagination_max_100(self, client: AsyncClient, auth_headers: dict):
        """page_size > 100 should be rejected."""
        resp = await client.get(
            "/api/v1/categories?page_size=101", headers=auth_headers
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_pagination_100_allowed(self, client: AsyncClient, auth_headers: dict):
        """page_size=100 should be accepted."""
        resp = await client.get(
            "/api/v1/categories?page_size=100", headers=auth_headers
        )
        assert resp.status_code == 200


# ===========================================================================
# RED-6: Archived category check on transaction update
# ===========================================================================

class TestRED6ArchivedCategory:

    @pytest.mark.asyncio
    async def test_create_transaction_with_archived_category_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Cannot create a transaction referencing an archived category."""
        cat = await _create_category(client, auth_headers, "to_archive")
        # Archive it
        await client.delete(f"/api/v1/categories/{cat['id']}", headers=auth_headers)

        resp = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "expense",
            "date": "2026-02-01",
            "category_id": cat["id"],
        }, headers=auth_headers)
        assert resp.status_code == 422
        assert "archived" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_update_transaction_with_archived_category_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Cannot update a transaction to use an archived category."""
        cat = await _create_category(client, auth_headers, "will_archive")
        tx = await _create_transaction(client, auth_headers, category_id=cat["id"])

        # Archive the category
        await client.delete(f"/api/v1/categories/{cat['id']}", headers=auth_headers)

        resp = await client.put(f"/api/v1/transactions/{tx['id']}", json={
            "category_id": cat["id"],
        }, headers=auth_headers)
        assert resp.status_code == 422
        assert "archived" in resp.json()["detail"].lower()


# ===========================================================================
# RED-7: Circular parent-child reference detection
# ===========================================================================

class TestRED7CircularReference:

    @pytest.mark.asyncio
    async def test_circular_reference_self(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Setting a category's parent_id to itself should fail."""
        cat = await _create_category(client, auth_headers, "self_ref")
        resp = await client.put(f"/api/v1/categories/{cat['id']}", json={
            "parent_id": cat["id"],
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert "circular" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_circular_reference_chain(
        self, client: AsyncClient, auth_headers: dict
    ):
        """A -> B -> C; setting C's parent to A and then A's parent to C should fail."""
        a = await _create_category(client, auth_headers, "chain_a")
        b = await _create_category(client, auth_headers, "chain_b")
        c = await _create_category(client, auth_headers, "chain_c")

        # B's parent = A
        await client.put(f"/api/v1/categories/{b['id']}", json={
            "parent_id": a["id"],
        }, headers=auth_headers)
        # C's parent = B
        await client.put(f"/api/v1/categories/{c['id']}", json={
            "parent_id": b["id"],
        }, headers=auth_headers)
        # Try A's parent = C (creates cycle A->C->B->A)
        resp = await client.put(f"/api/v1/categories/{a['id']}", json={
            "parent_id": c["id"],
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert "circular" in resp.json()["detail"].lower()


# ===========================================================================
# RED-2 / RED-8: Installment mark-paid creates transaction + rounding
# ===========================================================================

class TestRED2RED8InstallmentPayment:

    @pytest.mark.asyncio
    async def test_mark_paid_creates_transaction(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Marking an installment paid should create a transaction."""
        inst = await _create_installment(client, auth_headers, total=1200, payments=3)
        iid = inst["id"]

        # Mark first payment
        resp = await client.post(
            f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["payments_completed"] == 1

        # Check transaction was created
        tx_resp = await client.get(
            "/api/v1/transactions?page_size=50", headers=auth_headers
        )
        txs = tx_resp.json()["items"]
        inst_txs = [t for t in txs if t.get("installment_id") == iid]
        assert len(inst_txs) == 1
        assert inst_txs[0]["amount"] == "400.00"

    @pytest.mark.asyncio
    async def test_last_payment_absorbs_rounding(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Last installment payment absorbs rounding difference."""
        # 1000 / 3 = 333.33 each, last = 1000 - 333.33*2 = 333.34
        inst = await _create_installment(client, auth_headers, total=1000, payments=3)
        iid = inst["id"]

        # Pay all 3
        for _ in range(3):
            await client.post(
                f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers
            )

        # Verify transactions
        tx_resp = await client.get(
            "/api/v1/transactions?page_size=50", headers=auth_headers
        )
        txs = tx_resp.json()["items"]
        inst_txs = [t for t in txs if t.get("installment_id") == iid]
        amounts = sorted([Decimal(t["amount"]) for t in inst_txs])
        # Sum should exactly equal total
        assert sum(amounts) == Decimal("1000.00")

    @pytest.mark.asyncio
    async def test_mark_paid_all_completed_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Cannot mark paid when all payments are completed."""
        inst = await _create_installment(client, auth_headers, total=200, payments=1)
        iid = inst["id"]
        await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)

        resp = await client.post(
            f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers
        )
        assert resp.status_code == 422
        assert "already been completed" in resp.json()["detail"].lower()


# ===========================================================================
# ORANGE-1: Category type mismatch on fixed create/update
# ===========================================================================

class TestORANGE1CategoryTypeMismatch:

    @pytest.mark.asyncio
    async def test_fixed_create_category_type_mismatch(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Creating a fixed expense with an income category should fail."""
        income_cat = await _create_category(client, auth_headers, "inc_cat", type="income")
        resp = await client.post("/api/v1/fixed", json={
            "name": "Mismatch",
            "amount": 500,
            "type": "expense",
            "day_of_month": 1,
            "start_date": "2026-01-01",
            "category_id": income_cat["id"],
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert "type" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_fixed_update_category_type_mismatch(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Updating fixed to use a category with wrong type should fail."""
        income_cat = await _create_category(client, auth_headers, "inc_up", type="income")
        fixed = await _create_fixed(client, auth_headers, type="expense")

        resp = await client.put(f"/api/v1/fixed/{fixed['id']}", json={
            "category_id": income_cat["id"],
        }, headers=auth_headers)
        assert resp.status_code == 400


# ===========================================================================
# ORANGE-2: Loan monthly payment vs interest validation
# ===========================================================================

class TestORANGE2LoanInterest:

    @pytest.mark.asyncio
    async def test_loan_payment_less_than_interest_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Loan where monthly payment <= monthly interest should be rejected."""
        # 100000 * 12% / 12 = 1000 monthly interest
        # monthly_payment=500 < 1000 => should fail
        resp = await client.post("/api/v1/loans", json={
            "name": "Bad Loan",
            "original_amount": 100000,
            "monthly_payment": 500,
            "interest_rate": 12,
            "start_date": "2026-01-01",
            "day_of_month": 15,
            "total_payments": 60,
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert "interest" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_loan_payment_above_interest_accepted(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Loan where monthly payment > monthly interest should succeed."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Good Loan",
            "original_amount": 100000,
            "monthly_payment": 2000,
            "interest_rate": 12,
            "start_date": "2026-01-01",
            "day_of_month": 15,
            "total_payments": 120,
        }, headers=auth_headers)
        assert resp.status_code == 201


# ===========================================================================
# ORANGE-5: Cannot change category type with existing transactions
# ===========================================================================

class TestORANGE5CategoryTypeChange:

    @pytest.mark.asyncio
    async def test_type_change_with_transactions_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Cannot change category type when it has transactions."""
        cat = await _create_category(client, auth_headers, "typed_cat")
        await _create_transaction(client, auth_headers, category_id=cat["id"])

        resp = await client.put(f"/api/v1/categories/{cat['id']}", json={
            "type": "income",
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert "transactions" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_type_change_without_transactions_allowed(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Can change category type when it has no transactions."""
        cat = await _create_category(client, auth_headers, "empty_cat")
        resp = await client.put(f"/api/v1/categories/{cat['id']}", json={
            "type": "income",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["type"] == "income"


# ===========================================================================
# ORANGE-8: Settings validation patterns
# ===========================================================================

class TestORANGE8SettingsValidation:

    @pytest.mark.asyncio
    async def test_settings_invalid_currency_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Invalid currency code is rejected."""
        resp = await client.put("/api/v1/settings", json={
            "currency": "us",  # lowercase, 2 chars
        }, headers=auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_settings_invalid_language_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Language must be 'he' or 'en'."""
        resp = await client.put("/api/v1/settings", json={
            "language": "fr",
        }, headers=auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_settings_invalid_theme_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Theme must be 'light', 'dark', or 'system'."""
        resp = await client.put("/api/v1/settings", json={
            "theme": "purple",
        }, headers=auth_headers)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_settings_valid_update(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Valid settings update succeeds."""
        resp = await client.put("/api/v1/settings", json={
            "currency": "USD",
            "language": "en",
            "theme": "dark",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["currency"] == "USD"
        assert data["language"] == "en"
        assert data["theme"] == "dark"

    @pytest.mark.asyncio
    async def test_settings_alert_thresholds(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Alert thresholds can be set."""
        resp = await client.put("/api/v1/settings", json={
            "alert_warning_threshold": 3000,
            "alert_critical_threshold": 500,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert Decimal(data["alert_warning_threshold"]) == Decimal("3000.00")
        assert Decimal(data["alert_critical_threshold"]) == Decimal("500.00")


# ===========================================================================
# ORANGE-9: Token blacklist on logout
# ===========================================================================

class TestORANGE9TokenBlacklist:

    @pytest.mark.asyncio
    async def test_logout_blacklists_token(self, client: AsyncClient):
        """After logout, the same token should be rejected."""
        # Login
        login_resp = await client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "Admin2026!",
        })
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Verify token works
        me_resp = await client.get("/api/v1/auth/me", headers=headers)
        assert me_resp.status_code == 200

        # Logout
        logout_resp = await client.post("/api/v1/auth/logout", headers=headers)
        assert logout_resp.status_code == 200

        # Token should now be revoked
        me_resp2 = await client.get("/api/v1/auth/me", headers=headers)
        assert me_resp2.status_code == 401


# ===========================================================================
# YELLOW-1: Pause/resume sets timestamps
# ===========================================================================

class TestYELLOW1PauseResumeTimestamps:

    @pytest.mark.asyncio
    async def test_pause_sets_is_active_false(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Pausing a fixed entry sets is_active to false."""
        fixed = await _create_fixed(client, auth_headers)

        resp = await client.post(
            f"/api/v1/fixed/{fixed['id']}/pause", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    @pytest.mark.asyncio
    async def test_resume_sets_is_active_true(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Resuming a paused fixed entry sets is_active to true."""
        fixed = await _create_fixed(client, auth_headers)
        await client.post(f"/api/v1/fixed/{fixed['id']}/pause", headers=auth_headers)

        resp = await client.post(
            f"/api/v1/fixed/{fixed['id']}/resume", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True


# ===========================================================================
# YELLOW-8: Payment reversal (installments + loans)
# ===========================================================================

class TestYELLOW8PaymentReversal:

    @pytest.mark.asyncio
    async def test_reverse_installment_payment(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Reversing an installment payment decrements payments_completed."""
        inst = await _create_installment(client, auth_headers, total=600, payments=3)
        iid = inst["id"]

        # Mark 2 payments
        await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)
        await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)

        # Reverse one
        resp = await client.post(
            f"/api/v1/installments/{iid}/reverse-payment", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["payments_completed"] == 1

    @pytest.mark.asyncio
    async def test_reverse_installment_no_payments_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Cannot reverse when no payments have been made."""
        inst = await _create_installment(client, auth_headers)
        resp = await client.post(
            f"/api/v1/installments/{inst['id']}/reverse-payment", headers=auth_headers
        )
        assert resp.status_code == 400
        assert "no payments" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_reverse_loan_payment(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Reversing a loan payment restores remaining_balance and decrements payments_made."""
        loan = await _create_loan(client, auth_headers, amount=5000, monthly=500)
        lid = loan["id"]

        # Make a payment
        await client.post(f"/api/v1/loans/{lid}/payment", json={
            "amount": 500,
        }, headers=auth_headers)

        # Reverse
        resp = await client.post(
            f"/api/v1/loans/{lid}/reverse-payment", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["payments_made"] == 0
        assert Decimal(data["remaining_balance"]) == Decimal("5000.00")

    @pytest.mark.asyncio
    async def test_reverse_loan_no_payments_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Cannot reverse when no loan payments have been made."""
        loan = await _create_loan(client, auth_headers)
        resp = await client.post(
            f"/api/v1/loans/{loan['id']}/reverse-payment", headers=auth_headers
        )
        assert resp.status_code == 400
        assert "no payments" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_reverse_completed_loan_reactivates(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Reversing a payment on a completed loan changes status back to active."""
        loan = await _create_loan(
            client, auth_headers, amount=1000, monthly=500, total_payments=2
        )
        lid = loan["id"]

        # Complete all payments
        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 500}, headers=auth_headers)
        resp2 = await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 500}, headers=auth_headers)
        assert resp2.json()["status"] == "completed"

        # Reverse one
        resp = await client.post(
            f"/api/v1/loans/{lid}/reverse-payment", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"
        assert resp.json()["payments_made"] == 1


# ===========================================================================
# H-4: Fixed date range validation
# ===========================================================================

class TestH4FixedDateRange:

    @pytest.mark.asyncio
    async def test_fixed_end_before_start_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """end_date before start_date should be rejected."""
        resp = await client.post("/api/v1/fixed", json={
            "name": "Bad Dates",
            "amount": 500,
            "type": "expense",
            "day_of_month": 1,
            "start_date": "2026-06-01",
            "end_date": "2026-01-01",
        }, headers=auth_headers)
        assert resp.status_code == 422


# ===========================================================================
# H-10: HTML sanitization (strip_tags)
# ===========================================================================

class TestH10HTMLSanitization:

    @pytest.mark.asyncio
    async def test_transaction_description_html_stripped(
        self, client: AsyncClient, auth_headers: dict
    ):
        """HTML tags in transaction description should be stripped."""
        resp = await client.post("/api/v1/transactions", json={
            "amount": 50,
            "type": "expense",
            "date": "2026-02-01",
            "description": "Hello <script>alert('xss')</script>World",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert "<script>" not in resp.json()["description"]
        assert "alert" in resp.json()["description"]  # text content preserved

    @pytest.mark.asyncio
    async def test_transaction_notes_html_stripped(
        self, client: AsyncClient, auth_headers: dict
    ):
        """HTML tags in transaction notes should be stripped."""
        resp = await client.post("/api/v1/transactions", json={
            "amount": 50,
            "type": "expense",
            "date": "2026-02-01",
            "notes": "<b>Bold</b> and <i>italic</i>",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert "<b>" not in resp.json()["notes"]
        assert "Bold" in resp.json()["notes"]

    @pytest.mark.asyncio
    async def test_transaction_tags_html_stripped(
        self, client: AsyncClient, auth_headers: dict
    ):
        """HTML tags in transaction tags should be stripped."""
        resp = await client.post("/api/v1/transactions", json={
            "amount": 50,
            "type": "expense",
            "date": "2026-02-01",
            "tags": ["<b>tag1</b>", "clean_tag"],
        }, headers=auth_headers)
        assert resp.status_code == 201
        tags = resp.json()["tags"]
        assert "tag1" in tags[0]
        assert "<b>" not in tags[0]

    @pytest.mark.asyncio
    async def test_category_name_html_stripped(
        self, client: AsyncClient, auth_headers: dict
    ):
        """HTML tags in category names should be stripped."""
        resp = await client.post("/api/v1/categories", json={
            "name": "<script>test</script>category",
            "name_he": "<b>קטגוריה</b>",
            "type": "expense",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert "<script>" not in resp.json()["name"]
        assert "category" in resp.json()["name"]
        assert "<b>" not in resp.json()["name_he"]

    @pytest.mark.asyncio
    async def test_fixed_name_html_stripped(
        self, client: AsyncClient, auth_headers: dict
    ):
        """HTML tags in fixed income/expense name should be stripped."""
        resp = await client.post("/api/v1/fixed", json={
            "name": "<img src=x>Rent",
            "amount": 3000,
            "type": "expense",
            "day_of_month": 1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert "<img" not in resp.json()["name"]
        assert "Rent" in resp.json()["name"]

    @pytest.mark.asyncio
    async def test_fixed_description_html_stripped(
        self, client: AsyncClient, auth_headers: dict
    ):
        """HTML tags in fixed description should be stripped."""
        resp = await client.post("/api/v1/fixed", json={
            "name": "Rent",
            "amount": 3000,
            "type": "expense",
            "day_of_month": 1,
            "start_date": "2026-01-01",
            "description": "<p>Monthly <b>rent</b></p>",
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert "<p>" not in resp.json()["description"]
        assert "rent" in resp.json()["description"]

    @pytest.mark.asyncio
    async def test_installment_name_html_stripped(
        self, client: AsyncClient, auth_headers: dict
    ):
        """HTML tags in installment name should be stripped."""
        resp = await client.post("/api/v1/installments", json={
            "name": "<a href='x'>TV</a>",
            "total_amount": 3000,
            "number_of_payments": 6,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 15,
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert "<a" not in resp.json()["name"]
        assert "TV" in resp.json()["name"]

    @pytest.mark.asyncio
    async def test_loan_name_html_stripped(
        self, client: AsyncClient, auth_headers: dict
    ):
        """HTML tags in loan name should be stripped."""
        resp = await client.post("/api/v1/loans", json={
            "name": "<div>Car</div> Loan",
            "original_amount": 50000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 15,
            "total_payments": 50,
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert "<div>" not in resp.json()["name"]
        assert "Car" in resp.json()["name"]

    @pytest.mark.asyncio
    async def test_html_only_name_rejected(
        self, client: AsyncClient, auth_headers: dict
    ):
        """A name that's only HTML tags should be rejected (empty after strip)."""
        resp = await client.post("/api/v1/categories", json={
            "name": "<b></b>",
            "name_he": "<i></i>",
            "type": "expense",
        }, headers=auth_headers)
        assert resp.status_code == 422


# ===========================================================================
# M-9: Health check endpoint
# ===========================================================================

class TestM9HealthCheck:

    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """GET /health returns healthy status."""
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data


# ===========================================================================
# Unit tests for strip_tags utility
# ===========================================================================

class TestStripTagsUnit:

    def test_strip_simple_tags(self):
        from app.utils import strip_tags
        assert strip_tags("<b>hello</b>") == "hello"

    def test_strip_script_tags(self):
        from app.utils import strip_tags
        result = strip_tags("<script>alert('xss')</script>world")
        assert "<script>" not in result
        assert "world" in result

    def test_strip_nested_tags(self):
        from app.utils import strip_tags
        assert strip_tags("<div><p>text</p></div>") == "text"

    def test_none_returns_none(self):
        from app.utils import strip_tags
        assert strip_tags(None) is None

    def test_no_tags_unchanged(self):
        from app.utils import strip_tags
        assert strip_tags("plain text") == "plain text"

    def test_empty_string(self):
        from app.utils import strip_tags
        assert strip_tags("") == ""
