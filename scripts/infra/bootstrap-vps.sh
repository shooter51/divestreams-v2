#!/usr/bin/env bash
# bootstrap-vps.sh — Recreate VPSs from scratch via Hostinger API
#
# Usage:
#   ./scripts/infra/bootstrap-vps.sh [--prod-only|--test-only|--db-only]
#
# Required env vars:
#   HOSTINGER_API_TOKEN — Hostinger API bearer token
#   PROD_VPS_ID         — Hostinger VPS ID for production
#   TEST_VPS_ID         — Hostinger VPS ID for test
#   DB_VPS_ID           — Hostinger VPS ID for database

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

# Ubuntu 24.04 with Docker pre-installed template
TEMPLATE_ID=1121

# Default: recreate all VPSs
RECREATE_PROD=true
RECREATE_TEST=true
RECREATE_DB=true

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --prod-only)
                RECREATE_PROD=true
                RECREATE_TEST=false
                RECREATE_DB=false
                ;;
            --test-only)
                RECREATE_PROD=false
                RECREATE_TEST=true
                RECREATE_DB=false
                ;;
            --db-only)
                RECREATE_PROD=false
                RECREATE_TEST=false
                RECREATE_DB=true
                ;;
            *)
                die "Unknown argument: $1. Use --prod-only, --test-only, or --db-only."
                ;;
        esac
        shift
    done
}

# Trigger VPS recreate via Hostinger API
# Usage: recreate_vps <vps_id> <label>
recreate_vps() {
    local vps_id="$1"
    local label="$2"

    log_step "[$label] Triggering VPS recreate (template: $TEMPLATE_ID)..."

    local response
    response=$(curl -sf \
        -X POST \
        -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"template_id\": $TEMPLATE_ID}" \
        "https://developers.hostinger.com/api/vps/v1/virtual-machines/$vps_id/recreate" \
        2>&1) || {
        log_error "[$label] API call failed for VPS $vps_id"
        log_error "Response: $response"
        return 1
    }

    log_info "[$label] Recreate initiated for VPS $vps_id"
}

# Wait for a VPS and print its new IP
# Usage: await_vps <vps_id> <label>
await_vps() {
    local vps_id="$1"
    local label="$2"

    wait_for_vps_running "$vps_id"

    local new_ip
    new_ip=$(hostinger_get_vps_ip "$vps_id")
    echo ""
    log_info "[$label] VPS $vps_id is ready — New IP: ${GREEN}${new_ip}${NC}"
    echo "  export ${label}_VPS_IP=$new_ip"
}

main() {
    parse_args "$@"

    require_env HOSTINGER_API_TOKEN

    local targets=()
    $RECREATE_PROD && { require_env PROD_VPS_ID; targets+=("prod"); }
    $RECREATE_TEST && { require_env TEST_VPS_ID; targets+=("test"); }
    $RECREATE_DB   && { require_env DB_VPS_ID;   targets+=("db"); }

    if [[ ${#targets[@]} -eq 0 ]]; then
        die "No targets selected."
    fi

    log_step "=== DiveStreams VPS Bootstrap ==="
    log_warn "This will DESTROY and recreate the following VPSs: ${targets[*]}"
    log_warn "All data on these VPSs will be lost. Ensure you have a backup."
    echo ""
    read -rp "Type RECREATE to confirm: " confirmation
    [[ "$confirmation" == "RECREATE" ]] || die "Aborted."

    # Launch recreate calls in parallel
    local pids=()

    if $RECREATE_PROD; then
        log_step "Initiating recreate for PROD VPS ($PROD_VPS_ID)..."
        recreate_vps "$PROD_VPS_ID" "PROD" &
        pids+=($!)
    fi

    if $RECREATE_TEST; then
        log_step "Initiating recreate for TEST VPS ($TEST_VPS_ID)..."
        recreate_vps "$TEST_VPS_ID" "TEST" &
        pids+=($!)
    fi

    if $RECREATE_DB; then
        log_step "Initiating recreate for DB VPS ($DB_VPS_ID)..."
        recreate_vps "$DB_VPS_ID" "DB" &
        pids+=($!)
    fi

    # Wait for all recreate API calls to complete
    local failed=0
    for pid in "${pids[@]}"; do
        wait "$pid" || { log_error "A recreate call failed (pid $pid)"; failed=1; }
    done
    [[ $failed -eq 0 ]] || die "One or more recreate calls failed."

    log_info "All recreate calls accepted. Waiting for VPSs to become ready..."
    echo ""

    # Now wait for each VPS in parallel and collect output
    local wait_pids=()

    if $RECREATE_PROD; then
        await_vps "$PROD_VPS_ID" "PROD" &
        wait_pids+=($!)
    fi

    if $RECREATE_TEST; then
        await_vps "$TEST_VPS_ID" "TEST" &
        wait_pids+=($!)
    fi

    if $RECREATE_DB; then
        await_vps "$DB_VPS_ID" "DB" &
        wait_pids+=($!)
    fi

    failed=0
    for pid in "${wait_pids[@]}"; do
        wait "$pid" || { log_error "A VPS wait failed (pid $pid)"; failed=1; }
    done
    [[ $failed -eq 0 ]] || die "One or more VPSs did not become ready in time."

    echo ""
    log_step "=== Bootstrap Complete ==="
    log_warn "IMPORTANT: Update your env vars with the new IP addresses shown above."
    log_warn "Then run: ./scripts/infra/rebuild.sh"
}

main "$@"
