from __future__ import annotations

import pytest
from datetime import date
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _create_fixed(
    client: AsyncClient,
    auth_headers: dict,
    *,
    day_of_month: int = 15,
    start_date: str = "2026-01-01",
    end_date: str = None,
    name: str = "Test Fixed",
    type: str = "expense",
) -> dict:
    payload = {
        "name": name,
        "amount": 1000,
        "type": type,
        "day_of_month": day_of_month,
        "start_date": start_date,
    }
    if end_date is not None:
        payload["end_date"] = end_date
    resp = await client.post("/api/v1/fixed", json=payload, headers=auth_headers)
    return resp


async def _create_installment(
    client: AsyncClient,
    auth_headers: dict,
    *,
    start_date: str = "2026-01-31",
    day_of_month: int = 31,
    number_of_payments: int = 6,
    name: str = "Test Installment",
) -> dict:
    resp = await client.post(
        "/api/v1/installments",
        json={
            "name": name,
            "total_amount": 6000,
            "number_of_payments": number_of_payments,
            "type": "expense",
            "start_date": start_date,
            "day_of_month": day_of_month,
        },
        headers=auth_headers,
    )
    return resp


async def _create_loan(
    client: AsyncClient,
    auth_headers: dict,
    *,
    start_date: str = "2025-06-01",
    name: str = "Test Loan",
) -> dict:
    resp = await client.post(
        "/api/v1/loans",
        json={
            "name": name,
            "original_amount": 50000,
            "monthly_payment": 2000,
            "interest_rate": 5.0,
            "start_date": start_date,
            "day_of_month": 10,
            "total_payments": 30,
        },
        headers=auth_headers,
    )
    return resp


# ---------------------------------------------------------------------------
# 1. Fixed with day_of_month=31, starting in February
#    The server should accept this; the forecast/schedule logic clamps the day.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_fixed_day_31_in_february(client: AsyncClient, auth_headers: dict):
    resp = await _create_fixed(
        client, auth_headers, day_of_month=31, start_date="2026-02-01"
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["day_of_month"] == 31  # stored as-is; clamped at runtime


# ---------------------------------------------------------------------------
# 2. Fixed with day_of_month=30, starting in February
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_fixed_day_30_in_february(client: AsyncClient, auth_headers: dict):
    resp = await _create_fixed(
        client, auth_headers, day_of_month=30, start_date="2026-02-01"
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["day_of_month"] == 30


# ---------------------------------------------------------------------------
# 3. Fixed with day_of_month=29 in a leap year (Feb 2028)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_fixed_day_29_leap_year(client: AsyncClient, auth_headers: dict):
    resp = await _create_fixed(
        client, auth_headers, day_of_month=29, start_date="2028-02-01"
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["day_of_month"] == 29


# ---------------------------------------------------------------------------
# 4. Fixed with day_of_month=29 in a non-leap year (Feb 2027)
#    Should still be accepted; clamped at schedule computation time.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_fixed_day_29_non_leap_year(client: AsyncClient, auth_headers: dict):
    resp = await _create_fixed(
        client, auth_headers, day_of_month=29, start_date="2027-02-01"
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["day_of_month"] == 29


# ---------------------------------------------------------------------------
# 5. Installment starting on the 31st — schedule should clamp each month
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_installment_start_date_end_of_month(
    client: AsyncClient, auth_headers: dict
):
    resp = await _create_installment(
        client, auth_headers, start_date="2026-01-31", day_of_month=31
    )
    assert resp.status_code == 201
    inst_id = resp.json()["id"]

    # Fetch the detail with schedule
    detail_resp = await client.get(
        f"/api/v1/installments/{inst_id}", headers=auth_headers
    )
    assert detail_resp.status_code == 200
    schedule = detail_resp.json()["schedule"]
    assert len(schedule) == 6

    # February (index 1) should be clamped to 28 (2026 is not a leap year)
    feb_date = schedule[1]["date"]
    assert feb_date == "2026-02-28"


# ---------------------------------------------------------------------------
# 6. Loan with start_date in the past should work fine
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_loan_start_date_past(client: AsyncClient, auth_headers: dict):
    resp = await _create_loan(
        client, auth_headers, start_date="2024-01-01"
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["start_date"] == "2024-01-01"


# ---------------------------------------------------------------------------
# 7. Transaction date far in the future (2030)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_transaction_date_far_future(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "amount": 500,
            "type": "income",
            "description": "Future income",
            "date": "2030-12-31",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["date"] == "2030-12-31"


# ---------------------------------------------------------------------------
# 8. Transaction date far in the past (2020)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_transaction_date_far_past(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "amount": 300,
            "type": "expense",
            "description": "Old expense",
            "date": "2020-01-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["date"] == "2020-01-01"


# ---------------------------------------------------------------------------
# 9. Fixed: end_date before start_date should be rejected
#    The FixedCreate schema has a model_validator that raises ValueError,
#    which Pydantic turns into a 422. The endpoint also checks explicitly.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_fixed_end_date_before_start_date_rejected(
    client: AsyncClient, auth_headers: dict
):
    resp = await _create_fixed(
        client,
        auth_headers,
        start_date="2026-06-01",
        end_date="2026-01-01",  # before start
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 10. Forecast months=0 should be rejected (ge=1)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_forecast_months_zero(client: AsyncClient, auth_headers: dict):
    # Need a balance for forecast to work, but months=0 is rejected by Query validation
    resp = await client.get(
        "/api/v1/forecast?months=0", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 11. Forecast months=-1 should be rejected
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_forecast_months_negative(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/forecast?months=-1", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 12. Forecast months=24 (max) should work (assuming balance exists)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_forecast_months_max(client: AsyncClient, auth_headers: dict):
    # Create a balance first so forecast can compute
    await client.post(
        "/api/v1/balance",
        json={"balance": 10000, "effective_date": "2026-02-01"},
        headers=auth_headers,
    )
    resp = await client.get(
        "/api/v1/forecast?months=24", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["months"]) == 24


# ---------------------------------------------------------------------------
# 13. Forecast months=25 exceeds max (le=24), should be rejected
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_forecast_months_over_max(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/forecast?months=25", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 14. Expected-income month normalization — "2026-02-15" → stored as "2026-02-01"
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_expected_income_month_normalization(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.put(
        "/api/v1/expected-income/2026-02-15",
        json={"expected_amount": 20000},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["month"] == "2026-02-01"


# ---------------------------------------------------------------------------
# 15. Balance with effective_date = today should work
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_balance_effective_date_today(client: AsyncClient, auth_headers: dict):
    today = date.today().isoformat()
    resp = await client.post(
        "/api/v1/balance",
        json={"balance": 5000, "effective_date": today},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["effective_date"] == today
