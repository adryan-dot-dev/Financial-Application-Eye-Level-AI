from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.api.v1.schemas.backup import (
    BackupListResponse,
    BackupResponse,
    BackupScheduleResponse,
)
from app.config import settings
from app.core.exceptions import NotFoundException
from app.db.models import User
from app.db.session import get_db
from app.core.rate_limit import limiter
from app.services import backup_service
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backups", tags=["Backups"])


@router.get("", response_model=BackupListResponse)
async def list_backups(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all backups (admin only), paginated."""
    items = await backup_service.list_backups(db, limit=limit, offset=offset)
    count = await backup_service.get_backup_count(db)
    return BackupListResponse(items=items, count=count)


@router.post("", response_model=BackupResponse, status_code=201)
@limiter.limit("3/hour")
async def trigger_backup(
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a manual database backup (admin only)."""
    backup = await backup_service.create_backup(db, created_by=admin.id)
    await log_action(
        db,
        user_id=admin.id,
        action="backup_create",
        entity_type="backup",
        entity_id=str(backup.id),
        request=request,
        user_email=admin.email,
    )
    await db.commit()
    return backup


@router.get("/schedule", response_model=BackupScheduleResponse)
async def get_backup_schedule(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get backup schedule info and last backup status (admin only)."""
    backups = await backup_service.list_backups(db, limit=1)
    last_backup = backups[0] if backups else None
    total = await backup_service.get_backup_count(db)

    backup_dir = getattr(settings, "BACKUP_DIR", "/backups")
    retention_days = getattr(settings, "BACKUP_RETENTION_DAYS", 30)

    return BackupScheduleResponse(
        backup_dir=backup_dir,
        retention_days=retention_days,
        last_backup=last_backup,
        total_backups=total,
    )


@router.get("/{backup_id}", response_model=BackupResponse)
async def get_backup(
    backup_id: UUID,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a specific backup (admin only)."""
    backup = await backup_service.get_backup(db, backup_id)
    if backup is None:
        raise NotFoundException("Backup")
    return backup


@router.delete("/{backup_id}", status_code=204)
async def delete_backup(
    backup_id: UUID,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a backup file and its record (admin only)."""
    deleted = await backup_service.delete_backup(db, backup_id)
    if not deleted:
        raise NotFoundException("Backup")
    await log_action(
        db,
        user_id=admin.id,
        action="backup_delete",
        entity_type="backup",
        entity_id=str(backup_id),
        request=request,
        user_email=admin.email,
    )
    await db.commit()
    return None


@router.post("/{backup_id}/verify", response_model=BackupResponse)
async def verify_backup(
    backup_id: UUID,
    request: Request,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Verify a backup's integrity by recalculating checksum (admin only)."""
    try:
        backup = await backup_service.verify_backup(db, backup_id)
    except ValueError as exc:
        raise NotFoundException("Backup") from exc
    await log_action(
        db,
        user_id=admin.id,
        action="backup_verify",
        entity_type="backup",
        entity_id=str(backup_id),
        request=request,
        user_email=admin.email,
    )
    await db.commit()
    return backup
