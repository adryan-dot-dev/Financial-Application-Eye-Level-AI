from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.forecast import (
    ForecastResponse,
    ForecastSummary,
    ForecastWeeklyResponse,
)
from app.db.models import Alert, User
from app.db.session import get_db
from app.services.alert_service import generate_alerts
from app.services.forecast_service import compute_monthly_forecast, compute_weekly_forecast

router = APIRouter(prefix="/forecast", tags=["Forecast"])


@router.get("", response_model=ForecastResponse)
async def get_forecast(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await compute_monthly_forecast(db, current_user.id, months)
    return result


@router.get("/weekly", response_model=ForecastWeeklyResponse)
async def get_weekly_forecast(
    weeks: int = Query(12, ge=1, le=52),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await compute_weekly_forecast(db, current_user.id, weeks)
    return result


@router.get("/summary", response_model=ForecastSummary)
async def get_forecast_summary(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Generate/refresh alerts
    await generate_alerts(db, current_user.id, months)

    forecast = await compute_monthly_forecast(db, current_user.id, months)

    total_income = sum(m["total_income"] for m in forecast["months"])
    total_expenses = sum(m["total_expenses"] for m in forecast["months"])

    # Count active alerts
    alert_count_result = await db.execute(
        select(func.count(Alert.id)).where(
            Alert.user_id == current_user.id,
            Alert.is_dismissed == False,
        )
    )
    alerts_count = alert_count_result.scalar() or 0

    end_balance = forecast["months"][-1]["closing_balance"] if forecast["months"] else forecast["current_balance"]

    return ForecastSummary(
        current_balance=forecast["current_balance"],
        forecast_months=months,
        total_expected_income=total_income,
        total_expected_expenses=total_expenses,
        net_projected=total_income - total_expenses,
        end_balance=end_balance,
        has_negative_months=forecast["has_negative_months"],
        alerts_count=alerts_count,
    )
