#!/usr/bin/env bash
# rebuild.sh — Full rebuild after a nuke: configure, deploy DB, restore, deploy apps
#
# Usage:
#   ./scripts/infra/rebuild.sh
#
# Required env vars: All vars required by the sub-scripts, plus:
#   PROD_VPS_IP, TEST_VPS_IP, DB_VPS_IP
#   HOSTINGER_API_TOKEN, PROD_VPS_ID, TEST_VPS_ID, DB_VPS_ID
#   DB_PASSWORD, REDIS_PASSWORD
#   AUTH_SECRET, BETTER_AUTH_SECRET, ADMIN_PASSWORD
#   PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD
#   SMTP_HOST, SMTP_USER, SMTP_PASS
#   S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, CDN_URL
#   STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_THIN
#   GITHUB_TOKEN
#   SSH_PRIVATE_KEY or SSH_KEY_FILE
#
# Optional:
#   BACKUP_FILE — path to backup SQL to restore (default: latest in scripts/infra/backups/)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

main() {
    require_env PROD_VPS_IP TEST_VPS_IP DB_VPS_IP \
        HOSTINGER_API_TOKEN PROD_VPS_ID TEST_VPS_ID DB_VPS_ID \
        DB_PASSWORD REDIS_PASSWORD \
        AUTH_SECRET BETTER_AUTH_SECRET ADMIN_PASSWORD \
        PLATFORM_ADMIN_EMAIL PLATFORM_ADMIN_PASSWORD \
        SMTP_HOST SMTP_USER SMTP_PASS \
        S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY CDN_URL \
        STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET \
        GITHUB_TOKEN

    setup_ssh_key

    log_step "=== DiveStreams Full Rebuild ==="
    log_info "PROD VPS: $PROD_VPS_IP"
    log_info "TEST VPS: $TEST_VPS_IP"
    log_info "DB VPS:   $DB_VPS_IP"
    echo ""

    # --- Step 1: Configure firewalls ---
    log_step "=== Step 1/6: Configure Firewalls ==="
    "$SCRIPT_DIR/configure-firewall.sh"
    log_info "Firewalls configured."

    # --- Step 2: Deploy PostgreSQL to DB VPS ---
    log_step "=== Step 2/6: Deploy Database ==="
    "$SCRIPT_DIR/deploy-db.sh"
    log_info "Database deployed."

    # --- Step 3: Restore latest backup ---
    log_step "=== Step 3/6: Restore Database ==="

    local backup_file="${BACKUP_FILE:-}"

    if [[ -z "$backup_file" ]]; then
        backup_file=$(ls -t "$SCRIPT_DIR/backups"/prod-*.sql.gz 2>/dev/null | head -1 || echo "")
    fi

    if [[ -n "$backup_file" && -f "$backup_file" ]]; then
        log_info "Restoring from: $backup_file"
        "$SCRIPT_DIR/restore-db.sh" "$backup_file" --database=divestreams
        log_info "Database restored."
    else
        log_warn "No backup file found. Skipping restore."
        log_warn "The app will start with an empty database (migrations will run on first boot)."
        log_warn "To restore later: ./scripts/infra/restore-db.sh <backup-file>"
    fi

    # --- Step 4: Deploy Production app ---
    log_step "=== Step 4/6: Deploy Production App ==="
    "$SCRIPT_DIR/deploy-app.sh" prod
    log_info "Production app deployed."

    # --- Step 5: Deploy Test app ---
    log_step "=== Step 5/6: Deploy Test App ==="
    "$SCRIPT_DIR/deploy-app.sh" test
    log_info "Test app deployed."

    # --- Step 6: Verify all endpoints ---
    log_step "=== Step 6/6: Verify Endpoints ==="

    local all_ok=true

    check_endpoint() {
        local label="$1"
        local url="$2"
        local response

        response=$(curl -sf --max-time 15 "$url" 2>/dev/null || echo "")
        if [[ -n "$response" ]]; then
            log_info "$label: OK ($url)"
        else
            log_warn "$label: No response from $url (TLS may still be provisioning)"
            all_ok=false
        fi
    }

    check_endpoint "Production Health" "https://divestreams.com/api/health"
    check_endpoint "Test Health"       "https://test.divestreams.com/api/health"

    echo ""
    log_step "=== Rebuild Summary ==="
    echo ""
    echo "  PROD VPS:   $PROD_VPS_IP  → https://divestreams.com"
    echo "  TEST VPS:   $TEST_VPS_IP  → https://test.divestreams.com"
    echo "  DB VPS:     $DB_VPS_IP    → postgres:5432"
    echo ""

    if $all_ok; then
        log_info "All endpoints responding. Rebuild complete."
    else
        log_warn "Some endpoints did not respond immediately."
        log_warn "This is normal if Caddy is still provisioning TLS certificates."
        log_warn "Check again in a few minutes:"
        echo "    curl https://divestreams.com/api/health"
        echo "    curl https://test.divestreams.com/api/health"
    fi

    log_step "=== Rebuild Complete ==="
}

main "$@"
