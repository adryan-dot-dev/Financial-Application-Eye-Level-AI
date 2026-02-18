from __future__ import annotations

import logging
from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, DataContext
from app.api.v1.schemas.budget import (
    BudgetCreate,
    BudgetResponse,
    BudgetSummaryResponse,
    BudgetUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models import Category, OrgBudget, User
from app.db.session import get_db
from app.services.audit_service import log_action
from app.services.budget_service import compute_budget_actuals

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.post("", response_model=BudgetResponse, status_code=201)
async def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    # Verify category exists and belongs to user
    cat_result = await db.execute(
        select(Category).where(
            Category.id == data.category_id,
            ctx.ownership_filter(Category),
        )
    )
    category = cat_result.scalar_one_or_none()
    if not category:
        raise NotFoundException("Category not found")

    budget = OrgBudget(
        **ctx.create_fields(),
        category_id=data.category_id,
        period_type=data.period_type,
        amount=data.amount,
        currency=data.currency,
        start_date=data.start_date,
        end_date=data.end_date,
        alert_at_percentage=data.alert_at_percentage,
    )
    db.add(budget)
    await log_action(db, user_id=current_user.id, action="create", entity_type="budget", entity_id=str(budget.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(budget)
    logger.info("User %s created budget %s", current_user.id, budget.id)

    actuals = await compute_budget_actuals(db, budget, ctx)
    resp = BudgetResponse.model_validate(budget)
    for k, v in actuals.items():
        setattr(resp, k, v)
    resp.category_name = category.name
    return resp


@router.get("", response_model=List[BudgetResponse])
async def list_budgets(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrgBudget)
        .where(ctx.ownership_filter(OrgBudget))
        .order_by(OrgBudget.created_at.desc())
    )
    budgets = result.scalars().all()

    responses = []
    for budget in budgets:
        actuals = await compute_budget_actuals(db, budget, ctx)
        resp = BudgetResponse.model_validate(budget)
        for k, v in actuals.items():
            setattr(resp, k, v)
        # Get category name
        cat_result = await db.execute(
            select(Category.name).where(Category.id == budget.category_id)
        )
        resp.category_name = cat_result.scalar_one_or_none()
        responses.append(resp)

    return responses


@router.get("/summary", response_model=BudgetSummaryResponse)
async def get_budget_summary(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrgBudget).where(
            ctx.ownership_filter(OrgBudget),
            OrgBudget.is_active == True,
        )
    )
    budgets = result.scalars().all()

    budget_responses: List[BudgetResponse] = []
    total_budgeted = Decimal("0")
    total_actual = Decimal("0")
    over_count = 0

    for budget in budgets:
        actuals = await compute_budget_actuals(db, budget, ctx)
        resp = BudgetResponse.model_validate(budget)
        for k, v in actuals.items():
            setattr(resp, k, v)
        cat_result = await db.execute(
            select(Category.name).where(Category.id == budget.category_id)
        )
        resp.category_name = cat_result.scalar_one_or_none()
        budget_responses.append(resp)

        total_budgeted += Decimal(str(budget.amount))
        total_actual += actuals["actual_amount"]
        if actuals["is_over_budget"]:
            over_count += 1

    return BudgetSummaryResponse(
        budgets=budget_responses,
        total_budgeted=total_budgeted,
        total_actual=total_actual,
        over_budget_count=over_count,
    )


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrgBudget).where(
            OrgBudget.id == budget_id,
            ctx.ownership_filter(OrgBudget),
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise NotFoundException("Budget not found")

    actuals = await compute_budget_actuals(db, budget, ctx)
    resp = BudgetResponse.model_validate(budget)
    for k, v in actuals.items():
        setattr(resp, k, v)
    cat_result = await db.execute(
        select(Category.name).where(Category.id == budget.category_id)
    )
    resp.category_name = cat_result.scalar_one_or_none()
    return resp


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: UUID,
    data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrgBudget).where(
            OrgBudget.id == budget_id,
            ctx.ownership_filter(OrgBudget),
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise NotFoundException("Budget not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(budget, key, value)

    await log_action(db, user_id=current_user.id, action="update", entity_type="budget", entity_id=str(budget.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(budget)
    logger.info("User %s updated budget %s", current_user.id, budget.id)

    actuals = await compute_budget_actuals(db, budget, ctx)
    resp = BudgetResponse.model_validate(budget)
    for k, v in actuals.items():
        setattr(resp, k, v)
    return resp


@router.delete("/{budget_id}")
async def delete_budget(
    budget_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrgBudget).where(
            OrgBudget.id == budget_id,
            ctx.ownership_filter(OrgBudget),
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise NotFoundException("Budget not found")

    await log_action(db, user_id=current_user.id, action="delete", entity_type="budget", entity_id=str(budget.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.delete(budget)
    await db.commit()
    logger.info("User %s deleted budget %s", current_user.id, budget_id)
    return {"detail": "Budget deleted"}
