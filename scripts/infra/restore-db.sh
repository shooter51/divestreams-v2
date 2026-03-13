#!/usr/bin/env bash
# restore-db.sh — Restore a database backup to the DB VPS
#
# Usage:
#   ./scripts/infra/restore-db.sh <backup-file> [--database=divestreams]
#
# Required env vars:
#   DB_VPS_IP       — IP address of the DB VPS
#   DB_PASSWORD     — PostgreSQL password
#   SSH_PRIVATE_KEY or SSH_KEY_FILE

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

usage() {
    echo "Usage: $0 <backup-file> [--database=<dbname>]"
    echo "  backup-file: path to .sql or .sql.gz backup file"
    echo "  --database:  target database name (default: divestreams)"
    exit 1
}

main() {
    [[ $# -ge 1 ]] || usage

    local backup_file="$1"
    local target_db="divestreams"

    # Parse optional --database flag
    shift
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --database=*)
                target_db="${1#--database=}"
                ;;
            --database)
                shift
                target_db="$1"
                ;;
            *)
                log_error "Unknown argument: $1"
                usage
                ;;
        esac
        shift
    done

    require_env DB_VPS_IP DB_PASSWORD

    [[ -f "$backup_file" ]] || die "Backup file not found: $backup_file"

    local file_size
    file_size=$(du -sh "$backup_file" | cut -f1)
    log_step "=== DiveStreams Database Restore ==="
    log_info "Backup file: $backup_file ($file_size)"
    log_info "Target DB:   $target_db on $DB_VPS_IP"

    setup_ssh_key

    # Determine if file is compressed
    local remote_file="/tmp/divestreams-restore.sql"
    local is_compressed=false

    if [[ "$backup_file" == *.gz ]]; then
        is_compressed=true
        remote_file="/tmp/divestreams-restore.sql.gz"
    fi

    # Copy backup file to DB VPS
    log_step "Uploading backup file to DB VPS..."
    scp_to "$backup_file" "$DB_VPS_IP" "$remote_file"

    # Restore on the DB VPS
    log_step "Restoring database '$target_db'..."
    ssh_exec "$DB_VPS_IP" bash <<REMOTE
set -euo pipefail

REMOTE_FILE="$remote_file"
TARGET_DB="$target_db"
IS_COMPRESSED="$is_compressed"

# Decompress if needed
if [[ "\$IS_COMPRESSED" == "true" ]]; then
    echo "[restore] Decompressing backup..."
    gunzip -f "\$REMOTE_FILE"
    REMOTE_FILE="\${REMOTE_FILE%.gz}"
fi

# Terminate existing connections to the target database
echo "[restore] Terminating existing connections to \$TARGET_DB..."
docker exec divestreams-db psql -U divestreams -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '\$TARGET_DB' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

# Drop and recreate the database
echo "[restore] Dropping and recreating database \$TARGET_DB..."
docker exec divestreams-db psql -U divestreams -d postgres -c "DROP DATABASE IF EXISTS \$TARGET_DB;"
docker exec divestreams-db psql -U divestreams -d postgres -c "CREATE DATABASE \$TARGET_DB OWNER divestreams;"

# Copy SQL file into the container and restore
echo "[restore] Copying SQL file into container..."
docker cp "\$REMOTE_FILE" divestreams-db:/tmp/restore.sql

echo "[restore] Running psql restore..."
docker exec divestreams-db psql -U divestreams -d "\$TARGET_DB" -f /tmp/restore.sql \
    2>&1 | tail -20

# Clean up temp files
rm -f "\$REMOTE_FILE"
docker exec divestreams-db rm -f /tmp/restore.sql

echo "[restore] Restore complete."
REMOTE

    # Verify restore by checking table counts
    log_step "Verifying restore — checking table counts..."
    local tables_output
    tables_output=$(ssh_exec "$DB_VPS_IP" \
        "docker exec divestreams-db psql -U divestreams -d '$target_db' -c \
         \"SELECT tablename, n_live_tup AS approx_rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 15;\" \
         2>/dev/null")

    echo "$tables_output"

    # Check that the DB has tables
    local table_count
    table_count=$(ssh_exec "$DB_VPS_IP" \
        "docker exec divestreams-db psql -U divestreams -d '$target_db' -t -c \
         \"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\" \
         2>/dev/null | tr -d ' '")

    if [[ "${table_count:-0}" -gt 0 ]]; then
        log_info "Restore verified: $table_count tables found in '$target_db'."
    else
        log_warn "No tables found in '$target_db' after restore — verify backup was valid."
    fi

    echo ""
    log_step "=== Restore Complete ==="
    log_info "Database '$target_db' restored from $backup_file"
}

main "$@"
