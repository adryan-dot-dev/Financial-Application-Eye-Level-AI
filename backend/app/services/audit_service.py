from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.audit_log import AuditLog

logger = logging.getLogger("cashflow.audit")


async def log_action(
    db: AsyncSession,
    *,
    user_id: Optional[UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[str] = None,
    request: Optional[Request] = None,
    user_email: Optional[str] = None,
    organization_id: Optional[UUID] = None,
) -> None:
    """Record an audit log entry.

    This is fire-and-forget — failures are logged but never propagated
    to avoid breaking the primary request flow.
    """
    try:
        ip_address = None
        user_agent = None
        if request is not None:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent", "")[:500]

        entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            user_email=user_email,
            organization_id=organization_id,
        )
        db.add(entry)
        # Don't commit — let the caller's commit include this row
    except Exception:
        logger.exception("Failed to write audit log entry")
