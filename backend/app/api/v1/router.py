from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    alerts,
    audit_logs,
    auth,
    automation,
    backups,
    balance,
    bank_accounts,
    budgets,
    categories,
    credit_cards,
    currency,
    dashboard,
    expected_income,
    export,
    fixed,
    forecast,
    installments,
    loans,
    obligo,
    organizations,
    settings,
    subscriptions,
    transactions,
    users,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(audit_logs.router)
api_router.include_router(users.router)
api_router.include_router(settings.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(fixed.router)
api_router.include_router(installments.router)
api_router.include_router(loans.router)
api_router.include_router(balance.router)
api_router.include_router(expected_income.router)
api_router.include_router(forecast.router)
api_router.include_router(dashboard.router)
api_router.include_router(currency.router)
api_router.include_router(alerts.router)
api_router.include_router(subscriptions.router)
api_router.include_router(automation.router)
api_router.include_router(export.router)
api_router.include_router(backups.router)
api_router.include_router(organizations.router)
api_router.include_router(credit_cards.router)
api_router.include_router(bank_accounts.router)
api_router.include_router(obligo.router)
api_router.include_router(budgets.router)
