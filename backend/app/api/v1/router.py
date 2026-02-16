from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import (
    alerts,
    auth,
    automation,
    balance,
    categories,
    dashboard,
    expected_income,
    fixed,
    forecast,
    installments,
    loans,
    settings,
    transactions,
    users,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
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
api_router.include_router(alerts.router)
api_router.include_router(automation.router)
