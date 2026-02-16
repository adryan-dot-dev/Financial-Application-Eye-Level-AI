from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any, Dict, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.db.models.user import User
from app.db.session import async_session
from app.services.automation_service import process_recurring_charges

logger = logging.getLogger(__name__)

# Module-level state for tracking run history
_last_run_time: Optional[datetime] = None
_last_run_result: Optional[Dict[str, Any]] = None
_scheduler: Optional[AsyncIOScheduler] = None


async def _process_all_users_recurring(reference_date: Optional[date] = None) -> Dict[str, Any]:
    """Process recurring charges for all active users.

    This is the job function called by APScheduler daily. It iterates over
    all active users, calling process_recurring_charges for each one.
    If one user fails, it logs the error and continues with the remaining users.

    Args:
        reference_date: The date to process charges for. Defaults to today.

    Returns:
        Summary dict with per-user results and totals.
    """
    global _last_run_time, _last_run_result

    if reference_date is None:
        reference_date = date.today()

    logger.info("Starting recurring charge processing for date %s", reference_date)

    total_loans = 0
    total_fixed = 0
    total_installments = 0
    total_skipped = 0
    users_processed = 0
    users_failed = 0
    errors = []

    async with async_session() as db:
        result = await db.execute(
            select(User.id, User.username).where(User.is_active == True)
        )
        active_users = result.all()

    logger.info("Found %d active users to process", len(active_users))

    for user_id, username in active_users:
        try:
            async with async_session() as db:
                user_result = await process_recurring_charges(
                    db=db,
                    user_id=user_id,
                    reference_date=reference_date,
                    preview=False,
                )

            total_loans += user_result.get("loans_charged", 0)
            total_fixed += user_result.get("fixed_charged", 0)
            total_installments += user_result.get("installments_charged", 0)
            total_skipped += user_result.get("skipped", 0)
            users_processed += 1

            charged = (
                user_result.get("loans_charged", 0)
                + user_result.get("fixed_charged", 0)
                + user_result.get("installments_charged", 0)
            )
            if charged > 0:
                logger.info(
                    "User %s (%s): %d charges created, %d skipped",
                    username,
                    user_id,
                    charged,
                    user_result.get("skipped", 0),
                )

        except Exception:
            users_failed += 1
            error_msg = "Failed to process user %s (%s)" % (username, user_id)
            logger.exception(error_msg)
            errors.append(error_msg)

    summary: Dict[str, Any] = {
        "date": str(reference_date),
        "users_processed": users_processed,
        "users_failed": users_failed,
        "total_loans_charged": total_loans,
        "total_fixed_charged": total_fixed,
        "total_installments_charged": total_installments,
        "total_skipped": total_skipped,
    }

    if errors:
        summary["errors"] = errors

    _last_run_time = datetime.utcnow()
    _last_run_result = summary

    total_charged = total_loans + total_fixed + total_installments
    logger.info(
        "Recurring charge processing complete: %d users processed, "
        "%d failed, %d total charges created, %d skipped",
        users_processed,
        users_failed,
        total_charged,
        total_skipped,
    )

    return summary


def get_scheduler() -> Optional[AsyncIOScheduler]:
    """Return the current scheduler instance."""
    return _scheduler


def get_last_run_info() -> Dict[str, Any]:
    """Return information about the last scheduler run."""
    return {
        "last_run_time": _last_run_time.isoformat() if _last_run_time else None,
        "last_run_result": _last_run_result,
    }


def get_scheduler_status() -> Dict[str, Any]:
    """Return the current scheduler status including next run time."""
    if _scheduler is None:
        return {
            "running": False,
            "next_run_time": None,
            "last_run_time": _last_run_time.isoformat() if _last_run_time else None,
            "last_run_result": _last_run_result,
        }

    running = _scheduler.running
    next_run: Optional[str] = None

    if running:
        jobs = _scheduler.get_jobs()
        if jobs:
            next_run_dt = jobs[0].next_run_time
            if next_run_dt is not None:
                next_run = next_run_dt.isoformat()

    return {
        "running": running,
        "next_run_time": next_run,
        "last_run_time": _last_run_time.isoformat() if _last_run_time else None,
        "last_run_result": _last_run_result,
    }


def start_scheduler() -> AsyncIOScheduler:
    """Create, configure, and start the APScheduler instance.

    The scheduler runs a daily job at 00:05 Israel time (Asia/Jerusalem)
    that processes recurring charges for all active users.

    Returns:
        The started AsyncIOScheduler instance.
    """
    global _scheduler

    _scheduler = AsyncIOScheduler(timezone="Asia/Jerusalem")

    _scheduler.add_job(
        _process_all_users_recurring,
        trigger=CronTrigger(hour=0, minute=5, timezone="Asia/Jerusalem"),
        id="daily_recurring_charges",
        name="Daily Recurring Charge Processing",
        replace_existing=True,
        misfire_grace_time=3600,  # Allow up to 1 hour late execution
    )

    _scheduler.start()
    logger.info("Scheduler started - daily recurring charges at 00:05 Asia/Jerusalem")

    return _scheduler


def stop_scheduler() -> None:
    """Gracefully stop the scheduler if it is running."""
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=True)
        logger.info("Scheduler stopped gracefully")

    _scheduler = None
