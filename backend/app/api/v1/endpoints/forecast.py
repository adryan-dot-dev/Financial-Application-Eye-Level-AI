from __future__ import annotations

from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, DataContext
from app.api.v1.schemas.forecast import (
    CompareMonthDelta,
    CompareRequest,
    CompareResponse,
    ForecastResponse,
    ForecastSummary,
    ForecastWeeklyResponse,
    ScenarioCreate,
    ScenarioResponse,
    ScenarioUpdate,
    WhatIfRequest,
    WhatIfResponse,
)
from app.core.exceptions import NotFoundException
from app.db.models import Alert, User
from app.db.models.forecast_scenario import ForecastScenario
from app.db.session import get_db
from app.services.alert_service import generate_alerts
from app.services.audit_service import log_action
from app.core.cache import set_cache_headers
from app.services.forecast_service import compute_monthly_forecast, compute_weekly_forecast

router = APIRouter(prefix="/forecast", tags=["Forecast"])

ZERO = Decimal("0")


@router.get("", response_model=ForecastResponse)
async def get_forecast(
    response: Response,
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    set_cache_headers(response, max_age=60)
    result = await compute_monthly_forecast(db, user_id=current_user.id, months=months, ctx=ctx)
    return result


@router.get("/weekly", response_model=ForecastWeeklyResponse)
async def get_weekly_forecast(
    response: Response,
    weeks: int = Query(12, ge=1, le=52),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    set_cache_headers(response, max_age=60)
    result = await compute_weekly_forecast(db, user_id=current_user.id, weeks=weeks, ctx=ctx)
    return result


@router.get("/summary", response_model=ForecastSummary)
async def get_forecast_summary(
    response: Response,
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    set_cache_headers(response, max_age=60)
    await generate_alerts(db, user_id=current_user.id, months=months)

    forecast = await compute_monthly_forecast(db, user_id=current_user.id, months=months, ctx=ctx)

    total_income = sum(Decimal(str(m["total_income"])) for m in forecast["months"])
    total_expenses = sum(Decimal(str(m["total_expenses"])) for m in forecast["months"])

    alert_count_result = await db.execute(
        select(func.count(Alert.id)).where(
            ctx.ownership_filter(Alert),
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


# ---------------------------------------------------------------------------
# What-If
# ---------------------------------------------------------------------------

@router.post("/what-if", response_model=WhatIfResponse)
async def compute_what_if(
    data: WhatIfRequest,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Compute a what-if forecast with hypothetical income/expense/balance changes."""
    what_if_dict = data.params.model_dump()
    result = await compute_monthly_forecast(
        db, user_id=current_user.id, months=data.months, ctx=ctx,
        what_if=what_if_dict,
    )
    return WhatIfResponse(
        current_balance=result["original_balance"],
        adjusted_balance=result["current_balance"],
        months=result["months"],
        has_negative_months=result["has_negative_months"],
        first_negative_month=result.get("first_negative_month"),
        params=data.params,
    )


# ---------------------------------------------------------------------------
# Scenario CRUD
# ---------------------------------------------------------------------------

@router.post("/scenarios", response_model=ScenarioResponse, status_code=201)
async def create_scenario(
    data: ScenarioCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Save a what-if scenario for later comparison."""
    scenario = ForecastScenario(
        **ctx.create_fields(),
        name=data.name,
        description=data.description,
        params=data.params.model_dump(),
        months=data.months,
    )
    db.add(scenario)
    await log_action(db, user_id=current_user.id, action="create", entity_type="forecast_scenario", entity_id=str(scenario.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.get("/scenarios", response_model=List[ScenarioResponse])
async def list_scenarios(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """List all saved scenarios."""
    result = await db.execute(
        select(ForecastScenario)
        .where(ctx.ownership_filter(ForecastScenario))
        .order_by(ForecastScenario.created_at.desc())
    )
    return result.scalars().all()


@router.get("/scenarios/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(
    scenario_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ForecastScenario).where(
            ForecastScenario.id == scenario_id,
            ctx.ownership_filter(ForecastScenario),
        )
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise NotFoundException("Scenario not found")
    return scenario


@router.get("/scenarios/{scenario_id}/compute", response_model=WhatIfResponse)
async def compute_scenario(
    scenario_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Run a saved scenario and return the forecast results."""
    result = await db.execute(
        select(ForecastScenario).where(
            ForecastScenario.id == scenario_id,
            ctx.ownership_filter(ForecastScenario),
        )
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise NotFoundException("Scenario not found")

    forecast = await compute_monthly_forecast(
        db, user_id=current_user.id, months=scenario.months, ctx=ctx,
        what_if=scenario.params,
    )
    from app.api.v1.schemas.forecast import WhatIfParams
    return WhatIfResponse(
        current_balance=forecast["original_balance"],
        adjusted_balance=forecast["current_balance"],
        months=forecast["months"],
        has_negative_months=forecast["has_negative_months"],
        first_negative_month=forecast.get("first_negative_month"),
        params=WhatIfParams(**scenario.params),
    )


@router.put("/scenarios/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    scenario_id: UUID,
    data: ScenarioUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ForecastScenario).where(
            ForecastScenario.id == scenario_id,
            ctx.ownership_filter(ForecastScenario),
        )
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise NotFoundException("Scenario not found")

    update_data = data.model_dump(exclude_unset=True)
    if "params" in update_data and update_data["params"] is not None:
        update_data["params"] = data.params.model_dump()
    for key, value in update_data.items():
        setattr(scenario, key, value)
    await log_action(db, user_id=current_user.id, action="update", entity_type="forecast_scenario", entity_id=str(scenario_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.delete("/scenarios/{scenario_id}")
async def delete_scenario(
    scenario_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ForecastScenario).where(
            ForecastScenario.id == scenario_id,
            ctx.ownership_filter(ForecastScenario),
        )
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise NotFoundException("Scenario not found")
    await db.delete(scenario)
    await log_action(db, user_id=current_user.id, action="delete", entity_type="forecast_scenario", entity_id=str(scenario_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    return {"message": "Scenario deleted successfully"}


# ---------------------------------------------------------------------------
# Compare
# ---------------------------------------------------------------------------

@router.post("/compare", response_model=CompareResponse)
async def compare_scenarios(
    data: CompareRequest,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Compare two scenarios side-by-side with monthly deltas."""

    async def _resolve_what_if(ref) -> dict:
        if ref.is_baseline:
            return None  # No what-if = baseline
        if ref.scenario_id:
            result = await db.execute(
                select(ForecastScenario).where(
                    ForecastScenario.id == ref.scenario_id,
                    ctx.ownership_filter(ForecastScenario),
                )
            )
            scenario = result.scalar_one_or_none()
            if not scenario:
                raise HTTPException(status_code=404, detail=f"Scenario {ref.scenario_id} not found")
            return scenario.params
        if ref.inline_params:
            return ref.inline_params.model_dump()
        return None  # Baseline

    wi_a = await _resolve_what_if(data.scenario_a)
    wi_b = await _resolve_what_if(data.scenario_b)

    forecast_a = await compute_monthly_forecast(
        db, user_id=current_user.id, months=data.months, ctx=ctx,
        what_if=wi_a,
    )
    forecast_b = await compute_monthly_forecast(
        db, user_id=current_user.id, months=data.months, ctx=ctx,
        what_if=wi_b,
    )

    deltas = []
    for ma, mb in zip(forecast_a["months"], forecast_b["months"]):
        deltas.append(CompareMonthDelta(
            month=ma["month"],
            closing_a=ma["closing_balance"],
            closing_b=mb["closing_balance"],
            delta=mb["closing_balance"] - ma["closing_balance"],
        ))

    return CompareResponse(
        scenario_a=forecast_a,
        scenario_b=forecast_b,
        deltas=deltas,
    )
