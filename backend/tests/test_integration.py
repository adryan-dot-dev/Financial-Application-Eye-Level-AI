from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from datetime import date


# ---------------------------------------------------------------------------
# Helper: register a second user and return its auth headers
# ---------------------------------------------------------------------------
async def _register_and_login(
    client: AsyncClient, username: str, email: str, password: str
) -> dict:
    """Register a new user and return auth headers."""
    await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": username,
        "password": password,
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. Balance -> Forecast flow
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_balance_forecast_flow(client: AsyncClient, auth_headers: dict):
    """Setting balance and adding fixed entries should reflect in forecast."""
    today = date.today().isoformat()

    # Set balance
    bal_resp = await client.post("/api/v1/balance", json={
        "balance": 10000,
        "effective_date": today,
    }, headers=auth_headers)
    assert bal_resp.status_code == 201

    # Add fixed expense
    fixed_resp = await client.post("/api/v1/fixed", json={
        "name": "Rent",
        "amount": 3000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    assert fixed_resp.status_code == 201

    # Check forecast
    response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["current_balance"] == "10000.00"
    # Each month should show 3000 expense from fixed
    for month in data["months"]:
        assert month["fixed_expenses"] == "3000.00"


# ---------------------------------------------------------------------------
# 2. Loan lifecycle: create -> payments -> complete -> dashboard reflects
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_loan_lifecycle_create_pay_complete_dashboard(
    client: AsyncClient, auth_headers: dict
):
    """Full loan lifecycle: create, make payments, complete, verify dashboard."""
    # Create a small loan with 2 payments
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Integration Loan",
        "original_amount": 2000,
        "monthly_payment": 1000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 15,
        "total_payments": 2,
    }, headers=auth_headers)
    assert create_resp.status_code == 201
    lid = create_resp.json()["id"]
    assert create_resp.json()["status"] == "active"
    assert create_resp.json()["remaining_balance"] == "2000.00"

    # Dashboard loans-summary should reflect 1 active loan
    summary_resp = await client.get(
        "/api/v1/dashboard/loans-summary", headers=auth_headers
    )
    assert summary_resp.status_code == 200
    assert summary_resp.json()["active_count"] == 1
    assert summary_resp.json()["total_monthly_payments"] == "1000.00"

    # Payment 1
    pay1 = await client.post(
        f"/api/v1/loans/{lid}/payment",
        json={"amount": 1000},
        headers=auth_headers,
    )
    assert pay1.status_code == 200
    assert pay1.json()["payments_made"] == 1
    assert pay1.json()["remaining_balance"] == "1000.00"
    assert pay1.json()["status"] == "active"

    # Payment 2 -> loan completes
    pay2 = await client.post(
        f"/api/v1/loans/{lid}/payment",
        json={"amount": 1000},
        headers=auth_headers,
    )
    assert pay2.status_code == 200
    assert pay2.json()["status"] == "completed"
    assert pay2.json()["remaining_balance"] == "0.00"

    # Dashboard loans-summary should now show 0 active loans
    summary_resp2 = await client.get(
        "/api/v1/dashboard/loans-summary", headers=auth_headers
    )
    assert summary_resp2.status_code == 200
    assert summary_resp2.json()["active_count"] == 0


# ---------------------------------------------------------------------------
# 3. Installment lifecycle: create -> mark-paid -> check progress
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_installment_lifecycle_mark_paid_progress(
    client: AsyncClient, auth_headers: dict
):
    """Create installment, mark payments, verify progress via detail endpoint."""
    create_resp = await client.post("/api/v1/installments", json={
        "name": "Laptop Installment",
        "total_amount": 6000,
        "number_of_payments": 6,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 10,
    }, headers=auth_headers)
    assert create_resp.status_code == 201
    iid = create_resp.json()["id"]
    assert create_resp.json()["payments_completed"] == 0
    assert create_resp.json()["monthly_amount"] == "1000.00"

    # Mark 3 payments as paid
    for i in range(3):
        mark_resp = await client.post(
            f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers
        )
        assert mark_resp.status_code == 200
        assert mark_resp.json()["payments_completed"] == i + 1

    # Check detail endpoint: 3/6 payments completed
    detail_resp = await client.get(
        f"/api/v1/installments/{iid}", headers=auth_headers
    )
    assert detail_resp.status_code == 200
    installment_data = detail_resp.json()["installment"]
    assert installment_data["payments_completed"] == 3
    assert installment_data["number_of_payments"] == 6
    # Progress should be ~50%
    assert float(installment_data["progress_percentage"]) == pytest.approx(50.0, abs=0.1)

    # Dashboard installments-summary should reflect 1 active installment
    summary_resp = await client.get(
        "/api/v1/dashboard/installments-summary", headers=auth_headers
    )
    assert summary_resp.status_code == 200
    assert summary_resp.json()["active_count"] == 1
    assert summary_resp.json()["total_monthly_expense"] == "1000.00"


