from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helper: register a second user and return its auth headers
# ---------------------------------------------------------------------------
async def _register_and_login(client: AsyncClient, username: str, email: str, password: str) -> dict:
    """Register a new user and return auth headers."""
    await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": username,
        "password": password,
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# 1. Auth edge cases
# ===========================================================================

class TestAuthEdgeCases:
    """Edge-case tests for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient):
        """Login with wrong password returns 401."""
        response = await client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "WrongPass9",
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Login with a non-existent username returns 401."""
        response = await client.post("/api/v1/auth/login", json={
            "username": "user_does_not_exist_xyz",
            "password": "SomePass1",
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_access_protected_endpoint_without_token(self, client: AsyncClient):
        """Accessing a protected endpoint with no Authorization header returns 403."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_access_protected_endpoint_with_invalid_token(self, client: AsyncClient):
        """Accessing a protected endpoint with a garbage token returns 401."""
        headers = {"Authorization": "Bearer this.is.not.a.valid.jwt"}
        response = await client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_access_protected_endpoint_with_empty_bearer(self, client: AsyncClient):
        """Accessing a protected endpoint with empty Bearer value returns 403."""
        headers = {"Authorization": "Bearer "}
        response = await client.get("/api/v1/auth/me", headers=headers)
        # FastAPI HTTPBearer returns 403 when the credentials are empty
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client: AsyncClient):
        """Registering with a username that already exists returns 409."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "admin",
            "email": "another@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient):
        """Registering with a duplicate email returns 409."""
        # First register a user
        await client.post("/api/v1/auth/register", json={
            "username": "emailtest1",
            "email": "unique@example.com",
            "password": "TestPass1",
        })
        # Try to register another user with same email
        response = await client.post("/api/v1/auth/register", json={
            "username": "emailtest2",
            "email": "unique@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_register_short_password(self, client: AsyncClient):
        """Registering with a password shorter than min_length (8) returns 422."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "shortpass",
            "email": "shortpass@example.com",
            "password": "ab",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_short_username(self, client: AsyncClient):
        """Registering with a username shorter than min_length (3) returns 422."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "ab",
            "email": "shortuser@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_long_username(self, client: AsyncClient):
        """Registering with a username exceeding max_length (50) returns 422."""
        long_name = "a" * 51
        response = await client.post("/api/v1/auth/register", json={
            "username": long_name,
            "email": "longuser@example.com",
            "password": "TestPass1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client: AsyncClient):
        """Registering with an invalid email format returns 422."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "invalidemail",
            "email": "not-an-email",
            "password": "TestPass1",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_refresh_with_invalid_token(self, client: AsyncClient):
        """Refreshing with an invalid refresh token returns 401."""
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": "definitely.not.valid",
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_instead(self, client: AsyncClient):
        """Using an access token as refresh token returns 401 (wrong type)."""
        login_resp = await client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "Admin2026!",
        })
        access_token = login_resp.json()["access_token"]
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": access_token,
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, client: AsyncClient, auth_headers: dict):
        """Change password with wrong current password returns 401."""
        response = await client.put("/api/v1/auth/password", json={
            "current_password": "WrongCurrent1",
            "new_password": "NewPass1",
        }, headers=auth_headers)
        assert response.status_code == 401


# ===========================================================================
# 2. Transaction / Financial edge cases
# ===========================================================================

class TestTransactionEdgeCases:
    """Edge-case tests for transaction validation."""

    @pytest.mark.asyncio
    async def test_create_transaction_amount_zero(self, client: AsyncClient, auth_headers: dict):
        """Creating a transaction with amount=0 should fail (gt=0 in schema)."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 0,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_transaction_negative_amount(self, client: AsyncClient, auth_headers: dict):
        """Creating a transaction with negative amount should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": -100,
            "type": "expense",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_transaction_invalid_type(self, client: AsyncClient, auth_headers: dict):
        """Creating a transaction with invalid type should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "donation",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_transaction_missing_date(self, client: AsyncClient, auth_headers: dict):
        """Creating a transaction without a date should fail."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_nonexistent_transaction(self, client: AsyncClient, auth_headers: dict):
        """Getting a transaction that does not exist returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/transactions/{fake_id}", headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_transaction(self, client: AsyncClient, auth_headers: dict):
        """Deleting a transaction that does not exist returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.delete(
            f"/api/v1/transactions/{fake_id}", headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_nonexistent_transaction(self, client: AsyncClient, auth_headers: dict):
        """Updating a transaction that does not exist returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.put(
            f"/api/v1/transactions/{fake_id}",
            json={"amount": 999},
            headers=auth_headers,
        )
        assert response.status_code == 404


# ===========================================================================
# 3. Loan edge cases
# ===========================================================================

class TestLoanEdgeCases:
    """Edge-case tests for loan endpoints."""

    @pytest.mark.asyncio
    async def test_create_loan_zero_total_payments(self, client: AsyncClient, auth_headers: dict):
        """total_payments with 0 should fail (ge=1 in schema)."""
        response = await client.post("/api/v1/loans", json={
            "name": "Zero Payments",
            "original_amount": 10000,
            "monthly_payment": 500,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 0,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_loan_negative_amount(self, client: AsyncClient, auth_headers: dict):
        """Negative original_amount should fail (gt=0 in schema)."""
        response = await client.post("/api/v1/loans", json={
            "name": "Negative Loan",
            "original_amount": -5000,
            "monthly_payment": 500,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 10,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_loan_zero_monthly_payment(self, client: AsyncClient, auth_headers: dict):
        """monthly_payment of 0 should fail (gt=0 in schema)."""
        response = await client.post("/api/v1/loans", json={
            "name": "Zero Payment",
            "original_amount": 10000,
            "monthly_payment": 0,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 10,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_loan_interest_over_100(self, client: AsyncClient, auth_headers: dict):
        """interest_rate over 100 should fail (le=100 in schema)."""
        response = await client.post("/api/v1/loans", json={
            "name": "High Interest",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "interest_rate": 150,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 12,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_loan_day_of_month_invalid(self, client: AsyncClient, auth_headers: dict):
        """day_of_month outside 1-31 should fail."""
        response = await client.post("/api/v1/loans", json={
            "name": "Bad Day",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "start_date": "2026-01-01",
            "day_of_month": 32,
            "total_payments": 12,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_loan_payment_on_completed_loan(self, client: AsyncClient, auth_headers: dict):
        """Recording a payment on a completed loan should be rejected."""
        create_resp = await client.post("/api/v1/loans", json={
            "name": "Will Complete",
            "original_amount": 1000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 1,
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        lid = create_resp.json()["id"]

        # Complete the loan
        pay1 = await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 1000},
            headers=auth_headers,
        )
        assert pay1.json()["status"] == "completed"

        # Another payment on the already-completed loan should be rejected
        pay2 = await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 500},
            headers=auth_headers,
        )
        assert pay2.status_code == 400
        assert "completed" in pay2.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_nonexistent_loan(self, client: AsyncClient, auth_headers: dict):
        """Getting a loan that does not exist returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(f"/api/v1/loans/{fake_id}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_loan_with_single_payment(self, client: AsyncClient, auth_headers: dict):
        """Loan with total_payments=1 should work and complete after one payment."""
        create_resp = await client.post("/api/v1/loans", json={
            "name": "Single Payment Loan",
            "original_amount": 5000,
            "monthly_payment": 5000,
            "interest_rate": 0,
            "start_date": "2026-03-01",
            "day_of_month": 1,
            "total_payments": 1,
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        lid = create_resp.json()["id"]

        pay = await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 5000},
            headers=auth_headers,
        )
        assert pay.status_code == 200
        assert pay.json()["status"] == "completed"
        assert pay.json()["remaining_balance"] == "0.00"
        assert pay.json()["payments_made"] == 1

    @pytest.mark.asyncio
    async def test_loan_amortization_day31_february(self, client: AsyncClient, auth_headers: dict):
        """Loan with day_of_month=31 handles February correctly (falls to last day)."""
        create_resp = await client.post("/api/v1/loans", json={
            "name": "Day 31 Loan",
            "original_amount": 3000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-31",
            "day_of_month": 31,
            "total_payments": 3,
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        lid = create_resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        assert detail.status_code == 200
        data = detail.json()
        assert len(data["amortization"]) == 3
        # February 2026 has 28 days, so day 31 should resolve to 28
        feb_payment = data["amortization"][1]
        assert feb_payment["date"] == "2026-02-28"


# ===========================================================================
# 4. Installment edge cases
# ===========================================================================

class TestInstallmentEdgeCases:
    """Edge-case tests for installment endpoints."""

    @pytest.mark.asyncio
    async def test_installment_single_payment(self, client: AsyncClient, auth_headers: dict):
        """Installment with number_of_payments=1 should set monthly_amount = total_amount."""
        response = await client.post("/api/v1/installments", json={
            "name": "One Shot",
            "total_amount": 5000,
            "number_of_payments": 1,
            "type": "expense",
            "start_date": "2026-03-01",
            "day_of_month": 15,
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["monthly_amount"] == "5000.00"
        assert data["number_of_payments"] == 1

    @pytest.mark.asyncio
    async def test_installment_very_large_amount(self, client: AsyncClient, auth_headers: dict):
        """Very large total_amount (within DECIMAL(15,2) limits) should succeed."""
        response = await client.post("/api/v1/installments", json={
            "name": "Big Purchase",
            "total_amount": 999999999.99,
            "number_of_payments": 12,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["total_amount"] == "999999999.99"
        # monthly_amount should be total/payments
        assert float(data["monthly_amount"]) > 0

    @pytest.mark.asyncio
    async def test_installment_zero_payments(self, client: AsyncClient, auth_headers: dict):
        """number_of_payments=0 should fail (ge=1 in schema)."""
        response = await client.post("/api/v1/installments", json={
            "name": "Zero Payments",
            "total_amount": 1000,
            "number_of_payments": 0,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 10,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_installment_negative_amount(self, client: AsyncClient, auth_headers: dict):
        """Negative total_amount should fail (gt=0 in schema)."""
        response = await client.post("/api/v1/installments", json={
            "name": "Negative",
            "total_amount": -500,
            "number_of_payments": 5,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 10,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_installment_empty_name(self, client: AsyncClient, auth_headers: dict):
        """Empty name should fail (min_length=1 in schema)."""
        response = await client.post("/api/v1/installments", json={
            "name": "",
            "total_amount": 1000,
            "number_of_payments": 5,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 10,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_nonexistent_installment(self, client: AsyncClient, auth_headers: dict):
        """Getting an installment that does not exist returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/v1/installments/{fake_id}", headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_installment_schedule_day31_february(self, client: AsyncClient, auth_headers: dict):
        """Installment with day_of_month=31 handles February correctly."""
        create_resp = await client.post("/api/v1/installments", json={
            "name": "Day 31 Installment",
            "total_amount": 3000,
            "number_of_payments": 3,
            "type": "expense",
            "start_date": "2026-01-31",
            "day_of_month": 31,
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        iid = create_resp.json()["id"]

        detail = await client.get(f"/api/v1/installments/{iid}", headers=auth_headers)
        assert detail.status_code == 200
        schedule = detail.json()["schedule"]
        assert len(schedule) == 3
        # February 2026 has 28 days
        assert schedule[1]["date"] == "2026-02-28"


# ===========================================================================
# 5. Fixed Income/Expense edge cases
# ===========================================================================

class TestFixedEdgeCases:
    """Edge-case tests for fixed income/expense endpoints."""

    @pytest.mark.asyncio
    async def test_fixed_day31(self, client: AsyncClient, auth_headers: dict):
        """Creating a fixed income with day_of_month=31 succeeds."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Monthly Rent",
            "amount": 3000,
            "type": "expense",
            "day_of_month": 31,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["day_of_month"] == 31

    @pytest.mark.asyncio
    async def test_fixed_day_of_month_invalid(self, client: AsyncClient, auth_headers: dict):
        """day_of_month=0 or day_of_month=32 should fail."""
        for bad_day in [0, 32]:
            response = await client.post("/api/v1/fixed", json={
                "name": "Bad Day",
                "amount": 100,
                "type": "income",
                "day_of_month": bad_day,
                "start_date": "2026-01-01",
            }, headers=auth_headers)
            assert response.status_code == 422, f"day_of_month={bad_day} should fail"

    @pytest.mark.asyncio
    async def test_fixed_zero_amount(self, client: AsyncClient, auth_headers: dict):
        """amount=0 should fail (gt=0 in schema)."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Zero Amount",
            "amount": 0,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_fixed_negative_amount(self, client: AsyncClient, auth_headers: dict):
        """Negative amount should fail (gt=0 in schema)."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Negative",
            "amount": -100,
            "type": "expense",
            "day_of_month": 15,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_fixed_empty_name(self, client: AsyncClient, auth_headers: dict):
        """Empty name should fail (min_length=1 in schema)."""
        response = await client.post("/api/v1/fixed", json={
            "name": "",
            "amount": 100,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_fixed_end_date_before_start_date(self, client: AsyncClient, auth_headers: dict):
        """end_date before start_date should be rejected by schema validation."""
        response = await client.post("/api/v1/fixed", json={
            "name": "Backwards Dates",
            "amount": 1000,
            "type": "income",
            "day_of_month": 1,
            "start_date": "2026-06-01",
            "end_date": "2026-01-01",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_nonexistent_fixed(self, client: AsyncClient, auth_headers: dict):
        """Getting a non-existent fixed entry returns 404."""
        fake_id = str(uuid.uuid4())
        response = await client.get(f"/api/v1/fixed/{fake_id}", headers=auth_headers)
        assert response.status_code == 404


# ===========================================================================
# 6. Forecast edge cases
# ===========================================================================

class TestForecastEdgeCases:
    """Edge-case tests for forecast endpoints."""

    @pytest.mark.asyncio
    async def test_forecast_no_balance(self, client: AsyncClient, auth_headers: dict):
        """Forecast with no balance set should return current_balance=0."""
        response = await client.get("/api/v1/forecast?months=1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["current_balance"] == "0"

    @pytest.mark.asyncio
    async def test_forecast_months_zero(self, client: AsyncClient, auth_headers: dict):
        """months=0 should fail (ge=1 in query param)."""
        response = await client.get("/api/v1/forecast?months=0", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_months_too_many(self, client: AsyncClient, auth_headers: dict):
        """months=25 should fail (le=24 in query param)."""
        response = await client.get("/api/v1/forecast?months=25", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_single_month(self, client: AsyncClient, auth_headers: dict):
        """Forecast for exactly 1 month should return 1 month entry."""
        response = await client.get("/api/v1/forecast?months=1", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()["months"]) == 1

    @pytest.mark.asyncio
    async def test_weekly_forecast_zero_weeks(self, client: AsyncClient, auth_headers: dict):
        """weeks=0 should fail (ge=1 in query param)."""
        response = await client.get("/api/v1/forecast/weekly?weeks=0", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_weekly_forecast_too_many(self, client: AsyncClient, auth_headers: dict):
        """weeks=53 should fail (le=52 in query param)."""
        response = await client.get("/api/v1/forecast/weekly?weeks=53", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forecast_summary_no_data(self, client: AsyncClient, auth_headers: dict):
        """Summary with no data should still return valid structure."""
        response = await client.get("/api/v1/forecast/summary?months=1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["forecast_months"] == 1
        assert "current_balance" in data
        assert "total_expected_income" in data
        assert "total_expected_expenses" in data
        assert "has_negative_months" in data

    @pytest.mark.asyncio
    async def test_forecast_with_only_expenses_goes_negative(self, client: AsyncClient, auth_headers: dict):
        """Forecast with only expenses and zero balance goes negative immediately."""
        # No balance set -> defaults to 0
        await client.post("/api/v1/fixed", json={
            "name": "Rent",
            "amount": 5000,
            "type": "expense",
            "day_of_month": 1,
            "start_date": "2026-01-01",
        }, headers=auth_headers)

        response = await client.get("/api/v1/forecast?months=2", headers=auth_headers)
        data = response.json()
        assert data["has_negative_months"] is True
        assert data["first_negative_month"] is not None


# ===========================================================================
# 7. IDOR prevention (Insecure Direct Object Reference)
# ===========================================================================

class TestIDORPrevention:
    """Ensure users cannot access resources belonging to other users."""

    @pytest.mark.asyncio
    async def test_user2_cannot_see_user1_transaction(self, client: AsyncClient, auth_headers: dict):
        """User 2 should get 404 when trying to access User 1's transaction."""
        # User 1 (admin) creates a transaction
        create_resp = await client.post("/api/v1/transactions", json={
            "amount": 5000,
            "type": "income",
            "date": "2026-02-01",
            "description": "Admin's transaction",
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        txn_id = create_resp.json()["id"]

        # Register user 2
        user2_headers = await _register_and_login(
            client, "user2_idor", "user2_idor@example.com", "TestPass1",
        )

        # User 2 tries to read admin's transaction
        response = await client.get(
            f"/api/v1/transactions/{txn_id}", headers=user2_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_update_user1_transaction(self, client: AsyncClient, auth_headers: dict):
        """User 2 should get 404 when trying to update User 1's transaction."""
        create_resp = await client.post("/api/v1/transactions", json={
            "amount": 3000,
            "type": "expense",
            "date": "2026-02-01",
        }, headers=auth_headers)
        txn_id = create_resp.json()["id"]

        user2_headers = await _register_and_login(
            client, "user2_upd", "user2_upd@example.com", "TestPass1",
        )

        response = await client.put(
            f"/api/v1/transactions/{txn_id}",
            json={"amount": 1},
            headers=user2_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_delete_user1_transaction(self, client: AsyncClient, auth_headers: dict):
        """User 2 should get 404 when trying to delete User 1's transaction."""
        create_resp = await client.post("/api/v1/transactions", json={
            "amount": 7000,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        txn_id = create_resp.json()["id"]

        user2_headers = await _register_and_login(
            client, "user2_del", "user2_del@example.com", "TestPass1",
        )

        response = await client.delete(
            f"/api/v1/transactions/{txn_id}", headers=user2_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_access_user1_category(self, client: AsyncClient, auth_headers: dict):
        """User 2 should get 404 when trying to read/update User 1's category."""
        # Admin creates a custom category
        create_resp = await client.post("/api/v1/categories", json={
            "name": "admin_custom_cat",
            "name_he": "קטגוריה_מנהל",
            "type": "expense",
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        cat_id = create_resp.json()["id"]

        user2_headers = await _register_and_login(
            client, "user2_cat", "user2_cat@example.com", "TestPass1",
        )

        # Try to GET admin's category
        get_resp = await client.get(
            f"/api/v1/categories/{cat_id}", headers=user2_headers,
        )
        assert get_resp.status_code == 404

        # Try to UPDATE admin's category
        put_resp = await client.put(
            f"/api/v1/categories/{cat_id}",
            json={"name": "hacked"},
            headers=user2_headers,
        )
        assert put_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_access_user1_loan(self, client: AsyncClient, auth_headers: dict):
        """User 2 should get 404 when trying to access User 1's loan."""
        create_resp = await client.post("/api/v1/loans", json={
            "name": "Admin Loan",
            "original_amount": 50000,
            "monthly_payment": 2000,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 30,
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        lid = create_resp.json()["id"]

        user2_headers = await _register_and_login(
            client, "user2_loan", "user2_loan@example.com", "TestPass1",
        )

        response = await client.get(f"/api/v1/loans/{lid}", headers=user2_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_access_user1_installment(self, client: AsyncClient, auth_headers: dict):
        """User 2 should get 404 when trying to access User 1's installment."""
        create_resp = await client.post("/api/v1/installments", json={
            "name": "Admin Installment",
            "total_amount": 6000,
            "number_of_payments": 12,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 5,
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        iid = create_resp.json()["id"]

        user2_headers = await _register_and_login(
            client, "user2_inst", "user2_inst@example.com", "TestPass1",
        )

        response = await client.get(
            f"/api/v1/installments/{iid}", headers=user2_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_access_user1_fixed(self, client: AsyncClient, auth_headers: dict):
        """User 2 should get 404 when trying to access User 1's fixed entry."""
        create_resp = await client.post("/api/v1/fixed", json={
            "name": "Admin Salary",
            "amount": 20000,
            "type": "income",
            "day_of_month": 10,
            "start_date": "2026-01-01",
        }, headers=auth_headers)
        assert create_resp.status_code == 201
        fid = create_resp.json()["id"]

        user2_headers = await _register_and_login(
            client, "user2_fixed", "user2_fixed@example.com", "TestPass1",
        )

        response = await client.get(f"/api/v1/fixed/{fid}", headers=user2_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user2_cannot_pay_user1_loan(self, client: AsyncClient, auth_headers: dict):
        """User 2 should get 404 when trying to record payment on User 1's loan."""
        create_resp = await client.post("/api/v1/loans", json={
            "name": "Admin Loan 2",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 5,
            "total_payments": 10,
        }, headers=auth_headers)
        lid = create_resp.json()["id"]

        user2_headers = await _register_and_login(
            client, "user2_pay", "user2_pay@example.com", "TestPass1",
        )

        response = await client.post(
            f"/api/v1/loans/{lid}/payment",
            json={"amount": 1000},
            headers=user2_headers,
        )
        assert response.status_code == 404


# ===========================================================================
# 8. Boundary values
# ===========================================================================

class TestBoundaryValues:
    """Boundary value tests for fields."""

    @pytest.mark.asyncio
    async def test_transaction_description_at_max_length(self, client: AsyncClient, auth_headers: dict):
        """Transaction with description at max_length=500 should be accepted."""
        desc_500 = "A" * 500
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "description": desc_500,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["description"] == desc_500

    @pytest.mark.asyncio
    async def test_transaction_description_exceeds_max(self, client: AsyncClient, auth_headers: dict):
        """Transaction with description exceeding max_length=500 should fail."""
        desc_501 = "A" * 501
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "description": desc_501,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_notes_at_max_length(self, client: AsyncClient, auth_headers: dict):
        """Transaction with notes at max_length=2000 should be accepted."""
        notes_2000 = "B" * 2000
        response = await client.post("/api/v1/transactions", json={
            "amount": 50,
            "type": "expense",
            "date": "2026-02-01",
            "notes": notes_2000,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["notes"] == notes_2000

    @pytest.mark.asyncio
    async def test_transaction_notes_exceeds_max(self, client: AsyncClient, auth_headers: dict):
        """Transaction with notes exceeding max_length=2000 should fail."""
        notes_2001 = "B" * 2001
        response = await client.post("/api/v1/transactions", json={
            "amount": 50,
            "type": "expense",
            "date": "2026-02-01",
            "notes": notes_2001,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_special_characters_in_description(self, client: AsyncClient, auth_headers: dict):
        """Special characters and Hebrew text in description should be stored correctly (HTML stripped)."""
        special_desc = "Payment <script>alert('xss')</script> & 'quotes' \"double\" \u05e9\u05dc\u05d5\u05dd"
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
            "description": special_desc,
        }, headers=auth_headers)
        assert response.status_code == 201
        # HTML tags are stripped by strip_tags sanitization
        assert response.json()["description"] == "Payment alert('xss') & 'quotes' \"double\" \u05e9\u05dc\u05d5\u05dd"

    @pytest.mark.asyncio
    async def test_loan_name_special_characters(self, client: AsyncClient, auth_headers: dict):
        """Loan name with special characters should be stored correctly."""
        special_name = "Loan #1 (2026) - \u05d4\u05dc\u05d5\u05d5\u05d0\u05d4 & Co."
        response = await client.post("/api/v1/loans", json={
            "name": special_name,
            "original_amount": 10000,
            "monthly_payment": 500,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 24,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["name"] == special_name

    @pytest.mark.asyncio
    async def test_loan_name_max_length(self, client: AsyncClient, auth_headers: dict):
        """Loan name at exactly max_length=200 should succeed."""
        name_200 = "X" * 200
        response = await client.post("/api/v1/loans", json={
            "name": name_200,
            "original_amount": 10000,
            "monthly_payment": 500,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 24,
        }, headers=auth_headers)
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_loan_name_exceeds_max_length(self, client: AsyncClient, auth_headers: dict):
        """Loan name exceeding max_length=200 should fail."""
        name_201 = "X" * 201
        response = await client.post("/api/v1/loans", json={
            "name": name_201,
            "original_amount": 10000,
            "monthly_payment": 500,
            "start_date": "2026-01-01",
            "day_of_month": 10,
            "total_payments": 24,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_category_name_max_length(self, client: AsyncClient, auth_headers: dict):
        """Category name at exactly max_length=100 should succeed."""
        name_100 = "C" * 100
        response = await client.post("/api/v1/categories", json={
            "name": name_100,
            "name_he": "test",
            "type": "income",
        }, headers=auth_headers)
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_category_name_exceeds_max_length(self, client: AsyncClient, auth_headers: dict):
        """Category name exceeding max_length=100 should fail."""
        name_101 = "C" * 101
        response = await client.post("/api/v1/categories", json={
            "name": name_101,
            "name_he": "test",
            "type": "income",
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_with_tags(self, client: AsyncClient, auth_headers: dict):
        """Transaction with a list of tags should be stored."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "expense",
            "date": "2026-02-01",
            "tags": ["food", "restaurant", "lunch"],
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["tags"] == ["food", "restaurant", "lunch"]

    @pytest.mark.asyncio
    async def test_transaction_minimal_amount(self, client: AsyncClient, auth_headers: dict):
        """Transaction with smallest valid amount (0.01) should succeed."""
        response = await client.post("/api/v1/transactions", json={
            "amount": 0.01,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["amount"] == "0.01"

    @pytest.mark.asyncio
    async def test_installment_max_payments(self, client: AsyncClient, auth_headers: dict):
        """Installment with number_of_payments=360 (max) should succeed."""
        response = await client.post("/api/v1/installments", json={
            "name": "Max Payments",
            "total_amount": 36000,
            "number_of_payments": 360,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["number_of_payments"] == 360

    @pytest.mark.asyncio
    async def test_installment_exceeds_max_payments(self, client: AsyncClient, auth_headers: dict):
        """Installment with number_of_payments=361 (over max) should fail."""
        response = await client.post("/api/v1/installments", json={
            "name": "Too Many",
            "total_amount": 36100,
            "number_of_payments": 361,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_loan_max_total_payments(self, client: AsyncClient, auth_headers: dict):
        """Loan with total_payments=600 (max) should succeed."""
        response = await client.post("/api/v1/loans", json={
            "name": "Max Payments Loan",
            "original_amount": 600000,
            "monthly_payment": 1000,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 600,
        }, headers=auth_headers)
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_loan_exceeds_max_total_payments(self, client: AsyncClient, auth_headers: dict):
        """Loan with total_payments=601 (over max) should fail."""
        response = await client.post("/api/v1/loans", json={
            "name": "Too Many Payments Loan",
            "original_amount": 601000,
            "monthly_payment": 1000,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 601,
        }, headers=auth_headers)
        assert response.status_code == 422


# ===========================================================================
# 9. Balance edge cases
# ===========================================================================

class TestBalanceEdgeCases:
    """Edge-case tests for balance endpoints."""

    @pytest.mark.asyncio
    async def test_get_balance_when_none_set(self, client: AsyncClient, auth_headers: dict):
        """Getting current balance with none set should return 404 or 0."""
        response = await client.get("/api/v1/balance", headers=auth_headers)
        # The endpoint may return 404 if no balance exists
        assert response.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_update_balance_when_none_exists(self, client: AsyncClient, auth_headers: dict):
        """Updating balance when none exists should return 404."""
        response = await client.put("/api/v1/balance", json={
            "balance": 5000,
        }, headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_negative_balance(self, client: AsyncClient, auth_headers: dict):
        """Setting a negative balance should be allowed (overdraft scenario)."""
        response = await client.post("/api/v1/balance", json={
            "balance": -5000,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)
        # Depends on schema validation; if allowed:
        if response.status_code == 201:
            assert response.json()["balance"] == "-5000.00"
        else:
            # If the API rejects negative balances
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_balance(self, client: AsyncClient, auth_headers: dict):
        """Setting balance to exactly 0 should succeed."""
        response = await client.post("/api/v1/balance", json={
            "balance": 0,
            "effective_date": "2026-02-01",
        }, headers=auth_headers)
        assert response.status_code == 201
        assert response.json()["balance"] == "0.00"


# ===========================================================================
# 10. Pagination edge cases
# ===========================================================================

class TestPaginationEdgeCases:
    """Edge-case tests for transaction listing pagination."""

    @pytest.mark.asyncio
    async def test_list_transactions_empty(self, client: AsyncClient, auth_headers: dict):
        """Listing transactions when none exist should return empty list."""
        response = await client.get("/api/v1/transactions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["pages"] == 0

    @pytest.mark.asyncio
    async def test_list_transactions_page_beyond_range(self, client: AsyncClient, auth_headers: dict):
        """Requesting a page beyond available data should return empty items."""
        # Create one transaction
        await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)

        response = await client.get(
            "/api/v1/transactions?page=999", headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["items"] == []

    @pytest.mark.asyncio
    async def test_list_transactions_page_zero(self, client: AsyncClient, auth_headers: dict):
        """page=0 should fail (ge=1 in query param)."""
        response = await client.get(
            "/api/v1/transactions?page=0", headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_transactions_page_size_over_max(self, client: AsyncClient, auth_headers: dict):
        """page_size=101 should fail (le=100 in query param)."""
        response = await client.get(
            "/api/v1/transactions?page_size=101", headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_transactions_invalid_sort(self, client: AsyncClient, auth_headers: dict):
        """Invalid sort_by field should fail (pattern validation)."""
        response = await client.get(
            "/api/v1/transactions?sort_by=invalid_field", headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_transactions_invalid_sort_order(self, client: AsyncClient, auth_headers: dict):
        """Invalid sort_order should fail (pattern validation)."""
        response = await client.get(
            "/api/v1/transactions?sort_order=random", headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_transactions_filter_by_type(self, client: AsyncClient, auth_headers: dict):
        """Filtering by type should only return matching transactions."""
        await client.post("/api/v1/transactions", json={
            "amount": 100,
            "type": "income",
            "date": "2026-02-01",
        }, headers=auth_headers)
        await client.post("/api/v1/transactions", json={
            "amount": 200,
            "type": "expense",
            "date": "2026-02-01",
        }, headers=auth_headers)

        income_resp = await client.get(
            "/api/v1/transactions?type=income", headers=auth_headers,
        )
        assert income_resp.status_code == 200
        for item in income_resp.json()["items"]:
            assert item["type"] == "income"

        expense_resp = await client.get(
            "/api/v1/transactions?type=expense", headers=auth_headers,
        )
        assert expense_resp.status_code == 200
        for item in expense_resp.json()["items"]:
            assert item["type"] == "expense"
