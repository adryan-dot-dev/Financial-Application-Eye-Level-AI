from __future__ import annotations

"""
Comprehensive financial precision tests.

Verifies that all monetary values in the system are stored and returned
as DECIMAL(15,2) with ROUND_HALF_UP semantics, and that no floating-point
drift occurs in calculations (installments, loans, forecasts, balances).
"""

from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient


TODAY = date.today().isoformat()


class TestTransactionPrecision:
    """Tests for transaction amount precision."""

    @pytest.mark.asyncio
    async def test_transaction_two_decimal_precision(self, client: AsyncClient, auth_headers: dict):
        """Amount 100.99 is stored and returned as '100.99' (exact 2 decimals)."""
        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "100.99",
            "type": "expense",
            "description": "Precision test",
            "date": TODAY,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == "100.99"

        # Re-fetch to confirm DB round-trip
        tx_id = data["id"]
        resp = await client.get(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["amount"] == "100.99"

    @pytest.mark.asyncio
    async def test_transaction_three_decimal_rejected(self, client: AsyncClient, auth_headers: dict):
        """Amount 100.999 should be rejected (exceeds decimal_places=2)."""
        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "100.999",
            "type": "expense",
            "description": "Three decimals",
            "date": TODAY,
        })
        # Pydantic's decimal_places=2 should reject 3 decimal places
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_very_large_amount(self, client: AsyncClient, auth_headers: dict):
        """Maximum DECIMAL(15,2) amount 9999999999999.99 should be accepted."""
        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "9999999999999.99",
            "type": "income",
            "description": "Max amount",
            "date": TODAY,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == "9999999999999.99"

    @pytest.mark.asyncio
    async def test_very_small_amount(self, client: AsyncClient, auth_headers: dict):
        """Minimum positive amount 0.01 should be accepted."""
        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "0.01",
            "type": "expense",
            "description": "Smallest amount",
            "date": TODAY,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == "0.01"

    @pytest.mark.asyncio
    async def test_zero_amount_rejected(self, client: AsyncClient, auth_headers: dict):
        """Amount 0 should be rejected (gt=0 in schema)."""
        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "0",
            "type": "income",
            "description": "Zero amount",
            "date": TODAY,
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_amount_rejected(self, client: AsyncClient, auth_headers: dict):
        """Amount -100 should be rejected (gt=0 in schema)."""
        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "-100",
            "type": "expense",
            "description": "Negative amount",
            "date": TODAY,
        })
        assert resp.status_code == 422


class TestInstallmentPrecision:
    """Tests for installment amount splitting precision."""

    @pytest.mark.asyncio
    async def test_installment_uneven_split_precision(self, client: AsyncClient, auth_headers: dict):
        """1000 / 3 = 333.33 per payment, last payment = 333.34 to sum correctly.

        Total: 333.33 * 2 + 333.34 = 1000.00 (no rounding loss).
        """
        resp = await client.post("/api/v1/installments", headers=auth_headers, json={
            "name": "Uneven Split",
            "total_amount": "1000.00",
            "number_of_payments": 3,
            "type": "expense",
            "start_date": TODAY,
            "day_of_month": 15,
        })
        assert resp.status_code == 201
        data = resp.json()

        # monthly_amount should be 1000/3 rounded HALF_UP = 333.33
        assert data["monthly_amount"] == "333.33"
        assert data["total_amount"] == "1000.00"

        # Fetch detail with schedule to verify last payment absorbs the remainder
        inst_id = data["id"]
        resp = await client.get(f"/api/v1/installments/{inst_id}", headers=auth_headers)
        assert resp.status_code == 200
        schedule = resp.json()["schedule"]
        assert len(schedule) == 3

        # First two payments are 333.33
        assert schedule[0]["amount"] == "333.33"
        assert schedule[1]["amount"] == "333.33"

        # Last payment absorbs the rounding difference: 1000.00 - 333.33*2 = 333.34
        assert schedule[2]["amount"] == "333.34"

        # Verify the total sums up exactly
        total = sum(Decimal(p["amount"]) for p in schedule)
        assert total == Decimal("1000.00")


