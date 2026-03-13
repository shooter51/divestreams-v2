#!/usr/bin/env bash
# update-vault.sh — Update Vault secrets with new VPS IPs after a rebuild
#
# Usage:
#   ./scripts/infra/update-vault.sh
#
# Required env vars:
#   PROD_VPS_IP, TEST_VPS_IP, DB_VPS_IP
#   VAULT_ADDR  — Vault server address (e.g. https://vault.example.com)
#   VAULT_TOKEN — Vault authentication token

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

main() {
    require_env PROD_VPS_IP TEST_VPS_IP DB_VPS_IP VAULT_ADDR VAULT_TOKEN

    log_step "=== DiveStreams Vault Update ==="
    log_info "Vault:    $VAULT_ADDR"
    log_info "Prod IP:  $PROD_VPS_IP"
    log_info "Test IP:  $TEST_VPS_IP"
    log_info "DB IP:    $DB_VPS_IP"

    # Verify vault CLI is available
    command -v vault > /dev/null || die "vault CLI not found. Install Vault CLI and ensure it is in PATH."

    # Check vault connectivity
    log_step "Checking Vault connectivity..."
    vault status > /dev/null || die "Cannot connect to Vault at $VAULT_ADDR. Check VAULT_ADDR and VAULT_TOKEN."
    log_info "Vault connected."

    # --- Update prod secrets ---
    log_step "Updating secret/divestreams/prod..."

    # Read existing prod secrets to merge (preserve existing values)
    local existing_prod
    existing_prod=$(vault kv get -format=json secret/divestreams/prod 2>/dev/null | \
        jq -r '.data.data // .data // {}' 2>/dev/null || echo '{}')

    # Build updated prod data (preserve existing fields, override IP)
    local prod_data
    prod_data=$(echo "$existing_prod" | jq \
        --arg ip "$PROD_VPS_IP" \
        '. + {"vps_ip": $ip}')

    vault kv put secret/divestreams/prod \
        "$(echo "$prod_data" | jq -r 'to_entries[] | "\(.key)=\(.value)"')" \
        || die "Failed to update secret/divestreams/prod"

    log_info "Updated secret/divestreams/prod with vps_ip=$PROD_VPS_IP"

    # --- Update test secrets ---
    log_step "Updating secret/divestreams/test..."

    local existing_test
    existing_test=$(vault kv get -format=json secret/divestreams/test 2>/dev/null | \
        jq -r '.data.data // .data // {}' 2>/dev/null || echo '{}')

    local test_data
    test_data=$(echo "$existing_test" | jq \
        --arg ip "$TEST_VPS_IP" \
        '. + {"vps_ip": $ip}')

    vault kv put secret/divestreams/test \
        "$(echo "$test_data" | jq -r 'to_entries[] | "\(.key)=\(.value)"')" \
        || die "Failed to update secret/divestreams/test"

    log_info "Updated secret/divestreams/test with vps_ip=$TEST_VPS_IP"

    # --- Update DB secrets ---
    log_step "Updating secret/divestreams/db..."

    local existing_db
    existing_db=$(vault kv get -format=json secret/divestreams/db 2>/dev/null | \
        jq -r '.data.data // .data // {}' 2>/dev/null || echo '{}')

    local db_data
    db_data=$(echo "$existing_db" | jq \
        --arg ip "$DB_VPS_IP" \
        '. + {"vps_ip": $ip, "host": $ip}')

    vault kv put secret/divestreams/db \
        "$(echo "$db_data" | jq -r 'to_entries[] | "\(.key)=\(.value)"')" \
        || die "Failed to update secret/divestreams/db"

    log_info "Updated secret/divestreams/db with vps_ip=$DB_VPS_IP, host=$DB_VPS_IP"

    # --- Update SSH hosts field ---
    log_step "Updating secret/ssh/id-ed25519 hosts field..."

    local existing_ssh
    existing_ssh=$(vault kv get -format=json secret/ssh/id-ed25519 2>/dev/null | \
        jq -r '.data.data // .data // {}' 2>/dev/null || echo '{}')

    # Build comma-separated list of known VPS IPs
    local hosts_value="$PROD_VPS_IP,$TEST_VPS_IP,$DB_VPS_IP"

    local ssh_data
    ssh_data=$(echo "$existing_ssh" | jq \
        --arg hosts "$hosts_value" \
        '. + {"hosts": $hosts}')

    vault kv put secret/ssh/id-ed25519 \
        "$(echo "$ssh_data" | jq -r 'to_entries[] | "\(.key)=\(.value)"')" \
        || die "Failed to update secret/ssh/id-ed25519"

    log_info "Updated secret/ssh/id-ed25519 hosts=$hosts_value"

    echo ""
    log_step "=== Vault Update Complete ==="
    log_info "Verify with:"
    echo "  vault kv get secret/divestreams/prod"
    echo "  vault kv get secret/divestreams/test"
    echo "  vault kv get secret/divestreams/db"
    echo "  vault kv get secret/ssh/id-ed25519"
}

main "$@"
