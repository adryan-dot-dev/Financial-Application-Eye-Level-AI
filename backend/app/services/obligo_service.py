from __future__ import annotations

from decimal import Decimal
from typing import List

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DataContext
from app.db.models.bank_account import BankAccount
from app.db.models.credit_card import CreditCard
from app.db.models.loan import Loan
from app.services.credit_card_service import compute_card_utilization


async def compute_obligo_summary(
    db: AsyncSession, ctx: DataContext
) -> dict:
    """Compute full obligo summary across all credit obligations."""
    # Credit cards
    result = await db.execute(
        select(CreditCard).where(
            ctx.ownership_filter(CreditCard),
            CreditCard.is_active == True,
        )
    )
    cards = result.scalars().all()

    total_card_limits = Decimal("0")
    total_card_util = Decimal("0")
    for card in cards:
        util = await compute_card_utilization(db, card, ctx)
        total_card_limits += Decimal(str(card.credit_limit))
        total_card_util += util["utilization_amount"]

    # Active loans
    result = await db.execute(
        select(func.coalesce(func.sum(Loan.remaining_balance), 0)).where(
            ctx.ownership_filter(Loan),
            Loan.status == "active",
        )
    )
    total_loan_outstanding = Decimal(str(result.scalar()))

    # Bank overdraft limits
    result = await db.execute(
        select(func.coalesce(func.sum(BankAccount.overdraft_limit), 0)).where(
            ctx.ownership_filter(BankAccount),
        )
    )
    total_overdraft = Decimal(str(result.scalar()))

    total_obligo = total_loan_outstanding + total_card_util
    total_limits = total_card_limits + total_overdraft
    pct = float((total_obligo / total_limits) * 100) if total_limits > 0 else 0.0
    available = total_limits - total_obligo

    return {
        "total_credit_card_limits": total_card_limits,
        "total_credit_utilization": total_card_util,
        "total_loan_outstanding": total_loan_outstanding,
        "total_overdraft_limits": total_overdraft,
        "total_obligo": total_obligo,
        "total_available_credit": available,
        "obligo_utilization_pct": round(pct, 2),
    }


async def compute_obligo_details(
    db: AsyncSession, ctx: DataContext
) -> List[dict]:
    """Return individual obligo items."""
    items = []

    # Credit cards
    result = await db.execute(
        select(CreditCard).where(
            ctx.ownership_filter(CreditCard),
            CreditCard.is_active == True,
        )
    )
    for card in result.scalars().all():
        util = await compute_card_utilization(db, card, ctx)
        limit = Decimal(str(card.credit_limit))
        utilized = util["utilization_amount"]
        items.append({
            "type": "credit_card",
            "name": card.name,
            "limit": limit,
            "utilized": utilized,
            "available": limit - utilized,
        })

    # Active loans
    result = await db.execute(
        select(Loan).where(
            ctx.ownership_filter(Loan),
            Loan.status == "active",
        )
    )
    for loan in result.scalars().all():
        items.append({
            "type": "loan",
            "name": loan.name,
            "limit": Decimal(str(loan.original_amount)),
            "utilized": Decimal(str(loan.remaining_balance)),
            "available": Decimal(str(loan.original_amount)) - Decimal(str(loan.remaining_balance)),
        })

    # Bank accounts with overdraft
    result = await db.execute(
        select(BankAccount).where(
            ctx.ownership_filter(BankAccount),
            BankAccount.overdraft_limit > 0,
        )
    )
    for acct in result.scalars().all():
        limit = Decimal(str(acct.overdraft_limit))
        items.append({
            "type": "overdraft",
            "name": acct.name,
            "limit": limit,
            "utilized": Decimal("0"),  # We don't track overdraft usage directly
            "available": limit,
        })

    return items
