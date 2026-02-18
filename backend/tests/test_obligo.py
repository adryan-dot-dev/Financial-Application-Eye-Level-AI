from __future__ import annotations

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_credit_card(client: AsyncClient, auth_headers: dict) -> dict:
    """Create a credit card and return its JSON response."""
    resp = await client.post("/api/v1/credit-cards", json={
        "name": "Test Visa",
        "last_four_digits": "4321",
        "card_network": "visa",
        "issuer": "Leumi",
        "credit_limit": 10000,
        "billing_day": 10,
        "currency": "ILS",
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_loan(client: AsyncClient, auth_headers: dict) -> dict:
    """Create a loan and return its JSON response."""
    resp = await client.post("/api/v1/loans", json={
        "name": "Test Loan",
        "original_amount": 50000,
        "interest_rate": 5.0,
        "monthly_payment": 1000,
        "total_payments": 60,
        "start_date": "2026-01-01",
        "day_of_month": 15,
        "currency": "ILS",
        "type": "expense",
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_obligo_summary_empty(client: AsyncClient, auth_headers: dict):
    """With no credit cards, loans or overdraft the summary should be all zeros."""
    response = await client.get("/api/v1/obligo", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert float(data["total_credit_card_limits"]) == 0
    assert float(data["total_credit_utilization"]) == 0
    assert float(data["total_loan_outstanding"]) == 0
    assert float(data["total_overdraft_limits"]) == 0
    assert float(data["total_obligo"]) == 0


@pytest.mark.asyncio
async def test_obligo_summary_with_cards(client: AsyncClient, auth_headers: dict):
    """Creating a credit card should increase total_credit_card_limits."""
    await _create_credit_card(client, auth_headers)

    response = await client.get("/api/v1/obligo", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert float(data["total_credit_card_limits"]) == 10000


@pytest.mark.asyncio
async def test_obligo_summary_with_loans(client: AsyncClient, auth_headers: dict):
    """Creating a loan should increase total_loan_outstanding."""
    await _create_loan(client, auth_headers)

    response = await client.get("/api/v1/obligo", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert float(data["total_loan_outstanding"]) == 50000


@pytest.mark.asyncio
async def test_obligo_details_empty(client: AsyncClient, auth_headers: dict):
    """With no data the details items list should be empty."""
    response = await client.get("/api/v1/obligo/details", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []


@pytest.mark.asyncio
async def test_obligo_details_with_data(client: AsyncClient, auth_headers: dict):
    """Creating a card and a loan should produce detail items."""
    await _create_credit_card(client, auth_headers)
    await _create_loan(client, auth_headers)

    response = await client.get("/api/v1/obligo/details", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 2

    types_found = {item["type"] for item in data["items"]}
    assert "credit_card" in types_found
    assert "loan" in types_found


@pytest.mark.asyncio
async def test_obligo_requires_auth(client: AsyncClient):
    """Obligo endpoints without auth should return 403."""
    response = await client.get("/api/v1/obligo")
    assert response.status_code == 403

    response = await client.get("/api/v1/obligo/details")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_obligo_summary_fields(client: AsyncClient, auth_headers: dict):
    """Verify the summary response contains all expected fields."""
    response = await client.get("/api/v1/obligo", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    expected_fields = [
        "total_credit_card_limits",
        "total_credit_utilization",
        "total_loan_outstanding",
        "total_overdraft_limits",
        "total_obligo",
        "total_available_credit",
        "obligo_utilization_pct",
    ]
    for field in expected_fields:
        assert field in data, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_obligo_details_has_summary(client: AsyncClient, auth_headers: dict):
    """The details response should include a summary object."""
    response = await client.get("/api/v1/obligo/details", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "total_obligo" in data["summary"]
    assert "total_credit_card_limits" in data["summary"]
