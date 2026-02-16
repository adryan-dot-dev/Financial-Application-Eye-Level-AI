from __future__ import annotations

import pytest
from httpx import AsyncClient


# ─── Helper functions ──────────────────────────────────────────────


async def _create_loan(client: AsyncClient, headers: dict, **overrides) -> dict:
    """Create a loan and return its JSON response."""
    data = {
        "name": "Test Loan",
        "original_amount": 10000,
        "monthly_payment": 1000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 15,
        "total_payments": 10,
    }
    data.update(overrides)
    resp = await client.post("/api/v1/loans", json=data, headers=headers)
    assert resp.status_code == 201, f"Failed to create loan: {resp.text}"
    return resp.json()


async def _create_fixed(client: AsyncClient, headers: dict, **overrides) -> dict:
    """Create a fixed income/expense and return its JSON response."""
    data = {
        "name": "Test Fixed",
        "amount": 5000,
        "type": "income",
        "day_of_month": 15,
        "start_date": "2026-01-01",
    }
    data.update(overrides)
    resp = await client.post("/api/v1/fixed", json=data, headers=headers)
    assert resp.status_code == 201, f"Failed to create fixed: {resp.text}"
    return resp.json()


async def _create_installment(client: AsyncClient, headers: dict, **overrides) -> dict:
    """Create an installment and return its JSON response."""
    data = {
        "name": "Test Installment",
        "total_amount": 6000,
        "number_of_payments": 6,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 15,
    }
    data.update(overrides)
    resp = await client.post("/api/v1/installments", json=data, headers=headers)
    assert resp.status_code == 201, f"Failed to create installment: {resp.text}"
    return resp.json()


async def _process_recurring(
    client: AsyncClient, headers: dict, target_date: str
) -> dict:
    """Call the process-recurring endpoint and return the result."""
    resp = await client.post(
        f"/api/v1/automation/process-recurring?date={target_date}",
        headers=headers,
    )
    assert resp.status_code == 200, f"Failed to process recurring: {resp.text}"
    return resp.json()


async def _preview_recurring(
    client: AsyncClient, headers: dict, target_date: str
) -> dict:
    """Call the preview endpoint and return the result."""
    resp = await client.post(
        f"/api/v1/automation/process-recurring/preview?date={target_date}",
        headers=headers,
    )
    assert resp.status_code == 200, f"Failed to preview recurring: {resp.text}"
    return resp.json()


async def _get_transactions(
    client: AsyncClient, headers: dict
) -> list:
    """Get all transactions for the current user."""
    resp = await client.get("/api/v1/transactions", headers=headers)
    assert resp.status_code == 200
    return resp.json()["items"]


# ─── Loan Auto-Charge Tests ───────────────────────────────────────


@pytest.mark.asyncio
async def test_loan_auto_charge_creates_transaction(
    client: AsyncClient, auth_headers: dict
):
    """Test that processing a loan on its day_of_month creates a transaction."""
    loan = await _create_loan(client, auth_headers, day_of_month=15)

    result = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result["loans_charged"] == 1
    assert result["fixed_charged"] == 0
    assert result["installments_charged"] == 0
    assert result["skipped"] == 0

    # Verify the transaction was created
    txns = await _get_transactions(client, auth_headers)
    loan_txns = [t for t in txns if t["loan_id"] == loan["id"]]
    assert len(loan_txns) == 1
    assert loan_txns[0]["type"] == "expense"
    assert loan_txns[0]["amount"] == "1000.00"
    assert loan_txns[0]["is_recurring"] is True
    assert "Loan payment: Test Loan" in loan_txns[0]["description"]


@pytest.mark.asyncio
async def test_loan_auto_charge_increments_payments_made(
    client: AsyncClient, auth_headers: dict
):
    """Test that processing a loan increments payments_made."""
    loan = await _create_loan(client, auth_headers, day_of_month=15)

    await _process_recurring(client, auth_headers, "2026-02-15")

    # Check loan status
    resp = await client.get(f"/api/v1/loans/{loan['id']}", headers=auth_headers)
    assert resp.status_code == 200
    loan_data = resp.json()["loan"]
    assert loan_data["payments_made"] == 1


