#!/usr/bin/env bash
# configure-firewall.sh — Create and activate firewall rules via Hostinger API
#
# Usage:
#   ./scripts/infra/configure-firewall.sh
#
# Required env vars:
#   HOSTINGER_API_TOKEN
#   PROD_VPS_ID, TEST_VPS_ID, DB_VPS_ID
#   PROD_VPS_IP, TEST_VPS_IP

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

HOSTINGER_BASE="https://developers.hostinger.com/api/vps/v1"

# Create a firewall group and return its ID
# Usage: create_firewall <name>
create_firewall() {
    local name="$1"
    log_step "Creating firewall group: $name"

    local response
    response=$(curl -sf \
        -X POST \
        -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$name\"}" \
        "$HOSTINGER_BASE/firewalls") || die "Failed to create firewall group: $name"

    local fw_id
    fw_id=$(echo "$response" | jq -r '.id // empty')
    [[ -n "$fw_id" ]] || die "No firewall ID in response for $name: $response"

    log_info "Created firewall '$name' with ID: $fw_id"
    echo "$fw_id"
}

# Add a rule to a firewall group
# Usage: add_firewall_rule <fw_id> <protocol> <port> <source>
# source: "any" or a CIDR / IP
add_firewall_rule() {
    local fw_id="$1"
    local protocol="$2"
    local port="$3"
    local source="$4"

    local source_json
    if [[ "$source" == "any" ]]; then
        source_json='"0.0.0.0/0"'
    else
        source_json="\"$source\""
    fi

    log_info "  Adding rule: $protocol port $port from $source"

    curl -sf \
        -X POST \
        -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
              \"protocol\": \"$protocol\",
              \"port\": \"$port\",
              \"source\": $source_json,
              \"action\": \"accept\"
            }" \
        "$HOSTINGER_BASE/firewalls/$fw_id/rules" > /dev/null \
        || die "Failed to add rule: $protocol $port from $source to firewall $fw_id"
}

# Activate a firewall on a VPS
# Usage: activate_firewall <fw_id> <vps_id> <label>
activate_firewall() {
    local fw_id="$1"
    local vps_id="$2"
    local label="$3"

    log_step "Activating firewall $fw_id on $label VPS ($vps_id)..."

    curl -sf \
        -X POST \
        -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
        -H "Content-Type: application/json" \
        "$HOSTINGER_BASE/firewalls/$fw_id/activate/$vps_id" > /dev/null \
        || die "Failed to activate firewall $fw_id on VPS $vps_id"

    log_info "Firewall activated on $label VPS."
}

main() {
    require_env HOSTINGER_API_TOKEN PROD_VPS_ID TEST_VPS_ID DB_VPS_ID PROD_VPS_IP TEST_VPS_IP

    log_step "=== DiveStreams Firewall Configuration ==="
    log_info "Prod VPS: $PROD_VPS_ID ($PROD_VPS_IP)"
    log_info "Test VPS: $TEST_VPS_ID ($TEST_VPS_IP)"
    log_info "DB VPS:   $DB_VPS_ID"

    # --- Production firewall ---
    log_step "--- Setting up divestreams-prod firewall ---"
    PROD_FW_ID=$(create_firewall "divestreams-prod")
    add_firewall_rule "$PROD_FW_ID" "TCP" "22"  "any"
    add_firewall_rule "$PROD_FW_ID" "TCP" "80"  "any"
    add_firewall_rule "$PROD_FW_ID" "TCP" "443" "any"
    activate_firewall "$PROD_FW_ID" "$PROD_VPS_ID" "PROD"

    # --- Test firewall ---
    log_step "--- Setting up divestreams-test firewall ---"
    TEST_FW_ID=$(create_firewall "divestreams-test")
    add_firewall_rule "$TEST_FW_ID" "TCP" "22"  "any"
    add_firewall_rule "$TEST_FW_ID" "TCP" "80"  "any"
    add_firewall_rule "$TEST_FW_ID" "TCP" "443" "any"
    activate_firewall "$TEST_FW_ID" "$TEST_VPS_ID" "TEST"

    # --- DB firewall ---
    log_step "--- Setting up divestreams-db firewall ---"
    DB_FW_ID=$(create_firewall "divestreams-db")
    add_firewall_rule "$DB_FW_ID" "TCP" "22"   "any"
    add_firewall_rule "$DB_FW_ID" "TCP" "5432" "$PROD_VPS_IP"
    add_firewall_rule "$DB_FW_ID" "TCP" "5432" "$TEST_VPS_IP"
    activate_firewall "$DB_FW_ID" "$DB_VPS_ID" "DB"

    echo ""
    log_step "=== Firewall Configuration Complete ==="
    log_info "Prod firewall ID: $PROD_FW_ID"
    log_info "Test firewall ID: $TEST_FW_ID"
    log_info "DB firewall ID:   $DB_FW_ID"
    log_warn "DB port 5432 is restricted to: $PROD_VPS_IP and $TEST_VPS_IP"
}

main "$@"
