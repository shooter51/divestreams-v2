#!/usr/bin/env bash
# restore-pitr.sh — Point-in-time recovery from S3 base backup + WAL files
#
# Restores the PostgreSQL data directory from a base backup stored in S3 and
# replays WAL files up to (but not past) a specified target time. After the
# restore the container is left in normal read-write mode.
#
# IMPORTANT: Run this on the DB VPS as root. It STOPS the divestreams-db
# container, replaces its data directory, and restarts in recovery mode.
# This is a DESTRUCTIVE operation — the current data directory is replaced.
# Take a final pg_dumpall before running if the container is still accessible.
#
# PostgreSQL 16 PITR overview:
#   1. Restore a base backup into the data directory.
#   2. Place a recovery_signal file in the data directory.
#   3. Set restore_command and recovery_target_time in postgresql.auto.conf.
#   4. Start PostgreSQL — it will replay WAL until the target time, then promote.
#
# Usage:
#   ./scripts/infra/restore-pitr.sh [--target-time "2026-03-15 14:30:00 UTC"] \
#                                   [--base-backup-key base/ds-db/2026-03-15T03:00:00Z.tar.gz]
#
# Options:
#   --target-time <timestamp>    Recovery target (ISO 8601 or PostgreSQL timestamp).
#                                Defaults to "latest" (replay all available WAL).
#   --base-backup-key <s3-key>   Specific base backup S3 key to restore from.
#                                Defaults to the latest base backup (reads base/<host>/latest).
#   --database <dbname>          Database to verify after recovery (default: divestreams).
#   --dry-run                    Print what would be done without making changes.
#
# Required env vars (or sourced from /etc/wal-archive.env):
#   S3_BUCKET            — S3 bucket containing base backups and WAL
#   S3_REGION            — AWS region
#   S3_ACCESS_KEY_ID     — AWS access key ID
#   S3_SECRET_ACCESS_KEY — AWS secret access key
#   S3_ENDPOINT          — (optional) Custom S3 endpoint URL

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

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$S3_REGION"

ENDPOINT_FLAG=""
if [[ -n "${S3_ENDPOINT:-}" ]]; then
    ENDPOINT_FLAG="--endpoint-url $S3_ENDPOINT"
fi

TARGET_TIME=""
BASE_BACKUP_KEY=""
TARGET_DB="divestreams"
DRY_RUN=false
HOSTNAME_SHORT="$(hostname -s)"

# -- Argument parsing ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --target-time)
            shift; TARGET_TIME="$1" ;;
        --target-time=*)
            TARGET_TIME="${1#--target-time=}" ;;
        --base-backup-key)
            shift; BASE_BACKUP_KEY="$1" ;;
        --base-backup-key=*)
            BASE_BACKUP_KEY="${1#--base-backup-key=}" ;;
        --database)
            shift; TARGET_DB="$1" ;;
        --database=*)
            TARGET_DB="${1#--database=}" ;;
        --dry-run)
            DRY_RUN=true ;;
        *)
            echo "Unknown argument: $1" >&2
            echo "Usage: $0 [--target-time <ts>] [--base-backup-key <key>] [--database <db>] [--dry-run]" >&2
            exit 1 ;;
    esac
    shift
done
# -----------------------------------------------------------------------------

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[dry-run] $*"
    else
        eval "$*"
    fi
}

log "=== DiveStreams Point-in-Time Recovery ==="
[[ "$DRY_RUN" == "true" ]] && log "DRY RUN — no changes will be made"
log "Target time: ${TARGET_TIME:-latest (all available WAL)}"
log "Target database: $TARGET_DB"

# -- Resolve base backup key --------------------------------------------------
if [[ -z "$BASE_BACKUP_KEY" ]]; then
    log "Resolving latest base backup from s3://${S3_BUCKET}/base/${HOSTNAME_SHORT}/latest ..."
    BASE_BACKUP_KEY=$(aws s3 cp \
        $ENDPOINT_FLAG \
        "s3://${S3_BUCKET}/base/${HOSTNAME_SHORT}/latest" \
        - 2>/dev/null | tr -d '[:space:]')

    if [[ -z "$BASE_BACKUP_KEY" ]]; then
        echo "ERROR: Could not resolve latest base backup. Run base-backup.sh first." >&2
        exit 1
    fi
fi
log "Base backup: s3://${S3_BUCKET}/${BASE_BACKUP_KEY}"

# -- Paths --------------------------------------------------------------------
WORK_DIR="/tmp/pitr-restore-$$"
DATA_RESTORE_DIR="$WORK_DIR/pgdata"
# The Docker volume for postgres data (mounted at /var/lib/postgresql/data in container)
# On the host this is managed by Docker; we replace it via docker cp + volume tricks.
# For a named volume (postgres_data) we must copy files into the container's data dir.