@pytest.mark.asyncio
async def test_loan_completes_when_all_payments_made(
    client: AsyncClient, auth_headers: dict
):
    """Test that a loan is marked completed when all payments are made."""
    loan = await _create_loan(
        client, auth_headers,
        day_of_month=15,
        total_payments=2,
        original_amount=2000,
        monthly_payment=1000,
    )

    # First payment
    await _process_recurring(client, auth_headers, "2026-02-15")
    # Second (final) payment
    await _process_recurring(client, auth_headers, "2026-03-15")

    # Check loan status
    resp = await client.get(f"/api/v1/loans/{loan['id']}", headers=auth_headers)
    assert resp.status_code == 200
    loan_data = resp.json()["loan"]
    assert loan_data["payments_made"] == 2
    assert loan_data["status"] == "completed"
    assert loan_data["remaining_balance"] == "0.00"


@pytest.mark.asyncio
async def test_loan_wrong_day_not_charged(
    client: AsyncClient, auth_headers: dict
):
    """Test that a loan is NOT charged on a day that doesn't match day_of_month."""
    await _create_loan(client, auth_headers, day_of_month=15)

    result = await _process_recurring(client, auth_headers, "2026-02-10")

    assert result["loans_charged"] == 0


# ─── Fixed Income/Expense Auto-Charge Tests ───────────────────────


@pytest.mark.asyncio
async def test_fixed_income_creates_transaction(
    client: AsyncClient, auth_headers: dict
):
    """Test that a fixed income entry creates a transaction on its day."""
    fixed = await _create_fixed(
        client, auth_headers,
        name="Monthly Salary",
        amount=15000,
        type="income",
        day_of_month=15,
        start_date="2026-01-01",
    )

    result = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result["fixed_charged"] == 1

    txns = await _get_transactions(client, auth_headers)
    fixed_txns = [t for t in txns if t["recurring_source_id"] == fixed["id"]]
    assert len(fixed_txns) == 1
    assert fixed_txns[0]["type"] == "income"
    assert fixed_txns[0]["amount"] == "15000.00"
    assert fixed_txns[0]["is_recurring"] is True
    assert "Fixed income: Monthly Salary" in fixed_txns[0]["description"]


@pytest.mark.asyncio
async def test_fixed_expense_creates_transaction(
    client: AsyncClient, auth_headers: dict
):
    """Test that a fixed expense entry creates a transaction on its day."""
    fixed = await _create_fixed(
        client, auth_headers,
        name="Office Rent",
        amount=3000,
        type="expense",
        day_of_month=15,
        start_date="2026-01-01",
    )

    result = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result["fixed_charged"] == 1

    txns = await _get_transactions(client, auth_headers)
    fixed_txns = [t for t in txns if t["recurring_source_id"] == fixed["id"]]
    assert len(fixed_txns) == 1
    assert fixed_txns[0]["type"] == "expense"
    assert fixed_txns[0]["amount"] == "3000.00"


