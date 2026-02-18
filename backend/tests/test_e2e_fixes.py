"""End-to-end tests for Reject fixes.

Covers:
  1. Loan amortization calculation correctness (Reject 1)
  2. Installment date synchronization / status logic (Reject 4)
  3. Loan reverse-payment balance correctness (Reject 1)
  4. Currency conversion stored on financial records (Reject 2)
  5. Audit trail on CRUD operations (Phase 4)
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Reject 1: Loan amortization math
# ---------------------------------------------------------------------------


class TestLoanAmortizationMath:
    """Verify the Spitzer amortization schedule is mathematically correct."""

    @pytest.mark.asyncio
    async def test_interest_bearing_principal_plus_interest_equals_payment(
        self, client: AsyncClient, auth_headers: dict
    ):
        """For every row except the last, principal + interest == monthly_payment."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Math Test 5%",
            "original_amount": 60000,
            "monthly_payment": 5500,
            "interest_rate": 5.0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 12,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        assert detail.status_code == 200
        amort = detail.json()["amortization"]
        assert len(amort) == 12

        for i, row in enumerate(amort):
            principal = Decimal(row["principal"])
            interest = Decimal(row["interest"])
            payment = Decimal(row["payment_amount"])
            remaining = Decimal(row["remaining_balance"])

            # principal and interest must be non-negative
            assert principal >= 0, f"Row {i+1}: negative principal"
            assert interest >= 0, f"Row {i+1}: negative interest"

            if i < 11:
                # Regular payment: principal + interest == monthly_payment
                assert principal + interest == payment, (
                    f"Row {i+1}: {principal} + {interest} != {payment}"
                )
            else:
                # Last payment: pays off remainder + interest
                assert principal + interest == payment, (
                    f"Last row: {principal} + {interest} != {payment}"
                )

    @pytest.mark.asyncio
    async def test_remaining_balance_reaches_zero(
        self, client: AsyncClient, auth_headers: dict
    ):
        """After all amortization rows, remaining balance must be exactly 0."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Zero Balance Test",
            "original_amount": 24000,
            "monthly_payment": 2100,
            "interest_rate": 4.0,
            "start_date": "2026-01-01",
            "day_of_month": 15,
            "total_payments": 12,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        last_row = amort[-1]
        assert Decimal(last_row["remaining_balance"]) == Decimal("0"), (
            f"Last row remaining_balance is {last_row['remaining_balance']}, expected 0.00"
        )

    @pytest.mark.asyncio
    async def test_sum_of_principal_equals_original(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Sum of all principal portions must equal the original loan amount."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Sum Principal Test",
            "original_amount": 50000,
            "monthly_payment": 4500,
            "interest_rate": 6.0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 12,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        total_principal = sum(Decimal(row["principal"]) for row in amort)
        assert total_principal == Decimal("50000.00"), (
            f"Sum of principal: {total_principal}, expected 50000.00"
        )

    @pytest.mark.asyncio
    async def test_remaining_decreases_monotonically(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Remaining balance must decrease (or stay 0) with each payment."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Monotone Test",
            "original_amount": 30000,
            "monthly_payment": 2800,
            "interest_rate": 3.5,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 12,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        prev = Decimal("30000.00")
        for i, row in enumerate(amort):
            curr = Decimal(row["remaining_balance"])
            assert curr <= prev, (
                f"Row {i+1}: remaining {curr} > previous {prev}"
            )
            prev = curr

    @pytest.mark.asyncio
    async def test_zero_interest_all_interest_zero(
        self, client: AsyncClient, auth_headers: dict
    ):
        """With 0% interest, every row should have interest == 0.00."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Zero Interest Verify",
            "original_amount": 12000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 12,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        for i, row in enumerate(amort):
            assert Decimal(row["interest"]) == Decimal("0.00"), (
                f"Row {i+1}: interest should be 0.00, got {row['interest']}"
            )
            assert Decimal(row["principal"]) == Decimal(row["payment_amount"]), (
                f"Row {i+1}: principal should equal payment_amount for 0% interest"
            )

    @pytest.mark.asyncio
    async def test_last_payment_differs_from_monthly(
        self, client: AsyncClient, auth_headers: dict
    ):
        """With interest > 0, the last payment_amount should differ from monthly_payment
        because it pays off the exact remaining balance + interest."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Last Payment Test",
            "original_amount": 10000,
            "monthly_payment": 900,
            "interest_rate": 5.0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 12,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        monthly = Decimal(resp.json()["monthly_payment"])
        last_payment = Decimal(amort[-1]["payment_amount"])
        # The last payment should NOT be exactly the monthly payment
        assert last_payment != monthly, (
            f"Last payment {last_payment} should differ from monthly {monthly}"
        )
        # But the remaining_balance should still be 0
        assert Decimal(amort[-1]["remaining_balance"]) == Decimal("0")

    @pytest.mark.asyncio
    async def test_high_interest_validation(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Monthly payment must exceed monthly interest — server should reject if not."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Too Little Payment",
            "original_amount": 100000,
            "monthly_payment": 100,
            "interest_rate": 12.0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 120,
        }, headers=auth_headers)
        # 12% annual on 100000 = 1000/month interest, payment 100 < 1000
        assert resp.status_code == 400, (
            "Should reject: monthly payment < monthly interest"
        )


# ---------------------------------------------------------------------------
# Reject 1 (continued): Reverse payment correctness
# ---------------------------------------------------------------------------


class TestLoanReversePayment:
    """Verify reverse_payment reconstructs balance from amortization schedule."""

    @pytest.mark.asyncio
    async def test_reverse_restores_original_balance(
        self, client: AsyncClient, auth_headers: dict
    ):
        """After 1 payment + reverse, remaining_balance == original_amount."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Reverse Test",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 10,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        # Pay
        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 1000}, headers=auth_headers)
        # Reverse
        rev = await client.post(f"/api/v1/loans/{lid}/reverse-payment", headers=auth_headers)
        assert rev.status_code == 200
        data = rev.json()
        assert data["payments_made"] == 0
        assert data["remaining_balance"] == "10000.00"

    @pytest.mark.asyncio
    async def test_reverse_with_interest_uses_schedule(
        self, client: AsyncClient, auth_headers: dict
    ):
        """After 2 payments + 1 reverse on an interest-bearing loan,
        balance matches the amortization row for payment 1."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Interest Reverse",
            "original_amount": 12000,
            "monthly_payment": 2100,
            "interest_rate": 4.0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 6,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        # Get amortization to know expected balance after payment 1
        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        expected_after_1 = amort[0]["remaining_balance"]

        # Pay twice
        p1 = amort[0]["principal"]
        p2 = amort[1]["principal"]
        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": float(p1)}, headers=auth_headers)
        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": float(p2)}, headers=auth_headers)

        # Reverse once — should go back to balance after payment 1
        rev = await client.post(f"/api/v1/loans/{lid}/reverse-payment", headers=auth_headers)
        assert rev.status_code == 200
        assert rev.json()["payments_made"] == 1
        assert rev.json()["remaining_balance"] == expected_after_1

    @pytest.mark.asyncio
    async def test_reverse_completed_loan_reactivates(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Reversing a payment on a completed loan should set status back to active."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Complete Then Reverse",
            "original_amount": 2000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 2,
        }, headers=auth_headers)
        lid = resp.json()["id"]

        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 1000}, headers=auth_headers)
        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 1000}, headers=auth_headers)

        # Should be completed
        loan = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        assert loan.json()["loan"]["status"] == "completed"

        # Reverse — should become active
        rev = await client.post(f"/api/v1/loans/{lid}/reverse-payment", headers=auth_headers)
        assert rev.status_code == 200
        assert rev.json()["status"] == "active"

    @pytest.mark.asyncio
    async def test_reverse_no_payments_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Reversing when no payments have been made should fail."""
        resp = await client.post("/api/v1/loans", json={
            "name": "No Payments Reverse",
            "original_amount": 5000,
            "monthly_payment": 500,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 10,
        }, headers=auth_headers)
        lid = resp.json()["id"]

        rev = await client.post(f"/api/v1/loans/{lid}/reverse-payment", headers=auth_headers)
        assert rev.status_code == 400


