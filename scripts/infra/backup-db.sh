#!/usr/bin/env bash
# backup-db.sh — Backup production PostgreSQL database to local machine
#
# Usage:
#   ./scripts/infra/backup-db.sh
#
# Env vars:
#   SSH_PRIVATE_KEY or SSH_KEY_FILE — SSH key for VPS access
#   PROD_VPS_IP (optional override, default: 72.62.166.128)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

PROD_VPS_IP="${PROD_VPS_IP:-100.112.155.18}"  # Tailscale IP (SSH locked to Tailscale)
BACKUP_DIR="$SCRIPT_DIR/backups"
DATESTAMP="$(date +%Y-%m-%d)"
REMOTE_DUMP="/tmp/prod-${DATESTAMP}.sql.gz"
LOCAL_DUMP="$BACKUP_DIR/prod-${DATESTAMP}.sql.gz"

# Key tables to report row counts for
KEY_TABLES=(
    "organizations"
    "users"
    "subscriptions"
    "bookings"
    "tours"
    "trips"
    "courses"
)

main() {
    log_step "=== DiveStreams Production Database Backup ==="
    log_info "Source VPS: $PROD_VPS_IP"
    log_info "Destination: $LOCAL_DUMP"

    setup_ssh_key

    # Create local backup directory
    mkdir -p "$BACKUP_DIR"
    log_info "Backup directory: $BACKUP_DIR"

    # Dump database inside the postgres container on the prod VPS
    log_step "Running pg_dump inside postgres container on $PROD_VPS_IP..."
    ssh_exec "$PROD_VPS_IP" \
        "docker exec divestreams-prod-app sh -c 'echo \$DATABASE_URL' | \
         grep -oP '(?<=:)[^:@]+(?=@)' > /tmp/.pg_pass_tmp && \
         docker exec divestreams-prod-app sh -c 'echo \$DATABASE_URL' | \
         grep -oP '\w+(?=:\d+/)' > /tmp/.pg_host_tmp || true"

    # Perform the actual pg_dump via the db container
    # The prod setup uses an external DB VPS, so we exec pg_dump from the app container
    # using the DATABASE_URL env var parsed out to host/user/db/password
    ssh_exec "$PROD_VPS_IP" bash <<'REMOTE'
set -euo pipefail

# Extract connection details from DATABASE_URL in the app container
DB_URL=$(docker exec divestreams-prod-app printenv DATABASE_URL)
# postgresql://user:password@host:port/dbname
DB_USER=$(echo "$DB_URL" | grep -oP '(?<=postgresql://)[^:]+')
DB_PASS=$(echo "$DB_URL" | grep -oP '(?<=://[^:]{1,64}:)[^@]+')
DB_HOST=$(echo "$DB_URL" | grep -oP '(?<=@)[^:/]+')
DB_PORT=$(echo "$DB_URL" | grep -oP '(?<=@[^:]{1,64}:)\d+' || echo "5432")
DB_NAME=$(echo "$DB_URL" | grep -oP '[^/]+$')

echo "[backup] Connecting to $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER"

PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-acl \
    2>/dev/null \
    | gzip > /tmp/prod-backup.sql.gz

echo "[backup] Dump complete. Size: $(du -sh /tmp/prod-backup.sql.gz | cut -f1)"
REMOTE

    # Copy dump to local machine
    log_step "Copying backup from VPS to local..."
    scp_from "$PROD_VPS_IP" "/tmp/prod-backup.sql.gz" "$LOCAL_DUMP"

    # Clean up remote temp file
    ssh_exec "$PROD_VPS_IP" "rm -f /tmp/prod-backup.sql.gz /tmp/.pg_pass_tmp /tmp/.pg_host_tmp"

    # Verify dump is non-empty
    if [[ ! -s "$LOCAL_DUMP" ]]; then
        die "Backup file is empty: $LOCAL_DUMP"
    fi

    local file_size
    file_size=$(du -sh "$LOCAL_DUMP" | cut -f1)
    log_info "Backup file size: $file_size"

    # Print row counts for key tables
    log_step "Verifying backup contents — row counts for key tables..."
    local uncompressed_dump
    uncompressed_dump=$(mktemp /tmp/divestreams-verify-XXXXXX.sql)
    trap 'rm -f "$uncompressed_dump"' EXIT

    gunzip -c "$LOCAL_DUMP" > "$uncompressed_dump"

    for table in "${KEY_TABLES[@]}"; do
        local count
        count=$(grep -c "^INSERT INTO public.${table} " "$uncompressed_dump" 2>/dev/null || \
                grep -c "^COPY public.${table} " "$uncompressed_dump" 2>/dev/null || \
                echo "0")
        printf "  %-30s %s rows (insert/copy statements)\n" "$table" "$count"
    done

    echo ""
    log_info "Backup complete: $LOCAL_DUMP ($file_size)"
    log_info "To restore: ./scripts/infra/restore-db.sh $LOCAL_DUMP"
}

main "$@"
