from __future__ import annotations

import calendar
import math
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, get_base_currency, DataContext
from app.api.v1.schemas.installment import (
    InstallmentCreate,
    InstallmentDetailResponse,
    InstallmentResponse,
    InstallmentUpdate,
    PaymentScheduleItem,
)
from app.core.exceptions import NotFoundException
from app.db.models import Category, Installment, Transaction, User
from app.db.models.bank_account import BankAccount
from app.db.models.credit_card import CreditCard
from app.db.session import get_db
from app.services.audit_service import log_action
from app.services.exchange_rate_service import prepare_currency_fields

import logging

logger = logging.getLogger(__name__)

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
    - status: "completed" | "pending" | "overdue" | "due" | "active"
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

    # --- next_payment_date (computed before status so we can check "due") ---
    next_payment_num = completed + 1
    if next_payment_num > num_payments:
        next_payment_date = None
    else:
        # next payment is at start_date + (next_payment_num - 1) months, day = day_of_month
        next_dt = start + relativedelta(months=next_payment_num - 1)
        next_payment_date = _safe_day(next_dt.year, next_dt.month, dom)

    # --- status ---
    if completed >= num_payments:
        status = "completed"
    elif today < start:
        status = "pending"
    elif completed < expected_payments_by_now:
        status = "overdue"
    elif next_payment_date is not None and next_payment_date == today:
        status = "due"
    else:
        status = "active"

    # --- is_on_track ---
    is_on_track = completed >= expected_payments_by_now

    # --- end_date ---
    end_dt = start + relativedelta(months=num_payments - 1)
    end_date = _safe_day(end_dt.year, end_dt.month, dom)

    # --- remaining_amount ---
    # Use the same rounding-aware logic as the payment schedule: the last
    # payment absorbs the rounding difference, so we cannot simply multiply
    # monthly_amount * remaining_count.
    remaining_count = num_payments - completed
    if remaining_count <= 0:
        remaining_amount = Decimal("0")
    elif remaining_count == 1:
        # Only one payment left -- it absorbs the rounding remainder
        remaining_amount = max(
            Decimal("0"),
            inst.total_amount - (inst.monthly_amount * (num_payments - 1)),
        )
    else:
        # More than one payment left: (remaining_count - 1) regular payments
        # plus one last payment that absorbs the rounding difference
        regular_remaining = inst.monthly_amount * (remaining_count - 1)
        last_payment = inst.total_amount - (inst.monthly_amount * (num_payments - 1))
        remaining_amount = max(Decimal("0"), regular_remaining + last_payment)

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
        elif payment_date < today:
            status = "overdue"
        elif payment_date.year == today.year and payment_date.month == today.month:
            status = "due"
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
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Installment)
        .where(ctx.ownership_filter(Installment))
        .order_by(Installment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    installments = result.scalars().all()
    today = date.today()
    return [_enrich_installment(inst, today) for inst in installments]


@router.post("", response_model=InstallmentResponse, status_code=201)
async def create_installment(
    data: InstallmentCreate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    base_currency: str = Depends(get_base_currency),
    db: AsyncSession = Depends(get_db),
):
    if data.category_id:
        cat_result = await db.execute(
            select(Category).where(Category.id == data.category_id, ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        if cat.type != data.type:
            raise HTTPException(
                status_code=422,
                detail=f"Category type '{cat.type}' does not match installment type '{data.type}'"
            )

    # Payment method consistency validation
    if data.payment_method == "credit_card" and not data.credit_card_id:
        raise HTTPException(
            status_code=422,
            detail="credit_card_id is required when payment_method is 'credit_card'"
        )
    if data.payment_method == "bank_transfer" and not data.bank_account_id:
        raise HTTPException(
            status_code=422,
            detail="bank_account_id is required when payment_method is 'bank_transfer'"
        )

    if data.credit_card_id:
        cc_result = await db.execute(
            select(CreditCard).where(CreditCard.id == data.credit_card_id, ctx.ownership_filter(CreditCard))
        )
        if not cc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Credit card not found or does not belong to you")

    if data.bank_account_id:
        ba_result = await db.execute(
            select(BankAccount).where(BankAccount.id == data.bank_account_id, ctx.ownership_filter(BankAccount))
        )
        if not ba_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Bank account not found or does not belong to you")

    data_dict = data.model_dump()
    first_payment_made = data_dict.pop("first_payment_made", False)

    conv = await prepare_currency_fields(data.total_amount, data.currency, base_currency)
    converted_total = conv["converted_amount"]
    data_dict["total_amount"] = converted_total
    data_dict["currency"] = base_currency
    data_dict["original_amount"] = conv["original_amount"]
    data_dict["original_currency"] = conv["original_currency"]
    data_dict["exchange_rate"] = conv["exchange_rate"]

    monthly_amount = _calc_monthly_amount(converted_total, data.number_of_payments)
    payments_completed = 1 if first_payment_made else 0
    inst = Installment(
        **ctx.create_fields(),
        monthly_amount=monthly_amount,
        payments_completed=payments_completed,
        **data_dict,
    )
    db.add(inst)

    # If first payment already made, create a transaction for it
    if first_payment_made:
        await db.flush()  # Ensure inst.id is generated before referencing it
        payment_date = inst.start_date
        payment_date = _safe_day(payment_date.year, payment_date.month, data.day_of_month)

        tx = Transaction(
            **ctx.create_fields(),
            amount=monthly_amount,
            currency=base_currency,
            type=data.type,
            category_id=data.category_id,
            description=f"Installment: {data.name} (1/{data.number_of_payments})",
            date=payment_date,
            entry_pattern="installment",
            is_recurring=True,
            installment_id=inst.id,
            installment_number=1,
        )
        db.add(tx)

    await log_action(db, user_id=current_user.id, action="create", entity_type="installment", entity_id=str(inst.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(inst)
    logger.info("User %s created installment %s", current_user.id, inst.id)
    return _enrich_installment(inst)


@router.get("/{installment_id}", response_model=InstallmentDetailResponse)
async def get_installment(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            ctx.ownership_filter(Installment),
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
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            ctx.ownership_filter(Installment),
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")

    update_data = data.model_dump(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"]:
        cat_result = await db.execute(
            select(Category).where(Category.id == update_data["category_id"], ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")
        effective_type = update_data.get("type", inst.type)
        if cat.type != effective_type:
            raise HTTPException(
                status_code=422,
                detail=f"Category type '{cat.type}' does not match installment type '{effective_type}'"
            )

    # Payment method consistency validation on update
    effective_payment_method = update_data.get("payment_method", inst.payment_method)
    effective_cc_id = update_data.get("credit_card_id", inst.credit_card_id)
    effective_ba_id = update_data.get("bank_account_id", inst.bank_account_id)
    if effective_payment_method == "credit_card" and not effective_cc_id:
        raise HTTPException(
            status_code=422,
            detail="credit_card_id is required when payment_method is 'credit_card'"
        )
    if effective_payment_method == "bank_transfer" and not effective_ba_id:
        raise HTTPException(
            status_code=422,
            detail="bank_account_id is required when payment_method is 'bank_transfer'"
        )

    if update_data.get("credit_card_id"):
        cc_result = await db.execute(
            select(CreditCard).where(CreditCard.id == update_data["credit_card_id"], ctx.ownership_filter(CreditCard))
        )
        if not cc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Credit card not found or does not belong to you")

    if update_data.get("bank_account_id"):
        ba_result = await db.execute(
            select(BankAccount).where(BankAccount.id == update_data["bank_account_id"], ctx.ownership_filter(BankAccount))
        )
        if not ba_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Bank account not found or does not belong to you")

    for key, value in update_data.items():
        setattr(inst, key, value)

    # Recalculate monthly_amount when total_amount or number_of_payments changed
    if "total_amount" in update_data or "number_of_payments" in update_data:
        inst.monthly_amount = _calc_monthly_amount(
            inst.total_amount, inst.number_of_payments,
        )

    await log_action(db, user_id=current_user.id, action="update", entity_type="installment", entity_id=str(installment_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(inst)
    logger.info("User %s updated installment %s", current_user.id, inst.id)
    return _enrich_installment(inst)


@router.delete("/{installment_id}")
async def delete_installment(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            ctx.ownership_filter(Installment),
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")
    await db.delete(inst)
    await log_action(db, user_id=current_user.id, action="delete", entity_type="installment", entity_id=str(installment_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    logger.info("User %s deleted installment %s", current_user.id, installment_id)
    return {"message": "Deleted successfully"}


@router.post("/{installment_id}/mark-paid", response_model=InstallmentResponse)
async def mark_installment_paid(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            ctx.ownership_filter(Installment),
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
        **ctx.create_fields(),
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

    await log_action(db, user_id=current_user.id, action="mark_paid", entity_type="installment", entity_id=str(installment_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(inst)
    logger.info("User %s marked installment %s as paid", current_user.id, inst.id)
    return _enrich_installment(inst)


@router.post("/{installment_id}/reverse-payment", response_model=InstallmentResponse)
async def reverse_installment_payment(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            ctx.ownership_filter(Installment),
        ).with_for_update()
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")

    if inst.payments_completed <= 0:
        raise HTTPException(status_code=400, detail="No payments to reverse")

    # Delete the orphaned transaction created during the original mark-paid
    payment_number = inst.payments_completed  # current count = the payment to reverse
    orphan_result = await db.execute(
        select(Transaction).where(
            Transaction.installment_id == installment_id,
            Transaction.installment_number == payment_number,
        )
    )
    orphan_tx = orphan_result.scalar_one_or_none()
    if orphan_tx:
        await db.delete(orphan_tx)

    inst.payments_completed -= 1
    await log_action(db, user_id=current_user.id, action="reverse_payment", entity_type="installment", entity_id=str(installment_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(inst)
    logger.info("User %s reversed payment on installment %s", current_user.id, inst.id)
    return _enrich_installment(inst)


@router.get("/{installment_id}/payments", response_model=List[PaymentScheduleItem])
async def get_installment_payments(
    installment_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Installment).where(
            Installment.id == installment_id,
            ctx.ownership_filter(Installment),
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise NotFoundException("Installment not found")
    return _build_schedule(inst)
