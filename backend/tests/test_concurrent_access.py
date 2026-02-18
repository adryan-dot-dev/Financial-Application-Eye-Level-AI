from __future__ import annotations

"""
Concurrent database access tests.

These tests use asyncio.gather() to fire multiple simultaneous HTTP requests
and verify that the application handles concurrent access correctly:
- No data corruption (counters, balances stay consistent)
- No deadlocks (all requests complete within timeout)
- No 500 errors (every response is a valid success or business-rule rejection)
"""

import asyncio
from decimal import Decimal
from typing import List

import pytest
from httpx import AsyncClient, Response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fire_concurrent(coros: list) -> List[Response]:
    """Fire multiple coroutines concurrently and return results.

    Any individual exception is captured as an Exception object in the
    returned list so the caller can inspect it rather than crashing the
    whole gather.
    """
    return await asyncio.gather(*coros, return_exceptions=True)


def _assert_no_server_errors(results: list, context: str = "") -> None:
    """Assert that none of the gathered results are exceptions or 5xx."""
    for i, r in enumerate(results):
        assert not isinstance(r, Exception), (
            f"{context} request #{i} raised an exception: {r}"
        )
        assert r.status_code < 500, (
            f"{context} request #{i} returned 5xx: {r.status_code} {r.text}"
        )


