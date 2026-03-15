#!/usr/bin/env bash
# setup-wal-archiving.sh — Configure PostgreSQL WAL archiving on the DB VPS
#
# This script configures the divestreams-db container for WAL archiving by:
#   1. Creating the local WAL archive directory on the host
#   2. Setting up the cron job to upload WAL files to S3 every 5 minutes
#   3. Running a base backup immediately
#   4. Verifying archiving is active
#
# WAL files are staged to /backups/wal on the DB VPS host, then uploaded to S3
# by upload-wal-to-s3.sh (installed as a cron job). The docker-compose.db.yml
# already passes the required -c flags to enable archiving.
#
# Usage:
#   ./scripts/infra/setup-wal-archiving.sh
#
# Required env vars:
#   DB_VPS_IP            — IP address of the DB VPS (default: 72.62.166.128)
#   SSH_PRIVATE_KEY or SSH_KEY_FILE
#   S3_BUCKET            — S3 bucket name (e.g. divestreams-backups)
#   S3_REGION            — AWS region (e.g. us-east-1)
#   S3_ACCESS_KEY_ID     — AWS access key ID
#   S3_SECRET_ACCESS_KEY — AWS secret access key
#   S3_ENDPOINT          — (optional) Custom S3 endpoint URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

DB_VPS_IP="${DB_VPS_IP:-72.62.166.128}"

main() {
    log_step "=== DiveStreams WAL Archiving Setup ==="
    log_info "Target DB VPS: $DB_VPS_IP"

    require_env S3_BUCKET S3_REGION S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY

    setup_ssh_key

    log_step "Creating WAL archive directory on DB VPS..."
    ssh_exec "$DB_VPS_IP" "mkdir -p /backups/wal && chmod 755 /backups/wal"

    log_step "Copying upload-wal-to-s3.sh and base-backup.sh to DB VPS..."
    scp_to "$SCRIPT_DIR/upload-wal-to-s3.sh" "$DB_VPS_IP" "/usr/local/bin/upload-wal-to-s3.sh"
    scp_to "$SCRIPT_DIR/base-backup.sh"       "$DB_VPS_IP" "/usr/local/bin/base-backup.sh"
    ssh_exec "$DB_VPS_IP" "chmod +x /usr/local/bin/upload-wal-to-s3.sh /usr/local/bin/base-backup.sh"

    log_step "Writing S3 credentials to /etc/wal-archive.env on DB VPS..."
    ssh_exec "$DB_VPS_IP" bash <<REMOTE
cat > /etc/wal-archive.env <<ENV
S3_BUCKET=${S3_BUCKET}
S3_REGION=${S3_REGION}
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
S3_ENDPOINT=${S3_ENDPOINT:-}
POSTGRES_USER=divestreams
ENV
chmod 600 /etc/wal-archive.env
REMOTE

    log_step "Installing cron jobs on DB VPS..."
    ssh_exec "$DB_VPS_IP" bash <<'REMOTE'
# Upload WAL files every 5 minutes
CRON_WAL="*/5 * * * * root /usr/local/bin/upload-wal-to-s3.sh >> /var/log/wal-upload.log 2>&1"
# Weekly base backup on Sundays at 3 AM UTC
CRON_BASE="0 3 * * 0 root /usr/local/bin/base-backup.sh >> /var/log/base-backup.log 2>&1"

echo "$CRON_WAL"  > /etc/cron.d/wal-archive
echo "$CRON_BASE" >> /etc/cron.d/wal-archive
chmod 644 /etc/cron.d/wal-archive

# Ensure cron is running (alpine uses crond, debian/ubuntu uses cron)
if command -v crond >/dev/null 2>&1; then
    crond 2>/dev/null || true
elif command -v cron >/dev/null 2>&1; then
    service cron start 2>/dev/null || true
fi

echo "[setup] Cron jobs installed."
REMOTE

    log_step "Restarting divestreams-db container to apply WAL config flags..."
    log_warn "This will briefly interrupt database connections (~5 seconds)."
    ssh_exec "$DB_VPS_IP" "cd /root && docker compose -f docker-compose.db.yml up -d --force-recreate postgres"

    log_step "Waiting for PostgreSQL to be ready..."
    local retries=0
    until ssh_exec "$DB_VPS_IP" "docker exec divestreams-db pg_isready -U divestreams" > /dev/null 2>&1; do
        retries=$((retries + 1))
        [[ $retries -lt 20 ]] || die "PostgreSQL did not become ready after restart."
        sleep 3
    done
    log_info "PostgreSQL is ready."

    log_step "Verifying WAL archiving is active..."
    ssh_exec "$DB_VPS_IP" bash <<'REMOTE'
OUTPUT=$(docker exec divestreams-db psql -U divestreams -d divestreams -t -c "
    SELECT name, setting
    FROM pg_settings
    WHERE name IN ('wal_level','archive_mode','archive_command','archive_timeout')
    ORDER BY name;
")
echo "$OUTPUT"

ARCHIVE_MODE=$(docker exec divestreams-db psql -U divestreams -d divestreams -t -c \
    "SELECT setting FROM pg_settings WHERE name = 'archive_mode';" | tr -d ' \n')

if [[ "$ARCHIVE_MODE" == "on" ]]; then
    echo "[verify] archive_mode=on confirmed."
else
    echo "[verify] WARNING: archive_mode is '$ARCHIVE_MODE', not 'on'."
    exit 1
fi
REMOTE

    log_step "Running initial base backup..."
    ssh_exec "$DB_VPS_IP" "S3_BUCKET=${S3_BUCKET} S3_REGION=${S3_REGION} S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID} S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY} S3_ENDPOINT=${S3_ENDPOINT:-} /usr/local/bin/base-backup.sh"

    log_info ""
    log_info "WAL archiving setup complete."
    log_info "  WAL files:    uploaded to s3://${S3_BUCKET}/wal/ every 5 minutes"
    log_info "  Base backups: uploaded to s3://${S3_BUCKET}/base/ every Sunday at 03:00 UTC"
    log_info "  Restore:      use scripts/infra/restore-pitr.sh"
}

main "$@"
