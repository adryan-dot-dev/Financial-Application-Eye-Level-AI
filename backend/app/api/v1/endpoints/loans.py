from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.schemas.loan import (
    AmortizationItem,
    LoanCreate,
    LoanDetailResponse,
    LoanPaymentRecord,
    LoanResponse,
    LoanUpdate,
)
from app.core.exceptions import NotFoundException
from app.db.models import Loan, User
from app.db.session import get_db

router = APIRouter(prefix="/loans", tags=["Loans"])


def _build_amortization(loan: Loan) -> List[AmortizationItem]:
    """Build amortization schedule for a loan."""
    schedule = []
    today = date.today()
    remaining = loan.original_amount
    monthly_rate = (loan.interest_rate / Decimal("100") / Decimal("12")) if loan.interest_rate > 0 else Decimal("0")

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
        principal_portion = loan.monthly_payment - interest_portion

        # Last payment adjustment
        if i == loan.total_payments:
            principal_portion = remaining
            interest_portion = (remaining * monthly_rate).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        remaining = max(Decimal("0"), remaining - principal_portion)

        if i <= loan.payments_made:
            status = "paid"
        elif payment_date <= today:
            status = "upcoming"
        else:
            status = "future"

        schedule.append(AmortizationItem(
            payment_number=i,
            date=payment_date,
            payment_amount=loan.monthly_payment,
            principal=principal_portion,
            interest=interest_portion,
            remaining_balance=remaining,
            status=status,
        ))
    return schedule


@router.get("", response_model=List[LoanResponse])
async def list_loans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan)
        .where(Loan.user_id == current_user.id)
        .order_by(Loan.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=LoanResponse, status_code=201)
async def create_loan(
    data: LoanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    loan = Loan(
        user_id=current_user.id,
        remaining_balance=data.original_amount,
        payments_made=0,
        status="active",
        **data.model_dump(),
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.get("/{loan_id}", response_model=LoanDetailResponse)
async def get_loan(
    loan_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            Loan.user_id == current_user.id,
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
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            Loan.user_id == current_user.id,
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(loan, key, value)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.delete("/{loan_id}")
async def delete_loan(
    loan_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            Loan.user_id == current_user.id,
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")
    await db.delete(loan)
    await db.commit()
    return {"message": "Deleted successfully"}


@router.post("/{loan_id}/payment", response_model=LoanResponse)
async def record_payment(
    loan_id: UUID,
    data: LoanPaymentRecord,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            Loan.user_id == current_user.id,
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")

    loan.payments_made += 1
    loan.remaining_balance = max(
        Decimal("0"), loan.remaining_balance - data.amount
    )
    if loan.payments_made >= loan.total_payments or loan.remaining_balance <= 0:
        loan.status = "completed"
        loan.remaining_balance = Decimal("0")

    await db.commit()
    await db.refresh(loan)
    return loan


@router.get("/{loan_id}/breakdown", response_model=List[AmortizationItem])
async def get_loan_breakdown(
    loan_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            Loan.user_id == current_user.id,
        )
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise NotFoundException("Loan not found")
    return _build_amortization(loan)