# -- Download and extract base backup -----------------------------------------
log "Downloading base backup..."
run "mkdir -p '$WORK_DIR'"
run "aws s3 cp $ENDPOINT_FLAG 's3://${S3_BUCKET}/${BASE_BACKUP_KEY}' '$WORK_DIR/base.tar.gz'"

log "Extracting base backup..."
run "mkdir -p '$DATA_RESTORE_DIR'"
run "tar -xzf '$WORK_DIR/base.tar.gz' -C '$WORK_DIR'"
# The base backup contains data/base.tar.gz and data/pg_wal.tar.gz (from pg_basebackup -Ft)
run "tar -xzf '$WORK_DIR/data/base.tar.gz' -C '$DATA_RESTORE_DIR'"
if [[ -f "$WORK_DIR/data/pg_wal.tar.gz" ]]; then
    run "mkdir -p '$DATA_RESTORE_DIR/pg_wal'"
    run "tar -xzf '$WORK_DIR/data/pg_wal.tar.gz' -C '$DATA_RESTORE_DIR/pg_wal'"
fi

# -- Create WAL restore directory for replay ----------------------------------
WAL_RESTORE_DIR="/backups/wal-restore"
run "mkdir -p '$WAL_RESTORE_DIR'"

log "Downloading WAL files from s3://${S3_BUCKET}/wal/${HOSTNAME_SHORT}/ to $WAL_RESTORE_DIR ..."
run "aws s3 sync $ENDPOINT_FLAG 's3://${S3_BUCKET}/wal/${HOSTNAME_SHORT}/' '$WAL_RESTORE_DIR/'"

# -- Write recovery configuration into the restored data directory ------------
log "Writing recovery configuration (postgresql.auto.conf + recovery_signal)..."

RESTORE_CMD="cp ${WAL_RESTORE_DIR}/%f %p"
RECOVERY_CONF="restore_command = '${RESTORE_CMD}'\n"

if [[ -n "$TARGET_TIME" ]]; then
    RECOVERY_CONF+="recovery_target_time = '${TARGET_TIME}'\n"
    RECOVERY_CONF+="recovery_target_action = 'promote'\n"
fi

if [[ "$DRY_RUN" == "false" ]]; then
    printf "%b" "$RECOVERY_CONF" >> "$DATA_RESTORE_DIR/postgresql.auto.conf"
    # recovery_signal file triggers PostgreSQL 12+ to enter recovery mode
    touch "$DATA_RESTORE_DIR/recovery_signal"
    log "Created recovery_signal and wrote postgresql.auto.conf."
else
    echo "[dry-run] Would append to postgresql.auto.conf:"
    printf "%b" "$RECOVERY_CONF"
    echo "[dry-run] Would create recovery_signal file."
fi

# -- Stop container, swap data directory, restart -----------------------------
log "Stopping divestreams-db container..."
run "docker stop divestreams-db"

log "Replacing data directory inside container..."
# Copy restored data into the container (overwrites the Docker named volume contents)
# We use a temporary container that mounts the same postgres_data volume.
if [[ "$DRY_RUN" == "false" ]]; then
    # Clear current data directory via a short-lived alpine container
    docker run --rm \
        -v divestreams-db_postgres_data:/pgdata \
        alpine \
        sh -c "rm -rf /pgdata/* /pgdata/.*  2>/dev/null || true"

    # Copy restored data into the volume
    docker run --rm \
        -v divestreams-db_postgres_data:/pgdata \
        -v "$DATA_RESTORE_DIR":/restore:ro \
        alpine \
        sh -c "cp -a /restore/. /pgdata/ && chown -R 999:999 /pgdata"
else
    echo "[dry-run] Would clear postgres_data volume and copy restored data into it."
fi

log "Starting divestreams-db container in recovery mode..."
run "cd /root && docker compose -f docker-compose.db.yml up -d postgres"

log ""
log "Recovery started. PostgreSQL will replay WAL and promote automatically."
log "Monitor progress with:"
log "  docker logs -f divestreams-db"
log ""
log "Once recovery is complete, verify with:"
log "  docker exec divestreams-db psql -U divestreams -d ${TARGET_DB} -c 'SELECT now();'"
log ""
log "Cleaning up work directory..."
run "rm -rf '$WORK_DIR'"

if [[ "$DRY_RUN" == "false" ]]; then
    log "Restore procedure complete. WAL replay is in progress."
    log "Check 'docker logs divestreams-db' for 'database system is ready to accept connections'."
fi
