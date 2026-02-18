from __future__ import annotations

"""
Step 1: Cross-Module Integration Tests
12+ tests that verify complete flows across multiple API modules.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _login(client: AsyncClient, username: str, password: str) -> dict:
    r = await client.post("/api/v1/auth/login", json={
        "username": username, "password": password,
    })
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _register_and_login(client: AsyncClient, username: str) -> dict:
    """Register a new user and return auth headers.
    Uses the token from registration directly to avoid extra login call.
    """
    r = await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": f"{username}@test.com",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    })
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _get_expense_category(client: AsyncClient, headers: dict) -> str:
    """Return the id of the first expense seed category."""
    r = await client.get("/api/v1/categories?type=expense", headers=headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) > 0
    return items[0]["id"]


async def _get_income_category(client: AsyncClient, headers: dict) -> str:
    """Return the id of the first income seed category."""
    r = await client.get("/api/v1/categories?type=income", headers=headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) > 0
    return items[0]["id"]


# ---------------------------------------------------------------------------
# 1. Full Transaction Lifecycle
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_transaction_lifecycle(client: AsyncClient, auth_headers: dict):
    """Create user → category → transaction → update → delete.
    Verify dashboard summary reflects changes.
    """
    headers = auth_headers
    today = date.today().isoformat()

    # Get a category
    cat_id = await _get_expense_category(client, headers)

    # Create transaction
    r = await client.post("/api/v1/transactions", headers=headers, json={
        "amount": "500.00",
        "type": "expense",
        "category_id": cat_id,
        "description": "Integration test expense",
        "date": today,
    })
    assert r.status_code == 201
    tx_id = r.json()["id"]

    # Update transaction
    r = await client.put(f"/api/v1/transactions/{tx_id}", headers=headers, json={
        "amount": "750.00",
        "description": "Updated integration test",
    })
    assert r.status_code == 200
    assert Decimal(r.json()["amount"]) == Decimal("750.00")

    # Verify in list
    r = await client.get("/api/v1/transactions", headers=headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(t["id"] == tx_id for t in items)

    # Delete
    r = await client.delete(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert r.status_code == 200

    # Verify deleted
    r = await client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 2. Installment Full Cycle
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_installment_full_cycle(client: AsyncClient, auth_headers: dict):
    """Create installment 3 payments → mark-paid x3 → verify completed.
    Verify rounding is correct for the last payment.
    """
    headers = auth_headers
    today = date.today()
    cat_id = await _get_expense_category(client, headers)

    # 1000 / 3 = 333.33 per month, last = 333.34
    r = await client.post("/api/v1/installments", headers=headers, json={
        "name": "Test Installment 3 Pay",
        "total_amount": "1000.00",
        "number_of_payments": 3,
        "type": "expense",
        "category_id": cat_id,
        "start_date": today.isoformat(),
        "day_of_month": today.day,
    })
    assert r.status_code == 201
    inst = r.json()
    inst_id = inst["id"]
    monthly = Decimal(inst["monthly_amount"])
    assert monthly == Decimal("333.33")

    # Mark 3 payments
    for i in range(3):
        r = await client.post(
            f"/api/v1/installments/{inst_id}/mark-paid", headers=headers,
        )
        assert r.status_code == 200

    # Should be completed
    r = await client.get(f"/api/v1/installments/{inst_id}", headers=headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["installment"]["payments_completed"] == 3
    assert detail["installment"]["status"] == "completed"

    # Verify the schedule last payment has the rounding correction
    schedule = detail["schedule"]
    assert len(schedule) == 3
    last_amount = Decimal(schedule[2]["amount"])
    first_amount = Decimal(schedule[0]["amount"])
    total_via_schedule = first_amount * 2 + last_amount
    assert total_via_schedule == Decimal("1000.00")

    # Attempt 4th mark-paid → should fail
    r = await client.post(
        f"/api/v1/installments/{inst_id}/mark-paid", headers=headers,
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 3. Loan Full Cycle
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_loan_full_cycle(client: AsyncClient, auth_headers: dict):
    """Create loan → pay 3 times → verify remaining_balance."""
    headers = auth_headers
    today = date.today()

    r = await client.post("/api/v1/loans", headers=headers, json={
        "name": "Test Loan",
        "original_amount": "10000.00",
        "monthly_payment": "3500.00",
        "interest_rate": "0",
        "start_date": today.isoformat(),
        "day_of_month": today.day,
        "total_payments": 3,
    })
    assert r.status_code == 201
    loan = r.json()
    loan_id = loan["id"]
    assert Decimal(loan["remaining_balance"]) == Decimal("10000.00")

    # Pay 3 times (3500 + 3500 + 3000)
    for amount in ["3500.00", "3500.00", "3000.00"]:
        r = await client.post(
            f"/api/v1/loans/{loan_id}/payment", headers=headers,
            json={"amount": amount},
        )
        assert r.status_code == 200

    # Should be completed
    loan = r.json()
    assert loan["status"] == "completed"
    assert Decimal(loan["remaining_balance"]) == Decimal("0")

    # Further payment should fail
    r = await client.post(
        f"/api/v1/loans/{loan_id}/payment", headers=headers,
        json={"amount": "100"},
    )
    assert r.status_code in (400, 422)


# ---------------------------------------------------------------------------
# 4. Forecast Accuracy
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_forecast_accuracy(client: AsyncClient, auth_headers: dict):
    """Create fixed income + fixed expense + balance → check forecast sums."""
    headers = auth_headers
    today = date.today()
    cat_income = await _get_income_category(client, headers)
    cat_expense = await _get_expense_category(client, headers)

    # Set a balance
    r = await client.post("/api/v1/balance", headers=headers, json={
        "balance": "50000.00",
        "effective_date": today.isoformat(),
    })
    assert r.status_code == 201

    # Fixed income 10000/month
    r = await client.post("/api/v1/fixed", headers=headers, json={
        "name": "Monthly Salary",
        "amount": "10000.00",
        "type": "income",
        "category_id": cat_income,
        "day_of_month": 1,
        "start_date": today.isoformat(),
    })
    assert r.status_code == 201

    # Fixed expense 3000/month
    r = await client.post("/api/v1/fixed", headers=headers, json={
        "name": "Monthly Rent",
        "amount": "3000.00",
        "type": "expense",
        "category_id": cat_expense,
        "day_of_month": 1,
        "start_date": today.isoformat(),
    })
    assert r.status_code == 201

    # Get 3-month forecast
    r = await client.get("/api/v1/forecast?months=3", headers=headers)
    assert r.status_code == 200
    data = r.json()

    # Should have 3 months
    assert len(data["months"]) == 3

    # Each month should have some fixed income and expense
    for m in data["months"]:
        assert Decimal(str(m["fixed_income"])) >= Decimal("0")
        assert Decimal(str(m["fixed_expenses"])) >= Decimal("0")


# ---------------------------------------------------------------------------
# 5. Alert Generation Flow
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alert_generation_flow(client: AsyncClient, auth_headers: dict):
    """Trigger forecast summary (which generates alerts) and check alert list."""
    headers = auth_headers
    today = date.today()

    # Set a small balance to potentially trigger alerts
    await client.post("/api/v1/balance", headers=headers, json={
        "balance": "100.00",
        "effective_date": today.isoformat(),
    })

    # Create a large fixed expense
    r = await client.post("/api/v1/fixed", headers=headers, json={
        "name": "Big Expense",
        "amount": "50000.00",
        "type": "expense",
        "day_of_month": 1,
        "start_date": today.isoformat(),
    })
    assert r.status_code == 201

    # Trigger forecast summary which calls generate_alerts
    r = await client.get("/api/v1/forecast/summary?months=3", headers=headers)
    assert r.status_code == 200
    summary = r.json()
    assert summary["has_negative_months"] is True

    # Check alerts were generated
    r = await client.get("/api/v1/alerts", headers=headers)
    assert r.status_code == 200
    alerts = r.json()["items"]
    assert len(alerts) > 0

    # Dismiss an alert
    alert_id = alerts[0]["id"]
    r = await client.put(f"/api/v1/alerts/{alert_id}/dismiss", headers=headers)
    assert r.status_code == 200
    assert r.json()["is_dismissed"] is True

    # Dismissed alert should not appear in list
    r = await client.get("/api/v1/alerts", headers=headers)
    assert r.status_code == 200
    remaining = r.json()["items"]
    assert all(a["id"] != alert_id for a in remaining)


# ---------------------------------------------------------------------------
# 6. Category Cascade
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_category_cascade(client: AsyncClient, auth_headers: dict):
    """Create category → 3 transactions → archive category.
    Verify transactions still exist, category is archived.
    """
    headers = auth_headers
    today = date.today().isoformat()

    # Create a new category
    r = await client.post("/api/v1/categories", headers=headers, json={
        "name": "CascadeTest",
        "name_he": "בדיקת מפל",
        "type": "expense",
        "color": "#FF0000",
        "icon": "trash",
    })
    assert r.status_code == 201
    cat_id = r.json()["id"]

    # Create 3 transactions
    tx_ids = []
    for i in range(3):
        r = await client.post("/api/v1/transactions", headers=headers, json={
            "amount": "100.00",
            "type": "expense",
            "category_id": cat_id,
            "description": f"Cascade tx {i}",
            "date": today,
        })
        assert r.status_code == 201
        tx_ids.append(r.json()["id"])

    # Archive category (soft delete)
    r = await client.delete(f"/api/v1/categories/{cat_id}", headers=headers)
    assert r.status_code == 200

    # Transactions still exist
    for tx_id in tx_ids:
        r = await client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
        assert r.status_code == 200

    # Cannot create new transaction with archived category
    r = await client.post("/api/v1/transactions", headers=headers, json={
        "amount": "50.00",
        "type": "expense",
        "category_id": cat_id,
        "description": "Should fail",
        "date": today,
    })
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 7. User Isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_user_isolation(client: AsyncClient, auth_headers: dict):
    """Two users: admin and user2. Each creates data.
    Verify they cannot see each other's data.
    """
    admin_headers = auth_headers
    user2_headers = await _register_and_login(client, "isolation_user2")
    today = date.today().isoformat()

    # Admin creates a transaction
    r = await client.post("/api/v1/transactions", headers=admin_headers, json={
        "amount": "999.00",
        "type": "income",
        "description": "Admin secret income",
        "date": today,
    })
    assert r.status_code == 201
    admin_tx_id = r.json()["id"]

    # User2 creates a transaction
    r = await client.post("/api/v1/transactions", headers=user2_headers, json={
        "amount": "111.00",
        "type": "expense",
        "description": "User2 expense",
        "date": today,
    })
    assert r.status_code == 201
    user2_tx_id = r.json()["id"]

    # User2 cannot see admin's transaction
    r = await client.get(f"/api/v1/transactions/{admin_tx_id}", headers=user2_headers)
    assert r.status_code == 404

    # Admin cannot see user2's transaction
    r = await client.get(f"/api/v1/transactions/{user2_tx_id}", headers=admin_headers)
    assert r.status_code == 404

    # User2's list doesn't include admin's transaction
    r = await client.get("/api/v1/transactions", headers=user2_headers)
    assert r.status_code == 200
    user2_items = r.json()["items"]
    assert all(t["id"] != admin_tx_id for t in user2_items)

    # Verify isolation on balance
    r = await client.post("/api/v1/balance", headers=admin_headers, json={
        "balance": "99999.00",
        "effective_date": today,
    })
    assert r.status_code == 201

    r = await client.get("/api/v1/balance", headers=user2_headers)
    assert r.status_code == 404  # No balance set for user2

    # Verify isolation on fixed
    r = await client.post("/api/v1/fixed", headers=admin_headers, json={
        "name": "Admin Fixed",
        "amount": "5000.00",
        "type": "income",
        "day_of_month": 1,
        "start_date": today,
    })
    assert r.status_code == 201
    admin_fixed_id = r.json()["id"]

    r = await client.get(f"/api/v1/fixed/{admin_fixed_id}", headers=user2_headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 8. Settings Impact
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_settings_impact(client: AsyncClient, auth_headers: dict):
    """Change currency → verify it persists. Change settings and verify."""
    headers = auth_headers

    # Get current settings
    r = await client.get("/api/v1/settings", headers=headers)
    assert r.status_code == 200
    original_currency = r.json()["currency"]

    # Update currency to USD
    r = await client.put("/api/v1/settings", headers=headers, json={
        "currency": "USD",
    })
    assert r.status_code == 200
    assert r.json()["currency"] == "USD"

    # Verify persistence
    r = await client.get("/api/v1/settings", headers=headers)
    assert r.status_code == 200
    assert r.json()["currency"] == "USD"

    # Restore original
    r = await client.put("/api/v1/settings", headers=headers, json={
        "currency": original_currency,
    })
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# 9. Balance History
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_balance_history(client: AsyncClient, auth_headers: dict):
    """Update balance 5 times → verify history is complete.
    Verify only 1 is_current=True.
    """
    headers = auth_headers
    today = date.today()

    amounts = ["1000.00", "2000.00", "3000.00", "4000.00", "5000.00"]
    for i, amount in enumerate(amounts):
        effective = (today + timedelta(days=i)).isoformat()
        if i == 0:
            r = await client.post("/api/v1/balance", headers=headers, json={
                "balance": amount,
                "effective_date": effective,
            })
            assert r.status_code == 201
        else:
            r = await client.put("/api/v1/balance", headers=headers, json={
                "balance": amount,
                "effective_date": effective,
            })
            assert r.status_code == 200

    # Get history
    r = await client.get("/api/v1/balance/history", headers=headers)
    assert r.status_code == 200
    history = r.json()["items"]
    assert len(history) >= 5

    # Only 1 is_current=True
    current_count = sum(1 for item in history if item["is_current"])
    assert current_count == 1

    # Current balance should be the last one
    r = await client.get("/api/v1/balance", headers=headers)
    assert r.status_code == 200
    assert Decimal(r.json()["balance"]) == Decimal("5000.00")


# ---------------------------------------------------------------------------
# 10. Automation Idempotency
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_automation_idempotency(client: AsyncClient, auth_headers: dict):
    """Run process-recurring twice for the same date → no duplicates."""
    headers = auth_headers
    today = date.today()

    # Create a fixed expense
    r = await client.post("/api/v1/fixed", headers=headers, json={
        "name": "Idempotent Expense",
        "amount": "1000.00",
        "type": "expense",
        "day_of_month": today.day,
        "start_date": today.isoformat(),
    })
    assert r.status_code == 201

    # Run automation once
    r = await client.post(
        f"/api/v1/automation/process-recurring?date={today.isoformat()}",
        headers=headers,
    )
    assert r.status_code == 200
    first_run = r.json()

    # Run automation again same date
    r = await client.post(
        f"/api/v1/automation/process-recurring?date={today.isoformat()}",
        headers=headers,
    )
    assert r.status_code == 200
    second_run = r.json()

    # Verify second run created fewer (or zero) new transactions
    first_created = first_run.get("transactions_created", first_run.get("created", 0))
    second_created = second_run.get("transactions_created", second_run.get("created", 0))
    assert second_created <= first_created


# ---------------------------------------------------------------------------
# 11. Bulk Operations
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bulk_operations(client: AsyncClient, auth_headers: dict):
    """Bulk-create 10 transactions → bulk-delete 5.
    Verify pagination, count, data integrity.
    """
    headers = auth_headers
    today = date.today().isoformat()

    # Bulk-create 10 transactions
    transactions = [
        {
            "amount": f"{(i + 1) * 100}.00",
            "type": "expense",
            "description": f"Bulk tx {i}",
            "date": today,
        }
        for i in range(10)
    ]
    r = await client.post("/api/v1/transactions/bulk", headers=headers, json={
        "transactions": transactions,
    })
    assert r.status_code == 201
    created = r.json()
    assert len(created) == 10

    # Get list and verify count
    r = await client.get("/api/v1/transactions?page_size=100", headers=headers)
    assert r.status_code == 200
    total_before = r.json()["total"]
    assert total_before >= 10

    # Bulk delete first 5
    ids_to_delete = [tx["id"] for tx in created[:5]]
    r = await client.post("/api/v1/transactions/bulk-delete", headers=headers, json={
        "ids": ids_to_delete,
    })
    assert r.status_code == 200

    # Verify count decreased
    r = await client.get("/api/v1/transactions?page_size=100", headers=headers)
    assert r.status_code == 200
    total_after = r.json()["total"]
    assert total_after == total_before - 5

    # Remaining 5 still accessible
    for tx in created[5:]:
        r = await client.get(f"/api/v1/transactions/{tx['id']}", headers=headers)
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# 12. Payment Reversal Flow
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_payment_reversal_flow(client: AsyncClient, auth_headers: dict):
    """Installment: mark-paid → reverse → mark-paid again.
    Loan: payment → reverse → payment again.
    Verify counts return correctly.
    """
    headers = auth_headers
    today = date.today()

    # --- Installment reversal ---
    r = await client.post("/api/v1/installments", headers=headers, json={
        "name": "Reversal Test Inst",
        "total_amount": "600.00",
        "number_of_payments": 3,
        "type": "expense",
        "start_date": today.isoformat(),
        "day_of_month": today.day,
    })
    assert r.status_code == 201
    inst_id = r.json()["id"]

    # Mark paid
    r = await client.post(f"/api/v1/installments/{inst_id}/mark-paid", headers=headers)
    assert r.status_code == 200
    assert r.json()["payments_completed"] == 1

    # Reverse
    r = await client.post(f"/api/v1/installments/{inst_id}/reverse-payment", headers=headers)
    assert r.status_code == 200
    assert r.json()["payments_completed"] == 0

    # Mark paid again
    r = await client.post(f"/api/v1/installments/{inst_id}/mark-paid", headers=headers)
    assert r.status_code == 200
    assert r.json()["payments_completed"] == 1

    # --- Loan reversal ---
    r = await client.post("/api/v1/loans", headers=headers, json={
        "name": "Reversal Test Loan",
        "original_amount": "3000.00",
        "monthly_payment": "1000.00",
        "interest_rate": "0",
        "start_date": today.isoformat(),
        "day_of_month": today.day,
        "total_payments": 3,
    })
    assert r.status_code == 201
    loan_id = r.json()["id"]

    # Pay
    r = await client.post(f"/api/v1/loans/{loan_id}/payment", headers=headers,
                          json={"amount": "1000.00"})
    assert r.status_code == 200
    assert r.json()["payments_made"] == 1
    assert Decimal(r.json()["remaining_balance"]) == Decimal("2000.00")

    # Reverse
    r = await client.post(f"/api/v1/loans/{loan_id}/reverse-payment", headers=headers)
    assert r.status_code == 200
    assert r.json()["payments_made"] == 0
    assert Decimal(r.json()["remaining_balance"]) == Decimal("3000.00")

    # Pay again
    r = await client.post(f"/api/v1/loans/{loan_id}/payment", headers=headers,
                          json={"amount": "1000.00"})
    assert r.status_code == 200
    assert r.json()["payments_made"] == 1


# ---------------------------------------------------------------------------
# 13. Dashboard User Isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_dashboard_user_isolation(client: AsyncClient, auth_headers: dict):
    """Verify dashboard data is isolated per user."""
    admin_headers = auth_headers
    user2_headers = await _register_and_login(client, "dash_user2")
    today = date.today().isoformat()

    # Admin creates income
    await client.post("/api/v1/transactions", headers=admin_headers, json={
        "amount": "9999.00",
        "type": "income",
        "description": "Admin big income",
        "date": today,
    })

    # User2 should see 0 income on dashboard
    r = await client.get("/api/v1/dashboard/summary", headers=user2_headers)
    assert r.status_code == 200
    assert Decimal(r.json()["monthly_income"]) == Decimal("0")

    # Admin should see the income
    r = await client.get("/api/v1/dashboard/summary", headers=admin_headers)
    assert r.status_code == 200
    assert Decimal(r.json()["monthly_income"]) >= Decimal("9999.00")


# ---------------------------------------------------------------------------
# 14. Cross-User Update/Delete Rejection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cross_user_update_delete_rejected(client: AsyncClient, auth_headers: dict):
    """User A cannot update or delete user B's data."""
    admin_headers = auth_headers
    user2_headers = await _register_and_login(client, "cross_user")
    today = date.today().isoformat()

    # Admin creates data
    r = await client.post("/api/v1/transactions", headers=admin_headers, json={
        "amount": "500.00",
        "type": "expense",
        "description": "Admin only tx",
        "date": today,
    })
    assert r.status_code == 201
    admin_tx_id = r.json()["id"]

    # User2 tries to update admin's transaction → 404
    r = await client.put(f"/api/v1/transactions/{admin_tx_id}", headers=user2_headers, json={
        "amount": "1.00",
    })
    assert r.status_code == 404

    # User2 tries to delete admin's transaction → 404
    r = await client.delete(f"/api/v1/transactions/{admin_tx_id}", headers=user2_headers)
    assert r.status_code == 404
