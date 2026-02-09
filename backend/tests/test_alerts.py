from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_alerts_initially_empty(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/alerts", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "unread_count" in data


@pytest.mark.asyncio
async def test_unread_alerts_count(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/alerts/unread", headers=auth_headers)
    assert response.status_code == 200
    assert "count" in response.json()


@pytest.mark.asyncio
async def test_alerts_generated_on_negative_forecast(client: AsyncClient, auth_headers: dict):
    """When forecast shows negative balance, alerts should be generated."""
    # Small balance
    await client.post("/api/v1/balance", json={
        "balance": 500,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    # Large recurring expense
    await client.post("/api/v1/fixed", json={
        "name": "Huge Expense",
        "amount": 10000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    # Trigger forecast summary (which generates alerts)
    await client.get("/api/v1/forecast/summary?months=3", headers=auth_headers)

    # Check alerts
    response = await client.get("/api/v1/alerts", headers=auth_headers)
    data = response.json()
    assert len(data["items"]) > 0
    assert data["unread_count"] > 0

    # Should have negative_cashflow alert
    alert_types = [a["alert_type"] for a in data["items"]]
    assert "negative_cashflow" in alert_types


@pytest.mark.asyncio
async def test_mark_alert_as_read(client: AsyncClient, auth_headers: dict):
    # Generate an alert first
    await client.post("/api/v1/balance", json={
        "balance": 100,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)
    await client.post("/api/v1/fixed", json={
        "name": "Big Bill",
        "amount": 8000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    await client.get("/api/v1/forecast/summary?months=2", headers=auth_headers)

    # Get alerts
    alerts_resp = await client.get("/api/v1/alerts", headers=auth_headers)
    items = alerts_resp.json()["items"]
    assert len(items) > 0
    alert_id = items[0]["id"]

    # Mark as read
    response = await client.put(f"/api/v1/alerts/{alert_id}/read", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_read"] is True


@pytest.mark.asyncio
async def test_dismiss_alert(client: AsyncClient, auth_headers: dict):
    # Generate an alert
    await client.post("/api/v1/balance", json={
        "balance": 50,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)
    await client.post("/api/v1/fixed", json={
        "name": "Expense Dismiss",
        "amount": 9000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    await client.get("/api/v1/forecast/summary?months=2", headers=auth_headers)

    alerts_resp = await client.get("/api/v1/alerts", headers=auth_headers)
    items = alerts_resp.json()["items"]
    assert len(items) > 0
    alert_id = items[0]["id"]

    # Dismiss
    response = await client.put(f"/api/v1/alerts/{alert_id}/dismiss", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_dismissed"] is True

    # Should not appear in list anymore
    alerts_resp2 = await client.get("/api/v1/alerts", headers=auth_headers)
    ids = [a["id"] for a in alerts_resp2.json()["items"]]
    assert alert_id not in ids
