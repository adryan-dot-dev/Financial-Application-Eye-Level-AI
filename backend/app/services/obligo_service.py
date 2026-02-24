from __future__ import annotations

from decimal import Decimal
from typing import List

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DataContext
from app.db.models.bank_account import BankAccount
from app.db.models.bank_balance import BankBalance
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

    # Bank overdraft actual usage — check current balances for negative values
    result = await db.execute(
        select(BankBalance.balance, BankBalance.bank_account_id).where(
            ctx.ownership_filter(BankBalance),
            BankBalance.is_current == True,
        )
    )
    balance_rows = result.all()
    total_overdraft_used = Decimal("0")
    for row in balance_rows:
        balance = Decimal(str(row.balance))
        if balance < 0:
            total_overdraft_used += abs(balance)

    total_obligo = total_loan_outstanding + total_card_util + total_overdraft_used
    total_limits = total_card_limits + total_overdraft
    pct = float((total_obligo / total_limits) * 100) if total_limits > 0 else 0.0
    available = total_limits - total_obligo

    return {
        "total_credit_card_limits": total_card_limits,
        "total_credit_utilization": total_card_util,
        "total_loan_outstanding": total_loan_outstanding,
        "total_overdraft_limits": total_overdraft,
        "total_overdraft_used": total_overdraft_used,
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

    # Bank accounts with overdraft — include actual usage from current balances
    result = await db.execute(
        select(BankAccount).where(
            ctx.ownership_filter(BankAccount),
            BankAccount.overdraft_limit > 0,
        )
    )
    overdraft_accounts = result.scalars().all()

    # Fetch current balances for all bank accounts in one query
    acct_ids = [acct.id for acct in overdraft_accounts]
    current_balances: dict = {}
    if acct_ids:
        bal_result = await db.execute(
            select(BankBalance.bank_account_id, BankBalance.balance).where(
                BankBalance.bank_account_id.in_(acct_ids),
                BankBalance.is_current == True,
            )
        )
        for row in bal_result.all():
            current_balances[row.bank_account_id] = Decimal(str(row.balance))

    for acct in overdraft_accounts:
        limit = Decimal(str(acct.overdraft_limit))
        balance = current_balances.get(acct.id, Decimal("0"))
        overdraft_used = abs(balance) if balance < 0 else Decimal("0")
        items.append({
            "type": "overdraft",
            "name": acct.name,
            "limit": limit,
            "utilized": overdraft_used,
            "available": limit - overdraft_used,
        })

    return items
