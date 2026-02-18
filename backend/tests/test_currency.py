from __future__ import annotations

import pytest
from httpx import AsyncClient

# Expected supported currencies (must match exchange_rate_service.SUPPORTED_CURRENCIES)
EXPECTED_CURRENCIES = {"ILS", "USD", "EUR"}


@pytest.mark.asyncio
async def test_supported_currencies(client: AsyncClient, auth_headers: dict):
    """GET /supported returns all expected supported currencies."""
    response = await client.get("/api/v1/currency/supported", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert "currencies" in data

    codes = {c["code"] for c in data["currencies"]}
    assert codes == EXPECTED_CURRENCIES

    # Each currency item should have code, name, and symbol
    for item in data["currencies"]:
        assert "code" in item
        assert "name" in item
        assert "symbol" in item
        assert len(item["code"]) == 3


@pytest.mark.asyncio
async def test_exchange_rates_default_base(client: AsyncClient, auth_headers: dict):
    """GET /rates with no base param defaults to ILS and returns a rates dict."""
    response = await client.get("/api/v1/currency/rates", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["base_currency"] == "ILS"
    assert "rates" in data
    assert isinstance(data["rates"], dict)
    # The base currency itself should be present with rate 1
    assert float(data["rates"]["ILS"]) == 1.0


@pytest.mark.asyncio
async def test_exchange_rates_custom_base(client: AsyncClient, auth_headers: dict):
    """GET /rates?base=USD returns rates relative to USD."""
    response = await client.get(
        "/api/v1/currency/rates", params={"base": "USD"}, headers=auth_headers
    )
    assert response.status_code == 200

    data = response.json()
    assert data["base_currency"] == "USD"
    assert isinstance(data["rates"], dict)
    # USD rate relative to itself should be 1
    assert float(data["rates"]["USD"]) == 1.0


@pytest.mark.asyncio
async def test_convert_currency(client: AsyncClient, auth_headers: dict):
    """GET /convert?amount=100&from=USD&to=ILS returns a positive converted amount."""
    response = await client.get(
        "/api/v1/currency/convert",
        params={"amount": "100", "from": "USD", "to": "ILS"},
        headers=auth_headers,
    )
    assert response.status_code == 200

    data = response.json()
    assert data["from_currency"] == "USD"
    assert data["to_currency"] == "ILS"
    assert float(data["original_amount"]) == 100.0
    assert float(data["converted_amount"]) > 0
    assert float(data["exchange_rate"]) > 0


@pytest.mark.asyncio
async def test_convert_same_currency(client: AsyncClient, auth_headers: dict):
    """GET /convert with from==to should return the same amount (rate 1)."""
    response = await client.get(
        "/api/v1/currency/convert",
        params={"amount": "100", "from": "ILS", "to": "ILS"},
        headers=auth_headers,
    )
    assert response.status_code == 200

    data = response.json()
    assert float(data["original_amount"]) == 100.0
    assert float(data["converted_amount"]) == 100.0
    assert float(data["exchange_rate"]) == 1.0


@pytest.mark.asyncio
async def test_currency_requires_auth(client: AsyncClient):
    """All currency endpoints should return 401 without auth headers."""
    endpoints = [
        "/api/v1/currency/supported",
        "/api/v1/currency/rates",
        "/api/v1/currency/convert",
    ]
    for endpoint in endpoints:
        response = await client.get(endpoint)
        assert response.status_code in (401, 403), (
            f"Expected 401/403 for {endpoint} without auth, got {response.status_code}"
        )
