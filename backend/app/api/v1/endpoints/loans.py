from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, get_base_currency, DataContext
from app.api.v1.schemas.loan import (
    AmortizationItem,
    LoanCreate,
    LoanDetailResponse,
    LoanPaymentRecord,
    LoanResponse,
    LoanUpdate,
)
from app.core.exceptions import CashFlowException, NotFoundException
from app.db.models import Category, Loan, User
from app.db.models.bank_account import BankAccount
from app.db.session import get_db
from app.services.audit_service import log_action
from app.services.exchange_rate_service import prepare_currency_fields

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/loans", tags=["Loans"])


def _build_amortization(loan: Loan) -> List[AmortizationItem]:
    """Build amortization schedule for a loan (Spitzer/declining balance)."""
    schedule = []
    today = date.today()
    remaining = loan.original_amount
    monthly_rate = (
        (loan.interest_rate / Decimal("100") / Decimal("12"))
        if loan.interest_rate > 0
        else Decimal("0")
    )

    for i in range(1, loan.total_payments + 1):
        payment_date = loan.start_date + relativedelta(months=i - 1)
        try:
            payment_date = payment_date.replace(day=loan.day_of_month)
        except ValueError:
            last_day = calendar.monthrange(payment_date.year, payment_date.month)[1]
            payment_date = payment_date.replace(day=last_day)

        interest_portion = (remaining * monthly_rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        if i == loan.total_payments:
            # Last payment: pay off entire remaining balance + interest
            principal_portion = remaining
            actual_payment = principal_portion + interest_portion
        else:
            principal_portion = loan.monthly_payment - interest_portion
            # Guard: principal should not exceed remaining
            if principal_portion > remaining:
                principal_portion = remaining
            actual_payment = loan.monthly_payment

        remaining = remaining - principal_portion
        # Guard against sub-cent rounding drift
        if remaining < Decimal("0.01"):
            remaining = Decimal("0")

        if i <= loan.payments_made:
            status = "paid"
        elif payment_date < today:
            status = "overdue"
        elif payment_date.year == today.year and payment_date.month == today.month:
            status = "due"
        else:
            status = "future"

        schedule.append(AmortizationItem(
            payment_number=i,
            date=payment_date,
            payment_amount=actual_payment,
            principal=principal_portion,
            interest=interest_portion,
            remaining_balance=remaining,
            status=status,
        ))
    return schedule


@router.get("", response_model=List[LoanResponse])
async def list_loans(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Loan)
        .where(ctx.ownership_filter(Loan))
        .order_by(Loan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=LoanResponse, status_code=201)
async def create_loan(
    data: LoanCreate,
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

    if data.bank_account_id:
        ba_result = await db.execute(
            select(BankAccount).where(BankAccount.id == data.bank_account_id, ctx.ownership_filter(BankAccount))
        )
        if not ba_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Bank account not found or does not belong to you")

    # ORANGE-2: Validate monthly payment exceeds monthly interest
    if data.interest_rate > 0:
        monthly_interest = data.original_amount * (data.interest_rate / Decimal("12") / Decimal("100"))
        if data.monthly_payment <= monthly_interest:
            raise HTTPException(
                status_code=400,
                detail="Monthly payment must exceed monthly interest to pay off the loan",
            )

    data_dict = data.model_dump()
    first_payment_made = data_dict.pop("first_payment_made", False)

    # Multi-currency conversion for loan principal
    conv = await prepare_currency_fields(data.original_amount, data.currency, base_currency)
    converted_principal = conv["converted_amount"]
    rate = conv["exchange_rate"]
    data_dict["original_amount"] = converted_principal
    data_dict["currency"] = base_currency
    data_dict["original_currency_amount"] = conv["original_amount"]
    data_dict["original_currency"] = conv["original_currency"]
    data_dict["exchange_rate"] = rate
    # Convert monthly payment using same rate
    if data.currency.upper() != base_currency.upper():
        data_dict["monthly_payment"] = (data.monthly_payment * rate).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    # Compute first payment amortization if first_payment_made
    remaining_balance = converted_principal
    payments_made = 0
    status = "active"

    if first_payment_made:
        payments_made = 1
        monthly_rate = (data.interest_rate / Decimal("100") / Decimal("12")) if data.interest_rate > 0 else Decimal("0")
        interest_portion = (converted_principal * monthly_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        principal_portion = data_dict["monthly_payment"] - interest_portion
        if principal_portion > converted_principal:
            principal_portion = converted_principal
        new_remaining = max(Decimal("0"), converted_principal - principal_portion)
        remaining_balance = new_remaining
        if new_remaining <= 0 or payments_made >= data.total_payments:
            status = "completed"

    loan = Loan(
        **ctx.create_fields(),
        remaining_balance=remaining_balance,
        payments_made=payments_made,
        status=status,
        **data_dict,
    )
    db.add(loan)
    await log_action(db, user_id=current_user.id, action="create", entity_type="loan", entity_id=str(loan.id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(loan)
    logger.info("User %s created loan %s", current_user.id, loan.id)
    return loan


@router.get("/{loan_id}", response_model=LoanDetailResponse)
async def get_loan(
    loan_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            ctx.ownership_filter(Loan),
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")

    amortization = _build_amortization(loan)
    return LoanDetailResponse(
        loan=LoanResponse.model_validate(loan),
        amortization=amortization,
    )


@router.put("/{loan_id}", response_model=LoanResponse)
async def update_loan(
    loan_id: UUID,
    data: LoanUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            ctx.ownership_filter(Loan),
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")

    update_data = data.model_dump(exclude_unset=True)

    if "category_id" in update_data and update_data["category_id"]:
        cat_result = await db.execute(
            select(Category).where(Category.id == update_data["category_id"], ctx.ownership_filter(Category))
        )
        cat = cat_result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Category not found or does not belong to you")

    if "bank_account_id" in update_data and update_data["bank_account_id"]:
        ba_result = await db.execute(
            select(BankAccount).where(BankAccount.id == update_data["bank_account_id"], ctx.ownership_filter(BankAccount))
        )
        if not ba_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail="Bank account not found or does not belong to you")

    # Business logic: prevent invalid status transitions
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status == "completed" and loan.payments_made < loan.total_payments:
            raise HTTPException(
                status_code=422,
                detail="Cannot mark loan as completed: not all payments have been made"
            )
        if loan.status == "completed" and new_status == "active":
            raise HTTPException(
                status_code=422,
                detail="Cannot reactivate a completed loan"
            )

    for key, value in update_data.items():
        setattr(loan, key, value)
    await log_action(db, user_id=current_user.id, action="update", entity_type="loan", entity_id=str(loan_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(loan)
    logger.info("User %s updated loan %s", current_user.id, loan.id)
    return loan


@router.delete("/{loan_id}")
async def delete_loan(
    loan_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            ctx.ownership_filter(Loan),
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")
    await db.delete(loan)
    await log_action(db, user_id=current_user.id, action="delete", entity_type="loan", entity_id=str(loan_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    logger.info("User %s deleted loan %s", current_user.id, loan_id)
    return {"message": "Deleted successfully"}


@router.post("/{loan_id}/payment", response_model=LoanResponse)
async def record_payment(
    loan_id: UUID,
    data: LoanPaymentRecord,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            ctx.ownership_filter(Loan),
        ).with_for_update()
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")

    if loan.status == "completed":
        raise CashFlowException("Loan is already completed, cannot record payment")
    if loan.payments_made >= loan.total_payments:
        raise CashFlowException("All payments have already been made")

    # Validate payment amount does not exceed remaining balance
    if data.amount > loan.remaining_balance:
        raise HTTPException(
            status_code=422,
            detail=f"Payment amount ({data.amount}) exceeds remaining balance ({loan.remaining_balance})"
        )

    loan.payments_made += 1
    loan.remaining_balance = max(
        Decimal("0"), loan.remaining_balance - data.amount
    )
    if loan.payments_made >= loan.total_payments or loan.remaining_balance <= 0:
        loan.status = "completed"
        loan.remaining_balance = Decimal("0")

    await log_action(db, user_id=current_user.id, action="payment", entity_type="loan", entity_id=str(loan_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(loan)
    logger.info("User %s recorded payment on loan %s", current_user.id, loan.id)
    return loan


@router.get("/{loan_id}/breakdown", response_model=List[AmortizationItem])
async def get_loan_breakdown(
    loan_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            ctx.ownership_filter(Loan),
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")
    return _build_amortization(loan)


@router.post("/{loan_id}/reverse-payment", response_model=LoanResponse)
async def reverse_loan_payment(
    loan_id: UUID,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            ctx.ownership_filter(Loan),
        ).with_for_update()
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")

    if loan.payments_made <= 0:
        raise HTTPException(status_code=400, detail="No payments to reverse")

    # Recalculate what remaining_balance should be at payment N-1
    loan.payments_made -= 1
    if loan.payments_made == 0:
        loan.remaining_balance = loan.original_amount
    else:
        # Rebuild amortization and find balance after payment N-1
        schedule = _build_amortization(loan)
        loan.remaining_balance = schedule[loan.payments_made - 1].remaining_balance
    if loan.status == "completed":
        loan.status = "active"

    await log_action(db, user_id=current_user.id, action="reverse_payment", entity_type="loan", entity_id=str(loan_id), user_email=current_user.email, organization_id=ctx.organization_id)
    await db.commit()
    await db.refresh(loan)
    logger.info("User %s reversed payment on loan %s", current_user.id, loan.id)
    return loan
