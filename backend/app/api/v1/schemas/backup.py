from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class BackupResponse(BaseModel):
    id: UUID
    backup_type: str
    filename: str
    file_size: Optional[int] = None
    file_path: str
    status: str
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    created_by: Optional[UUID] = None
    verification_checksum: Optional[str] = None
    is_verified: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BackupListResponse(BaseModel):
    items: List[BackupResponse]
    count: int


class BackupScheduleResponse(BaseModel):
    backup_dir: str
    retention_days: int
    last_backup: Optional[BackupResponse] = None
    total_backups: int
