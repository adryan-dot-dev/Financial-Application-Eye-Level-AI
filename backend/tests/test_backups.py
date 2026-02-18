from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.backup import Backup


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_regular_user_headers(client: AsyncClient) -> dict:
    """Register a non-admin user and return their auth headers."""
    await client.post("/api/v1/auth/register", json={
        "username": "backupuser",
        "email": "backup@test.com",
        "password": "TestPass1",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "username": "backupuser",
        "password": "TestPass1",
    })
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _insert_backup_record(db: AsyncSession, **overrides) -> uuid.UUID:
    """Insert a backup row directly into the database and return its id."""
    backup_id = overrides.pop("id", uuid.uuid4())
    values = {
        "id": backup_id,
        "backup_type": "full",
        "filename": f"cashflow_backup_{backup_id.hex[:8]}.sql.gz",
        "file_path": f"/tmp/backups/cashflow_backup_{backup_id.hex[:8]}.sql.gz",
        "status": "completed",
        "is_verified": False,
    }
    values.update(overrides)
    await db.execute(insert(Backup).values(**values))
    await db.commit()
    return backup_id


# ---------------------------------------------------------------------------
# 1. List backups (empty)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_backups_empty(client: AsyncClient, auth_headers: dict):
    """GET /backups on a fresh database returns an empty items list."""
    resp = await client.get("/api/v1/backups", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["count"] == 0


# ---------------------------------------------------------------------------
# 2. Create backup (mocked pg_dump)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_backup_mocked(client: AsyncClient, auth_headers: dict):
    """POST /backups triggers a backup with mocked subprocess + filesystem."""
    mock_result = MagicMock(returncode=0, stderr=b"", stdout=b"PGDUMP_MOCK_DATA")

    with patch("app.services.backup_service.subprocess") as mock_subprocess, \
         patch("app.services.backup_service.os") as mock_os, \
         patch("app.services.backup_service.gzip") as mock_gzip:
        # subprocess.run returns success
        mock_subprocess.run.return_value = mock_result

        # os helpers
        mock_os.environ.copy.return_value = {}
        mock_os.makedirs.return_value = None
        mock_os.path.join.side_effect = lambda *parts: "/".join(parts)
        mock_os.path.getsize.return_value = 2048
        mock_os.path.exists.return_value = True
        mock_os.remove.return_value = None

        # gzip.open context manager
        gz_cm = MagicMock()
        mock_gzip.open.return_value.__enter__ = MagicMock(return_value=gz_cm)
        mock_gzip.open.return_value.__exit__ = MagicMock(return_value=False)

        # _calculate_sha256 opens a real file -- patch it too
        with patch("app.services.backup_service._calculate_sha256", return_value="abc123def456"):
            resp = await client.post("/api/v1/backups", headers=auth_headers)

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] in ("completed", "failed", "in_progress")
    assert data["backup_type"] == "full"
    assert "id" in data
    assert "filename" in data


# ---------------------------------------------------------------------------
# 3. Backup schedule
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_backup_schedule(client: AsyncClient, auth_headers: dict):
    """GET /backups/schedule returns schedule info with expected keys."""
    resp = await client.get("/api/v1/backups/schedule", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "backup_dir" in data
    assert "retention_days" in data
    assert "total_backups" in data
    # last_backup may be None when there are no backups
    assert "last_backup" in data


# ---------------------------------------------------------------------------
# 4. Backup requires admin (403 for regular user)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_backup_requires_admin(client: AsyncClient):
    """Non-admin users receive 403 on backup endpoints."""
    headers = await _get_regular_user_headers(client)

    resp_list = await client.get("/api/v1/backups", headers=headers)
    assert resp_list.status_code in (401, 403), f"Expected 401/403, got {resp_list.status_code}"

    resp_create = await client.post("/api/v1/backups", headers=headers)
    assert resp_create.status_code in (401, 403), f"Expected 401/403, got {resp_create.status_code}"

    resp_schedule = await client.get("/api/v1/backups/schedule", headers=headers)
    assert resp_schedule.status_code in (401, 403), f"Expected 401/403, got {resp_schedule.status_code}"


# ---------------------------------------------------------------------------
# 5. Get backup not found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_backup_not_found(client: AsyncClient, auth_headers: dict):
    """GET /backups/{random_uuid} returns 404."""
    random_id = uuid.uuid4()
    resp = await client.get(f"/api/v1/backups/{random_id}", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 6. Delete backup not found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_backup_not_found(client: AsyncClient, auth_headers: dict):
    """DELETE /backups/{random_uuid} returns 404."""
    random_id = uuid.uuid4()
    resp = await client.delete(f"/api/v1/backups/{random_id}", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 7. Verify backup not found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_backup_not_found(client: AsyncClient, auth_headers: dict):
    """POST /backups/{random_uuid}/verify returns 404."""
    random_id = uuid.uuid4()
    resp = await client.post(f"/api/v1/backups/{random_id}/verify", headers=auth_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 8. List backups with pagination
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_backups_pagination(client: AsyncClient, auth_headers: dict, db: AsyncSession):
    """Insert 2 backup records, list with limit=1 returns exactly 1 item."""
    await _insert_backup_record(db, filename="backup_one.sql.gz")
    await _insert_backup_record(db, filename="backup_two.sql.gz")

    resp = await client.get("/api/v1/backups?limit=1&offset=0", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["count"] == 2

    # Second page
    resp2 = await client.get("/api/v1/backups?limit=1&offset=1", headers=auth_headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["items"]) == 1
    assert data2["count"] == 2

    # Filenames should differ between pages
    assert data["items"][0]["id"] != data2["items"][0]["id"]