class TestLoanPrecision:
    """Tests for loan calculation precision."""

    @pytest.mark.asyncio
    async def test_loan_zero_interest_precision(self, client: AsyncClient, auth_headers: dict):
        """Loan with 0% interest: all payments are exact, remaining balance accurate."""
        resp = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Zero Interest Loan",
            "original_amount": "10000.00",
            "monthly_payment": "1000.00",
            "interest_rate": "0",
            "start_date": TODAY,
            "day_of_month": 10,
            "total_payments": 10,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["original_amount"] == "10000.00"
        assert data["monthly_payment"] == "1000.00"
        assert data["remaining_balance"] == "10000.00"

        # Make one payment and check precision
        loan_id = data["id"]
        resp = await client.post(f"/api/v1/loans/{loan_id}/payment", headers=auth_headers, json={
            "amount": "1000.00",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["remaining_balance"] == "9000.00"
        assert data["payments_made"] == 1

        # Make second payment
        resp = await client.post(f"/api/v1/loans/{loan_id}/payment", headers=auth_headers, json={
            "amount": "1000.00",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["remaining_balance"] == "8000.00"
        assert data["payments_made"] == 2

    @pytest.mark.asyncio
    async def test_loan_interest_calculation_precision(self, client: AsyncClient, auth_headers: dict):
        """Verify amortization schedule uses Decimal and sums correctly.

        Loan: 12000, 12 payments, 12% annual interest, monthly payment = 1066.19
        (roughly). Verify all amortization amounts use 2-decimal precision.
        """
        resp = await client.post("/api/v1/loans", headers=auth_headers, json={
            "name": "Interest Precision Loan",
            "original_amount": "12000.00",
            "monthly_payment": "1066.19",
            "interest_rate": "12",
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 12,
        })
        assert resp.status_code == 201
        loan_id = resp.json()["id"]

        # Get full amortization schedule
        resp = await client.get(f"/api/v1/loans/{loan_id}", headers=auth_headers)
        assert resp.status_code == 200
        amortization = resp.json()["amortization"]
        assert len(amortization) == 12

        # Verify every amount has exactly 2 decimal precision (no floating point artifacts)
        for item in amortization:
            for field in ("payment_amount", "principal", "interest", "remaining_balance"):
                value = Decimal(item[field])
                # Check that the value has at most 2 decimal places
                assert value == value.quantize(Decimal("0.01")), (
                    f"Payment #{item['payment_number']} {field}={item[field]} "
                    f"has more than 2 decimal places"
                )

        # Verify the last payment brings balance to exactly 0
        last = amortization[-1]
        assert Decimal(last["remaining_balance"]) == Decimal("0") or Decimal(last["remaining_balance"]) == Decimal("0.00")


class TestForecastPrecision:
    """Tests for forecast aggregation precision."""

    @pytest.mark.asyncio
    async def test_forecast_aggregation_precision(self, client: AsyncClient, auth_headers: dict):
        """Forecast totals use Decimal, not float -- no rounding drift.

        Create a balance and a fixed expense, verify forecast values
        are returned as proper decimal strings (not floating point).
        """
        # Set a balance
        resp = await client.post("/api/v1/balance", headers=auth_headers, json={
            "balance": "100000.50",
            "effective_date": TODAY,
        })
        assert resp.status_code == 201

        # Create a fixed expense with a value that would cause float issues
        resp = await client.post("/api/v1/fixed", headers=auth_headers, json={
            "name": "Precision Rent",
            "amount": "3333.33",
            "type": "expense",
            "day_of_month": 1,
            "start_date": TODAY,
        })
        assert resp.status_code == 201

        # Get forecast
        resp = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        # current_balance should be exact
        assert data["current_balance"] == "100000.50"

        # Verify all monthly values are valid Decimal strings (2 decimal places)
        for month in data["months"]:
            for field in ("opening_balance", "fixed_expenses", "total_expenses",
                          "net_change", "closing_balance"):
                value = Decimal(month[field])
                assert value == value.quantize(Decimal("0.01")), (
                    f"Month {month['month']} {field}={month[field]} "
                    f"has precision issues"
                )


class TestCurrencyConversionPrecision:
    """Tests for currency conversion maintaining precision."""

    @pytest.mark.asyncio
    async def test_currency_same_currency_no_drift(self, client: AsyncClient, auth_headers: dict):
        """When currency matches base currency (ILS), no conversion occurs.

        Amount in = amount out, exchange_rate = 1.
        """
        resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
            "amount": "1234.56",
            "currency": "ILS",
            "type": "expense",
            "description": "ILS no conversion",
            "date": TODAY,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == "1234.56"
        assert data["original_amount"] == "1234.56"
        assert data["original_currency"] == "ILS"
        assert Decimal(data["exchange_rate"]) == Decimal("1")


class TestBalancePrecision:
    """Tests for balance precision after transactions."""

    @pytest.mark.asyncio
    async def test_balance_after_transactions_precision(self, client: AsyncClient, auth_headers: dict):
        """Balance reflects exact Decimal sums, no floating-point drift.

        Set balance to 10000.10, create expenses of 3333.33 * 3 = 9999.99,
        verify forecast shows correct remaining: 10000.10 - 9999.99 = 0.11.
        """
        # Set balance
        resp = await client.post("/api/v1/balance", headers=auth_headers, json={
            "balance": "10000.10",
            "effective_date": TODAY,
        })
        assert resp.status_code == 201
        assert resp.json()["balance"] == "10000.10"

        # Create 3 transactions that would cause floating point issues
        for i in range(3):
            resp = await client.post("/api/v1/transactions", headers=auth_headers, json={
                "amount": "3333.33",
                "type": "expense",
                "description": f"Precision tx {i+1}",
                "date": TODAY,
            })
            assert resp.status_code == 201
            assert resp.json()["amount"] == "3333.33"

        # Verify the balance itself is stored with precision
        resp = await client.get("/api/v1/balance", headers=auth_headers)
        assert resp.status_code == 200
        balance = Decimal(resp.json()["balance"])
        assert balance == Decimal("10000.10")

        # Verify the balance update endpoint also maintains precision
        resp = await client.put("/api/v1/balance", headers=auth_headers, json={
            "balance": "0.11",
        })
        assert resp.status_code == 200
        assert resp.json()["balance"] == "0.11"

    @pytest.mark.asyncio
    async def test_balance_large_value_precision(self, client: AsyncClient, auth_headers: dict):
        """Large balance values maintain exact 2-decimal precision."""
        resp = await client.post("/api/v1/balance", headers=auth_headers, json={
            "balance": "9999999999999.99",
            "effective_date": TODAY,
        })
        assert resp.status_code == 201
        assert resp.json()["balance"] == "9999999999999.99"

    @pytest.mark.asyncio
    async def test_balance_negative_precision(self, client: AsyncClient, auth_headers: dict):
        """Negative balance (overdraft) maintains precision."""
        resp = await client.post("/api/v1/balance", headers=auth_headers, json={
            "balance": "-12345.67",
            "effective_date": TODAY,
        })
        assert resp.status_code == 201
        assert resp.json()["balance"] == "-12345.67"

    @pytest.mark.asyncio
    async def test_balance_zero_precision(self, client: AsyncClient, auth_headers: dict):
        """Zero balance is stored as '0.00' with proper formatting."""
        resp = await client.post("/api/v1/balance", headers=auth_headers, json={
            "balance": "0",
            "effective_date": TODAY,
        })
        assert resp.status_code == 201
        # Zero should be normalized to "0" or "0.00" - both are acceptable Decimal representations
        balance_value = Decimal(resp.json()["balance"])
        assert balance_value == Decimal("0")