# ---------------------------------------------------------------------------
# 1. Concurrent transaction creation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_transaction_creation(
    client: AsyncClient, auth_headers: dict
):
    """Fire 5 concurrent POST /transactions and verify all succeed with no
    data corruption.  Each transaction gets a unique description so we can
    verify they were all persisted independently.
    """
    num_concurrent = 5

    async def create_tx(i: int) -> Response:
        return await client.post(
            "/api/v1/transactions",
            json={
                "amount": 100 + i,
                "type": "income",
                "date": "2026-02-01",
                "description": f"concurrent_tx_{i}",
            },
            headers=auth_headers,
        )

    results = await _fire_concurrent([create_tx(i) for i in range(num_concurrent)])

    # No 500s or exceptions
    _assert_no_server_errors(results, "transaction creation")

    # All should succeed with 201
    for i, r in enumerate(results):
        assert r.status_code == 201, (
            f"Transaction #{i} failed: {r.status_code} {r.text}"
        )

    # Verify that all 5 were actually persisted (distinct IDs)
    created_ids = {r.json()["id"] for r in results}
    assert len(created_ids) == num_concurrent, (
        f"Expected {num_concurrent} unique IDs, got {len(created_ids)}"
    )

    # Verify via list endpoint that total count includes them all
    list_resp = await client.get("/api/v1/transactions", headers=auth_headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= num_concurrent

    # Verify amounts are correct (no cross-contamination between rows)
    expected_amounts = {str(Decimal(100 + i).quantize(Decimal("0.01"))) for i in range(num_concurrent)}
    actual_amounts = set()
    for r in results:
        actual_amounts.add(r.json()["amount"])
    assert actual_amounts == expected_amounts, (
        f"Amount mismatch: expected {expected_amounts}, got {actual_amounts}"
    )


# ---------------------------------------------------------------------------
# 2. Concurrent balance updates
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_balance_updates(
    client: AsyncClient, auth_headers: dict
):
    """Fire 5 concurrent POST /balance with different amounts.

    The balance endpoint uses SELECT ... FOR UPDATE to prevent races.  After
    the concurrent barrage only ONE balance row should be marked is_current.
    """
    num_concurrent = 5

    async def create_balance(i: int) -> Response:
        return await client.post(
            "/api/v1/balance",
            json={
                "balance": 1000 + i * 100,
                "effective_date": f"2026-02-{10 + i:02d}",
                "notes": f"concurrent_balance_{i}",
            },
            headers=auth_headers,
        )

    results = await _fire_concurrent(
        [create_balance(i) for i in range(num_concurrent)]
    )

    _assert_no_server_errors(results, "balance creation")

    # Count successes (201) and business-rule rejections (4xx)
    successes = [r for r in results if r.status_code == 201]
    assert len(successes) >= 1, "At least one balance creation should succeed"

    # Verify exactly one balance is current
    current_resp = await client.get("/api/v1/balance", headers=auth_headers)
    assert current_resp.status_code == 200
    assert current_resp.json()["is_current"] is True

    # History should have all persisted entries
    history_resp = await client.get("/api/v1/balance/history", headers=auth_headers)
    assert history_resp.status_code == 200
    history_items = history_resp.json()["items"]
    current_count = sum(1 for item in history_items if item["is_current"])
    assert current_count == 1, (
        f"Expected exactly 1 current balance, found {current_count}"
    )


# ---------------------------------------------------------------------------
# 3. Concurrent installment mark-paid
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_installment_payments(
    client: AsyncClient, auth_headers: dict
):
    """Create an installment with 6 payments, then fire 3 concurrent
    mark-paid requests.

    The endpoint uses SELECT ... FOR UPDATE so at most each call should
    increment by exactly 1.  Final payments_completed must equal the number
    of successful mark-paid responses (no double-counting).
    """
    # Create installment
    create_resp = await client.post(
        "/api/v1/installments",
        json={
            "name": "Concurrent Installment",
            "total_amount": 6000,
            "number_of_payments": 6,
            "type": "expense",
            "start_date": "2026-01-01",
            "day_of_month": 15,
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    inst_id = create_resp.json()["id"]

    num_concurrent = 3

    async def mark_paid() -> Response:
        return await client.post(
            f"/api/v1/installments/{inst_id}/mark-paid",
            headers=auth_headers,
        )

    results = await _fire_concurrent([mark_paid() for _ in range(num_concurrent)])
    _assert_no_server_errors(results, "installment mark-paid")

    # Count how many succeeded (200) vs. rejected (422 = already completed)
    success_count = sum(1 for r in results if r.status_code == 200)
    assert success_count >= 1, "At least one mark-paid should succeed"

    # Verify final state: payments_completed must match success count exactly
    detail_resp = await client.get(
        f"/api/v1/installments/{inst_id}", headers=auth_headers
    )
    assert detail_resp.status_code == 200
    final_completed = detail_resp.json()["installment"]["payments_completed"]
    assert final_completed == success_count, (
        f"Data race detected: payments_completed={final_completed} "
        f"but only {success_count} requests returned 200"
    )
    # Payments should never exceed number_of_payments
    assert final_completed <= 6


# ---------------------------------------------------------------------------
# 4. Concurrent loan payments
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_loan_payments(
    client: AsyncClient, auth_headers: dict
):
    """Create a loan with 10 payments, fire 3 concurrent payment requests.

    The loan endpoint uses SELECT ... FOR UPDATE.  After the barrage
    payments_made must equal the number of successful responses and
    remaining_balance must be consistent.
    """
    # Create a zero-interest loan for simple arithmetic
    create_resp = await client.post(
        "/api/v1/loans",
        json={
            "name": "Concurrent Loan",
            "original_amount": 10000,
            "monthly_payment": 1000,
            "interest_rate": 0,
            "start_date": "2026-01-01",
            "day_of_month": 1,
            "total_payments": 10,
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    loan_id = create_resp.json()["id"]

    num_concurrent = 3

    async def record_payment() -> Response:
        return await client.post(
            f"/api/v1/loans/{loan_id}/payment",
            json={"amount": 1000},
            headers=auth_headers,
        )

    results = await _fire_concurrent(
        [record_payment() for _ in range(num_concurrent)]
    )
    _assert_no_server_errors(results, "loan payment")

    success_count = sum(1 for r in results if r.status_code == 200)
    assert success_count >= 1, "At least one payment should succeed"

    # Verify final loan state via list endpoint (avoids stale-session
    # issues that can surface after concurrent FOR UPDATE locks).
    list_resp = await client.get("/api/v1/loans", headers=auth_headers)
    assert list_resp.status_code == 200
    loans = list_resp.json()
    loan_data = next((l for l in loans if l["id"] == loan_id), None)
    assert loan_data is not None, f"Loan {loan_id} not found in list"
    payments_made = loan_data["payments_made"]
    remaining = Decimal(loan_data["remaining_balance"])

    assert payments_made == success_count, (
        f"Data race detected: payments_made={payments_made} "
        f"but {success_count} requests returned 200"
    )
    assert payments_made <= 10, "payments_made exceeds total_payments"

    # Remaining balance should be original - (success_count * payment_amount)
    expected_remaining = Decimal("10000") - (Decimal("1000") * success_count)
    assert remaining == expected_remaining, (
        f"Balance inconsistency: expected {expected_remaining}, got {remaining}"
    )


# ---------------------------------------------------------------------------
# 5. Concurrent category creation (unique names)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_category_creation(
    client: AsyncClient, auth_headers: dict
):
    """Fire 5 concurrent POST /categories with unique names.

    Each should succeed because names are distinct.  Verify no duplicate IDs
    and all names persisted correctly.
    """
    num_concurrent = 5

    async def create_category(i: int) -> Response:
        return await client.post(
            "/api/v1/categories",
            json={
                "name": f"concurrent_cat_{i}",
                "name_he": f"קטגוריה_{i}",
                "type": "expense",
                "icon": "tag",
                "color": f"#{i:02d}{i:02d}{i:02d}",
            },
            headers=auth_headers,
        )

    results = await _fire_concurrent(
        [create_category(i) for i in range(num_concurrent)]
    )
    _assert_no_server_errors(results, "category creation")

    # All should succeed
    for i, r in enumerate(results):
        assert r.status_code == 201, (
            f"Category #{i} failed: {r.status_code} {r.text}"
        )

    # All IDs should be unique
    created_ids = {r.json()["id"] for r in results}
    assert len(created_ids) == num_concurrent

    # Verify names are all distinct and correct
    created_names = {r.json()["name"] for r in results}
    expected_names = {f"concurrent_cat_{i}" for i in range(num_concurrent)}
    assert created_names == expected_names


# ---------------------------------------------------------------------------
# 6. Concurrent reads and writes on transactions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_read_write(
    client: AsyncClient, auth_headers: dict
):
    """Fire simultaneous reads (GET) and writes (POST) on /transactions.

    The goal is to detect deadlocks or 500 errors caused by interleaved
    read/write sessions, not to test CRUD logic.
    """
    # Seed a few transactions first so reads have data to return
    for i in range(3):
        resp = await client.post(
            "/api/v1/transactions",
            json={
                "amount": 50 + i,
                "type": "expense",
                "date": "2026-02-01",
                "description": f"seed_tx_{i}",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def read_transactions() -> Response:
        return await client.get(
            "/api/v1/transactions", headers=auth_headers
        )

    async def write_transaction(i: int) -> Response:
        return await client.post(
            "/api/v1/transactions",
            json={
                "amount": 200 + i,
                "type": "income",
                "date": "2026-02-15",
                "description": f"concurrent_rw_{i}",
            },
            headers=auth_headers,
        )

    # Interleave: read, write, read, write, read, write, read
    coros = []
    for i in range(4):
        coros.append(read_transactions())
        coros.append(write_transaction(i))
    coros.append(read_transactions())

    results = await _fire_concurrent(coros)
    _assert_no_server_errors(results, "concurrent read/write")

    # Separate reads and writes
    reads = [r for r in results if r.request.method == "GET"]
    writes = [r for r in results if r.request.method == "POST"]

    # All reads should return 200
    for r in reads:
        assert r.status_code == 200, f"Read failed: {r.status_code} {r.text}"

    # All writes should return 201
    for r in writes:
        assert r.status_code == 201, f"Write failed: {r.status_code} {r.text}"

    # Final verification: total count should include seed + concurrent writes
    final_resp = await client.get(
        "/api/v1/transactions", headers=auth_headers
    )
    assert final_resp.status_code == 200
    total = final_resp.json()["total"]
    # 3 seed + 4 concurrent writes = 7 minimum
    assert total >= 7, f"Expected at least 7 transactions, got {total}"
