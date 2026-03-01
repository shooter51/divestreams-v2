#!/bin/bash
# DiveStreams Database Backup Script
# Usage: ./scripts/backup-db.sh
# Backs up PostgreSQL database and optionally uploads to AWS S3

set -e

# Configuration
BACKUP_DIR="/backups/divestreams"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/divestreams_${TIMESTAMP}.sql.gz"
DOCKER_COMPOSE="docker-compose -f docker-compose.test.yml"
LOG_FILE="/var/log/divestreams-backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
  exit 1
}

warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "${BACKUP_DIR}" || error "Failed to create backup directory"

log "Starting database backup..."
log "Backup file: ${BACKUP_FILE}"

# Perform backup
if ! $DOCKER_COMPOSE exec -T db pg_dump -U divestreams divestreams | gzip > "${BACKUP_FILE}"; then
  error "Database backup failed"
fi

# Check backup file size
if [ ! -f "${BACKUP_FILE}" ]; then
  error "Backup file was not created"
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log "Backup completed successfully (${BACKUP_SIZE})"

# Verify backup integrity
log "Verifying backup integrity..."
if gunzip -t "${BACKUP_FILE}" > /dev/null 2>&1; then
  log "Backup integrity verified"
else
  error "Backup integrity check failed"
fi

# Clean up old local backups (keep last 30 days)
log "Cleaning up old backups (keeping last 30 days)..."
DELETED_COUNT=0
while IFS= read -r old_backup; do
  if [ -f "${old_backup}" ]; then
    rm -f "${old_backup}"
    DELETED_COUNT=$((DELETED_COUNT + 1))
  fi
done < <(find "${BACKUP_DIR}" -name "divestreams_*.sql.gz" -mtime +30 -type f)
log "Deleted ${DELETED_COUNT} old backup(s)"

# Upload to AWS S3 (optional)
if command -v aws &> /dev/null; then
  if [ -n "${AWS_BACKUP_BUCKET}" ]; then
    log "Uploading backup to S3..."
    S3_PATH="s3://${AWS_BACKUP_BUCKET}/staging/${TIMESTAMP}/"

    if aws s3 cp "${BACKUP_FILE}" "${S3_PATH}" \
        --region "${AWS_REGION:-us-east-2}" \
        --storage-class STANDARD \
        >> "$LOG_FILE" 2>&1; then
      log "Backup uploaded to S3: ${S3_PATH}"

      # Optionally archive very old backups to Glacier
      log "Archiving backups older than 90 days to Glacier..."
      aws s3api list-objects-v2 \
        --bucket "${AWS_BACKUP_BUCKET}" \
        --prefix "staging/" \
        --region "${AWS_REGION:-us-east-2}" \
        --query 'Contents[?LastModified<=`2024-10-26`].[Key]' \
        --output text 2>/dev/null | \
        while read -r key; do
          if [ -n "${key}" ]; then
            aws s3api copy-object \
              --bucket "${AWS_BACKUP_BUCKET}" \
              --copy-source "${AWS_BACKUP_BUCKET}/${key}" \
              --key "${key}" \
              --storage-class GLACIER \
              --region "${AWS_REGION:-us-east-2}" \
              >> "$LOG_FILE" 2>&1
          fi
        done
      log "Glacier archival completed"
    else
      warning "Failed to upload to S3 (continuing anyway)"
    fi
  else
    warning "AWS_BACKUP_BUCKET not set, skipping S3 upload"
  fi
else
  warning "AWS CLI not installed, skipping S3 upload"
fi

log "Backup process completed successfully"
log "Backup location: ${BACKUP_FILE}"