# ---------------------------------------------------------------------------
# 4. Fixed pause -> forecast updates
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fixed_pause_removes_from_forecast(
    client: AsyncClient, auth_headers: dict
):
    """Pausing a fixed entry should remove it from forecast calculations."""
    # Set balance
    await client.post("/api/v1/balance", json={
        "balance": 20000,
        "effective_date": date.today().isoformat(),
    }, headers=auth_headers)

    # Create active fixed expense
    create_resp = await client.post("/api/v1/fixed", json={
        "name": "Subscription",
        "amount": 2000,
        "type": "expense",
        "day_of_month": 5,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    assert create_resp.status_code == 201
    fid = create_resp.json()["id"]

    # Forecast should include the expense
    forecast_before = await client.get(
        "/api/v1/forecast?months=1", headers=auth_headers
    )
    assert forecast_before.status_code == 200
    before_data = forecast_before.json()
    assert float(before_data["months"][0]["fixed_expenses"]) >= 2000.0

    # Pause the fixed entry
    pause_resp = await client.post(
        f"/api/v1/fixed/{fid}/pause", headers=auth_headers
    )
    assert pause_resp.status_code == 200
    assert pause_resp.json()["is_active"] is False

    # Forecast should no longer include the paused expense
    forecast_after = await client.get(
        "/api/v1/forecast?months=1", headers=auth_headers
    )
    assert forecast_after.status_code == 200
    after_data = forecast_after.json()
    assert float(after_data["months"][0]["fixed_expenses"]) == 0.0


# ---------------------------------------------------------------------------
# 5. Alert generation from negative forecast
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alerts_generated_from_negative_forecast(
    client: AsyncClient, auth_headers: dict
):
    """Negative forecast should generate alerts visible in the alerts endpoint."""
    # Set a small balance
    await client.post("/api/v1/balance", json={
        "balance": 200,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    # Add a large recurring expense
    await client.post("/api/v1/fixed", json={
        "name": "Big Monthly Expense",
        "amount": 15000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    # Trigger forecast summary (which generates alerts)
    summary_resp = await client.get(
        "/api/v1/forecast/summary?months=3", headers=auth_headers
    )
    assert summary_resp.status_code == 200
    assert summary_resp.json()["has_negative_months"] is True

    # Verify alerts were generated
    alerts_resp = await client.get("/api/v1/alerts", headers=auth_headers)
    assert alerts_resp.status_code == 200
    alert_data = alerts_resp.json()
    assert len(alert_data["items"]) > 0
    assert alert_data["unread_count"] > 0

    # Should contain a negative_cashflow alert
    alert_types = [a["alert_type"] for a in alert_data["items"]]
    assert "negative_cashflow" in alert_types


# ---------------------------------------------------------------------------
# 6. Category archive -> transaction impact (SET NULL via soft delete)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_category_archive_does_not_break_existing_transactions(
    client: AsyncClient, auth_headers: dict
):
    """Archiving a category should not delete transactions that reference it.

    The transaction's category_id remains as-is (the category still exists,
    just archived), so the transaction is still readable.
    """
    # Create a category
    cat_resp = await client.post("/api/v1/categories", json={
        "name": "integ_archive_test",
        "name_he": "בדיקת ארכיון",
        "type": "expense",
    }, headers=auth_headers)
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    # Create a transaction using that category
    txn_resp = await client.post("/api/v1/transactions", json={
        "amount": 500,
        "type": "expense",
        "date": date.today().isoformat(),
        "category_id": cat_id,
        "description": "Test with category",
    }, headers=auth_headers)
    assert txn_resp.status_code == 201
    txn_id = txn_resp.json()["id"]
    assert txn_resp.json()["category_id"] == cat_id

    # Archive the category (soft delete)
    del_resp = await client.delete(
        f"/api/v1/categories/{cat_id}", headers=auth_headers
    )
    assert del_resp.status_code == 200

    # Transaction should still be accessible
    get_txn = await client.get(
        f"/api/v1/transactions/{txn_id}", headers=auth_headers
    )
    assert get_txn.status_code == 200
    # category_id should still reference the archived category
    assert get_txn.json()["category_id"] == cat_id


# ---------------------------------------------------------------------------
# 7. Transaction create with category -> dashboard category-breakdown
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_transaction_with_category_shows_in_dashboard_breakdown(
    client: AsyncClient, auth_headers: dict
):
    """Creating expense transactions with a category should appear in
    the dashboard category-breakdown for the current month."""
    today = date.today().isoformat()

    # Create a category
    cat_resp = await client.post("/api/v1/categories", json={
        "name": "integ_food",
        "name_he": "אוכל",
        "type": "expense",
        "color": "#FF5733",
        "icon": "utensils",
    }, headers=auth_headers)
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    # Create two expense transactions with this category
    for amount in [150, 250]:
        resp = await client.post("/api/v1/transactions", json={
            "amount": amount,
            "type": "expense",
            "date": today,
            "category_id": cat_id,
            "description": f"Food expense {amount}",
        }, headers=auth_headers)
        assert resp.status_code == 201

    # Check dashboard category breakdown
    breakdown_resp = await client.get(
        "/api/v1/dashboard/category-breakdown", headers=auth_headers
    )
    assert breakdown_resp.status_code == 200
    breakdown_data = breakdown_resp.json()
    assert float(breakdown_data["total_expenses"]) >= 400.0

    # Our category should appear in items
    found = False
    for item in breakdown_data["items"]:
        if item["category_id"] == cat_id:
            found = True
            assert float(item["total_amount"]) == 400.0
            assert item["transaction_count"] == 2
            assert item["category_name"] == "integ_food"
            break
    assert found, "Category should appear in dashboard breakdown"


# ---------------------------------------------------------------------------
# 8. User isolation: user A cannot see user B's data across all modules
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_user_isolation_across_all_modules(
    client: AsyncClient, auth_headers: dict
):
    """User B should not see any of User A's data across transactions,
    fixed entries, loans, installments, balance, and categories."""
    # User A (admin) creates data in all modules
    txn_resp = await client.post("/api/v1/transactions", json={
        "amount": 9999,
        "type": "income",
        "date": "2026-02-01",
        "description": "Admin exclusive",
    }, headers=auth_headers)
    assert txn_resp.status_code == 201
    txn_id = txn_resp.json()["id"]

    fixed_resp = await client.post("/api/v1/fixed", json={
        "name": "Admin Salary",
        "amount": 50000,
        "type": "income",
        "day_of_month": 10,
        "start_date": "2026-01-01",
    }, headers=auth_headers)
    assert fixed_resp.status_code == 201
    fixed_id = fixed_resp.json()["id"]

    loan_resp = await client.post("/api/v1/loans", json={
        "name": "Admin Car Loan",
        "original_amount": 80000,
        "monthly_payment": 2000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 5,
        "total_payments": 40,
    }, headers=auth_headers)
    assert loan_resp.status_code == 201
    loan_id = loan_resp.json()["id"]

    inst_resp = await client.post("/api/v1/installments", json={
        "name": "Admin Phone",
        "total_amount": 4800,
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 20,
    }, headers=auth_headers)
    assert inst_resp.status_code == 201
    inst_id = inst_resp.json()["id"]

    await client.post("/api/v1/balance", json={
        "balance": 100000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    cat_resp = await client.post("/api/v1/categories", json={
        "name": "integ_admin_only",
        "name_he": "רק מנהל",
        "type": "income",
    }, headers=auth_headers)
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    # Register User B
    user_b_headers = await _register_and_login(
        client, "integ_user_b", "integ_user_b@example.com", "TestPass1"
    )

    # User B cannot access Admin's transaction
    assert (await client.get(
        f"/api/v1/transactions/{txn_id}", headers=user_b_headers
    )).status_code == 404

    # User B cannot access Admin's fixed entry
    assert (await client.get(
        f"/api/v1/fixed/{fixed_id}", headers=user_b_headers
    )).status_code == 404

    # User B cannot access Admin's loan
    assert (await client.get(
        f"/api/v1/loans/{loan_id}", headers=user_b_headers
    )).status_code == 404

    # User B cannot access Admin's installment
    assert (await client.get(
        f"/api/v1/installments/{inst_id}", headers=user_b_headers
    )).status_code == 404

    # User B cannot access Admin's category
    assert (await client.get(
        f"/api/v1/categories/{cat_id}", headers=user_b_headers
    )).status_code == 404

    # User B's balance is separate (404 or empty - no balance set)
    user_b_bal = await client.get("/api/v1/balance", headers=user_b_headers)
    assert user_b_bal.status_code in (200, 404)
    if user_b_bal.status_code == 200:
        assert user_b_bal.json()["balance"] != "100000.00"

    # User B's transaction list should be empty
    user_b_txns = await client.get(
        "/api/v1/transactions", headers=user_b_headers
    )
    assert user_b_txns.status_code == 200
    assert user_b_txns.json()["total"] == 0


# ---------------------------------------------------------------------------
# 9. Date range validation in transactions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_transaction_date_range_filter_validation(
    client: AsyncClient, auth_headers: dict
):
    """Filtering transactions with start_date > end_date should return 422."""
    # Create a transaction so the database is not empty
    await client.post("/api/v1/transactions", json={
        "amount": 100,
        "type": "income",
        "date": "2026-02-15",
    }, headers=auth_headers)

    # start_date > end_date should be rejected
    response = await client.get(
        "/api/v1/transactions?start_date=2026-03-01&end_date=2026-01-01",
        headers=auth_headers,
    )
    assert response.status_code == 422

    # Valid date range should work
    response = await client.get(
        "/api/v1/transactions?start_date=2026-01-01&end_date=2026-12-31",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["total"] >= 1


# ---------------------------------------------------------------------------
# 10. Archived category cannot be assigned to new transaction
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_archived_category_rejected_for_new_transaction(
    client: AsyncClient, auth_headers: dict
):
    """Creating a transaction with an archived category should be rejected."""
    # Create a category
    cat_resp = await client.post("/api/v1/categories", json={
        "name": "integ_temp_cat",
        "name_he": "קטגוריה זמנית",
        "type": "expense",
    }, headers=auth_headers)
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    # Archive the category
    del_resp = await client.delete(
        f"/api/v1/categories/{cat_id}", headers=auth_headers
    )
    assert del_resp.status_code == 200

    # Attempt to create a transaction with the archived category
    txn_resp = await client.post("/api/v1/transactions", json={
        "amount": 100,
        "type": "expense",
        "date": date.today().isoformat(),
        "category_id": cat_id,
    }, headers=auth_headers)
    assert txn_resp.status_code == 422
    assert "archived" in txn_resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 11. Installment rounding: last payment adjusts for difference
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_installment_last_payment_rounding_adjustment(
    client: AsyncClient, auth_headers: dict
):
    """For uneven splits, the last payment amount should adjust so the
    total exactly matches total_amount."""
    # 1000 / 3 = 333.33 per payment, last payment = 1000 - 333.33*2 = 333.34
    create_resp = await client.post("/api/v1/installments", json={
        "name": "Rounding Test",
        "total_amount": 1000,
        "number_of_payments": 3,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 15,
    }, headers=auth_headers)
    assert create_resp.status_code == 201
    iid = create_resp.json()["id"]
    assert create_resp.json()["monthly_amount"] == "333.33"

    # Check the payment schedule
    detail_resp = await client.get(
        f"/api/v1/installments/{iid}", headers=auth_headers
    )
    assert detail_resp.status_code == 200
    schedule = detail_resp.json()["schedule"]
    assert len(schedule) == 3

    # First two payments should be 333.33
    assert schedule[0]["amount"] == "333.33"
    assert schedule[1]["amount"] == "333.33"

    # Last payment should be adjusted: 1000 - (333.33 * 2) = 333.34
    last_amount = float(schedule[2]["amount"])
    assert last_amount == pytest.approx(333.34, abs=0.01)

    # Total of all payments should equal total_amount
    total_paid = sum(float(p["amount"]) for p in schedule)
    assert total_paid == pytest.approx(1000.0, abs=0.01)


# ---------------------------------------------------------------------------
# 12. Loan payment exceeding remaining balance -> error
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_loan_payment_exceeding_remaining_balance_rejected(
    client: AsyncClient, auth_headers: dict
):
    """Recording a loan payment larger than remaining balance should fail."""
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Overpay Test",
        "original_amount": 5000,
        "monthly_payment": 1000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "total_payments": 5,
    }, headers=auth_headers)
    assert create_resp.status_code == 201
    lid = create_resp.json()["id"]

    # Make one payment so remaining = 4000
    await client.post(
        f"/api/v1/loans/{lid}/payment",
        json={"amount": 1000},
        headers=auth_headers,
    )

    # Try to pay more than remaining balance (4000)
    response = await client.post(
        f"/api/v1/loans/{lid}/payment",
        json={"amount": 5000},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert "exceeds" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 13. Dashboard summary matches transaction totals
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_dashboard_summary_matches_transaction_totals(
    client: AsyncClient, auth_headers: dict
):
    """Dashboard summary income/expenses should match manually created
    transactions for the current month."""
    today = date.today().isoformat()

    # Create income transactions
    await client.post("/api/v1/transactions", json={
        "amount": 5000, "type": "income", "date": today,
        "description": "Salary",
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 3000, "type": "income", "date": today,
        "description": "Freelance",
    }, headers=auth_headers)

    # Create expense transactions
    await client.post("/api/v1/transactions", json={
        "amount": 2000, "type": "expense", "date": today,
        "description": "Rent",
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 500, "type": "expense", "date": today,
        "description": "Food",
    }, headers=auth_headers)

    # Check dashboard summary
    summary_resp = await client.get(
        "/api/v1/dashboard/summary", headers=auth_headers
    )
    assert summary_resp.status_code == 200
    summary = summary_resp.json()

    assert float(summary["monthly_income"]) == 8000.0
    assert float(summary["monthly_expenses"]) == 2500.0
    assert float(summary["net_cashflow"]) == 5500.0


# ---------------------------------------------------------------------------
# 14. Settings defaults auto-created
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_settings_defaults_auto_created_for_new_user(
    client: AsyncClient,
):
    """A newly registered user should get default settings automatically."""
    # Register a new user
    reg_resp = await client.post("/api/v1/auth/register", json={
        "username": "integ_settings_user",
        "email": "integ_settings@example.com",
        "password": "TestPass1",
    })
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {token}"}

    # Get settings - should return defaults
    settings_resp = await client.get("/api/v1/settings", headers=new_headers)
    assert settings_resp.status_code == 200
    data = settings_resp.json()
    assert data["currency"] == "ILS"
    assert data["language"] == "he"
    assert data["theme"] == "light"


# ---------------------------------------------------------------------------
# 15. Forecast includes loans and installments
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_forecast_includes_loans_and_installments(
    client: AsyncClient, auth_headers: dict
):
    """Forecast should include loan payments and installment payments."""
    # Set balance
    await client.post("/api/v1/balance", json={
        "balance": 50000,
        "effective_date": "2026-02-01",
    }, headers=auth_headers)

    # Create a loan
    await client.post("/api/v1/loans", json={
        "name": "Forecast Loan",
        "original_amount": 24000,
        "monthly_payment": 2000,
        "interest_rate": 0,
        "start_date": "2026-02-01",
        "day_of_month": 10,
        "total_payments": 12,
    }, headers=auth_headers)

    # Create an installment
    await client.post("/api/v1/installments", json={
        "name": "Forecast Installment",
        "total_amount": 3600,
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2026-02-01",
        "day_of_month": 20,
    }, headers=auth_headers)

    # Get forecast
    response = await client.get("/api/v1/forecast?months=3", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["current_balance"] == "50000.00"

    # Each month should include loan and installment payments
    for month in data["months"]:
        loan_payments = float(month["loan_payments"])
        installment_expenses = float(month["installment_expenses"])
        assert loan_payments >= 0
        assert installment_expenses >= 0

    # At least one month should have non-zero loan and installment values
    has_loan = any(float(m["loan_payments"]) > 0 for m in data["months"])
    has_installment = any(
        float(m["installment_expenses"]) > 0 for m in data["months"]
    )
    assert has_loan, "Forecast should include loan payments"
    assert has_installment, "Forecast should include installment expenses"


# ---------------------------------------------------------------------------
# 16. Multiple fixed entries aggregate correctly in forecast
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multiple_fixed_entries_aggregate_in_forecast(
    client: AsyncClient, auth_headers: dict
):
    """Multiple fixed income and expense entries should all aggregate in forecast."""
    await client.post("/api/v1/balance", json={
        "balance": 30000,
        "effective_date": date.today().isoformat(),
    }, headers=auth_headers)

    # Two incomes
    await client.post("/api/v1/fixed", json={
        "name": "Salary", "amount": 15000, "type": "income",
        "day_of_month": 10, "start_date": "2026-01-01",
    }, headers=auth_headers)
    await client.post("/api/v1/fixed", json={
        "name": "Side Job", "amount": 5000, "type": "income",
        "day_of_month": 20, "start_date": "2026-01-01",
    }, headers=auth_headers)

    # Two expenses
    await client.post("/api/v1/fixed", json={
        "name": "Rent", "amount": 6000, "type": "expense",
        "day_of_month": 1, "start_date": "2026-01-01",
    }, headers=auth_headers)
    await client.post("/api/v1/fixed", json={
        "name": "Insurance", "amount": 1000, "type": "expense",
        "day_of_month": 15, "start_date": "2026-01-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/forecast?months=1", headers=auth_headers)
    assert response.status_code == 200
    month = response.json()["months"][0]
    assert float(month["fixed_income"]) == 20000.0
    assert float(month["fixed_expenses"]) == 7000.0


# ---------------------------------------------------------------------------
# 17. Loan complete then extra payment rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_loan_payment_on_completed_loan_rejected(
    client: AsyncClient, auth_headers: dict
):
    """After a loan is completed, further payments should be rejected."""
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Complete Then Pay",
        "original_amount": 1000,
        "monthly_payment": 1000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "total_payments": 1,
    }, headers=auth_headers)
    lid = create_resp.json()["id"]

    # Complete the loan
    pay_resp = await client.post(
        f"/api/v1/loans/{lid}/payment",
        json={"amount": 1000},
        headers=auth_headers,
    )
    assert pay_resp.json()["status"] == "completed"

    # Try another payment -> should fail
    extra_resp = await client.post(
        f"/api/v1/loans/{lid}/payment",
        json={"amount": 100},
        headers=auth_headers,
    )
    assert extra_resp.status_code == 400
    assert "completed" in extra_resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 18. Installment completion via mark-paid -> stops accepting
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_installment_fully_paid_rejects_extra_mark_paid(
    client: AsyncClient, auth_headers: dict
):
    """After all installment payments are marked, further mark-paid calls
    should be rejected with 422."""
    create_resp = await client.post("/api/v1/installments", json={
        "name": "Two Payments",
        "total_amount": 2000,
        "number_of_payments": 2,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 5,
    }, headers=auth_headers)
    iid = create_resp.json()["id"]

    # Mark both payments
    for _ in range(2):
        resp = await client.post(
            f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers
        )
        assert resp.status_code == 200

    # Third mark-paid should be rejected
    extra_resp = await client.post(
        f"/api/v1/installments/{iid}/mark-paid", headers=auth_headers
    )
    assert extra_resp.status_code == 422
    assert "completed" in extra_resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 19. Category type mismatch prevents transaction creation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_category_type_mismatch_rejected(
    client: AsyncClient, auth_headers: dict
):
    """Assigning an income category to an expense transaction should fail."""
    # Create an income category
    cat_resp = await client.post("/api/v1/categories", json={
        "name": "integ_income_only",
        "name_he": "הכנסה בלבד",
        "type": "income",
    }, headers=auth_headers)
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    # Try to use it for an expense transaction
    txn_resp = await client.post("/api/v1/transactions", json={
        "amount": 100,
        "type": "expense",
        "date": date.today().isoformat(),
        "category_id": cat_id,
    }, headers=auth_headers)
    assert txn_resp.status_code == 422
    assert "type" in txn_resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 20. End-to-end: full financial scenario with all modules
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_financial_scenario(
    client: AsyncClient, auth_headers: dict
):
    """End-to-end test: set up a complete financial scenario and verify
    forecast, dashboard, and alerts all work together consistently."""
    today = date.today().isoformat()

    # 1. Set initial balance
    await client.post("/api/v1/balance", json={
        "balance": 25000,
        "effective_date": today,
    }, headers=auth_headers)

    # 2. Add fixed income
    await client.post("/api/v1/fixed", json={
        "name": "Monthly Salary",
        "amount": 12000,
        "type": "income",
        "day_of_month": 10,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    # 3. Add fixed expenses
    await client.post("/api/v1/fixed", json={
        "name": "Office Rent",
        "amount": 4000,
        "type": "expense",
        "day_of_month": 1,
        "start_date": "2026-01-01",
    }, headers=auth_headers)

    # 4. Add a loan
    await client.post("/api/v1/loans", json={
        "name": "Equipment Loan",
        "original_amount": 24000,
        "monthly_payment": 2000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 5,
        "total_payments": 12,
    }, headers=auth_headers)

    # 5. Add an installment
    await client.post("/api/v1/installments", json={
        "name": "Software License",
        "total_amount": 6000,
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 15,
    }, headers=auth_headers)

    # 6. Record some transactions for this month
    await client.post("/api/v1/transactions", json={
        "amount": 12000, "type": "income", "date": today,
        "description": "February Salary",
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 800, "type": "expense", "date": today,
        "description": "Team lunch",
    }, headers=auth_headers)

    # 7. Verify forecast
    forecast_resp = await client.get(
        "/api/v1/forecast?months=3", headers=auth_headers
    )
    assert forecast_resp.status_code == 200
    forecast_data = forecast_resp.json()
    assert forecast_data["current_balance"] == "25000.00"
    assert len(forecast_data["months"]) == 3

    # Each month should have income, expenses, and running balance
    for month in forecast_data["months"]:
        assert "fixed_income" in month
        assert "fixed_expenses" in month
        assert "closing_balance" in month

    # 8. Verify dashboard summary
    summary_resp = await client.get(
        "/api/v1/dashboard/summary", headers=auth_headers
    )
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert float(summary["current_balance"]) == 25000.0
    assert float(summary["monthly_income"]) >= 12000.0

    # 9. Verify dashboard loans-summary shows active loan
    loans_sum = await client.get(
        "/api/v1/dashboard/loans-summary", headers=auth_headers
    )
    assert loans_sum.status_code == 200
    assert loans_sum.json()["active_count"] == 1
    assert float(loans_sum.json()["total_monthly_payments"]) == 2000.0

    # 10. Verify dashboard installments-summary shows active installment
    inst_sum = await client.get(
        "/api/v1/dashboard/installments-summary", headers=auth_headers
    )
    assert inst_sum.status_code == 200
    assert inst_sum.json()["active_count"] == 1

    # 11. Verify forecast summary
    summary2 = await client.get(
        "/api/v1/forecast/summary?months=3", headers=auth_headers
    )
    assert summary2.status_code == 200
    assert summary2.json()["forecast_months"] == 3
    assert "total_expected_income" in summary2.json()
    assert "total_expected_expenses" in summary2.json()
