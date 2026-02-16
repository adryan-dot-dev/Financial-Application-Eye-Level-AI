from __future__ import annotations

import calendar
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Alert, Installment, Loan, Transaction
from app.services.forecast_service import compute_monthly_forecast

logger = logging.getLogger(__name__)

HEBREW_MONTHS = {
    1: "ינואר", 2: "פברואר", 3: "מרץ", 4: "אפריל",
    5: "מאי", 6: "יוני", 7: "יולי", 8: "אוגוסט",
    9: "ספטמבר", 10: "אוקטובר", 11: "נובמבר", 12: "דצמבר",
}

# All forecast-based alert types (managed by generate_alerts via upsert logic)
FORECAST_ALERT_TYPES = [
    "negative_cashflow",
    "high_expenses",
    "approaching_negative",
]

# All non-forecast alert types (managed by generate_alerts via full refresh)
ENTITY_ALERT_TYPES = [
    "high_single_expense",
    "high_income",
    "payment_overdue",
    "upcoming_payment",
    "loan_ending_soon",
    "installment_ending_soon",
]

ALL_ALERT_TYPES = FORECAST_ALERT_TYPES + ENTITY_ALERT_TYPES


def _hebrew_month(d: date) -> str:
    """Return the Hebrew name of the month for a given date."""
    return HEBREW_MONTHS[d.month]


def _fmt(amount: Decimal) -> str:
    """Format a Decimal amount with thousands separator, no decimals."""
    return f"{amount:,.0f}"


