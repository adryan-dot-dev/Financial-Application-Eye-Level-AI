from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Alert
from app.services.forecast_service import compute_monthly_forecast


async def generate_alerts(
    db: AsyncSession, user_id: UUID, months: int = 6
) -> List[Alert]:
    """Analyze forecast and generate alerts for negative cash flow months."""
    forecast = await compute_monthly_forecast(db, user_id, months)
    new_alerts = []

    # Remove old auto-generated forecast alerts for this user
    await db.execute(
        delete(Alert).where(
            Alert.user_id == user_id,
            Alert.alert_type == "negative_cashflow",
            Alert.is_dismissed == False,
        )
    )

    for month_data in forecast["months"]:
        closing = month_data["closing_balance"]

        if closing < 0:
            severity = "critical" if closing < Decimal("-5000") else "warning"
            month_date = month_data["month"]
            alert = Alert(
                user_id=user_id,
                alert_type="negative_cashflow",
                severity=severity,
                title=f"Negative balance expected - {month_date.strftime('%B %Y')}",
                message=(
                    f"Expected closing balance of {closing:,.2f} ILS for "
                    f"{month_date.strftime('%B %Y')}. "
                    f"Total income: {month_data['total_income']:,.2f}, "
                    f"Total expenses: {month_data['total_expenses']:,.2f}."
                ),
                related_entity_type="forecast",
                related_month=month_date,
                is_read=False,
                is_dismissed=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(alert)
            new_alerts.append(alert)

        # Check if net change is very negative (large expense month)
        net = month_data["net_change"]
        if net < Decimal("-10000"):
            month_date = month_data["month"]
            alert = Alert(
                user_id=user_id,
                alert_type="high_expenses",
                severity="info",
                title=f"High expenses month - {month_date.strftime('%B %Y')}",
                message=(
                    f"Net change of {net:,.2f} ILS expected for "
                    f"{month_date.strftime('%B %Y')}. "
                    f"Consider reviewing expenses."
                ),
                related_entity_type="forecast",
                related_month=month_date,
                is_read=False,
                is_dismissed=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(alert)
            new_alerts.append(alert)

    await db.commit()
    return new_alerts
