#!/usr/bin/env bash
# nuke.sh — Full teardown: backup, then recreate all 3 VPSs
#
# Usage:
#   ./scripts/infra/nuke.sh [--skip-backup]
#
# Required env vars:
#   HOSTINGER_API_TOKEN
#   PROD_VPS_ID, TEST_VPS_ID, DB_VPS_ID
#   SSH_PRIVATE_KEY or SSH_KEY_FILE (for backup)
#   PROD_VPS_IP (for backup, default: 72.62.166.128)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

SKIP_BACKUP=false

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --skip-backup)
                SKIP_BACKUP=true
                ;;
            *)
                die "Unknown argument: $1. Usage: $0 [--skip-backup]"
                ;;
        esac
        shift
    done
}

print_banner() {
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║            DIVESTREAMS VPS NUKE OPERATION                ║${NC}"
    echo -e "${RED}║                                                          ║${NC}"
    echo -e "${RED}║  This will DESTROY all 3 VPSs and recreate them.        ║${NC}"
    echo -e "${RED}║  ALL DATA ON THE VPSs WILL BE LOST.                     ║${NC}"
    echo -e "${RED}║                                                          ║${NC}"
    echo -e "${RED}║  A backup of the production DB will be taken first       ║${NC}"
    echo -e "${RED}║  (unless --skip-backup is specified).                    ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

main() {
    parse_args "$@"

    require_env HOSTINGER_API_TOKEN PROD_VPS_ID TEST_VPS_ID DB_VPS_ID

    print_banner

    log_warn "VPSs to be destroyed:"
    log_warn "  PROD VPS: $PROD_VPS_ID"
    log_warn "  TEST VPS: $TEST_VPS_ID"
    log_warn "  DB VPS:   $DB_VPS_ID"
    echo ""

    if $SKIP_BACKUP; then
        log_warn "--skip-backup specified: production database will NOT be backed up."
    else
        log_info "A production database backup will be taken before destroying VPSs."
    fi

    echo ""
    log_warn "To proceed, type DESTROY (all caps):"
    read -r confirmation
    [[ "$confirmation" == "DESTROY" ]] || { log_info "Aborted."; exit 0; }

    echo ""
    log_step "=== Step 1: Backup Production Database ==="
    if $SKIP_BACKUP; then
        log_warn "Skipping backup (--skip-backup)."
    else
        setup_ssh_key

        log_step "Running backup-db.sh..."
        "$SCRIPT_DIR/backup-db.sh"

        # Find the backup file that was just created
        local latest_backup
        latest_backup=$(ls -t "$SCRIPT_DIR/backups"/prod-*.sql.gz 2>/dev/null | head -1)

        if [[ -n "$latest_backup" ]]; then
            log_info "Backup saved: $latest_backup"
        else
            die "Backup file not found after backup-db.sh ran. Aborting nuke."
        fi
    fi

    echo ""
    log_step "=== Step 2: Recreate All VPSs ==="
    log_warn "Recreating VPSs — this cannot be undone..."

    # bootstrap-vps.sh has its own confirmation prompt; bypass by passing pre-confirmed flag
    # We'll call the recreate directly to avoid double-prompting
    recreate_all_vps

    echo ""
    log_step "=== Step 3: Print New IPs ==="
    local prod_ip test_ip db_ip
    prod_ip=$(hostinger_get_vps_ip "$PROD_VPS_ID")
    test_ip=$(hostinger_get_vps_ip "$TEST_VPS_ID")
    db_ip=$(hostinger_get_vps_ip "$DB_VPS_ID")

    echo ""
    echo -e "${GREEN}New VPS IP Addresses:${NC}"
    echo "  export PROD_VPS_IP=$prod_ip"
    echo "  export TEST_VPS_IP=$test_ip"
    echo "  export DB_VPS_IP=$db_ip"

    echo ""
    log_step "=== Nuke Complete ==="
    echo ""
    log_warn "Next steps:"
    echo "  1. Update environment variables with new IPs:"
    echo "       export PROD_VPS_IP=$prod_ip"
    echo "       export TEST_VPS_IP=$test_ip"
    echo "       export DB_VPS_IP=$db_ip"
    echo ""
    echo "  2. Run the full rebuild:"
    echo "       ./scripts/infra/rebuild.sh"
    echo ""
    if ! $SKIP_BACKUP; then
        local latest_backup
        latest_backup=$(ls -t "$SCRIPT_DIR/backups"/prod-*.sql.gz 2>/dev/null | head -1 || echo "")
        if [[ -n "$latest_backup" ]]; then
            echo "  3. The backup for restore is at:"
            echo "       $latest_backup"
        fi
    fi
}

# Recreate all VPSs without an extra confirmation prompt
recreate_all_vps() {
    local pids=()

    for vps_info in "PROD:$PROD_VPS_ID" "TEST:$TEST_VPS_ID" "DB:$DB_VPS_ID"; do
        local label="${vps_info%%:*}"
        local vps_id="${vps_info##*:}"

        log_step "Triggering recreate for $label VPS ($vps_id)..."

        curl -sf \
            -X POST \
            -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"template_id": 1121}' \
            "https://developers.hostinger.com/api/vps/v1/virtual-machines/$vps_id/recreate" \
            > /dev/null \
            || die "Failed to trigger recreate for $label VPS $vps_id"

        log_info "$label VPS recreate initiated."
    done

    log_info "All recreate calls sent. Waiting for VPSs to become ready..."

    # Wait for each VPS in parallel
    for vps_info in "PROD:$PROD_VPS_ID" "TEST:$TEST_VPS_ID" "DB:$DB_VPS_ID"; do
        local label="${vps_info%%:*}"
        local vps_id="${vps_info##*:}"

        (
            wait_for_vps_running "$vps_id" 300
            local ip
            ip=$(hostinger_get_vps_ip "$vps_id")
            log_info "[$label] VPS $vps_id is ready. IP: $ip"
        ) &
        pids+=($!)
    done

    local failed=0
    for pid in "${pids[@]}"; do
        wait "$pid" || { log_error "VPS wait failed (pid $pid)"; failed=1; }
    done
    [[ $failed -eq 0 ]] || die "One or more VPSs did not become ready."
}

main "$@"
