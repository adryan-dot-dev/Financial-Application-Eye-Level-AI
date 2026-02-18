from __future__ import annotations

import gzip
import hashlib
import logging
import os
import subprocess
import time
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models.backup import Backup

logger = logging.getLogger(__name__)


def _parse_database_url(database_url: str) -> dict:
    """Parse DATABASE_URL into connection components.

    Handles both asyncpg and psycopg2 style URLs.
    Example: postgresql+asyncpg://user:pass@host:5432/dbname
    """
    # Strip the async driver prefix for parsing
    url = database_url.replace("+asyncpg", "").replace("+psycopg2", "")
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "cashflow",
        "password": parsed.password or "",
        "dbname": parsed.path.lstrip("/") if parsed.path else "cashflow",
    }


def _get_backup_dir() -> str:
    """Get the backup directory, creating it if needed.

    Tries BACKUP_DIR from settings first, falls back to /tmp/backups/.
    """
    backup_dir = getattr(settings, "BACKUP_DIR", "/backups")
    try:
        os.makedirs(backup_dir, exist_ok=True)
        # Test write access
        test_file = os.path.join(backup_dir, ".write_test")
        with open(test_file, "w") as f:
            f.write("test")
        os.remove(test_file)
        return backup_dir
    except (OSError, PermissionError):
        fallback = "/tmp/backups"
        os.makedirs(fallback, exist_ok=True)
        logger.warning(
            "Cannot write to %s, falling back to %s", backup_dir, fallback
        )
        return fallback


