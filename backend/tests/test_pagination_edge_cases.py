from __future__ import annotations

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helper: create a transaction quickly
# ---------------------------------------------------------------------------
async def _create_transaction(
    client: AsyncClient, auth_headers: dict, idx: int = 0
) -> dict:
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "amount": 100 + idx,
            "type": "expense",
            "description": f"Pagination test {idx}",
            "date": "2026-02-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# 1. page=0 rejected (ge=1 means minimum is 1)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_zero_rejected(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page=0", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 2. page=-1 rejected
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_negative_rejected(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page=-1", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 3. Very large page number returns empty items, not an error
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_very_large_empty_result(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page=999999", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["page"] == 999999


# ---------------------------------------------------------------------------
# 4. page_size=0 rejected (ge=1)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_size_zero_rejected(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page_size=0", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 5. page_size=-1 rejected
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_size_negative_rejected(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page_size=-1", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 6. page_size=101 exceeds max (le=100), should be rejected
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_size_exceeds_max_rejected(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page_size=101", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 7. page_size=100 is exactly the max and should work
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_size_exactly_max(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page_size=100", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["page_size"] == 100


# ---------------------------------------------------------------------------
# 8. Default pagination returns page=1, page_size=20
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_default_pagination(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/transactions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["page_size"] == 20


# ---------------------------------------------------------------------------
# 9. Total count is accurate after creating 5 items
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_pagination_total_count_accurate(
    client: AsyncClient, auth_headers: dict
):
    for i in range(5):
        await _create_transaction(client, auth_headers, idx=i)

    resp = await client.get("/api/v1/transactions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5


# ---------------------------------------------------------------------------
# 10. Second page returns correct items (3 items, page_size=2 -> page 2 = 1)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_pagination_second_page(client: AsyncClient, auth_headers: dict):
    for i in range(3):
        await _create_transaction(client, auth_headers, idx=i)

    resp = await client.get(
        "/api/v1/transactions?page=2&page_size=2", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["total"] == 3
    assert data["page"] == 2
    assert data["pages"] == 2


# ---------------------------------------------------------------------------
# 11. page_size=1 returns exactly 1 item
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_size_one(client: AsyncClient, auth_headers: dict):
    for i in range(3):
        await _create_transaction(client, auth_headers, idx=i)

    resp = await client.get(
        "/api/v1/transactions?page_size=1", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["total"] == 3


# ---------------------------------------------------------------------------
# 12. Non-integer page value is rejected
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_non_integer_page_rejected(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page=abc", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 13. Float page value is rejected
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_float_page_rejected(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/transactions?page=1.5", headers=auth_headers
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 14. Categories endpoint also paginates
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_pagination_on_categories(client: AsyncClient, auth_headers: dict):
    # Categories are seeded (13 seed categories), so we just test pagination params
    resp = await client.get(
        "/api/v1/categories?page=1&page_size=5", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 5
    assert data["page"] == 1
    assert data["page_size"] == 5
    assert data["total"] >= 5  # at least the seed categories

    # page_size=0 should also be rejected on categories
    resp2 = await client.get(
        "/api/v1/categories?page_size=0", headers=auth_headers
    )
    assert resp2.status_code == 422


# ---------------------------------------------------------------------------
# 15. Fixed endpoint also paginates
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_pagination_on_fixed(client: AsyncClient, auth_headers: dict):
    # Create 3 fixed items
    for i in range(3):
        resp = await client.post(
            "/api/v1/fixed",
            json={
                "name": f"Fixed {i}",
                "amount": 500 + i,
                "type": "expense",
                "day_of_month": 15,
                "start_date": "2026-01-01",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    resp = await client.get(
        "/api/v1/fixed?page=1&page_size=2", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) <= 2  # fixed returns a plain list, not paginated wrapper

    # page=0 should be rejected on fixed as well
    resp2 = await client.get(
        "/api/v1/fixed?page=0", headers=auth_headers
    )
    assert resp2.status_code == 422
