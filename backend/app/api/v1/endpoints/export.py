from __future__ import annotations

import csv
import io
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_admin, get_current_user, get_data_context, DataContext
from app.core.rate_limit import limiter
from app.db.models import (
    BankBalance,
    Category,
    FixedIncomeExpense,
    Installment,
    Loan,
    Settings,
    Transaction,
    User,
)
from app.db.session import get_db

router = APIRouter(prefix="/export", tags=["Export"])

# Characters that can trigger formula injection when a CSV is opened in Excel
_CSV_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _sanitize_csv(value: str) -> str:
    """Prefix dangerous strings with a single quote to prevent CSV formula injection.

    Strings starting with =, +, -, @, tab, or carriage-return can be interpreted
    as formulas by spreadsheet applications such as Microsoft Excel and Google
    Sheets.  Prefixing with a single quote neutralises this.
    """
    if value and value[0] in _CSV_DANGEROUS_PREFIXES:
        return f"'{value}"
    return value


def _decimal_default(obj: object) -> object:
    """JSON serializer for Decimal and date/datetime objects."""
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


# ---------------------------------------------------------------------------
# GET /export/transactions  — CSV or JSON
# ---------------------------------------------------------------------------

@router.get("/transactions")
async def export_transactions(
    format: str = Query("csv", pattern="^(csv|json)$"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    type: Optional[str] = Query(None, pattern="^(income|expense)$"),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Export user transactions as CSV or JSON."""
    query = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(ctx.ownership_filter(Transaction))
        .order_by(Transaction.date.desc())
    )

    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)
    if type:
        query = query.where(Transaction.type == type)

    result = await db.execute(query)
    transactions = result.scalars().all()

    if format == "json":
        data = [
            {
                "date": tx.date.isoformat(),
                "amount": str(tx.amount),
                "type": tx.type,
                "category": tx.category.name if tx.category else None,
                "category_he": tx.category.name_he if tx.category else None,
                "description": tx.description,
                "entry_pattern": tx.entry_pattern,
                "currency": tx.currency,
            }
            for tx in transactions
        ]
        content = json.dumps(data, ensure_ascii=False, indent=2, default=_decimal_default)
        return StreamingResponse(
            iter([content]),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=transactions.json"},
        )

    # CSV format with BOM for Excel Hebrew support
    output = io.StringIO()
    output.write("\ufeff")  # BOM for Excel
    writer = csv.writer(output)
    writer.writerow([_sanitize_csv(h) for h in ["date", "amount", "type", "category", "category_he", "description", "entry_pattern", "currency"]])

    for tx in transactions:
        writer.writerow([
            tx.date.isoformat(),
            str(tx.amount),
            tx.type,
            _sanitize_csv(tx.category.name) if tx.category else "",
            _sanitize_csv(tx.category.name_he) if tx.category else "",
            _sanitize_csv(tx.description or ""),
            tx.entry_pattern,
            tx.currency,
        ])

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


# ---------------------------------------------------------------------------
# GET /export/all  — Full JSON backup
# ---------------------------------------------------------------------------

@router.get("/all")
@limiter.limit("10/hour")
async def export_all_data(
    request: Request,
    limit: int = Query(default=10000, ge=1, le=100000, description="Max rows per entity type to export"),
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    """Export ALL user financial data as JSON (full backup).

    A per-entity ``limit`` cap (default 10 000) prevents memory exhaustion for
    users with very large datasets.  Increase the limit via query parameter if
    you need a larger export.
    """

    # Transactions
    tx_result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(ctx.ownership_filter(Transaction))
        .order_by(Transaction.date.desc())
        .limit(limit)
    )
    transactions = [
        {
            "date": tx.date.isoformat(),
            "amount": str(tx.amount),
            "type": tx.type,
            "category": tx.category.name if tx.category else None,
            "description": tx.description,
            "entry_pattern": tx.entry_pattern,
            "currency": tx.currency,
        }
        for tx in tx_result.scalars().all()
    ]

    # Categories
    cat_result = await db.execute(
        select(Category).where(ctx.ownership_filter(Category)).order_by(Category.display_order).limit(limit)
    )
    categories = [
        {
            "name": c.name,
            "name_he": c.name_he,
            "type": c.type,
            "icon": c.icon,
            "color": c.color,
            "is_archived": c.is_archived,
        }
        for c in cat_result.scalars().all()
    ]

    # Fixed entries
    fixed_result = await db.execute(
        select(FixedIncomeExpense).where(ctx.ownership_filter(FixedIncomeExpense)).limit(limit)
    )
    fixed_items = [
        {
            "name": f.name,
            "amount": str(f.amount),
            "type": f.type,
            "day_of_month": f.day_of_month,
            "start_date": f.start_date.isoformat(),
            "end_date": f.end_date.isoformat() if f.end_date else None,
            "is_active": f.is_active,
            "currency": f.currency,
        }
        for f in fixed_result.scalars().all()
    ]

    # Installments
    inst_result = await db.execute(
        select(Installment).where(ctx.ownership_filter(Installment)).limit(limit)
    )
    installments = [
        {
            "name": i.name,
            "total_amount": str(i.total_amount),
            "monthly_amount": str(i.monthly_amount),
            "type": i.type,
            "number_of_payments": i.number_of_payments,
            "payments_completed": i.payments_completed,
            "start_date": i.start_date.isoformat(),
            "day_of_month": i.day_of_month,
            "currency": i.currency,
        }
        for i in inst_result.scalars().all()
    ]

    # Loans
    loan_result = await db.execute(
        select(Loan).where(ctx.ownership_filter(Loan)).limit(limit)
    )
    loans = [
        {
            "name": l.name,
            "original_amount": str(l.original_amount),
            "monthly_payment": str(l.monthly_payment),
            "interest_rate": str(l.interest_rate),
            "total_payments": l.total_payments,
            "payments_made": l.payments_made,
            "remaining_balance": str(l.remaining_balance),
            "status": l.status,
            "start_date": l.start_date.isoformat(),
            "day_of_month": l.day_of_month,
            "currency": l.currency,
        }
        for l in loan_result.scalars().all()
    ]

    # Balance history
    bal_result = await db.execute(
        select(BankBalance).where(ctx.ownership_filter(BankBalance)).order_by(BankBalance.effective_date.desc()).limit(limit)
    )
    balances = [
        {
            "balance": str(b.balance),
            "effective_date": b.effective_date.isoformat(),
            "is_current": b.is_current,
            "notes": b.notes,
            "currency": b.currency,
        }
        for b in bal_result.scalars().all()
    ]

    # Settings (personal — always by user_id, not org-scoped)
    settings_result = await db.execute(
        select(Settings).where(Settings.user_id == current_user.id).limit(1)
    )
    user_settings = settings_result.scalar_one_or_none()
    settings_data = None
    if user_settings:
        settings_data = {
            "currency": user_settings.currency,
            "language": user_settings.language,
            "theme": user_settings.theme,
            "notifications_enabled": user_settings.notifications_enabled,
        }

    backup = {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
        },
        "settings": settings_data,
        "categories": categories,
        "transactions": transactions,
        "fixed_entries": fixed_items,
        "installments": installments,
        "loans": loans,
        "balance_history": balances,
    }

    content = json.dumps(backup, ensure_ascii=False, indent=2, default=_decimal_default)
    filename = f"cashflow_backup_{date.today().isoformat()}.json"

    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# GET /export/users  — Admin only
# ---------------------------------------------------------------------------

@router.get("/users")
async def export_users(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Export user list as CSV (admin only)."""
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()

    output = io.StringIO()
    output.write("\ufeff")  # BOM for Excel
    writer = csv.writer(output)
    writer.writerow([_sanitize_csv(h) for h in ["username", "email", "full_name", "is_admin", "is_super_admin", "is_active", "created_at", "last_login_at"]])

    for u in users:
        writer.writerow([
            _sanitize_csv(u.username),
            _sanitize_csv(u.email),
            _sanitize_csv(u.full_name or ""),
            str(u.is_admin),
            str(u.is_super_admin),
            str(u.is_active),
            u.created_at.isoformat() if u.created_at else "",
            u.last_login_at.isoformat() if u.last_login_at else "",
        ])

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=users.csv"},
    )