@pytest.mark.asyncio
async def test_paused_fixed_entries_skipped(
    client: AsyncClient, auth_headers: dict
):
    """Test that paused (is_active=False) fixed entries are skipped."""
    fixed = await _create_fixed(
        client, auth_headers,
        day_of_month=15,
        start_date="2026-01-01",
    )

    # Pause the entry
    resp = await client.post(
        f"/api/v1/fixed/{fixed['id']}/pause", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    result = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result["fixed_charged"] == 0


@pytest.mark.asyncio
async def test_fixed_date_range_start_date_filter(
    client: AsyncClient, auth_headers: dict
):
    """Test that fixed entries are skipped if reference_date is before start_date."""
    await _create_fixed(
        client, auth_headers,
        day_of_month=15,
        start_date="2026-06-01",
    )

    # Process for a date before start_date
    result = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result["fixed_charged"] == 0


@pytest.mark.asyncio
async def test_fixed_date_range_end_date_filter(
    client: AsyncClient, auth_headers: dict
):
    """Test that fixed entries are skipped if reference_date is after end_date."""
    await _create_fixed(
        client, auth_headers,
        day_of_month=15,
        start_date="2026-01-01",
        end_date="2026-03-01",
    )

    # Process for a date after end_date
    result = await _process_recurring(client, auth_headers, "2026-04-15")

    assert result["fixed_charged"] == 0


@pytest.mark.asyncio
async def test_fixed_within_date_range(
    client: AsyncClient, auth_headers: dict
):
    """Test that fixed entries within date range are processed."""
    await _create_fixed(
        client, auth_headers,
        day_of_month=15,
        start_date="2026-01-01",
        end_date="2026-12-31",
    )

    result = await _process_recurring(client, auth_headers, "2026-06-15")

    assert result["fixed_charged"] == 1


# ─── Installment Auto-Charge Tests ────────────────────────────────


@pytest.mark.asyncio
async def test_installment_auto_charge_creates_transaction(
    client: AsyncClient, auth_headers: dict
):
    """Test that an installment creates a transaction on its day."""
    inst = await _create_installment(
        client, auth_headers,
        name="New TV",
        total_amount=6000,
        number_of_payments=6,
        type="expense",
        day_of_month=15,
        start_date="2026-01-01",
    )

    result = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result["installments_charged"] == 1

    txns = await _get_transactions(client, auth_headers)
    inst_txns = [t for t in txns if t["installment_id"] == inst["id"]]
    assert len(inst_txns) == 1
    assert inst_txns[0]["type"] == "expense"
    assert inst_txns[0]["amount"] == "1000.00"
    assert inst_txns[0]["is_recurring"] is True
    assert "Installment: New TV (1/6)" in inst_txns[0]["description"]


@pytest.mark.asyncio
async def test_installment_increments_payments_completed(
    client: AsyncClient, auth_headers: dict
):
    """Test that processing an installment increments payments_completed."""
    inst = await _create_installment(
        client, auth_headers,
        day_of_month=15,
    )

    await _process_recurring(client, auth_headers, "2026-02-15")

    # Check installment status
    resp = await client.get(
        f"/api/v1/installments/{inst['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    inst_data = resp.json()["installment"]
    assert inst_data["payments_completed"] == 1


@pytest.mark.asyncio
async def test_installment_completed_not_charged(
    client: AsyncClient, auth_headers: dict
):
    """Test that completed installments (all payments done) are skipped."""
    inst = await _create_installment(
        client, auth_headers,
        total_amount=2000,
        number_of_payments=2,
        day_of_month=15,
    )

    # Process two payments
    await _process_recurring(client, auth_headers, "2026-02-15")
    await _process_recurring(client, auth_headers, "2026-03-15")

    # Third attempt should skip
    result = await _process_recurring(client, auth_headers, "2026-04-15")

    assert result["installments_charged"] == 0
    assert result["skipped"] == 1


# ─── Idempotency Tests ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_idempotency_loan(
    client: AsyncClient, auth_headers: dict
):
    """Test that running process twice on same date doesn't duplicate loan transactions."""
    await _create_loan(client, auth_headers, day_of_month=15)

    # Process twice on same date
    result1 = await _process_recurring(client, auth_headers, "2026-02-15")
    result2 = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result1["loans_charged"] == 1
    assert result2["loans_charged"] == 0
    assert result2["skipped"] == 1

    # Verify only one transaction exists
    txns = await _get_transactions(client, auth_headers)
    loan_txns = [t for t in txns if t["loan_id"] is not None]
    assert len(loan_txns) == 1


@pytest.mark.asyncio
async def test_idempotency_fixed(
    client: AsyncClient, auth_headers: dict
):
    """Test that running process twice on same date doesn't duplicate fixed transactions."""
    await _create_fixed(client, auth_headers, day_of_month=15, start_date="2026-01-01")

    result1 = await _process_recurring(client, auth_headers, "2026-02-15")
    result2 = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result1["fixed_charged"] == 1
    assert result2["fixed_charged"] == 0
    assert result2["skipped"] == 1


@pytest.mark.asyncio
async def test_idempotency_installment(
    client: AsyncClient, auth_headers: dict
):
    """Test that running process twice on same date doesn't duplicate installment transactions."""
    await _create_installment(client, auth_headers, day_of_month=15)

    result1 = await _process_recurring(client, auth_headers, "2026-02-15")
    result2 = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result1["installments_charged"] == 1
    assert result2["installments_charged"] == 0
    assert result2["skipped"] == 1


# ─── Preview Tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_preview_does_not_create_transactions(
    client: AsyncClient, auth_headers: dict
):
    """Test that preview mode does not create any transactions."""
    await _create_loan(client, auth_headers, day_of_month=15)
    await _create_fixed(client, auth_headers, day_of_month=15, start_date="2026-01-01")

    result = await _preview_recurring(client, auth_headers, "2026-02-15")

    assert result["loans_charged"] == 1
    assert result["fixed_charged"] == 1
    assert "preview_transactions" in result
    assert len(result["preview_transactions"]) == 2

    # Verify NO actual transactions were created
    txns = await _get_transactions(client, auth_headers)
    recurring_txns = [t for t in txns if t["is_recurring"]]
    assert len(recurring_txns) == 0


