from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_loan(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/v1/loans", json={
        "name": "Car Loan",
        "original_amount": 100000,
        "monthly_payment": 2000,
        "interest_rate": 3.5,
        "start_date": "2026-01-01",
        "day_of_month": 15,
        "total_payments": 60,
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Car Loan"
    assert data["original_amount"] == "100000.00"
    assert data["monthly_payment"] == "2000.00"
    assert data["interest_rate"] == "3.50"
    assert data["remaining_balance"] == "100000.00"
    assert data["status"] == "active"
    assert data["payments_made"] == 0


@pytest.mark.asyncio
async def test_create_loan_zero_interest(client: AsyncClient, auth_headers: dict):
    """Test creating a loan with 0% interest (edge case: no divide by zero)."""
    response = await client.post("/api/v1/loans", json={
        "name": "Interest-Free Loan",
        "original_amount": 10000,
        "monthly_payment": 1000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 5,
        "total_payments": 10,
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["interest_rate"] == "0.00"


@pytest.mark.asyncio
async def test_list_loans(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/loans", json={
        "name": "Loan 1",
        "original_amount": 50000,
        "monthly_payment": 1500,
        "start_date": "2026-01-01",
        "day_of_month": 10,
        "total_payments": 36,
    }, headers=auth_headers)

    response = await client.get("/api/v1/loans", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_get_loan_with_amortization(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Amortization Test",
        "original_amount": 12000,
        "monthly_payment": 1000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "total_payments": 12,
    }, headers=auth_headers)
    lid = create_resp.json()["id"]

    response = await client.get(f"/api/v1/loans/{lid}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["amortization"]) == 12
    # First payment should be on 2026-01-01
    assert data["amortization"][0]["date"] == "2026-01-01"
    assert data["amortization"][0]["payment_number"] == 1


@pytest.mark.asyncio
async def test_record_loan_payment(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Payment Test",
        "original_amount": 5000,
        "monthly_payment": 500,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 10,
        "total_payments": 10,
    }, headers=auth_headers)
    lid = create_resp.json()["id"]

    # Record a payment
    response = await client.post(f"/api/v1/loans/{lid}/payment", json={
        "amount": 500,
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["payments_made"] == 1
    assert data["remaining_balance"] == "4500.00"


@pytest.mark.asyncio
async def test_loan_completes_after_all_payments(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Complete Loan",
        "original_amount": 1000,
        "monthly_payment": 500,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "total_payments": 2,
    }, headers=auth_headers)
    lid = create_resp.json()["id"]

    # Payment 1
    await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 500}, headers=auth_headers)
    # Payment 2
    response = await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 500}, headers=auth_headers)
    data = response.json()
    assert data["status"] == "completed"
    assert data["remaining_balance"] == "0.00"


@pytest.mark.asyncio
async def test_update_loan(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Update Me",
        "original_amount": 20000,
        "monthly_payment": 1000,
        "start_date": "2026-01-01",
        "day_of_month": 5,
        "total_payments": 24,
    }, headers=auth_headers)
    lid = create_resp.json()["id"]

    response = await client.put(f"/api/v1/loans/{lid}", json={
        "name": "Updated Loan",
        "status": "paused",
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Loan"
    assert response.json()["status"] == "paused"


@pytest.mark.asyncio
async def test_delete_loan(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Delete Me",
        "original_amount": 5000,
        "monthly_payment": 500,
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "total_payments": 10,
    }, headers=auth_headers)
    lid = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/loans/{lid}", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_loan_breakdown(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Breakdown Test",
        "original_amount": 6000,
        "monthly_payment": 1000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "total_payments": 6,
    }, headers=auth_headers)
    lid = create_resp.json()["id"]

    response = await client.get(f"/api/v1/loans/{lid}/breakdown", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 6
