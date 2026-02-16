from __future__ import annotations

import calendar
import math
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
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
from app.db.models import Category, Installment, Transaction, User
from app.db.session import get_db

router = APIRouter(prefix="/installments", tags=["Installments"])


def _calc_monthly_amount(total: Decimal, num_payments: int) -> Decimal:
    if num_payments <= 0:
        raise ValueError("number_of_payments must be > 0")
    return (total / num_payments).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _safe_day(year: int, month: int, day: int) -> date:
    """Return a date clamping day to the last valid day of the month."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


def _enrich_installment(inst: Installment, today: Optional[date] = None) -> InstallmentResponse:
    """Compute all derived/status fields for an installment and return the response model.

    Computed fields:
    - status: "completed" | "pending" | "overdue" | "active"
    - expected_payments_by_now: how many payments should have been made by today
    - is_on_track: payments_completed >= expected_payments_by_now
    - next_payment_date: date of next due payment (None if completed)
    - end_date: start_date + (number_of_payments - 1) months, on day_of_month
    - remaining_amount: total_amount - (payments_completed * monthly_amount)
    - progress_percentage: (payments_completed / number_of_payments) * 100
    """
    if today is None:
        today = date.today()

    start = inst.start_date
    dom = inst.day_of_month
    num_payments = inst.number_of_payments
    completed = inst.payments_completed

    # --- expected_payments_by_now ---
    # How many months have elapsed since start_date up to today?
    months_elapsed = (today.year - start.year) * 12 + (today.month - start.month)
    # If today's day is >= day_of_month (or past end of month), count current month
    if today.day >= dom:
        months_elapsed += 1
    # Also handle case where the start hasn't begun yet
    if today < start:
        months_elapsed = 0
    expected_payments_by_now = max(0, min(months_elapsed, num_payments))

    # --- status ---
    if completed >= num_payments:
        status = "completed"
    elif today < start:
        status = "pending"
    elif completed < expected_payments_by_now:
        status = "overdue"
    else:
        status = "active"

    # --- is_on_track ---
    is_on_track = completed >= expected_payments_by_now

    # --- next_payment_date ---
    next_payment_num = completed + 1
    if next_payment_num > num_payments:
        next_payment_date = None
    else:
        # next payment is at start_date + (next_payment_num - 1) months, day = day_of_month
        next_dt = start + relativedelta(months=next_payment_num - 1)
        next_payment_date = _safe_day(next_dt.year, next_dt.month, dom)

    # --- end_date ---
    end_dt = start + relativedelta(months=num_payments - 1)
    end_date = _safe_day(end_dt.year, end_dt.month, dom)

    # --- remaining_amount ---
    remaining_amount = max(
        Decimal("0"),
        inst.total_amount - (Decimal(str(completed)) * inst.monthly_amount),
    )

    # --- progress_percentage ---
    progress_percentage = round((completed / num_payments) * 100, 1) if num_payments > 0 else 0.0

    # Build response model from ORM instance + computed fields
    resp = InstallmentResponse.model_validate(inst)
    resp.status = status
    resp.expected_payments_by_now = expected_payments_by_now
    resp.is_on_track = is_on_track
    resp.next_payment_date = next_payment_date
    resp.end_date = end_date
    resp.remaining_amount = remaining_amount
    resp.progress_percentage = progress_percentage

    return resp


def _build_schedule(inst: Installment) -> List[PaymentScheduleItem]:
    """Build the payment schedule for an installment."""
    schedule = []
    today = date.today()
    for i in range(1, inst.number_of_payments + 1):
        payment_date = inst.start_date + relativedelta(months=i - 1)
        # Adjust day_of_month (handle months with fewer days)
        payment_date = _safe_day(payment_date.year, payment_date.month, inst.day_of_month)

        if i <= inst.payments_completed:
            status = "completed"
        elif payment_date <= today:
            status = "upcoming"
        else:
            status = "future"

        # Last payment adjusts for rounding difference
        if i == inst.number_of_payments:
            paid_so_far = inst.monthly_amount * (inst.number_of_payments - 1)
            amount = inst.total_amount - paid_so_far
        else:
            amount = inst.monthly_amount

        schedule.append(PaymentScheduleItem(
            payment_number=i,
            date=payment_date,
            amount=amount,
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
    installments = result.scalars().all()
    today = date.today()
    return [_enrich_installment(inst, today) for inst in installments]


@router.post("", response_model=InstallmentResponse, status_code=201)
async def create_installment(
    data: InstallmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.category_id:
        cat = await db.get(Category, data.category_id)
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")

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
    return _enrich_installment(inst)


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
        installment=_enrich_installment(inst),
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
    if "category_id" in update_data and update_data["category_id"]:
        cat = await db.get(Category, update_data["category_id"])
        if not cat or cat.user_id != current_user.id:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")

    for key, value in update_data.items():
        setattr(inst, key, value)
    await db.commit()
    await db.refresh(inst)
    return _enrich_installment(inst)


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


@router.post("/{installment_id}/mark-paid", response_model=InstallmentResponse)
async def mark_installment_paid(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            Installment.user_id == current_user.id,
        ).with_for_update()
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")

    if inst.payments_completed >= inst.number_of_payments:
        raise HTTPException(status_code=422, detail="All payments have already been completed")

    inst.payments_completed += 1
    payment_number = inst.payments_completed

    # RED-8: Rounding correction - last payment absorbs the difference
    if payment_number == inst.number_of_payments:
        actual_amount = inst.total_amount - (
            inst.monthly_amount * (inst.number_of_payments - 1)
        )
    else:
        actual_amount = inst.monthly_amount

    # RED-2: Create automatic transaction for the payment
    payment_date = inst.start_date + relativedelta(months=payment_number - 1)
    payment_date = _safe_day(payment_date.year, payment_date.month, inst.day_of_month)

    tx = Transaction(
        user_id=current_user.id,
        amount=actual_amount,
        currency=inst.currency,
        type=inst.type,
        category_id=inst.category_id,
        description=f"Installment: {inst.name} ({payment_number}/{inst.number_of_payments})",
        date=payment_date,
        entry_pattern="installment",
        is_recurring=True,
        installment_id=inst.id,
        installment_number=payment_number,
    )
    db.add(tx)

    await db.commit()
    await db.refresh(inst)
    return _enrich_installment(inst)


@router.post("/{installment_id}/reverse-payment", response_model=InstallmentResponse)
async def reverse_installment_payment(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            Installment.user_id == current_user.id,
        ).with_for_update()
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")

    if inst.payments_completed <= 0:
        raise HTTPException(status_code=400, detail="No payments to reverse")

    inst.payments_completed -= 1
    await db.commit()
    await db.refresh(inst)
    return _enrich_installment(inst)


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
