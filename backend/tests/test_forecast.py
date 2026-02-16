from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_forecast_empty(client: AsyncClient, auth_headers: dict):
    """Forecast with no data should return zeros."""
    response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["current_balance"] == "0"
    assert len(data["months"]) == 3


@pytest.mark.asyncio
async def test_forecast_with_balance_and_fixed(client: AsyncClient, auth_headers: dict):
    """Forecast with balance + fixed income/expense should calculate correctly."""
    # Set balance
    await client.post("/api/v1/balance", json={
        "balance": 10000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    # Add fixed income
    await client.post("/api/v1/fixed", json={
        "name": "Salary",
        "amount": 15000,
        "type": "income",
        "day_of_month": 10,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    # Add fixed expense
    await client.post("/api/v1/fixed", json={
        "name": "Rent",
        "amount": 5000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["current_balance"] == "10000.00"
    assert len(data["months"]) == 3

    # Each month should have 15000 income and 5000 expense
    for month in data["months"]:
        assert month["fixed_income"] == "15000.00"
        assert month["fixed_expenses"] == "5000.00"


@pytest.mark.asyncio
async def test_forecast_negative_balance_detection(client: AsyncClient, auth_headers: dict):
    """Forecast should detect when balance goes negative."""
    # Small balance
    await client.post("/api/v1/balance", json={
        "balance": 1000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    # Large expense
    await client.post("/api/v1/fixed", json={
        "name": "Big Expense",
        "amount": 5000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
    data = response.json()
    assert data["has_negative_months"] is True
    assert data["first_negative_month"] is not None


@pytest.mark.asyncio
async def test_weekly_forecast(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/forecast/weekly?weeks=4", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["weeks"]) == 4
    # Each week should have week_start and week_end
    for week in data["weeks"]:
        assert "week_start" in week
        assert "week_end" in week
        assert "income" in week
        assert "expenses" in week
        assert "running_balance" in week


@pytest.mark.asyncio
async def test_forecast_summary(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/forecast/summary?months=3", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "current_balance" in data
    assert "forecast_months" in data
    assert data["forecast_months"] == 3
    assert "total_expected_income" in data
    assert "total_expected_expenses" in data
    assert "net_projected" in data
    assert "end_balance" in data
    assert "has_negative_months" in data
    assert "alerts_count" in data


@pytest.mark.asyncio
async def test_forecast_with_installments(client: AsyncClient, auth_headers: dict):
    """Forecast should include installment payments."""
    await client.post("/api/v1/balance", json={
        "balance": 20000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    await client.post("/api/v1/installments", json={
        "name": "Phone",
        "total_amount": 3600,
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2026-02-01",
        "day_of_month": 15,
    }, headers=auth_headers)

    response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
    data = response.json()
    # Each month should include installment expense of 300
    for month in data["months"]:
        assert float(month["installment_expenses"]) >= 0


@pytest.mark.asyncio
async def test_forecast_with_loans(client: AsyncClient, auth_headers: dict):
    """Forecast should include loan payments."""
    await client.post("/api/v1/balance", json={
        "balance": 50000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    await client.post("/api/v1/loans", json={
        "name": "Car Loan",
        "original_amount": 60000,
        "monthly_payment": 1500,
        "interest_rate": 0,
        "start_date": "2026-02-01",
        "day_of_month": 10,
        "total_payments": 48,
    }, headers=auth_headers)

    response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
    data = response.json()
    for month in data["months"]:
        assert float(month["loan_payments"]) >= 0
