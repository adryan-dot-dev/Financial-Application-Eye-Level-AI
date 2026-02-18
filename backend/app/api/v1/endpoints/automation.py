from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.audit_service import log_action
from app.services.automation_service import process_recurring_charges
from app.services.scheduler import get_scheduler_status

router = APIRouter(prefix="/automation", tags=["Automation"])


@router.post("/process-recurring")
async def process_recurring(
    target_date: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Process all recurring charges (loans, fixed income/expenses, installments).

    Creates transactions for items whose day_of_month matches the target date.
    Idempotent: running twice on the same date will not create duplicate transactions.
    """
    result = await process_recurring_charges(
        db=db,
        user_id=current_user.id,
        reference_date=target_date,
        preview=False,
    )
    await log_action(db, user_id=current_user.id, action="process_recurring", entity_type="automation", details=f"processed recurring charges")
    await db.commit()
    return result


@router.post("/process-recurring/preview")
async def preview_recurring(
    target_date: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview what recurring charges would be created without committing.

    Returns a list of transactions that would be created, along with summary counts.
    """
    result = await process_recurring_charges(
        db=db,
        user_id=current_user.id,
        reference_date=target_date,
        preview=True,
    )
    return result


@router.post("/process")
async def manual_process(
    target_date: Optional[date] = Query(None, alias="date"),
    preview: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger recurring charge processing for the current user.

    Args:
        date: Optional target date (defaults to today).
        preview: If true, returns what would be created without committing.

    Returns:
        Summary of charges processed including counts per category.
    """
    result = await process_recurring_charges(
        db=db,
        user_id=current_user.id,
        reference_date=target_date,
        preview=preview,
    )
    if not preview:
        await log_action(db, user_id=current_user.id, action="process", entity_type="automation", details=f"manual process recurring charges")
        await db.commit()
    return result


@router.post("/sync-now")
async def sync_now(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Immediately process all recurring charges for today.

    Convenience endpoint that triggers processing for the current date,
    ensuring the dashboard reflects the latest recurring entries.
    """
    result = await process_recurring_charges(
        db=db,
        user_id=current_user.id,
        reference_date=date.today(),
        preview=False,
    )
    await log_action(db, user_id=current_user.id, action="sync_now", entity_type="automation", details="sync recurring charges for today")
    await db.commit()
    return result


@router.get("/status")
async def scheduler_status(
    current_user: User = Depends(get_current_user),
):
    """Get the current status of the recurring charge scheduler.

    Returns:
        Scheduler running state, next scheduled run time,
        last run time and result summary.
    """
    return get_scheduler_status()
