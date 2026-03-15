#!/usr/bin/env bash
# upload-wal-to-s3.sh — Upload staged WAL files to S3 and clean up local copies
#
# Runs on the DB VPS via cron every 5 minutes (installed by setup-wal-archiving.sh).
# Scans /backups/wal for WAL segment files, uploads each to S3, and deletes the
# local copy after a successful upload. Files written within the last 30 seconds
# are skipped to avoid uploading partial writes.
#
# The last 24 hours of WAL files are retained locally as a safety buffer so that
# a brief S3 outage does not make recent WAL unreachable. Files older than 24 hours
# are removed after upload.
#
# S3 key pattern: wal/<hostname>/<WAL-filename>
#
# Environment (sourced from /etc/wal-archive.env if present):
#   S3_BUCKET            — Target S3 bucket
#   S3_REGION            — AWS region
#   S3_ACCESS_KEY_ID     — AWS access key ID
#   S3_SECRET_ACCESS_KEY — AWS secret access key
#   S3_ENDPOINT          — (optional) Custom S3 endpoint URL

set -euo pipefail

WAL_DIR="${WAL_DIR:-/backups/wal}"
LOCK_FILE="/tmp/upload-wal-to-s3.lock"
# Retain local copies for 24 hours before deleting after upload
RETENTION_SECONDS=86400
# Skip files touched within the last 30 seconds (may still be written by archive_command)
MIN_AGE_SECONDS=30

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

S3_PREFIX="wal/$(hostname -s)"

# Build optional endpoint flag
ENDPOINT_FLAG=""
if [[ -n "${S3_ENDPOINT:-}" ]]; then
    ENDPOINT_FLAG="--endpoint-url $S3_ENDPOINT"
fi

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# Prevent concurrent runs
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    log "Another upload is already running (lock: $LOCK_FILE). Exiting."
    exit 0
fi

if [[ ! -d "$WAL_DIR" ]]; then
    log "WAL directory does not exist: $WAL_DIR — nothing to upload."
    exit 0
fi

NOW=$(date +%s)
uploaded=0
skipped=0
errors=0

# PostgreSQL WAL segment files are exactly 24 hex characters (e.g. 000000010000000000000001)
# History files end in .history, backup label files end in .backup
for wal_file in "$WAL_DIR"/*; do
    [[ -f "$wal_file" ]] || continue

    filename="$(basename "$wal_file")"

    # Only process WAL segment files, history files, and backup label files
    if [[ ! "$filename" =~ ^[0-9A-F]{24}(\.history|\.backup)?$ ]]; then
        continue
    fi

    # Skip files modified within the last MIN_AGE_SECONDS (may still be written)
    file_mtime=$(stat -c %Y "$wal_file" 2>/dev/null || stat -f %m "$wal_file" 2>/dev/null || echo 0)
    file_age=$(( NOW - file_mtime ))
    if [[ $file_age -lt $MIN_AGE_SECONDS ]]; then
        skipped=$((skipped + 1))
        continue
    fi

    s3_key="${S3_PREFIX}/${filename}"

    if aws s3 cp \
        $ENDPOINT_FLAG \
        --quiet \
        --no-progress \
        "$wal_file" "s3://${S3_BUCKET}/${s3_key}" 2>/dev/null; then

        # Only delete the local copy after the retention window has passed
        if [[ $file_age -gt $RETENTION_SECONDS ]]; then
            rm -f "$wal_file"
            log "Uploaded and removed: $filename (age: ${file_age}s)"
        else
            log "Uploaded (retained locally): $filename (age: ${file_age}s)"
        fi
        uploaded=$((uploaded + 1))
    else
        log "ERROR: Failed to upload $filename to s3://${S3_BUCKET}/${s3_key}"
        errors=$((errors + 1))
    fi
done

log "Done. uploaded=$uploaded skipped=$skipped errors=$errors"

if [[ $errors -gt 0 ]]; then
    exit 1
fi