def _calculate_sha256(file_path: str) -> str:
    """Calculate SHA256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


async def create_backup(
    db: AsyncSession,
    created_by: Optional[UUID] = None,
) -> Backup:
    """Create a full database backup using pg_dump.

    Args:
        db: Database session.
        created_by: UUID of the user who triggered the backup (None for automated).

    Returns:
        The Backup record with status and metadata.
    """
    conn_info = _parse_database_url(settings.DATABASE_URL)
    backup_dir = _get_backup_dir()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"cashflow_backup_{timestamp}.sql.gz"
    file_path = os.path.join(backup_dir, filename)

    # Create backup record
    backup = Backup(
        backup_type="full",
        filename=filename,
        file_path=file_path,
        status="in_progress",
        created_by=created_by,
    )
    db.add(backup)
    await db.commit()
    await db.refresh(backup)

    start_time = time.time()

    try:
        # Run pg_dump and pipe through gzip
        env = os.environ.copy()
        env["PGPASSWORD"] = conn_info["password"]

        pg_dump_cmd = [
            "pg_dump",
            "-h", conn_info["host"],
            "-p", conn_info["port"],
            "-U", conn_info["user"],
            "-d", conn_info["dbname"],
            "--no-owner",
            "--no-acl",
            "-F", "c",  # custom format (compressed)
        ]

        logger.info("Starting pg_dump for backup %s", backup.id)

        result = subprocess.run(
            pg_dump_cmd,
            capture_output=True,
            env=env,
            timeout=300,  # 5 minute timeout
        )

        if result.returncode != 0:
            error_msg = result.stderr.decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"pg_dump failed: {error_msg}")

        # Compress with gzip
        with gzip.open(file_path, "wb", compresslevel=6) as gz_file:
            gz_file.write(result.stdout)

        duration = int(time.time() - start_time)
        file_size = os.path.getsize(file_path)
        checksum = _calculate_sha256(file_path)

        # Update backup record
        backup.status = "completed"
        backup.file_size = file_size
        backup.completed_at = datetime.now(timezone.utc)
        backup.duration_seconds = duration
        backup.verification_checksum = checksum

        await db.commit()
        await db.refresh(backup)
        logger.info(
            "Backup completed: %s (%d bytes, %ds)",
            filename, file_size, duration,
        )

    except Exception as exc:
        duration = int(time.time() - start_time)
        backup.status = "failed"
        backup.error_message = str(exc)[:1000]
        backup.duration_seconds = duration
        backup.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(backup)
        logger.error("Backup failed: %s", exc)

    return backup


async def verify_backup(
    db: AsyncSession,
    backup_id: UUID,
) -> Backup:
    """Verify a backup's integrity by recalculating its SHA256 checksum.

    Args:
        db: Database session.
        backup_id: The backup ID to verify.

    Returns:
        Updated Backup record with verification status.

    Raises:
        ValueError: If backup not found or file missing.
    """
    result = await db.execute(
        select(Backup).where(Backup.id == backup_id)
    )
    backup = result.scalar_one_or_none()

    if backup is None:
        raise ValueError("Backup not found")

    if not os.path.exists(backup.file_path):
        backup.is_verified = False
        backup.error_message = "Backup file not found on disk"
        await db.commit()
        await db.refresh(backup)
        raise ValueError("Backup file not found on disk")

    current_checksum = _calculate_sha256(backup.file_path)

    if backup.verification_checksum and current_checksum == backup.verification_checksum:
        backup.is_verified = True
    else:
        backup.is_verified = False
        backup.error_message = "Checksum mismatch"

    await db.commit()
    await db.refresh(backup)
    return backup


async def list_backups(
    db: AsyncSession,
    limit: int = 30,
    offset: int = 0,
) -> List[Backup]:
    """List recent backups sorted by created_at descending.

    Args:
        db: Database session.
        limit: Maximum number of backups to return.
        offset: Number of records to skip.

    Returns:
        List of Backup records.
    """
    result = await db.execute(
        select(Backup)
        .order_by(Backup.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_backup(
    db: AsyncSession,
    backup_id: UUID,
) -> Optional[Backup]:
    """Get a single backup by ID.

    Args:
        db: Database session.
        backup_id: The backup ID.

    Returns:
        Backup record or None.
    """
    result = await db.execute(
        select(Backup).where(Backup.id == backup_id)
    )
    return result.scalar_one_or_none()


async def delete_backup(
    db: AsyncSession,
    backup_id: UUID,
) -> bool:
    """Delete a backup file from disk and its record from the database.

    Args:
        db: Database session.
        backup_id: The backup ID to delete.

    Returns:
        True if deleted, False if not found.
    """
    result = await db.execute(
        select(Backup).where(Backup.id == backup_id)
    )
    backup = result.scalar_one_or_none()

    if backup is None:
        return False

    # Remove file from disk
    if os.path.exists(backup.file_path):
        try:
            os.remove(backup.file_path)
            logger.info("Deleted backup file: %s", backup.file_path)
        except OSError as exc:
            logger.warning("Could not delete backup file %s: %s", backup.file_path, exc)

    await db.delete(backup)
    await db.commit()
    return True


async def cleanup_old_backups(
    db: AsyncSession,
    days: int = 30,
) -> int:
    """Delete backups older than the specified number of days.

    Args:
        db: Database session.
        days: Number of days to retain backups.

    Returns:
        Number of backups deleted.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # First get the records so we can delete files
    result = await db.execute(
        select(Backup).where(Backup.created_at < cutoff)
    )
    old_backups = result.scalars().all()

    count = 0
    for backup in old_backups:
        if os.path.exists(backup.file_path):
            try:
                os.remove(backup.file_path)
            except OSError as exc:
                logger.warning(
                    "Could not delete old backup file %s: %s",
                    backup.file_path, exc,
                )
        await db.delete(backup)
        count += 1

    if count > 0:
        await db.commit()
        logger.info("Cleaned up %d old backups (older than %d days)", count, days)

    return count


async def get_backup_count(db: AsyncSession) -> int:
    """Get total count of backups.

    Args:
        db: Database session.

    Returns:
        Total number of backup records.
    """
    from sqlalchemy import func as sa_func
    result = await db.execute(
        select(sa_func.count()).select_from(Backup)
    )
    return result.scalar() or 0
