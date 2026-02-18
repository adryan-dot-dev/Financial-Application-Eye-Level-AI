"""Tests for first_payment_made feature on installments and loans."""
from __future__ import annotations

import pytest
from decimal import Decimal

from httpx import AsyncClient


# ---- Installment Tests ----


@pytest.mark.asyncio
async def test_installment_first_payment_false_default(client: AsyncClient, auth_headers: dict):
    """Default: first_payment_made=False -> payments_completed=0, no transaction."""
    resp = await client.post("/api/v1/installments", json={
        "name": "Test Default",
        "total_amount": "1200.00",
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2026-01-15",
        "day_of_month": 15,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payments_completed"] == 0


@pytest.mark.asyncio
async def test_installment_first_payment_true(client: AsyncClient, auth_headers: dict):
    """first_payment_made=True -> payments_completed=1 and transaction created."""
    resp = await client.post("/api/v1/installments", json={
        "name": "Test First Paid",
        "total_amount": "1200.00",
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2026-01-15",
        "day_of_month": 15,
        "first_payment_made": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payments_completed"] == 1

    # Verify transaction was created
    tx_resp = await client.get(
        "/api/v1/transactions",
        params={"page_size": 100},
        headers=auth_headers,
    )
    assert tx_resp.status_code == 200
    tx_data = tx_resp.json()
    transactions = tx_data["items"]
    assert tx_data["total"] >= 1
    # Find the auto-created installment transaction by entry_pattern and installment_number
    installment_txs = [
        t for t in transactions
        if t.get("entry_pattern") == "installment" and t.get("installment_number") == 1
    ]
    assert len(installment_txs) == 1
    tx = installment_txs[0]
    assert tx["entry_pattern"] == "installment"
    assert tx["installment_number"] == 1
    assert Decimal(tx["amount"]) == Decimal("100.00")  # 1200/12
    assert tx["type"] == "expense"
    assert tx["is_recurring"] is True


@pytest.mark.asyncio
async def test_installment_first_payment_progress(client: AsyncClient, auth_headers: dict):
    """Verify progress reflects first payment."""
    resp = await client.post("/api/v1/installments", json={
        "name": "Progress Test",
        "total_amount": "600.00",
        "number_of_payments": 6,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "first_payment_made": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payments_completed"] == 1
    # progress = 1/6 * 100 = 16.7%
    assert abs(data["progress_percentage"] - 16.7) < 0.1


@pytest.mark.asyncio
async def test_installment_first_payment_single_payment(client: AsyncClient, auth_headers: dict):
    """Single payment installment with first_payment_made=True should complete it."""
    resp = await client.post("/api/v1/installments", json={
        "name": "Single Payment",
        "total_amount": "500.00",
        "number_of_payments": 1,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "first_payment_made": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payments_completed"] == 1
    assert data["status"] == "completed"


# ---- Loan Tests ----


@pytest.mark.asyncio
async def test_loan_first_payment_false_default(client: AsyncClient, auth_headers: dict):
    """Default: first_payment_made=False -> payments_made=0."""
    resp = await client.post("/api/v1/loans", json={
        "name": "Test Loan Default",
        "original_amount": "10000.00",
        "monthly_payment": "1000.00",
        "interest_rate": "0",
        "total_payments": 10,
        "start_date": "2026-01-15",
        "day_of_month": 15,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payments_made"] == 0
    assert Decimal(data["remaining_balance"]) == Decimal("10000.00")


@pytest.mark.asyncio
async def test_loan_first_payment_true_no_interest(client: AsyncClient, auth_headers: dict):
    """first_payment_made=True with 0% interest -> remaining reduced by monthly payment."""
    resp = await client.post("/api/v1/loans", json={
        "name": "Loan First Paid",
        "original_amount": "10000.00",
        "monthly_payment": "1000.00",
        "interest_rate": "0",
        "total_payments": 10,
        "start_date": "2026-01-15",
        "day_of_month": 15,
        "first_payment_made": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payments_made"] == 1
    assert Decimal(data["remaining_balance"]) == Decimal("9000.00")
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_loan_first_payment_true_with_interest(client: AsyncClient, auth_headers: dict):
    """first_payment_made=True with interest -> remaining reflects interest calculation."""
    resp = await client.post("/api/v1/loans", json={
        "name": "Loan Interest First Paid",
        "original_amount": "12000.00",
        "monthly_payment": "1100.00",
        "interest_rate": "12.00",
        "total_payments": 12,
        "start_date": "2026-01-15",
        "day_of_month": 15,
        "first_payment_made": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payments_made"] == 1
    # Monthly interest = 12000 * 12% / 12 = 120.00
    # Principal = 1100 - 120 = 980.00
    # Remaining = 12000 - 980 = 11020.00
    assert Decimal(data["remaining_balance"]) == Decimal("11020.00")
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_loan_first_payment_single_payment(client: AsyncClient, auth_headers: dict):
    """Single payment loan with first_payment_made=True should complete."""
    resp = await client.post("/api/v1/loans", json={
        "name": "Single Payment Loan",
        "original_amount": "5000.00",
        "monthly_payment": "5000.00",
        "interest_rate": "0",
        "total_payments": 1,
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "first_payment_made": True,
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payments_made"] == 1
    assert Decimal(data["remaining_balance"]) == Decimal("0")
    assert data["status"] == "completed"
