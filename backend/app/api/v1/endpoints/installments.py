from __future__ import annotations

import math
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.installment import (
    InstallmentCreate,
    InstallmentDetailResponse,
    InstallmentResponse,
    InstallmentUpdate,
    PaymentScheduleItem,
)
from app.core.exceptions import NotFoundException
from app.db.models import Installment, User
from app.db.session import get_db

router = APIRouter(prefix="/installments", tags=["Installments"])


def _calc_monthly_amount(total: Decimal, num_payments: int) -> Decimal:
    return (total / num_payments).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _build_schedule(inst: Installment) -> List[PaymentScheduleItem]:
    """Build the payment schedule for an installment."""
    schedule = []
    today = date.today()
    for i in range(1, inst.number_of_payments + 1):
        payment_date = inst.start_date + relativedelta(months=i - 1)
        # Adjust day_of_month (handle months with fewer days)
        try:
            payment_date = payment_date.replace(day=inst.day_of_month)
        except ValueError:
            # e.g., day 31 in a month with 30 days - use last day
            import calendar
            last_day = calendar.monthrange(payment_date.year, payment_date.month)[1]
            payment_date = payment_date.replace(day=last_day)

        if i <= inst.payments_completed:
            status = "completed"
        elif payment_date <= today:
            status = "upcoming"
        else:
            status = "future"

        schedule.append(PaymentScheduleItem(
            payment_number=i,
            date=payment_date,
            amount=inst.monthly_amount,
            status=status,
        ))
    return schedule


@router.get("", response_model=List[InstallmentResponse])
async def list_installments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment)
        .where(Installment.user_id == current_user.id)
        .order_by(Installment.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=InstallmentResponse, status_code=201)
async def create_installment(
    data: InstallmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    monthly_amount = _calc_monthly_amount(data.total_amount, data.number_of_payments)
    inst = Installment(
        user_id=current_user.id,
        monthly_amount=monthly_amount,
        payments_completed=0,
        **data.model_dump(),
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


@router.get("/{installment_id}", response_model=InstallmentDetailResponse)
async def get_installment(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            Installment.user_id == current_user.id,
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")

    schedule = _build_schedule(inst)
    return InstallmentDetailResponse(
        installment=InstallmentResponse.model_validate(inst),
        schedule=schedule,
    )


@router.put("/{installment_id}", response_model=InstallmentResponse)
async def update_installment(
    installment_id: UUID,
    data: InstallmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            Installment.user_id == current_user.id,
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(inst, key, value)
    await db.commit()
    await db.refresh(inst)
    return inst


@router.delete("/{installment_id}")
async def delete_installment(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            Installment.user_id == current_user.id,
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")
    await db.delete(inst)
    await db.commit()
    return {"message": "Deleted successfully"}


@router.get("/{installment_id}/payments", response_model=List[PaymentScheduleItem])
async def get_installment_payments(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            Installment.user_id == current_user.id,
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")
    return _build_schedule(inst)
