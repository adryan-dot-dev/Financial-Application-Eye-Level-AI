#!/usr/bin/env bash
# ============================================
# Database Backup Script (via Docker)
# ============================================
# Usage: ./scripts/backup_db.sh
# Cron:  0 2 * * * /path/to/scripts/backup_db.sh >> /path/to/backups/backup.log 2>&1
# ============================================

set -euo pipefail

# Configuration
DB_NAME="${DB_NAME:-cashflow}"
DB_USER="${DB_USER:-cashflow}"
CONTAINER_NAME="${CONTAINER_NAME:-cashflow-db}"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/cashflow_${TIMESTAMP}.dump"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log "=== Starting database backup ==="
log "Database: ${DB_NAME} | Container: ${CONTAINER_NAME} | User: ${DB_USER}"

# Verify container is running
if ! docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    log "ERROR: Container ${CONTAINER_NAME} is not running"
    exit 1
fi

# Run pg_dump inside the container, pipe output to local file
if docker exec "${CONTAINER_NAME}" pg_dump -Fc -U "${DB_USER}" -d "${DB_NAME}" > "${BACKUP_FILE}"; then
    FILESIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
    log "SUCCESS: Backup created at ${BACKUP_FILE} (${FILESIZE})"
else
    log "ERROR: Backup failed with exit code $?"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Delete backups older than retention period
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "cashflow_*.dump" -mtime +${RETENTION_DAYS} -print -delete | wc -l | tr -d ' ')
log "Deleted ${DELETED_COUNT} old backup(s)"

# Show current backup inventory
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "cashflow_*.dump" | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
log "Total backups: ${TOTAL_BACKUPS} | Total size: ${TOTAL_SIZE}"
log "=== Backup complete ==="
