from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    current_balance: Decimal
    monthly_income: Decimal
    monthly_expenses: Decimal
    net_cashflow: Decimal
    balance_trend: Decimal
    income_trend: Decimal
    expense_trend: Decimal


class DashboardPeriodData(BaseModel):
    period: str
    income: Decimal
    expenses: Decimal
    net: Decimal
    balance: Decimal


# ---------------------------------------------------------------------------
# Category Breakdown
# ---------------------------------------------------------------------------

class CategoryBreakdownItem(BaseModel):
    category_id: Optional[str]
    category_name: str
    category_name_he: str
    category_color: str
    category_icon: str
    total_amount: Decimal
    percentage: Decimal
    transaction_count: int


class CategoryBreakdownResponse(BaseModel):
    items: List[CategoryBreakdownItem]
    total_expenses: Decimal
    period: str  # e.g. "2026-02"


# ---------------------------------------------------------------------------
# Upcoming Payments
# ---------------------------------------------------------------------------

class UpcomingPaymentItem(BaseModel):
    id: str
    name: str
    amount: Decimal
    currency: str
    source_type: str  # 'fixed', 'installment', 'loan'
    type: str  # 'income' or 'expense'
    due_date: date
    days_until_due: int
    category_name: Optional[str]
    category_color: Optional[str]
    installment_info: Optional[str]  # e.g. "4/12"


class UpcomingPaymentsResponse(BaseModel):
    items: List[UpcomingPaymentItem]
    total_upcoming_expenses: Decimal
    total_upcoming_income: Decimal
    days_ahead: int


# ---------------------------------------------------------------------------
# Financial Health
# ---------------------------------------------------------------------------

class HealthFactor(BaseModel):
    name: str  # e.g. 'savings_ratio', 'debt_ratio', 'expense_stability'
    score: int  # 0-100 for this factor
    weight: Decimal
    description: str


class FinancialHealthResponse(BaseModel):
    score: int  # 0-100
    grade: str  # 'excellent', 'good', 'fair', 'poor', 'critical'
    factors: List[HealthFactor]


# ---------------------------------------------------------------------------
# Installments Summary
# ---------------------------------------------------------------------------

class InstallmentSummaryItem(BaseModel):
    id: str
    name: str
    monthly_amount: Decimal
    currency: str
    type: str  # 'income' or 'expense'
    payments_completed: int
    total_payments: int
    progress_pct: Decimal  # 0-100
    remaining_amount: Decimal
    next_payment_date: Optional[date]


class InstallmentsSummaryResponse(BaseModel):
    active_count: int
    total_monthly_expense: Decimal
    total_monthly_income: Decimal
    total_remaining: Decimal
    items: List[InstallmentSummaryItem]


# ---------------------------------------------------------------------------
# Loans Summary
# ---------------------------------------------------------------------------

class LoanSummaryItem(BaseModel):
    id: str
    name: str
    monthly_payment: Decimal
    currency: str
    original_amount: Decimal
    remaining_balance: Decimal
    payments_made: int
    total_payments: int
    progress_pct: Decimal
    interest_rate: Decimal
    next_payment_date: Optional[date]


class LoansSummaryResponse(BaseModel):
    active_count: int
    total_monthly_payments: Decimal
    total_remaining_balance: Decimal
    total_original_amount: Decimal
    overall_progress_pct: Decimal
    items: List[LoanSummaryItem]


# ---------------------------------------------------------------------------
# Top Expenses
# ---------------------------------------------------------------------------

class TopExpenseItem(BaseModel):
    id: str
    description: str
    amount: Decimal
    currency: str
    date: date
    category_name: Optional[str]
    category_name_he: Optional[str]
    category_color: Optional[str]
    category_icon: Optional[str]


class TopExpensesResponse(BaseModel):
    items: List[TopExpenseItem]
    period: str
