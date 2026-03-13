#!/usr/bin/env bash
# deploy-db.sh — Deploy PostgreSQL to the DB VPS
#
# Usage:
#   ./scripts/infra/deploy-db.sh
#
# Required env vars:
#   DB_VPS_IP       — IP address of the DB VPS
#   DB_PASSWORD     — PostgreSQL password
#   SSH_PRIVATE_KEY or SSH_KEY_FILE — SSH key for VPS access

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

REMOTE_DIR="/docker/divestreams-db"

main() {
    require_env DB_VPS_IP DB_PASSWORD

    log_step "=== DiveStreams DB VPS Deployment ==="
    log_info "Target VPS: $DB_VPS_IP"
    log_info "Remote dir: $REMOTE_DIR"

    setup_ssh_key

    # Create remote directory structure
    log_step "Creating remote directory $REMOTE_DIR..."
    ssh_exec "$DB_VPS_IP" "mkdir -p $REMOTE_DIR"

    # Copy docker-compose file
    log_step "Copying docker-compose.db.yml..."
    scp_to "$PROJECT_DIR/docker-compose.db.yml" "$DB_VPS_IP" "$REMOTE_DIR/docker-compose.yml"

    # Copy init-db.sh script
    log_step "Copying init-db.sh..."
    ssh_exec "$DB_VPS_IP" "mkdir -p $REMOTE_DIR/scripts/infra"
    scp_to "$SCRIPT_DIR/init-db.sh" "$DB_VPS_IP" "$REMOTE_DIR/scripts/infra/init-db.sh"
    ssh_exec "$DB_VPS_IP" "chmod +x $REMOTE_DIR/scripts/infra/init-db.sh"

    # Write .env file on remote
    log_step "Writing .env file on DB VPS..."
    ssh_exec "$DB_VPS_IP" "cat > $REMOTE_DIR/.env" <<ENV
DB_PASSWORD=${DB_PASSWORD}
ENV

    # Pull image and start containers
    log_step "Pulling images and starting containers..."
    ssh_exec "$DB_VPS_IP" bash <<REMOTE
set -euo pipefail
cd $REMOTE_DIR
docker compose pull
docker compose up -d
REMOTE

    # Wait for postgres to become healthy
    log_step "Waiting for PostgreSQL to become healthy..."
    local elapsed=0
    local max_wait=120

    while [[ $elapsed -lt $max_wait ]]; do
        local health
        health=$(ssh_exec "$DB_VPS_IP" \
            "docker inspect --format='{{.State.Health.Status}}' divestreams-db 2>/dev/null || echo 'missing'")

        if [[ "$health" == "healthy" ]]; then
            log_info "PostgreSQL is healthy."
            break
        fi

        log_info "Container health: $health (waited ${elapsed}s)"
        sleep 10
        elapsed=$((elapsed + 10))
    done

    if [[ $elapsed -ge $max_wait ]]; then
        die "PostgreSQL did not become healthy within ${max_wait}s"
    fi

    # Verify both databases exist
    log_step "Verifying databases exist..."
    local db_list
    db_list=$(ssh_exec "$DB_VPS_IP" \
        "docker exec divestreams-db psql -U divestreams -c '\l' 2>/dev/null")

    echo "$db_list"

    if echo "$db_list" | grep -q "divestreams"; then
        log_info "Database 'divestreams' exists."
    else
        log_warn "Database 'divestreams' not found in listing — check init-db.sh ran correctly."
    fi

    if echo "$db_list" | grep -q "divestreams_test"; then
        log_info "Database 'divestreams_test' exists."
    else
        log_warn "Database 'divestreams_test' not found — init-db.sh may need to run."
    fi

    echo ""
    log_step "=== DB Deployment Complete ==="
    log_info "PostgreSQL is running at $DB_VPS_IP:5432"
    log_warn "Ensure firewall rules restrict port 5432 to Prod and Test VPS IPs only."
}

main "$@"