def _safe_day(year: int, month: int, day: int) -> date:
    """Handle day_of_month > days in month (e.g., 31 in April)."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


# ---------------------------------------------------------------------------
# Forecast-based alert builders
# ---------------------------------------------------------------------------

def _build_negative_cashflow_alert(
    month_date: date,
    closing: Decimal,
    income: Decimal,
    expenses: Decimal,
    net: Decimal,
) -> Tuple[str, str, str]:
    """Build title, message, severity for a negative cashflow alert."""
    hm = _hebrew_month(month_date)
    year = month_date.year

    if closing < Decimal("-5000"):
        severity = "critical"
        title = f"\U0001f6a8 יתרה שלילית צפויה - {hm} {year}"
        message = (
            f"\u26a0\ufe0f היתרה הצפויה בסוף {hm} {year} היא {_fmt(closing)} \u20aa (מינוס!).\n\n"
            f"\U0001f4ca פירוט:\n"
            f"\u2022 הכנסות צפויות: {_fmt(income)} \u20aa\n"
            f"\u2022 הוצאות צפויות: {_fmt(expenses)} \u20aa\n"
            f"\u2022 הפרש: {_fmt(net)} \u20aa\n\n"
            f"\U0001f4a1 מומלץ לבדוק הוצאות גדולות או לתכנן הכנסה נוספת."
        )
    else:
        severity = "warning"
        title = f"\u26a0\ufe0f יתרה שלילית קלה צפויה - {hm} {year}"
        message = (
            f"היתרה הצפויה בסוף {hm} {year} היא {_fmt(closing)} \u20aa.\n\n"
            f"\U0001f4ca פירוט:\n"
            f"\u2022 הכנסות צפויות: {_fmt(income)} \u20aa\n"
            f"\u2022 הוצאות צפויות: {_fmt(expenses)} \u20aa\n"
            f"\u2022 הפרש: {_fmt(net)} \u20aa\n\n"
            f"\U0001f4a1 שימו לב - הפער קטן, ייתכן שניתן לסגור אותו."
        )

    return severity, title, message


def _build_high_expenses_alert(
    month_date: date,
    income: Decimal,
    expenses: Decimal,
    net: Decimal,
) -> Tuple[str, str]:
    """Build title and message for a high expenses alert."""
    hm = _hebrew_month(month_date)
    year = month_date.year

    title = f"\U0001f4b8 חודש הוצאות גבוהות - {hm} {year}"
    message = (
        f"\u26a0\ufe0f בחודש {hm} {year} צפויות הוצאות גבוהות מהרגיל.\n\n"
        f"\U0001f4ca פירוט:\n"
        f"\u2022 הכנסות: {_fmt(income)} \u20aa\n"
        f"\u2022 הוצאות: {_fmt(expenses)} \u20aa\n"
        f"\u2022 הפרש נטו: {_fmt(net)} \u20aa\n\n"
        f"\U0001f4a1 כדאי לבחון אילו הוצאות ניתן לדחות או לצמצם."
    )

    return title, message


def _build_approaching_negative_alert(
    month_date: date,
    closing: Decimal,
    income: Decimal,
    expenses: Decimal,
) -> Tuple[str, str]:
    """Build title and message for an approaching-negative alert."""
    hm = _hebrew_month(month_date)
    year = month_date.year

    title = f"\u2139\ufe0f יתרה נמוכה צפויה - {hm} {year}"
    message = (
        f"היתרה הצפויה בסוף {hm} {year} היא {_fmt(closing)} \u20aa בלבד.\n\n"
        f"\U0001f4ca פירוט:\n"
        f"\u2022 הכנסות: {_fmt(income)} \u20aa\n"
        f"\u2022 הוצאות: {_fmt(expenses)} \u20aa\n\n"
        f"\U0001f4a1 מומלץ לעקוב מקרוב ולהיות ערוכים למקרה של הוצאה לא צפויה."
    )

    return title, message


# ---------------------------------------------------------------------------
# Entity-based alert builders
# ---------------------------------------------------------------------------

def _build_high_single_expense_alert(
    tx_description: Optional[str],
    tx_amount: Decimal,
    tx_date: date,
) -> Tuple[str, str]:
    """Build title and message for a high single expense alert."""
    hm = _hebrew_month(tx_date)
    desc = tx_description or "ללא תיאור"

    title = f"\U0001f4b8 הוצאה גדולה - {_fmt(tx_amount)} \u20aa"
    message = (
        f"\u26a0\ufe0f נרשמה הוצאה חד-פעמית גבוהה:\n\n"
        f"\u2022 סכום: {_fmt(tx_amount)} \u20aa\n"
        f"\u2022 תיאור: {desc}\n"
        f"\u2022 תאריך: {tx_date.strftime('%d/%m/%Y')}\n\n"
        f"\U0001f4a1 כדאי לוודא שהוצאה זו מתוכננת ולעדכן את התקציב בהתאם."
    )

    return title, message


def _build_high_income_alert(
    current_month_income: Decimal,
    avg_income: Decimal,
    month_date: date,
) -> Tuple[str, str]:
    """Build title and message for high income alert."""
    hm = _hebrew_month(month_date)
    year = month_date.year

    title = f"\U0001f4b0 הכנסה חריגה לטובה - {hm} {year}"
    message = (
        f"\u2139\ufe0f ההכנסות בחודש {hm} {year} גבוהות מהממוצע.\n\n"
        f"\U0001f4ca פירוט:\n"
        f"\u2022 הכנסות החודש: {_fmt(current_month_income)} \u20aa\n"
        f"\u2022 ממוצע 3 חודשים אחרונים: {_fmt(avg_income)} \u20aa\n\n"
        f"\U0001f4a1 הזדמנות מצוינת לחסוך או להקדים תשלומים."
    )

    return title, message


def _build_payment_overdue_alert(
    entity_name: str,
    entity_type: str,
    payment_date: date,
    amount: Decimal,
) -> Tuple[str, str]:
    """Build title and message for an overdue payment alert."""
    type_label = "הלוואה" if entity_type == "loan" else "תשלום"

    title = f"\U0001f6a8 תשלום באיחור - {entity_name}"
    message = (
        f"\U0001f6a8 {type_label} שהיה אמור להתבצע לא שולם!\n\n"
        f"\U0001f4c5 פירוט:\n"
        f"\u2022 שם: {entity_name}\n"
        f"\u2022 סכום: {_fmt(amount)} \u20aa\n"
        f"\u2022 תאריך יעד: {payment_date.strftime('%d/%m/%Y')}\n\n"
        f"\u26a0\ufe0f יש לטפל בתשלום זה בהקדם האפשרי."
    )

    return title, message


def _build_upcoming_payment_alert(
    entity_name: str,
    entity_type: str,
    payment_date: date,
    amount: Decimal,
) -> Tuple[str, str]:
    """Build title and message for an upcoming payment alert."""
    type_label = "הלוואה" if entity_type == "loan" else "תשלום"

    title = f"\U0001f4c5 תשלום קרוב - {entity_name}"
    message = (
        f"\u2139\ufe0f {type_label} מתקרב לתאריך התשלום.\n\n"
        f"\U0001f4c5 פירוט:\n"
        f"\u2022 שם: {entity_name}\n"
        f"\u2022 סכום: {_fmt(amount)} \u20aa\n"
        f"\u2022 תאריך תשלום: {payment_date.strftime('%d/%m/%Y')}\n\n"
        f"\U0001f4a1 ודאו שיש מספיק יתרה בחשבון."
    )

    return title, message


def _build_loan_ending_soon_alert(
    loan_name: str,
    remaining_payments: int,
    monthly_payment: Decimal,
) -> Tuple[str, str]:
    """Build title and message for loan ending soon alert."""
    title = f"\U0001f3e6 הלוואה מסתיימת בקרוב - {loan_name}"
    message = (
        f"\u2139\ufe0f ההלוואה \"{loan_name}\" מתקרבת לסיום.\n\n"
        f"\U0001f4ca פירוט:\n"
        f"\u2022 תשלומים שנותרו: {remaining_payments}\n"
        f"\u2022 תשלום חודשי: {_fmt(monthly_payment)} \u20aa\n\n"
        f"\U0001f4a1 בקרוב תתפנה תקציב חודשי נוסף!"
    )

    return title, message


def _build_installment_ending_soon_alert(
    inst_name: str,
    remaining_payments: int,
    monthly_amount: Decimal,
) -> Tuple[str, str]:
    """Build title and message for installment ending soon alert."""
    title = f"\U0001f4c5 תשלומים מסתיימים בקרוב - {inst_name}"
    message = (
        f"\u2139\ufe0f פריסת התשלומים \"{inst_name}\" מתקרבת לסיום.\n\n"
        f"\U0001f4ca פירוט:\n"
        f"\u2022 תשלומים שנותרו: {remaining_payments}\n"
        f"\u2022 תשלום חודשי: {_fmt(monthly_amount)} \u20aa\n\n"
        f"\U0001f4a1 בקרוב תתפנה הוצאה חודשית קבועה."
    )

    return title, message


# ---------------------------------------------------------------------------
# Entity-based alert generators
# ---------------------------------------------------------------------------

async def _generate_high_single_expense_alerts(
    db: AsyncSession,
    user_id: UUID,
    existing_map: Dict[str, Alert],
) -> List[Alert]:
    """Generate alerts for single transactions > 5,000 ILS in the current month."""
    today = date.today()
    month_start = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    month_end = date(today.year, today.month, last_day)

    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.amount > Decimal("5000"),
            Transaction.date >= month_start,
            Transaction.date <= month_end,
        )
    )
    transactions = result.scalars().all()

    alerts: List[Alert] = []
    for tx in transactions:
        key = f"high_single_expense:{tx.id}"
        title, message = _build_high_single_expense_alert(
            tx.description, tx.amount, tx.date
        )

        if key in existing_map:
            existing = existing_map[key]
            existing.title = title
            existing.message = message
            existing.severity = "warning"
            alerts.append(existing)
        else:
            alert = Alert(
                user_id=user_id,
                alert_type="high_single_expense",
                severity="warning",
                title=title,
                message=message,
                related_entity_type="transaction",
                related_entity_id=tx.id,
                related_month=month_start,
                is_read=False,
                is_dismissed=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(alert)
            alerts.append(alert)

    return alerts


async def _generate_high_income_alert(
    db: AsyncSession,
    user_id: UUID,
    existing_map: Dict[str, Alert],
) -> List[Alert]:
    """Generate alert if current month income is unusually high vs 3-month average."""
    today = date.today()
    current_month_start = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    current_month_end = date(today.year, today.month, last_day)

    # Calculate income for current month
    result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), Decimal("0"))).where(
            Transaction.user_id == user_id,
            Transaction.type == "income",
            Transaction.date >= current_month_start,
            Transaction.date <= current_month_end,
        )
    )
    current_income = result.scalar() or Decimal("0")

    if current_income <= Decimal("0"):
        return []

    # Calculate average income for the previous 3 months
    three_months_ago_start = current_month_start - relativedelta(months=3)
    prev_month_end = current_month_start - timedelta(days=1)

    result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), Decimal("0"))).where(
            Transaction.user_id == user_id,
            Transaction.type == "income",
            Transaction.date >= three_months_ago_start,
            Transaction.date <= prev_month_end,
        )
    )
    total_prev_income = result.scalar() or Decimal("0")
    avg_income = total_prev_income / Decimal("3")

    # Only alert if average is meaningful (> 0) and current is > 150% of average
    if avg_income <= Decimal("0") or current_income <= avg_income * Decimal("1.5"):
        return []

    key = f"high_income:{current_month_start.isoformat()}"
    title, message = _build_high_income_alert(current_income, avg_income, current_month_start)

    alerts: List[Alert] = []
    if key in existing_map:
        existing = existing_map[key]
        existing.title = title
        existing.message = message
        existing.severity = "info"
        alerts.append(existing)
    else:
        alert = Alert(
            user_id=user_id,
            alert_type="high_income",
            severity="info",
            title=title,
            message=message,
            related_entity_type="income",
            related_month=current_month_start,
            is_read=False,
            is_dismissed=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        alerts.append(alert)

    return alerts


async def _generate_payment_overdue_alerts(
    db: AsyncSession,
    user_id: UUID,
    existing_map: Dict[str, Alert],
) -> List[Alert]:
    """Generate alerts for installment/loan payments that are overdue."""
    today = date.today()
    alerts: List[Alert] = []

    # Check installments for overdue payments
    result = await db.execute(
        select(Installment).where(
            Installment.user_id == user_id,
        )
    )
    installments = result.scalars().all()

    for inst in installments:
        remaining = inst.number_of_payments - inst.payments_completed
        if remaining <= 0:
            continue

        # The next expected payment: payments_completed tells us how many are done.
        # Payment N happens at start_date + (N-1) months.
        next_payment_num = inst.payments_completed + 1
        months_offset = next_payment_num - 1
        expected_month = inst.start_date + relativedelta(months=months_offset)
        expected_date = _safe_day(expected_month.year, expected_month.month, inst.day_of_month)

        if expected_date < today:
            key = f"payment_overdue:installment:{inst.id}"
            title, message = _build_payment_overdue_alert(
                inst.name, "installment", expected_date, inst.monthly_amount
            )

            if key in existing_map:
                existing = existing_map[key]
                existing.title = title
                existing.message = message
                existing.severity = "critical"
                alerts.append(existing)
            else:
                alert = Alert(
                    user_id=user_id,
                    alert_type="payment_overdue",
                    severity="critical",
                    title=title,
                    message=message,
                    related_entity_type="installment",
                    related_entity_id=inst.id,
                    related_month=expected_date.replace(day=1),
                    is_read=False,
                    is_dismissed=False,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(alert)
                alerts.append(alert)

    # Check loans for overdue payments
    result = await db.execute(
        select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == "active",
        )
    )
    loans = result.scalars().all()

    for loan in loans:
        remaining = loan.total_payments - loan.payments_made
        if remaining <= 0:
            continue

        next_payment_num = loan.payments_made + 1
        months_offset = next_payment_num - 1
        expected_month = loan.start_date + relativedelta(months=months_offset)
        expected_date = _safe_day(expected_month.year, expected_month.month, loan.day_of_month)

        if expected_date < today:
            key = f"payment_overdue:loan:{loan.id}"
            title, message = _build_payment_overdue_alert(
                loan.name, "loan", expected_date, loan.monthly_payment
            )

            if key in existing_map:
                existing = existing_map[key]
                existing.title = title
                existing.message = message
                existing.severity = "critical"
                alerts.append(existing)
            else:
                alert = Alert(
                    user_id=user_id,
                    alert_type="payment_overdue",
                    severity="critical",
                    title=title,
                    message=message,
                    related_entity_type="loan",
                    related_entity_id=loan.id,
                    related_month=expected_date.replace(day=1),
                    is_read=False,
                    is_dismissed=False,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(alert)
                alerts.append(alert)

    return alerts


async def _generate_upcoming_payment_alerts(
    db: AsyncSession,
    user_id: UUID,
    existing_map: Dict[str, Alert],
) -> List[Alert]:
    """Generate alerts for payments due within the next 3 days."""
    today = date.today()
    three_days_ahead = today + timedelta(days=3)
    alerts: List[Alert] = []

    # Check installments
    result = await db.execute(
        select(Installment).where(
            Installment.user_id == user_id,
        )
    )
    installments = result.scalars().all()

    for inst in installments:
        remaining = inst.number_of_payments - inst.payments_completed
        if remaining <= 0:
            continue

        next_payment_num = inst.payments_completed + 1
        months_offset = next_payment_num - 1
        expected_month = inst.start_date + relativedelta(months=months_offset)
        expected_date = _safe_day(expected_month.year, expected_month.month, inst.day_of_month)

        if today <= expected_date <= three_days_ahead:
            key = f"upcoming_payment:installment:{inst.id}:{expected_date.isoformat()}"
            title, message = _build_upcoming_payment_alert(
                inst.name, "installment", expected_date, inst.monthly_amount
            )

            if key in existing_map:
                existing = existing_map[key]
                existing.title = title
                existing.message = message
                existing.severity = "info"
                alerts.append(existing)
            else:
                alert = Alert(
                    user_id=user_id,
                    alert_type="upcoming_payment",
                    severity="info",
                    title=title,
                    message=message,
                    related_entity_type="installment",
                    related_entity_id=inst.id,
                    related_month=expected_date.replace(day=1),
                    is_read=False,
                    is_dismissed=False,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(alert)
                alerts.append(alert)

    # Check loans
    result = await db.execute(
        select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == "active",
        )
    )
    loans = result.scalars().all()

    for loan in loans:
        remaining = loan.total_payments - loan.payments_made
        if remaining <= 0:
            continue

        next_payment_num = loan.payments_made + 1
        months_offset = next_payment_num - 1
        expected_month = loan.start_date + relativedelta(months=months_offset)
        expected_date = _safe_day(expected_month.year, expected_month.month, loan.day_of_month)

        if today <= expected_date <= three_days_ahead:
            key = f"upcoming_payment:loan:{loan.id}:{expected_date.isoformat()}"
            title, message = _build_upcoming_payment_alert(
                loan.name, "loan", expected_date, loan.monthly_payment
            )

            if key in existing_map:
                existing = existing_map[key]
                existing.title = title
                existing.message = message
                existing.severity = "info"
                alerts.append(existing)
            else:
                alert = Alert(
                    user_id=user_id,
                    alert_type="upcoming_payment",
                    severity="info",
                    title=title,
                    message=message,
                    related_entity_type="loan",
                    related_entity_id=loan.id,
                    related_month=expected_date.replace(day=1),
                    is_read=False,
                    is_dismissed=False,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(alert)
                alerts.append(alert)

    return alerts


async def _generate_loan_ending_soon_alerts(
    db: AsyncSession,
    user_id: UUID,
    existing_map: Dict[str, Alert],
) -> List[Alert]:
    """Generate alerts for loans with < 3 payments remaining."""
    result = await db.execute(
        select(Loan).where(
            Loan.user_id == user_id,
            Loan.status == "active",
        )
    )
    loans = result.scalars().all()

    alerts: List[Alert] = []
    for loan in loans:
        remaining = loan.total_payments - loan.payments_made
        if 0 < remaining < 3:
            key = f"loan_ending_soon:{loan.id}"
            title, message = _build_loan_ending_soon_alert(
                loan.name, remaining, loan.monthly_payment
            )

            if key in existing_map:
                existing = existing_map[key]
                existing.title = title
                existing.message = message
                existing.severity = "info"
                alerts.append(existing)
            else:
                alert = Alert(
                    user_id=user_id,
                    alert_type="loan_ending_soon",
                    severity="info",
                    title=title,
                    message=message,
                    related_entity_type="loan",
                    related_entity_id=loan.id,
                    is_read=False,
                    is_dismissed=False,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(alert)
                alerts.append(alert)

    return alerts


async def _generate_installment_ending_soon_alerts(
    db: AsyncSession,
    user_id: UUID,
    existing_map: Dict[str, Alert],
) -> List[Alert]:
    """Generate alerts for installments with < 2 payments remaining."""
    result = await db.execute(
        select(Installment).where(
            Installment.user_id == user_id,
        )
    )
    installments = result.scalars().all()

    alerts: List[Alert] = []
    for inst in installments:
        remaining = inst.number_of_payments - inst.payments_completed
        if 0 < remaining < 2:
            key = f"installment_ending_soon:{inst.id}"
            title, message = _build_installment_ending_soon_alert(
                inst.name, remaining, inst.monthly_amount
            )

            if key in existing_map:
                existing = existing_map[key]
                existing.title = title
                existing.message = message
                existing.severity = "info"
                alerts.append(existing)
            else:
                alert = Alert(
                    user_id=user_id,
                    alert_type="installment_ending_soon",
                    severity="info",
                    title=title,
                    message=message,
                    related_entity_type="installment",
                    related_entity_id=inst.id,
                    is_read=False,
                    is_dismissed=False,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(alert)
                alerts.append(alert)

    return alerts


# ---------------------------------------------------------------------------
# Deterministic key helpers for existing alert lookup
# ---------------------------------------------------------------------------

def _entity_alert_key(alert: Alert) -> str:
    """Build a deterministic lookup key for entity-based alerts.

    For entity-based alerts, we encode the alert_type, related_entity_type,
    related_entity_id, and optionally the related_month into a string key
    so we can match existing alerts and preserve is_read state.
    """
    at = alert.alert_type

    if at == "high_single_expense":
        return f"high_single_expense:{alert.related_entity_id}"
    elif at == "high_income":
        month_iso = alert.related_month.isoformat() if alert.related_month else ""
        return f"high_income:{month_iso}"
    elif at == "payment_overdue":
        return f"payment_overdue:{alert.related_entity_type}:{alert.related_entity_id}"
    elif at == "upcoming_payment":
        month_iso = alert.related_month.isoformat() if alert.related_month else ""
        return f"upcoming_payment:{alert.related_entity_type}:{alert.related_entity_id}:{month_iso}"
    elif at == "loan_ending_soon":
        return f"loan_ending_soon:{alert.related_entity_id}"
    elif at == "installment_ending_soon":
        return f"installment_ending_soon:{alert.related_entity_id}"
    else:
        return f"{at}:{alert.related_entity_id}:{alert.related_month}"


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def generate_alerts(
    db: AsyncSession, user_id: UUID, months: int = 6
) -> List[Alert]:
    """Analyze forecast and entity data to generate/update all alert types.

    Uses deterministic keys (alert_type + related context) to match existing
    alerts, preserving is_read/snoozed state instead of deleting and recreating.
    Gracefully degrades if forecast computation fails.
    """

    # ------------------------------------------------------------------
    # 1. Forecast-based alerts (negative_cashflow, high_expenses, approaching_negative)
    # ------------------------------------------------------------------
    try:
        forecast = await compute_monthly_forecast(db, user_id, months)
    except Exception as e:
        logger.error("Failed to compute forecast for user %s: %s", user_id, e)
        forecast = None

    # Fetch existing non-dismissed forecast alerts keyed by (alert_type, related_month)
    existing_result = await db.execute(
        select(Alert).where(
            Alert.user_id == user_id,
            Alert.alert_type.in_(FORECAST_ALERT_TYPES),
            Alert.is_dismissed == False,
        )
    )
    existing_forecast_alerts = existing_result.scalars().all()
    forecast_map: Dict[Tuple[str, date], Alert] = {}
    for alert in existing_forecast_alerts:
        if alert.related_month is not None:
            key = (alert.alert_type, alert.related_month)
            forecast_map[key] = alert

    seen_forecast_keys: set = set()
    result_alerts: List[Alert] = []

    if forecast is not None:
        for month_data in forecast["months"]:
            closing = month_data["closing_balance"]
            month_date = month_data["month"]
            income = month_data["total_income"]
            expenses = month_data["total_expenses"]
            net = month_data["net_change"]

            # --- Negative cashflow alert ---
            if closing < 0:
                severity, title, message = _build_negative_cashflow_alert(
                    month_date, closing, income, expenses, net
                )
                key = ("negative_cashflow", month_date)
                seen_forecast_keys.add(key)

                if key in forecast_map:
                    existing = forecast_map[key]
                    existing.severity = severity
                    existing.title = title
                    existing.message = message
                    result_alerts.append(existing)
                else:
                    alert = Alert(
                        user_id=user_id,
                        alert_type="negative_cashflow",
                        severity=severity,
                        title=title,
                        message=message,
                        related_entity_type="forecast",
                        related_month=month_date,
                        is_read=False,
                        is_dismissed=False,
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(alert)
                    result_alerts.append(alert)

            # --- Approaching negative alert (positive but below 1000) ---
            elif Decimal("0") <= closing < Decimal("1000"):
                title, message = _build_approaching_negative_alert(
                    month_date, closing, income, expenses
                )
                key = ("approaching_negative", month_date)
                seen_forecast_keys.add(key)

                if key in forecast_map:
                    existing = forecast_map[key]
                    existing.severity = "info"
                    existing.title = title
                    existing.message = message
                    result_alerts.append(existing)
                else:
                    alert = Alert(
                        user_id=user_id,
                        alert_type="approaching_negative",
                        severity="info",
                        title=title,
                        message=message,
                        related_entity_type="forecast",
                        related_month=month_date,
                        is_read=False,
                        is_dismissed=False,
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(alert)
                    result_alerts.append(alert)

            # --- High expenses alert ---
            if net < Decimal("-10000"):
                title, message = _build_high_expenses_alert(
                    month_date, income, expenses, net
                )
                key = ("high_expenses", month_date)
                seen_forecast_keys.add(key)

                if key in forecast_map:
                    existing = forecast_map[key]
                    existing.severity = "info"
                    existing.title = title
                    existing.message = message
                    result_alerts.append(existing)
                else:
                    alert = Alert(
                        user_id=user_id,
                        alert_type="high_expenses",
                        severity="info",
                        title=title,
                        message=message,
                        related_entity_type="forecast",
                        related_month=month_date,
                        is_read=False,
                        is_dismissed=False,
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(alert)
                    result_alerts.append(alert)

    # Remove stale forecast alerts
    for key, alert in forecast_map.items():
        if key not in seen_forecast_keys:
            await db.delete(alert)

    # ------------------------------------------------------------------
    # 2. Entity-based alerts (new types)
    # ------------------------------------------------------------------

    # Fetch existing non-dismissed entity alerts
    existing_entity_result = await db.execute(
        select(Alert).where(
            Alert.user_id == user_id,
            Alert.alert_type.in_(ENTITY_ALERT_TYPES),
            Alert.is_dismissed == False,
        )
    )
    existing_entity_alerts = existing_entity_result.scalars().all()
    entity_map: Dict[str, Alert] = {}
    for alert in existing_entity_alerts:
        entity_map[_entity_alert_key(alert)] = alert

    # Track which entity keys are still relevant
    new_entity_alerts: List[Alert] = []

    # Generate all entity-based alerts
    new_entity_alerts.extend(
        await _generate_high_single_expense_alerts(db, user_id, entity_map)
    )
    new_entity_alerts.extend(
        await _generate_high_income_alert(db, user_id, entity_map)
    )
    new_entity_alerts.extend(
        await _generate_payment_overdue_alerts(db, user_id, entity_map)
    )
    new_entity_alerts.extend(
        await _generate_upcoming_payment_alerts(db, user_id, entity_map)
    )
    new_entity_alerts.extend(
        await _generate_loan_ending_soon_alerts(db, user_id, entity_map)
    )
    new_entity_alerts.extend(
        await _generate_installment_ending_soon_alerts(db, user_id, entity_map)
    )

    # Build set of keys that are still relevant
    seen_entity_keys: set = set()
    for alert in new_entity_alerts:
        seen_entity_keys.add(_entity_alert_key(alert))

    # Remove stale entity alerts
    for key, alert in entity_map.items():
        if key not in seen_entity_keys:
            await db.delete(alert)

    result_alerts.extend(new_entity_alerts)

    await db.commit()
    return result_alerts