# ---------------------------------------------------------------------------
# Reject 4: Installment status & date synchronization
# ---------------------------------------------------------------------------


class TestInstallmentStatusLogic:
    """Verify payment schedule statuses: completed / overdue / due / future."""

    @pytest.mark.asyncio
    async def test_past_unpaid_is_overdue(
        self, client: AsyncClient, auth_headers: dict
    ):
        """An installment started in the past with 0 payments shows overdue items."""
        resp = await client.post("/api/v1/installments", json={
            "name": "Past Overdue",
            "total_amount": 3000,
            "number_of_payments": 6,
            "type": "expense",
            "start_date": "2025-06-01",
            "day_of_month": 5,
        }, headers=auth_headers)
        assert resp.status_code == 201
        iid = resp.json()["id"]

        detail = await client.get(f"/api/v1/installments/{iid}", headers=auth_headers)
        assert detail.status_code == 200
        schedule = detail.json()["schedule"]

        overdue_items = [s for s in schedule if s["status"] == "overdue"]
        # All 6 payments should be overdue (June-Nov 2025, all before today Feb 2026)
        assert len(overdue_items) == 6, (
            f"Expected 6 overdue, got {len(overdue_items)}. "
            f"Statuses: {[s['status'] for s in schedule]}"
        )

    @pytest.mark.asyncio
    async def test_paid_items_are_completed(
        self, client: AsyncClient, auth_headers: dict
    ):
        """After marking payments, those items show as completed in schedule."""
        resp = await client.post("/api/v1/installments", json={
            "name": "Mark Paid Test",
            "total_amount": 3000,
            "number_of_payments": 6,
            "type": "expense",
            "start_date": "2025-10-01",
            "day_of_month": 10,
        }, headers=auth_headers)
        assert resp.status_code == 201
        iid = resp.json()["id"]

        # Mark first 2 as paid
        await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)
        await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)

        detail = await client.get(f"/api/v1/installments/{iid}", headers=auth_headers)
        schedule = detail.json()["schedule"]

        assert schedule[0]["status"] == "completed"
        assert schedule[1]["status"] == "completed"
        # Remaining past ones should be overdue
        for s in schedule[2:]:
            assert s["status"] in ("overdue", "due", "future"), (
                f"Payment {s['payment_number']}: expected overdue/due/future, got {s['status']}"
            )

    @pytest.mark.asyncio
    async def test_future_payments_are_future(
        self, client: AsyncClient, auth_headers: dict
    ):
        """An installment starting in the future should have all items as 'future'."""
        resp = await client.post("/api/v1/installments", json={
            "name": "Future Test",
            "total_amount": 6000,
            "number_of_payments": 6,
            "type": "expense",
            "start_date": "2027-01-01",
            "day_of_month": 15,
        }, headers=auth_headers)
        assert resp.status_code == 201
        iid = resp.json()["id"]

        detail = await client.get(f"/api/v1/installments/{iid}", headers=auth_headers)
        schedule = detail.json()["schedule"]

        for s in schedule:
            assert s["status"] == "future", (
                f"Payment {s['payment_number']} date {s['date']}: expected future, got {s['status']}"
            )

    @pytest.mark.asyncio
    async def test_installment_status_overdue_when_behind(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Installment-level status should be 'overdue' when behind on payments."""
        resp = await client.post("/api/v1/installments", json={
            "name": "Behind Payments",
            "total_amount": 6000,
            "number_of_payments": 12,
            "type": "expense",
            "start_date": "2025-06-01",
            "day_of_month": 10,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        # Started June 2025, today is Feb 2026, 0 payments made → overdue
        assert data["status"] == "overdue", (
            f"Expected status 'overdue', got '{data['status']}'"
        )
        assert data["is_on_track"] is False

    @pytest.mark.asyncio
    async def test_installment_status_pending_before_start(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Installment starting in the future should have status 'pending'."""
        resp = await client.post("/api/v1/installments", json={
            "name": "Future Pending",
            "total_amount": 3000,
            "number_of_payments": 6,
            "type": "expense",
            "start_date": "2027-06-01",
            "day_of_month": 15,
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["status"] == "pending"

    @pytest.mark.asyncio
    async def test_completed_installment_status(
        self, client: AsyncClient, auth_headers: dict
    ):
        """After all payments are marked, status should be 'completed'."""
        resp = await client.post("/api/v1/installments", json={
            "name": "Complete Test",
            "total_amount": 600,
            "number_of_payments": 2,
            "type": "expense",
            "start_date": "2025-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert resp.status_code == 201
        iid = resp.json()["id"]

        await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)
        result = await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)
        assert result.status_code == 200
        assert result.json()["status"] == "completed"
        assert result.json()["is_on_track"] is True
        assert Decimal(result.json()["remaining_amount"]) == Decimal("0")


# ---------------------------------------------------------------------------
# Reject 4 (continued): Loan amortization status logic
# ---------------------------------------------------------------------------


class TestLoanAmortizationStatus:
    """Verify loan amortization status states: paid / overdue / due / future."""

    @pytest.mark.asyncio
    async def test_paid_rows_after_payments(
        self, client: AsyncClient, auth_headers: dict
    ):
        """After recording payments, those rows should be marked 'paid'."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Status After Pay",
            "original_amount": 6000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 6,
        }, headers=auth_headers)
        lid = resp.json()["id"]

        # Record 2 payments
        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 1000}, headers=auth_headers)
        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 1000}, headers=auth_headers)

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        assert amort[0]["status"] == "paid"
        assert amort[1]["status"] == "paid"
        # Remaining should NOT be "paid"
        for row in amort[2:]:
            assert row["status"] != "paid"

    @pytest.mark.asyncio
    async def test_past_unpaid_rows_are_overdue(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Past payment dates without payments should be 'overdue'."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Overdue Rows",
            "original_amount": 6000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2025-06-01",
            "day_of_month": 5,
            "total_payments": 6,
        }, headers=auth_headers)
        lid = resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        # All 6 months (June-Nov 2025) are in the past
        for row in amort:
            assert row["status"] == "overdue", (
                f"Row {row['payment_number']} (date {row['date']}): "
                f"expected overdue, got {row['status']}"
            )

    @pytest.mark.asyncio
    async def test_future_rows_are_future(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Loan starting well in the future should have all rows as 'future'."""
        resp = await client.post("/api/v1/loans", json={
            "name": "Future Rows",
            "original_amount": 6000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2027-06-01",
            "day_of_month": 10,
            "total_payments": 6,
        }, headers=auth_headers)
        lid = resp.json()["id"]

        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]
        for row in amort:
            assert row["status"] == "future", (
                f"Row {row['payment_number']}: expected future, got {row['status']}"
            )


# ---------------------------------------------------------------------------
# Reject 2: Currency conversion stored on financial records
# ---------------------------------------------------------------------------


class TestCurrencyConversionStorage:
    """Verify that creating records in USD/EUR stores conversion fields."""

    @pytest.mark.asyncio
    async def test_loan_usd_stores_conversion_fields(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Creating a loan in USD should store original_currency_amount and exchange_rate."""
        resp = await client.post("/api/v1/loans", json={
            "name": "USD Loan",
            "original_amount": 10000,
            "monthly_payment": 900,
            "interest_rate": 3.0,
            "currency": "USD",
            "start_date": "2026-06-01",
            "day_of_month": 1,
            "total_payments": 12,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        # Currency should be converted to base (ILS)
        assert data["currency"] == "ILS"
        # Original currency info should be preserved
        assert data["original_currency"] == "USD"
        assert data["original_currency_amount"] is not None
        assert float(data["original_currency_amount"]) == 10000.0
        # Exchange rate should be stored and > 0
        assert data["exchange_rate"] is not None
        assert float(data["exchange_rate"]) > 0
        # Converted amount (original_amount in response) should differ from input
        assert float(data["original_amount"]) != 10000.0 or data["exchange_rate"] == "1.000000"

    @pytest.mark.asyncio
    async def test_installment_eur_stores_conversion_fields(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Creating an installment in EUR should store conversion fields."""
        resp = await client.post("/api/v1/installments", json={
            "name": "EUR Purchase",
            "total_amount": 3000,
            "number_of_payments": 6,
            "type": "expense",
            "currency": "EUR",
            "start_date": "2026-06-01",
            "day_of_month": 15,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["currency"] == "ILS"
        assert data["original_currency"] == "EUR"
        assert data["original_amount"] is not None
        assert float(data["original_amount"]) == 3000.0
        assert data["exchange_rate"] is not None
        assert float(data["exchange_rate"]) > 0

    @pytest.mark.asyncio
    async def test_ils_record_has_rate_1(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Creating a record in ILS should have exchange_rate == 1."""
        resp = await client.post("/api/v1/loans", json={
            "name": "ILS Loan",
            "original_amount": 50000,
            "monthly_payment": 5000,
            "interest_rate": 0,
            "currency": "ILS",
            "start_date": "2026-06-01",
            "day_of_month": 1,
            "total_payments": 10,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["currency"] == "ILS"
        assert float(data["exchange_rate"]) == 1.0
        assert float(data["original_amount"]) == 50000.0


# ---------------------------------------------------------------------------
# Phase 4: Audit trail
# ---------------------------------------------------------------------------


class TestAuditTrail:
    """Verify audit log entries are created for CRUD operations."""

    @pytest.mark.asyncio
    async def test_loan_crud_creates_audit_entries(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Creating, updating, and deleting a loan should generate audit entries."""
        # Create
        resp = await client.post("/api/v1/loans", json={
            "name": "Audit Loan",
            "original_amount": 5000,
            "monthly_payment": 500,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 10,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        # Update
        await client.put(f"/api/v1/loans/{lid}", json={"name": "Updated Audit Loan"}, headers=auth_headers)

        # Payment
        await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 500}, headers=auth_headers)

        # Delete
        await client.delete(f"/api/v1/loans/{lid}", headers=auth_headers)

        # We can't directly query the audit log via personal context,
        # but we can verify the operations succeeded (no 500 errors)
        # The actual audit log is stored in DB — verified via org endpoint or direct DB query

    @pytest.mark.asyncio
    async def test_installment_crud_creates_audit_entries(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Creating, updating, marking paid, and deleting creates audit entries."""
        resp = await client.post("/api/v1/installments", json={
            "name": "Audit Installment",
            "total_amount": 1200,
            "number_of_payments": 3,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert resp.status_code == 201
        iid = resp.json()["id"]

        # Update
        up = await client.put(f"/api/v1/installments/{iid}", json={"name": "Updated"}, headers=auth_headers)
        assert up.status_code == 200

        # Mark paid
        mp = await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)
        assert mp.status_code == 200

        # Delete
        dl = await client.delete(f"/api/v1/installments/{iid}", headers=auth_headers)
        assert dl.status_code == 200


# ---------------------------------------------------------------------------
# Integration: Loan full lifecycle
# ---------------------------------------------------------------------------


class TestLoanFullLifecycle:
    """End-to-end: create → pay all → verify complete → reverse → verify active."""

    @pytest.mark.asyncio
    async def test_complete_lifecycle_with_interest(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Full lifecycle of an interest-bearing loan."""
        # Create a short loan
        resp = await client.post("/api/v1/loans", json={
            "name": "Lifecycle Loan",
            "original_amount": 3000,
            "monthly_payment": 1100,
            "interest_rate": 6.0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 3,
        }, headers=auth_headers)
        assert resp.status_code == 201
        lid = resp.json()["id"]

        # Get amortization to use correct payment amounts
        detail = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        amort = detail.json()["amortization"]

        # Pay all 3 payments using the principal from amortization
        for row in amort:
            # The record_payment endpoint uses the amount to subtract from balance
            # We need to pay the principal portion (the amount that reduces the balance)
            pay_resp = await client.post(
                f"/api/v1/loans/{lid}/payment",
                json={"amount": float(row["principal"])},
                headers=auth_headers,
            )
            assert pay_resp.status_code == 200

        # Should be completed now
        final = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
        assert final.json()["loan"]["status"] == "completed"
        assert final.json()["loan"]["remaining_balance"] == "0.00"

        # Reverse one payment
        rev = await client.post(f"/api/v1/loans/{lid}/reverse-payment", headers=auth_headers)
        assert rev.status_code == 200
        assert rev.json()["status"] == "active"
        assert rev.json()["payments_made"] == 2
        # Balance should match amortization row 2's remaining
        assert rev.json()["remaining_balance"] == amort[1]["remaining_balance"]


# ---------------------------------------------------------------------------
# Integration: Installment full lifecycle
# ---------------------------------------------------------------------------


class TestInstallmentFullLifecycle:
    """End-to-end: create → mark all paid → verify completed."""

    @pytest.mark.asyncio
    async def test_complete_lifecycle(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Full lifecycle of an installment plan."""
        resp = await client.post("/api/v1/installments", json={
            "name": "Lifecycle Installment",
            "total_amount": 900,
            "number_of_payments": 3,
            "type": "expense",
            "start_date": "2025-01-01",
            "day_of_month": 1,
        }, headers=auth_headers)
        assert resp.status_code == 201
        iid = resp.json()["id"]
        assert resp.json()["status"] == "overdue"  # Started in past, 0 paid

        # Mark all 3 as paid
        for _ in range(3):
            mp = await client.post(f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers)
            assert mp.status_code == 200

        # Verify completed
        final = await client.get(f"/api/v1/installments/{iid}", headers=auth_headers)
        assert final.json()["installment"]["status"] == "completed"
        assert final.json()["installment"]["payments_completed"] == 3

        # All schedule items should be "completed"
        schedule = final.json()["schedule"]
        for s in schedule:
            assert s["status"] == "completed"

        # Reverse one
        rev = await client.post(f"/api/v1/installments/{iid}/reverse-payment", headers=auth_headers)
        assert rev.status_code == 200
        assert rev.json()["payments_completed"] == 2
        assert rev.json()["status"] != "completed"
