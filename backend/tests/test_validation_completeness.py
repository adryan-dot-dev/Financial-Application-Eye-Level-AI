from __future__ import annotations

"""
Step 7: API Validation Completeness Tests
Tests for schema validation, field constraints, and response consistency.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_expense_category(client: AsyncClient, headers: dict) -> str:
    r = await client.get("/api/v1/categories?type=expense", headers=headers)
    return r.json()["items"][0]["id"]


async def _get_income_category(client: AsyncClient, headers: dict) -> str:
    r = await client.get("/api/v1/categories?type=income", headers=headers)
    return r.json()["items"][0]["id"]


# ---------------------------------------------------------------------------
# Transaction Validation
# ---------------------------------------------------------------------------

class TestTransactionValidation:

    @pytest.mark.asyncio
    async def test_transaction_amount_zero_rejected(self, client: AsyncClient, auth_headers: dict):
        """Transaction amount must be > 0."""
        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "0", "type": "expense",
            "description": "Zero amount", "date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_negative_amount_rejected(self, client: AsyncClient, auth_headers: dict):
        """Transaction amount cannot be negative."""
        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "-100.00", "type": "expense",
            "description": "Negative", "date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_invalid_type_rejected(self, client: AsyncClient, auth_headers: dict):
        """Transaction type must be 'income' or 'expense'."""
        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "100.00", "type": "transfer",
            "description": "Invalid type", "date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_max_amount(self, client: AsyncClient, auth_headers: dict):
        """Transaction amount at max precision boundary."""
        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "9999999999999.99", "type": "expense",
            "description": "Max amount", "date": date.today().isoformat(),
        })
        assert r.status_code == 201

    @pytest.mark.asyncio
    async def test_transaction_over_max_amount_rejected(self, client: AsyncClient, auth_headers: dict):
        """Amount exceeding DECIMAL(15,2) range should be rejected."""
        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "99999999999999.99", "type": "expense",
            "description": "Over max", "date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_category_type_mismatch_rejected(self, client: AsyncClient, auth_headers: dict):
        """Income category with expense transaction should be rejected."""
        cat_id = await _get_income_category(client, auth_headers)
        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "100.00", "type": "expense",
            "category_id": cat_id,
            "description": "Type mismatch", "date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_date_range_start_after_end(self, client: AsyncClient, auth_headers: dict):
        """Filtering with start_date > end_date should return error."""
        r = await client.get(
            "/api/v1/transactions?start_date=2026-02-20&end_date=2026-02-10",
            headers=auth_headers,
        )
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_transaction_list_response_format(self, client: AsyncClient, auth_headers: dict):
        """List endpoint should return standard paginated response."""
        r = await client.get("/api/v1/transactions", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert "total" in body
        assert "page" in body
        assert "page_size" in body


# ---------------------------------------------------------------------------
# Fixed Income/Expense Validation
# ---------------------------------------------------------------------------

class TestFixedValidation:

    @pytest.mark.asyncio
    async def test_fixed_end_before_start_rejected(self, client: AsyncClient, auth_headers: dict):
        """end_date before start_date should be rejected."""
        r = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "Bad Dates",
            "amount": "1000.00", "type": "expense",
            "day_of_month": 1,
            "start_date": "2026-06-01", "end_date": "2026-01-01",
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_fixed_zero_amount_rejected(self, client: AsyncClient, auth_headers: dict):
        """Fixed amount must be > 0."""
        r = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "Zero Amount",
            "amount": "0", "type": "expense",
            "day_of_month": 1,
            "start_date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_fixed_day_of_month_boundaries(self, client: AsyncClient, auth_headers: dict):
        """day_of_month must be 1-31."""
        # Day 0
        r = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "Day 0", "amount": "100.00", "type": "expense",
            "day_of_month": 0, "start_date": date.today().isoformat(),
        })
        assert r.status_code == 422

        # Day 32
        r = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "Day 32", "amount": "100.00", "type": "expense",
            "day_of_month": 32, "start_date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_fixed_category_type_mismatch(self, client: AsyncClient, auth_headers: dict):
        """Expense category with income fixed entry should be rejected."""
        cat_id = await _get_expense_category(client, auth_headers)
        r = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "Mismatch", "amount": "100.00", "type": "income",
            "category_id": cat_id,
            "day_of_month": 1, "start_date": date.today().isoformat(),
        })
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Installment Validation
# ---------------------------------------------------------------------------

class TestInstallmentValidation:

    @pytest.mark.asyncio
    async def test_installment_zero_payments_rejected(self, client: AsyncClient, auth_headers: dict):
        """number_of_payments must be >= 1."""
        r = await client.post("/api/v1/installments", headers=auth_headers, json={
            "name": "Zero Payments", "total_amount": "1000.00",
            "number_of_payments": 0, "type": "expense",
            "start_date": date.today().isoformat(), "day_of_month": 15,
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_installment_zero_amount_rejected(self, client: AsyncClient, auth_headers: dict):
        """total_amount must be > 0."""
        r = await client.post("/api/v1/installments", headers=auth_headers, json={
            "name": "Zero Amount", "total_amount": "0",
            "number_of_payments": 5, "type": "expense",
            "start_date": date.today().isoformat(), "day_of_month": 15,
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_installment_negative_amount_rejected(self, client: AsyncClient, auth_headers: dict):
        """total_amount cannot be negative."""
        r = await client.post("/api/v1/installments", headers=auth_headers, json={
            "name": "Negative", "total_amount": "-500.00",
            "number_of_payments": 5, "type": "expense",
            "start_date": date.today().isoformat(), "day_of_month": 15,
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_installment_max_payments(self, client: AsyncClient, auth_headers: dict):
        """number_of_payments max is 360."""
        r = await client.post("/api/v1/installments", headers=auth_headers, json={
            "name": "Max Payments", "total_amount": "36000.00",
            "number_of_payments": 360, "type": "expense",
            "start_date": date.today().isoformat(), "day_of_month": 15,
        })
        assert r.status_code == 201

    @pytest.mark.asyncio
    async def test_installment_over_max_payments_rejected(self, client: AsyncClient, auth_headers: dict):
        """number_of_payments > 360 should be rejected."""
        r = await client.post("/api/v1/installments", headers=auth_headers, json={
            "name": "Too Many", "total_amount": "100000.00",
            "number_of_payments": 361, "type": "expense",
            "start_date": date.today().isoformat(), "day_of_month": 15,
        })
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Loan Validation
# ---------------------------------------------------------------------------

class TestLoanValidation:

    @pytest.mark.asyncio
    async def test_loan_negative_interest_rejected(self, client: AsyncClient, auth_headers: dict):
        """interest_rate must be >= 0."""
        r = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Negative Interest", "original_amount": "10000.00",
            "monthly_payment": "1000.00", "interest_rate": "-5",
            "start_date": date.today().isoformat(), "day_of_month": 10,
            "total_payments": 10,
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_loan_zero_interest_allowed(self, client: AsyncClient, auth_headers: dict):
        """0% interest should be allowed."""
        r = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Zero Interest", "original_amount": "5000.00",
            "monthly_payment": "500.00", "interest_rate": "0",
            "start_date": date.today().isoformat(), "day_of_month": 10,
            "total_payments": 10,
        })
        assert r.status_code == 201

    @pytest.mark.asyncio
    async def test_loan_payment_less_than_interest_rejected(self, client: AsyncClient, auth_headers: dict):
        """Monthly payment must exceed monthly interest (ORANGE-2)."""
        # 10000 * (12% / 12) = 100/month interest, but payment is only 50
        r = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Bad Payment", "original_amount": "10000.00",
            "monthly_payment": "50.00", "interest_rate": "12",
            "start_date": date.today().isoformat(), "day_of_month": 10,
            "total_payments": 360,
        })
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_loan_total_payments_minimum(self, client: AsyncClient, auth_headers: dict):
        """total_payments must be >= 1."""
        r = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Zero Payments", "original_amount": "5000.00",
            "monthly_payment": "5000.00", "interest_rate": "0",
            "start_date": date.today().isoformat(), "day_of_month": 10,
            "total_payments": 0,
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_loan_payment_exceeds_balance_rejected(self, client: AsyncClient, auth_headers: dict):
        """Payment amount exceeding remaining balance should be rejected."""
        today = date.today().isoformat()
        r = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Overpay Test", "original_amount": "1000.00",
            "monthly_payment": "500.00", "interest_rate": "0",
            "start_date": today, "day_of_month": 10, "total_payments": 2,
        })
        assert r.status_code == 201
        loan_id = r.json()["id"]

        r = await client.post(f"/api/v1/loans/{loan_id}/payment", headers=auth_headers,
                              json={"amount": "1500.00"})
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Balance Validation
# ---------------------------------------------------------------------------

class TestBalanceValidation:

    @pytest.mark.asyncio
    async def test_balance_negative_allowed(self, client: AsyncClient, auth_headers: dict):
        """Negative balance (overdraft) should be allowed."""
        r = await client.post("/api/v1/balance", headers=auth_headers, json={
            "balance": "-5000.00",
            "effective_date": date.today().isoformat(),
        })
        assert r.status_code == 201
        assert Decimal(r.json()["balance"]) == Decimal("-5000.00")

    @pytest.mark.asyncio
    async def test_balance_zero_allowed(self, client: AsyncClient, auth_headers: dict):
        """Zero balance should be allowed."""
        r = await client.post("/api/v1/balance", headers=auth_headers, json={
            "balance": "0.00",
            "effective_date": date.today().isoformat(),
        })
        assert r.status_code == 201


# ---------------------------------------------------------------------------
# Category Validation
# ---------------------------------------------------------------------------

class TestCategoryValidation:

    @pytest.mark.asyncio
    async def test_category_duplicate_name_type_rejected(self, client: AsyncClient, auth_headers: dict):
        """Duplicate (name + type) should be rejected."""
        data = {
            "name": "DuplicateTest", "name_he": "כפילות",
            "type": "expense", "color": "#FF0000", "icon": "x",
        }
        r1 = await client.post("/api/v1/categories", headers=auth_headers, json=data)
        assert r1.status_code == 201

        r2 = await client.post("/api/v1/categories", headers=auth_headers, json=data)
        assert r2.status_code == 409

    @pytest.mark.asyncio
    async def test_category_name_max_length(self, client: AsyncClient, auth_headers: dict):
        """Category name up to 100 chars should work, 101+ rejected."""
        # 100 chars - OK
        r = await client.post("/api/v1/categories", headers=auth_headers, json={
            "name": "A" * 100, "name_he": "ב" * 50,
            "type": "expense", "color": "#FF0000", "icon": "x",
        })
        assert r.status_code == 201

        # 101 chars - rejected
        r = await client.post("/api/v1/categories", headers=auth_headers, json={
            "name": "A" * 101, "name_he": "ב" * 50,
            "type": "expense", "color": "#FF0000", "icon": "x",
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_category_invalid_color_rejected(self, client: AsyncClient, auth_headers: dict):
        """Non-hex color format should be rejected."""
        r = await client.post("/api/v1/categories", headers=auth_headers, json={
            "name": "BadColor", "name_he": "צבע רע",
            "type": "expense", "color": "red", "icon": "x",
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_category_type_change_with_transactions_rejected(self, client: AsyncClient, auth_headers: dict):
        """Cannot change category type if it has existing transactions."""
        today = date.today().isoformat()

        # Create category
        r = await client.post("/api/v1/categories", headers=auth_headers, json={
            "name": "TypeChangeTest", "name_he": "שינוי סוג",
            "type": "expense", "color": "#FF0000", "icon": "x",
        })
        assert r.status_code == 201
        cat_id = r.json()["id"]

        # Create transaction with this category
        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "100.00", "type": "expense",
            "category_id": cat_id, "description": "Test", "date": today,
        })
        assert r.status_code == 201

        # Try to change type → should fail
        r = await client.put(f"/api/v1/categories/{cat_id}", headers=auth_headers, json={
            "type": "income",
        })
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# String Validation
# ---------------------------------------------------------------------------

class TestStringValidation:

    @pytest.mark.asyncio
    async def test_empty_name_rejected(self, client: AsyncClient, auth_headers: dict):
        """Empty names should be rejected."""
        r = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "", "amount": "100.00", "type": "expense",
            "day_of_month": 1, "start_date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_html_only_name_rejected(self, client: AsyncClient, auth_headers: dict):
        """Name that becomes empty after stripping HTML should be rejected."""
        r = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "<b></b>", "amount": "100.00", "type": "expense",
            "day_of_month": 1, "start_date": date.today().isoformat(),
        })
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_currency_iso_format(self, client: AsyncClient, auth_headers: dict):
        """Currency must be 3 uppercase letters."""
        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "100.00", "type": "expense", "currency": "usd",
            "description": "Lowercase currency", "date": date.today().isoformat(),
        })
        assert r.status_code == 422

        r = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "100.00", "type": "expense", "currency": "US",
            "description": "Too short", "date": date.today().isoformat(),
        })
        assert r.status_code == 422