@pytest.mark.asyncio
async def test_preview_shows_correct_details(
    client: AsyncClient, auth_headers: dict
):
    """Test that preview returns correct transaction details."""
    await _create_loan(
        client, auth_headers,
        name="Car Loan",
        monthly_payment=2000,
        day_of_month=15,
    )

    result = await _preview_recurring(client, auth_headers, "2026-02-15")

    assert len(result["preview_transactions"]) == 1
    preview_tx = result["preview_transactions"][0]
    assert preview_tx["source"] == "loan"
    assert preview_tx["amount"] == "2000.00"
    assert preview_tx["type"] == "expense"
    assert "Car Loan" in preview_tx["description"]
    assert preview_tx["date"] == "2026-02-15"


# ─── Mixed Processing Tests ───────────────────────────────────────


@pytest.mark.asyncio
async def test_process_all_types_together(
    client: AsyncClient, auth_headers: dict
):
    """Test processing loans, fixed, and installments all at once."""
    await _create_loan(client, auth_headers, day_of_month=15)
    await _create_fixed(
        client, auth_headers,
        name="Salary",
        amount=10000,
        type="income",
        day_of_month=15,
        start_date="2026-01-01",
    )
    await _create_installment(
        client, auth_headers,
        day_of_month=15,
    )

    result = await _process_recurring(client, auth_headers, "2026-02-15")

    assert result["loans_charged"] == 1
    assert result["fixed_charged"] == 1
    assert result["installments_charged"] == 1
    assert result["skipped"] == 0


@pytest.mark.asyncio
async def test_no_charges_on_wrong_day(
    client: AsyncClient, auth_headers: dict
):
    """Test that nothing is charged when no items match the target day."""
    await _create_loan(client, auth_headers, day_of_month=15)
    await _create_fixed(client, auth_headers, day_of_month=15, start_date="2026-01-01")
    await _create_installment(client, auth_headers, day_of_month=15)

    result = await _process_recurring(client, auth_headers, "2026-02-10")

    assert result["loans_charged"] == 0
    assert result["fixed_charged"] == 0
    assert result["installments_charged"] == 0
    assert result["skipped"] == 0


@pytest.mark.asyncio
async def test_process_without_date_param(
    client: AsyncClient, auth_headers: dict
):
    """Test that processing without a date parameter works (defaults to today)."""
    resp = await client.post(
        "/api/v1/automation/process-recurring",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # Should succeed with zero charges (no items match today necessarily)
    assert "loans_charged" in data
    assert "fixed_charged" in data
    assert "installments_charged" in data
    assert "skipped" in data
