from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient


# ===========================================================================
# Helper to get today's date string
# ===========================================================================

def _today_str() -> str:
    return date.today().isoformat()


def _day_of_month() -> int:
    """Return a day_of_month that is today or in the near future for upcoming payments."""
    today = date.today()
    # Use a day that is 5 days from now (wrapping around month boundary)
    future = today + timedelta(days=5)
    return future.day


# ===========================================================================
# 1. GET /api/v1/dashboard/summary
# ===========================================================================

@pytest.mark.asyncio
async def test_dashboard_summary_empty(client: AsyncClient, auth_headers: dict):
    """Summary should return zeros when no transactions exist."""
    response = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "current_balance" in data
    assert "monthly_income" in data
    assert "monthly_expenses" in data
    assert "net_cashflow" in data
    assert "balance_trend" in data
    assert "income_trend" in data
    assert "expense_trend" in data


@pytest.mark.asyncio
async def test_dashboard_summary_with_transactions(client: AsyncClient, auth_headers: dict):
    """Summary should reflect income and expense transactions for the current month."""
    today = _today_str()
    # Create income
    await client.post("/api/v1/transactions", json={
        "amount": 5000, "type": "income", "description": "Salary", "date": today,
    }, headers=auth_headers)
    # Create expense
    await client.post("/api/v1/transactions", json={
        "amount": 2000, "type": "expense", "description": "Rent", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert Decimal(data["monthly_income"]) == Decimal("5000.00")
    assert Decimal(data["monthly_expenses"]) == Decimal("2000.00")
    assert Decimal(data["net_cashflow"]) == Decimal("3000.00")


@pytest.mark.asyncio
async def test_dashboard_summary_zero_income(client: AsyncClient, auth_headers: dict):
    """Summary with only expenses should show negative net cashflow."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 1500, "type": "expense", "description": "Groceries", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert Decimal(data["monthly_income"]) == Decimal("0")
    assert Decimal(data["monthly_expenses"]) == Decimal("1500.00")
    assert Decimal(data["net_cashflow"]) == Decimal("-1500.00")


@pytest.mark.asyncio
async def test_dashboard_summary_includes_balance(client: AsyncClient, auth_headers: dict):
    """Summary should reflect the current bank balance when one is set."""
    await client.post("/api/v1/balance", json={
        "balance": 42000, "effective_date": _today_str(),
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert Decimal(data["current_balance"]) == Decimal("42000.00")


# ===========================================================================
# 2. GET /api/v1/dashboard/weekly
# ===========================================================================

@pytest.mark.asyncio
async def test_dashboard_weekly_returns_12_weeks(client: AsyncClient, auth_headers: dict):
    """Weekly endpoint should always return exactly 12 period entries."""
    response = await client.get("/api/v1/dashboard/weekly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 12


@pytest.mark.asyncio
async def test_dashboard_weekly_structure(client: AsyncClient, auth_headers: dict):
    """Each weekly period entry should have the required fields."""
    response = await client.get("/api/v1/dashboard/weekly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    for period in data:
        assert "period" in period
        assert "income" in period
        assert "expenses" in period
        assert "net" in period
        assert "balance" in period


@pytest.mark.asyncio
async def test_dashboard_weekly_with_transactions(client: AsyncClient, auth_headers: dict):
    """Weekly data should reflect current week transactions."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 3000, "type": "income", "description": "Payment", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/weekly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # The last period (current week) should have income > 0
    total_income = sum(Decimal(p["income"]) for p in data)
    assert total_income >= Decimal("3000.00")


# ===========================================================================
# 3. GET /api/v1/dashboard/monthly
# ===========================================================================

@pytest.mark.asyncio
async def test_dashboard_monthly_returns_12_months(client: AsyncClient, auth_headers: dict):
    """Monthly endpoint should always return exactly 12 period entries."""
    response = await client.get("/api/v1/dashboard/monthly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 12


@pytest.mark.asyncio
async def test_dashboard_monthly_structure(client: AsyncClient, auth_headers: dict):
    """Each monthly period entry should have the required fields."""
    response = await client.get("/api/v1/dashboard/monthly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    for period in data:
        assert "period" in period
        assert "income" in period
        assert "expenses" in period
        assert "net" in period
        assert "balance" in period
        # Period format should be YYYY-MM
        assert len(period["period"]) == 7
        assert "-" in period["period"]


@pytest.mark.asyncio
async def test_dashboard_monthly_with_transactions(client: AsyncClient, auth_headers: dict):
    """Monthly data should include the current month's transactions."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 8000, "type": "income", "description": "Salary", "date": today,
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 3000, "type": "expense", "description": "Rent", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/monthly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Current month is the last entry
    current_month = data[-1]
    assert Decimal(current_month["income"]) == Decimal("8000.00")
    assert Decimal(current_month["expenses"]) == Decimal("3000.00")
    assert Decimal(current_month["net"]) == Decimal("5000.00")


# ===========================================================================
# 4. GET /api/v1/dashboard/quarterly
# ===========================================================================

@pytest.mark.asyncio
async def test_dashboard_quarterly_returns_8_quarters(client: AsyncClient, auth_headers: dict):
    """Quarterly endpoint should always return exactly 8 period entries."""
    response = await client.get("/api/v1/dashboard/quarterly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 8


@pytest.mark.asyncio
async def test_dashboard_quarterly_structure(client: AsyncClient, auth_headers: dict):
    """Each quarterly period should have the required fields and correct label format."""
    response = await client.get("/api/v1/dashboard/quarterly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    for period in data:
        assert "period" in period
        assert "income" in period
        assert "expenses" in period
        assert "net" in period
        assert "balance" in period
        # Period format should be like "2026-Q1"
        assert "-Q" in period["period"]
        quarter_num = int(period["period"].split("-Q")[1])
        assert 1 <= quarter_num <= 4


@pytest.mark.asyncio
async def test_dashboard_quarterly_with_transactions(client: AsyncClient, auth_headers: dict):
    """Quarterly data should aggregate current quarter's transactions."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 10000, "type": "income", "description": "Revenue", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/quarterly", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Last quarter (current) should have income >= 10000
    current_quarter = data[-1]
    assert Decimal(current_quarter["income"]) >= Decimal("10000.00")


# ===========================================================================
# 5. GET /api/v1/dashboard/category-breakdown
# ===========================================================================

@pytest.mark.asyncio
async def test_category_breakdown_empty(client: AsyncClient, auth_headers: dict):
    """Category breakdown with no expenses should return empty items."""
    response = await client.get("/api/v1/dashboard/category-breakdown", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total_expenses" in data
    assert "period" in data
    assert len(data["items"]) == 0
    assert Decimal(data["total_expenses"]) == Decimal("0")


@pytest.mark.asyncio
async def test_category_breakdown_with_expenses(client: AsyncClient, auth_headers: dict):
    """Category breakdown should show expense breakdown with percentages summing to 100%."""
    today = _today_str()
    # Create expenses in different categories (uncategorized)
    await client.post("/api/v1/transactions", json={
        "amount": 3000, "type": "expense", "description": "Office Rent", "date": today,
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 2000, "type": "expense", "description": "Software", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/category-breakdown", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert Decimal(data["total_expenses"]) == Decimal("5000.00")
    # Percentages should sum to 100
    total_pct = sum(Decimal(item["percentage"]) for item in data["items"])
    assert abs(total_pct - Decimal("100.00")) < Decimal("0.1")


@pytest.mark.asyncio
async def test_category_breakdown_ignores_income(client: AsyncClient, auth_headers: dict):
    """Category breakdown should only include expenses, not income transactions."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 10000, "type": "income", "description": "Salary", "date": today,
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 500, "type": "expense", "description": "Food", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/category-breakdown", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert Decimal(data["total_expenses"]) == Decimal("500.00")


@pytest.mark.asyncio
async def test_category_breakdown_item_structure(client: AsyncClient, auth_headers: dict):
    """Each breakdown item should have all required fields."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 1000, "type": "expense", "description": "Test", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/category-breakdown", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    item = data["items"][0]
    assert "category_name" in item
    assert "category_name_he" in item
    assert "category_color" in item
    assert "category_icon" in item
    assert "total_amount" in item
    assert "percentage" in item
    assert "transaction_count" in item


# ===========================================================================
# 6. GET /api/v1/dashboard/upcoming-payments
# ===========================================================================

@pytest.mark.asyncio
async def test_upcoming_payments_empty(client: AsyncClient, auth_headers: dict):
    """Upcoming payments with no fixed/installments/loans should return empty."""
    response = await client.get("/api/v1/dashboard/upcoming-payments", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total_upcoming_expenses" in data
    assert "total_upcoming_income" in data
    assert "days_ahead" in data
    assert data["days_ahead"] == 30  # default


@pytest.mark.asyncio
async def test_upcoming_payments_with_fixed(client: AsyncClient, auth_headers: dict):
    """Upcoming payments should include active fixed entries."""
    day = _day_of_month()
    await client.post("/api/v1/fixed", json={
        "name": "Office Rent",
        "amount": 5000,
        "type": "expense",
        "day_of_month": day,
        "start_date": "2025-01-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/upcoming-payments?days=60", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["days_ahead"] == 60
    fixed_items = [i for i in data["items"] if i["source_type"] == "fixed"]
    assert len(fixed_items) >= 1
    assert Decimal(data["total_upcoming_expenses"]) >= Decimal("5000.00")


@pytest.mark.asyncio
async def test_upcoming_payments_with_installment(client: AsyncClient, auth_headers: dict):
    """Upcoming payments should include active installments."""
    day = _day_of_month()
    await client.post("/api/v1/installments", json={
        "name": "Laptop Purchase",
        "total_amount": 6000,
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2025-01-01",
        "day_of_month": day,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/upcoming-payments?days=60", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    installment_items = [i for i in data["items"] if i["source_type"] == "installment"]
    assert len(installment_items) >= 1
    # Should have installment_info like "1/12"
    assert installment_items[0]["installment_info"] is not None
    assert "/" in installment_items[0]["installment_info"]


@pytest.mark.asyncio
async def test_upcoming_payments_with_loan(client: AsyncClient, auth_headers: dict):
    """Upcoming payments should include active loans."""
    day = _day_of_month()
    await client.post("/api/v1/loans", json={
        "name": "Car Loan",
        "original_amount": 100000,
        "monthly_payment": 2000,
        "interest_rate": 3.5,
        "start_date": "2025-01-01",
        "day_of_month": day,
        "total_payments": 60,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/upcoming-payments?days=60", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    loan_items = [i for i in data["items"] if i["source_type"] == "loan"]
    assert len(loan_items) >= 1
    assert loan_items[0]["type"] == "expense"
    assert loan_items[0]["installment_info"] is not None


@pytest.mark.asyncio
async def test_upcoming_payments_sorted_by_date(client: AsyncClient, auth_headers: dict):
    """Upcoming payments should be sorted by due_date ascending."""
    today = date.today()
    # Create two fixed entries with different days
    day1 = ((today.day + 2) % 28) + 1
    day2 = ((today.day + 15) % 28) + 1

    await client.post("/api/v1/fixed", json={
        "name": "Later Payment",
        "amount": 1000,
        "type": "expense",
        "day_of_month": day2,
        "start_date": "2025-01-01",
    }, headers=auth_headers)
    await client.post("/api/v1/fixed", json={
        "name": "Earlier Payment",
        "amount": 2000,
        "type": "expense",
        "day_of_month": day1,
        "start_date": "2025-01-01",
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/upcoming-payments?days=60", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    if len(data["items"]) >= 2:
        dates = [item["due_date"] for item in data["items"]]
        assert dates == sorted(dates)


# ===========================================================================
# 7. GET /api/v1/dashboard/financial-health
# ===========================================================================

@pytest.mark.asyncio
async def test_financial_health_empty(client: AsyncClient, auth_headers: dict):
    """Financial health with no data should still return valid structure."""
    response = await client.get("/api/v1/dashboard/financial-health", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "score" in data
    assert "grade" in data
    assert "factors" in data
    assert 0 <= data["score"] <= 100
    assert data["grade"] in ["excellent", "good", "fair", "poor", "critical"]


@pytest.mark.asyncio
async def test_financial_health_score_range(client: AsyncClient, auth_headers: dict):
    """Financial health score should always be between 0 and 100."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 10000, "type": "income", "description": "Salary", "date": today,
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 3000, "type": "expense", "description": "Rent", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/financial-health", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert 0 <= data["score"] <= 100


@pytest.mark.asyncio
async def test_financial_health_has_five_factors(client: AsyncClient, auth_headers: dict):
    """Financial health should return exactly 5 weighted factors."""
    response = await client.get("/api/v1/dashboard/financial-health", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["factors"]) == 5
    factor_names = {f["name"] for f in data["factors"]}
    assert factor_names == {
        "savings_ratio", "debt_ratio", "balance_trend",
        "expense_stability", "emergency_fund",
    }


@pytest.mark.asyncio
async def test_financial_health_factor_structure(client: AsyncClient, auth_headers: dict):
    """Each health factor should have the required fields."""
    response = await client.get("/api/v1/dashboard/financial-health", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    for factor in data["factors"]:
        assert "name" in factor
        assert "score" in factor
        assert "weight" in factor
        assert "description" in factor
        assert 0 <= factor["score"] <= 100
        assert Decimal(factor["weight"]) > Decimal("0")


@pytest.mark.asyncio
async def test_financial_health_weights_sum_to_one(client: AsyncClient, auth_headers: dict):
    """Factor weights should sum to 1.00."""
    response = await client.get("/api/v1/dashboard/financial-health", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    total_weight = sum(Decimal(f["weight"]) for f in data["factors"])
    assert total_weight == Decimal("1.00")


@pytest.mark.asyncio
async def test_financial_health_good_scenario(client: AsyncClient, auth_headers: dict):
    """A user with high income, low expenses, and a good balance should score well."""
    today = _today_str()
    # Set a healthy balance
    await client.post("/api/v1/balance", json={
        "balance": 100000, "effective_date": today,
    }, headers=auth_headers)
    # High income, low expenses
    await client.post("/api/v1/transactions", json={
        "amount": 20000, "type": "income", "description": "Salary", "date": today,
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 5000, "type": "expense", "description": "Living", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/financial-health", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should be at least "good" (score >= 60)
    assert data["score"] >= 60
    assert data["grade"] in ["excellent", "good"]


# ===========================================================================
# 8. GET /api/v1/dashboard/installments-summary
# ===========================================================================

@pytest.mark.asyncio
async def test_installments_summary_empty(client: AsyncClient, auth_headers: dict):
    """Installments summary with no installments should return zeros."""
    response = await client.get("/api/v1/dashboard/installments-summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["active_count"] == 0
    assert Decimal(data["total_monthly_expense"]) == Decimal("0")
    assert Decimal(data["total_monthly_income"]) == Decimal("0")
    assert Decimal(data["total_remaining"]) == Decimal("0")
    assert data["items"] == []


@pytest.mark.asyncio
async def test_installments_summary_with_data(client: AsyncClient, auth_headers: dict):
    """Installments summary should reflect active installments."""
    await client.post("/api/v1/installments", json={
        "name": "TV Purchase",
        "total_amount": 6000,
        "number_of_payments": 12,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 15,
    }, headers=auth_headers)
    await client.post("/api/v1/installments", json={
        "name": "Freelance Income",
        "total_amount": 12000,
        "number_of_payments": 6,
        "type": "income",
        "start_date": "2026-01-01",
        "day_of_month": 20,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/installments-summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["active_count"] == 2
    assert Decimal(data["total_monthly_expense"]) == Decimal("500.00")
    assert Decimal(data["total_monthly_income"]) == Decimal("2000.00")
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_installments_summary_item_structure(client: AsyncClient, auth_headers: dict):
    """Each installment summary item should have the required fields."""
    await client.post("/api/v1/installments", json={
        "name": "Laptop",
        "total_amount": 4800,
        "number_of_payments": 8,
        "type": "expense",
        "start_date": "2026-01-01",
        "day_of_month": 10,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/installments-summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    item = data["items"][0]
    assert "id" in item
    assert "name" in item
    assert "monthly_amount" in item
    assert "currency" in item
    assert "type" in item
    assert "payments_completed" in item
    assert "total_payments" in item
    assert "progress_pct" in item
    assert "remaining_amount" in item
    assert "next_payment_date" in item
    # Progress should be 0% (no payments made)
    assert Decimal(item["progress_pct"]) == Decimal("0.00")
    assert item["payments_completed"] == 0
    assert item["total_payments"] == 8


# ===========================================================================
# 9. GET /api/v1/dashboard/loans-summary
# ===========================================================================

@pytest.mark.asyncio
async def test_loans_summary_empty(client: AsyncClient, auth_headers: dict):
    """Loans summary with no loans should return zeros."""
    response = await client.get("/api/v1/dashboard/loans-summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["active_count"] == 0
    assert Decimal(data["total_monthly_payments"]) == Decimal("0")
    assert Decimal(data["total_remaining_balance"]) == Decimal("0")
    assert Decimal(data["total_original_amount"]) == Decimal("0")
    assert Decimal(data["overall_progress_pct"]) == Decimal("0")
    assert data["items"] == []


@pytest.mark.asyncio
async def test_loans_summary_with_data(client: AsyncClient, auth_headers: dict):
    """Loans summary should reflect active loans."""
    await client.post("/api/v1/loans", json={
        "name": "Car Loan",
        "original_amount": 100000,
        "monthly_payment": 2000,
        "interest_rate": 3.5,
        "start_date": "2026-01-01",
        "day_of_month": 15,
        "total_payments": 60,
    }, headers=auth_headers)
    await client.post("/api/v1/loans", json={
        "name": "Home Loan",
        "original_amount": 500000,
        "monthly_payment": 5000,
        "interest_rate": 4.0,
        "start_date": "2026-01-01",
        "day_of_month": 1,
        "total_payments": 120,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/loans-summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["active_count"] == 2
    assert Decimal(data["total_monthly_payments"]) == Decimal("7000.00")
    assert Decimal(data["total_original_amount"]) == Decimal("600000.00")
    assert Decimal(data["total_remaining_balance"]) == Decimal("600000.00")
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_loans_summary_item_structure(client: AsyncClient, auth_headers: dict):
    """Each loan summary item should have the required fields."""
    await client.post("/api/v1/loans", json={
        "name": "Personal Loan",
        "original_amount": 50000,
        "monthly_payment": 1500,
        "interest_rate": 5.0,
        "start_date": "2026-01-01",
        "day_of_month": 10,
        "total_payments": 36,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/loans-summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    item = data["items"][0]
    assert "id" in item
    assert "name" in item
    assert "monthly_payment" in item
    assert "currency" in item
    assert "original_amount" in item
    assert "remaining_balance" in item
    assert "payments_made" in item
    assert "total_payments" in item
    assert "progress_pct" in item
    assert "interest_rate" in item
    assert "next_payment_date" in item


@pytest.mark.asyncio
async def test_loans_summary_progress_after_payment(client: AsyncClient, auth_headers: dict):
    """Loans summary should reflect progress after a payment is made."""
    create_resp = await client.post("/api/v1/loans", json={
        "name": "Progress Loan",
        "original_amount": 10000,
        "monthly_payment": 1000,
        "interest_rate": 0,
        "start_date": "2026-01-01",
        "day_of_month": 5,
        "total_payments": 10,
    }, headers=auth_headers)
    lid = create_resp.json()["id"]

    # Make 2 payments
    await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 1000}, headers=auth_headers)
    await client.post(f"/api/v1/loans/{lid}/payment", json={"amount": 1000}, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/loans-summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["active_count"] == 1
    item = data["items"][0]
    assert item["payments_made"] == 2
    assert Decimal(item["remaining_balance"]) == Decimal("8000.00")
    assert Decimal(item["progress_pct"]) == Decimal("20.00")
    assert Decimal(data["overall_progress_pct"]) == Decimal("20.00")


# ===========================================================================
# 10. GET /api/v1/dashboard/top-expenses
# ===========================================================================

@pytest.mark.asyncio
async def test_top_expenses_empty(client: AsyncClient, auth_headers: dict):
    """Top expenses with no expense transactions should return empty items."""
    response = await client.get("/api/v1/dashboard/top-expenses", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "period" in data
    assert len(data["items"]) == 0


@pytest.mark.asyncio
async def test_top_expenses_with_data(client: AsyncClient, auth_headers: dict):
    """Top expenses should return the highest expense transactions."""
    today = _today_str()
    amounts = [500, 1200, 300, 2500, 800, 1500, 100]
    for i, amount in enumerate(amounts):
        await client.post("/api/v1/transactions", json={
            "amount": amount,
            "type": "expense",
            "description": f"Expense {i}",
            "date": today,
        }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/top-expenses", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should return at most 5 items
    assert len(data["items"]) == 5
    # Should be sorted by amount descending
    amounts_returned = [Decimal(item["amount"]) for item in data["items"]]
    assert amounts_returned == sorted(amounts_returned, reverse=True)
    # Top expense should be 2500
    assert Decimal(data["items"][0]["amount"]) == Decimal("2500.00")


@pytest.mark.asyncio
async def test_top_expenses_excludes_income(client: AsyncClient, auth_headers: dict):
    """Top expenses should only include expense transactions, not income."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 50000, "type": "income", "description": "Big Income", "date": today,
    }, headers=auth_headers)
    await client.post("/api/v1/transactions", json={
        "amount": 200, "type": "expense", "description": "Small Expense", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/top-expenses", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert Decimal(data["items"][0]["amount"]) == Decimal("200.00")


@pytest.mark.asyncio
async def test_top_expenses_item_structure(client: AsyncClient, auth_headers: dict):
    """Each top expense item should have the required fields."""
    today = _today_str()
    await client.post("/api/v1/transactions", json={
        "amount": 999, "type": "expense", "description": "Test Expense", "date": today,
    }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/top-expenses", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    item = data["items"][0]
    assert "id" in item
    assert "description" in item
    assert "amount" in item
    assert "currency" in item
    assert "date" in item
    assert "category_name" in item
    assert "category_name_he" in item
    assert "category_color" in item
    assert "category_icon" in item


@pytest.mark.asyncio
async def test_top_expenses_max_five(client: AsyncClient, auth_headers: dict):
    """Top expenses should return at most 5 even if more expenses exist."""
    today = _today_str()
    for i in range(10):
        await client.post("/api/v1/transactions", json={
            "amount": 100 * (i + 1),
            "type": "expense",
            "description": f"Expense {i}",
            "date": today,
        }, headers=auth_headers)

    response = await client.get("/api/v1/dashboard/top-expenses", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5


# ===========================================================================
# Cross-endpoint / Auth tests
# ===========================================================================

@pytest.mark.asyncio
async def test_dashboard_summary_unauthorized(client: AsyncClient):
    """Dashboard summary should reject unauthenticated requests."""
    response = await client.get("/api/v1/dashboard/summary")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_dashboard_weekly_unauthorized(client: AsyncClient):
    """Dashboard weekly should reject unauthenticated requests."""
    response = await client.get("/api/v1/dashboard/weekly")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_dashboard_financial_health_unauthorized(client: AsyncClient):
    """Financial health should reject unauthenticated requests."""
    response = await client.get("/api/v1/dashboard/financial-health")
    assert response.status_code in (401, 403)
