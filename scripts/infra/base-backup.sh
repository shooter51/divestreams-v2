#!/usr/bin/env bash
# base-backup.sh — Take a pg_basebackup and upload it to S3
#
# Runs on the DB VPS (installed by setup-wal-archiving.sh).
# Scheduled weekly (Sundays 03:00 UTC) via cron. Also triggered once during
# initial setup and can be run manually at any time.
#
# A base backup is required for PITR: WAL replay must start from a known-good
# base backup that predates the WAL files being replayed.
#
# S3 key pattern: base/<hostname>/<YYYY-MM-DDTHH:MM:SSZ>.tar.gz
#
# Environment (sourced from /etc/wal-archive.env if present):
#   S3_BUCKET            — Target S3 bucket
#   S3_REGION            — AWS region
#   S3_ACCESS_KEY_ID     — AWS access key ID
#   S3_SECRET_ACCESS_KEY — AWS secret access key
#   S3_ENDPOINT          — (optional) Custom S3 endpoint URL
#   POSTGRES_USER        — PostgreSQL superuser (default: divestreams)

set -euo pipefail

# Load credentials from env file if not already in environment
if [[ -f /etc/wal-archive.env && -z "${S3_BUCKET:-}" ]]; then
    # shellcheck disable=SC1091
    source /etc/wal-archive.env
fi

: "${S3_BUCKET:?S3_BUCKET must be set}"
: "${S3_REGION:?S3_REGION must be set}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID must be set}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY must be set}"
POSTGRES_USER="${POSTGRES_USER:-divestreams}"

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"

ENDPOINT_FLAG=""
if [[ -n "${S3_ENDPOINT:-}" ]]; then
    ENDPOINT_FLAG="--endpoint-url $S3_ENDPOINT"
fi

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
HOSTNAME_SHORT="$(hostname -s)"
BACKUP_DIR="/tmp/pgbasebackup-$$"
ARCHIVE_NAME="${TIMESTAMP}.tar.gz"
S3_KEY="base/${HOSTNAME_SHORT}/${ARCHIVE_NAME}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

cleanup() {
    rm -rf "$BACKUP_DIR"
    log "Cleaned up temp dir: $BACKUP_DIR"
}
trap cleanup EXIT

log "=== DiveStreams Base Backup ==="
log "Timestamp: $TIMESTAMP"
log "Destination: s3://${S3_BUCKET}/${S3_KEY}"

mkdir -p "$BACKUP_DIR"

log "Running pg_basebackup inside divestreams-db container..."
# pg_basebackup connects via the Unix socket inside the container.
# -Ft = tar format, -z = gzip, -Xs = include WAL using streaming replication protocol
# This produces base.tar.gz (data directory) and pg_wal.tar.gz (WAL at time of backup)
docker exec divestreams-db pg_basebackup \
    -U "$POSTGRES_USER" \
    -D /tmp/pgbasebackup \
    -Ft \
    -z \
    -Xs \
    -P \
    --no-password \
    2>&1

log "Copying backup files out of container..."
docker cp divestreams-db:/tmp/pgbasebackup "$BACKUP_DIR/data"

log "Cleaning up temp dir inside container..."
docker exec divestreams-db rm -rf /tmp/pgbasebackup

log "Creating combined archive: $ARCHIVE_NAME"
tar -czf "/tmp/${ARCHIVE_NAME}" -C "$BACKUP_DIR" data/

local_size=$(du -sh "/tmp/${ARCHIVE_NAME}" | cut -f1)
log "Archive size: $local_size"

log "Uploading to s3://${S3_BUCKET}/${S3_KEY}..."
aws s3 cp \
    $ENDPOINT_FLAG \
    --no-progress \
    "/tmp/${ARCHIVE_NAME}" \
    "s3://${S3_BUCKET}/${S3_KEY}"

rm -f "/tmp/${ARCHIVE_NAME}"

log "Base backup complete: s3://${S3_BUCKET}/${S3_KEY} ($local_size)"

# Write a manifest so restore-pitr.sh can find the latest base backup easily
MANIFEST_KEY="base/${HOSTNAME_SHORT}/latest"
echo "${S3_KEY}" | aws s3 cp \
    $ENDPOINT_FLAG \
    - \
    "s3://${S3_BUCKET}/${MANIFEST_KEY}"

log "Updated latest manifest: s3://${S3_BUCKET}/${MANIFEST_KEY}"
