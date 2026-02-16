#!/usr/bin/env bash
# ============================================
# Database Restore Script (via Docker)
# ============================================
# Usage: ./scripts/restore_db.sh <backup_file.dump>
#        ./scripts/restore_db.sh --dry-run <backup_file.dump>
#        ./scripts/restore_db.sh --list <backup_file.dump>
# ============================================

set -euo pipefail

# Configuration
DB_NAME="${DB_NAME:-cashflow}"
DB_USER="${DB_USER:-cashflow}"
CONTAINER_NAME="${CONTAINER_NAME:-cashflow-db}"

usage() {
    echo "Usage: $0 [OPTIONS] <backup_file.dump>"
    echo ""
    echo "Options:"
    echo "  --dry-run    Show what would be restored without actually restoring"
    echo "  --list       List the contents of the backup file"
    echo "  --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backups/cashflow_20260216_020000.dump"
    echo "  $0 --dry-run backups/cashflow_20260216_020000.dump"
    exit 1
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Parse arguments
DRY_RUN=false
LIST_ONLY=false
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --list)
            LIST_ONLY=true
            shift
            ;;
        --help|-h)
            usage
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Validate backup file
if [[ -z "${BACKUP_FILE}" ]]; then
    echo "ERROR: No backup file specified."
    usage
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Verify container is running
if ! docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    log "ERROR: Container ${CONTAINER_NAME} is not running"
    exit 1
fi

FILESIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
log "Backup file: ${BACKUP_FILE} (${FILESIZE})"

# List mode: show contents and exit
if [[ "${LIST_ONLY}" == "true" ]]; then
    log "Listing contents of backup file..."
    docker exec -i "${CONTAINER_NAME}" pg_restore --list < "${BACKUP_FILE}"
    exit 0
fi

# Dry-run mode: show what would be restored
if [[ "${DRY_RUN}" == "true" ]]; then
    log "=== DRY RUN MODE - No changes will be made ==="
    log "Would restore to: ${DB_NAME} @ container ${CONTAINER_NAME} as ${DB_USER}"
    log ""
    log "Backup contents:"
    docker exec -i "${CONTAINER_NAME}" pg_restore --list < "${BACKUP_FILE}" | head -50
    echo ""
    log "... (use --list to see full contents)"
    log ""
    log "To perform the actual restore, run without --dry-run"
    exit 0
fi

# Actual restore
log "=== Starting database restore ==="
log "Target: ${DB_NAME} @ container ${CONTAINER_NAME} as ${DB_USER}"
log ""

# Confirm with user
echo "WARNING: This will overwrite data in database '${DB_NAME}'."
echo "Make sure you have a recent backup before proceeding."
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [[ "${CONFIRM}" != "yes" ]]; then
    log "Restore cancelled by user."
    exit 0
fi

log "Restoring database..."

if docker exec -i "${CONTAINER_NAME}" pg_restore \
    --clean \
    --if-exists \
    -U "${DB_USER}" \
    -d "${DB_NAME}" < "${BACKUP_FILE}"; then
    
    log "SUCCESS: Database restored from ${BACKUP_FILE}"
else
    EXIT_CODE=$?
    # pg_restore may return non-zero for warnings (e.g., "role already exists")
    if [[ ${EXIT_CODE} -eq 1 ]]; then
        log "WARNING: Restore completed with warnings (exit code 1). This is usually OK."
    else
        log "ERROR: Restore failed with exit code ${EXIT_CODE}"
        exit ${EXIT_CODE}
    fi
fi

log "=== Restore complete ==="
