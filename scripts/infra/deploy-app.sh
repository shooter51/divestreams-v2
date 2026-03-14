#!/usr/bin/env bash
# deploy-app.sh — Deploy app stack to Test or Prod VPS
#
# Usage:
#   ./scripts/infra/deploy-app.sh <environment>
#   environment: test | prod
#
# Required env vars (all environments):
#   SSH_PRIVATE_KEY or SSH_KEY_FILE
#   GITHUB_TOKEN          — for GHCR login
#   DB_HOST               — hostname/IP of the DB VPS
#   DB_PASSWORD
#   REDIS_PASSWORD
#   AUTH_SECRET
#   BETTER_AUTH_SECRET
#   ADMIN_PASSWORD
#   PLATFORM_ADMIN_EMAIL
#   PLATFORM_ADMIN_PASSWORD
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
#   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
#   CDN_URL
<<<<<<< HEAD
#   GRAFANA_MIMIR_URL, GRAFANA_MIMIR_USERNAME, GRAFANA_MIMIR_API_KEY
#   GRAFANA_TEMPO_URL, GRAFANA_TEMPO_USERNAME, GRAFANA_TEMPO_API_KEY
=======
>>>>>>> worktree-agent-afd855f5
#
# Prod-specific:
#   PROD_VPS_IP
#   STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_THIN
#
# Test-specific:
#   TEST_VPS_IP
#   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

usage() {
    echo "Usage: $0 <environment>"
    echo "  environment: test | prod"
    exit 1
}

# Wait until all core containers report healthy or running
# Usage: wait_containers_healthy <vps_ip> <compose_dir> <timeout>
wait_containers_healthy() {
    local vps_ip="$1"
    local compose_dir="$2"
    local max_wait="${3:-300}"
    local elapsed=0
    local interval=15

    log_step "Waiting for containers to become healthy (max ${max_wait}s)..."

    while [[ $elapsed -lt $max_wait ]]; do
        local status
        status=$(ssh_exec "$vps_ip" "cd $compose_dir && docker compose ps --format json 2>/dev/null || echo '[]'")

        # Check if any container is still starting or unhealthy
        local unhealthy
        unhealthy=$(echo "$status" | jq -r '.[] | select(.Health == "unhealthy" or .Health == "starting") | .Name' 2>/dev/null || true)

        local not_running
        not_running=$(echo "$status" | jq -r '.[] | select(.State != "running") | .Name' 2>/dev/null || true)

        if [[ -z "$unhealthy" && -z "$not_running" ]]; then
            log_info "All containers are healthy and running."
            return 0
        fi

        if [[ -n "$unhealthy" ]]; then
            log_info "Unhealthy/starting containers: $unhealthy (waited ${elapsed}s)"
        fi
        if [[ -n "$not_running" ]]; then
            log_info "Not-running containers: $not_running (waited ${elapsed}s)"
        fi

        sleep $interval
        elapsed=$((elapsed + interval))
    done

    log_warn "Containers did not all become healthy within ${max_wait}s. Showing current state:"
    ssh_exec "$vps_ip" "cd $compose_dir && docker compose ps"
    die "Container health check timed out."
}

main() {
    [[ $# -eq 1 ]] || usage
    local env="$1"

    case "$env" in
        prod)
            require_env PROD_VPS_IP GITHUB_TOKEN DB_HOST DB_PASSWORD REDIS_PASSWORD \
                AUTH_SECRET BETTER_AUTH_SECRET ADMIN_PASSWORD \
                PLATFORM_ADMIN_EMAIL PLATFORM_ADMIN_PASSWORD \
                SMTP_HOST SMTP_USER SMTP_PASS \
                S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY CDN_URL \
<<<<<<< HEAD
                STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET STRIPE_WEBHOOK_SECRET_THIN \
                GRAFANA_MIMIR_URL GRAFANA_MIMIR_USERNAME GRAFANA_MIMIR_API_KEY \
                GRAFANA_TEMPO_URL GRAFANA_TEMPO_USERNAME GRAFANA_TEMPO_API_KEY
=======
                STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET STRIPE_WEBHOOK_SECRET_THIN
>>>>>>> worktree-agent-afd855f5
            local vps_ip="$PROD_VPS_IP"
            local compose_src="$PROJECT_DIR/docker-compose.prod.yml"
            local caddyfile_src="$PROJECT_DIR/Caddyfile"
            local remote_dir="/docker/divestreams-prod"
            local domain="divestreams.com"
            local auth_url="https://divestreams.com"
            local app_url="https://divestreams.com"
            ;;
        test)
            require_env TEST_VPS_IP GITHUB_TOKEN DB_HOST DB_PASSWORD REDIS_PASSWORD \
                AUTH_SECRET BETTER_AUTH_SECRET ADMIN_PASSWORD \
                PLATFORM_ADMIN_EMAIL PLATFORM_ADMIN_PASSWORD \
                SMTP_HOST SMTP_USER SMTP_PASS \
                S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY CDN_URL \
<<<<<<< HEAD
                STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
                GRAFANA_MIMIR_URL GRAFANA_MIMIR_USERNAME GRAFANA_MIMIR_API_KEY \
                GRAFANA_TEMPO_URL GRAFANA_TEMPO_USERNAME GRAFANA_TEMPO_API_KEY
=======
                STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
>>>>>>> worktree-agent-afd855f5
            local vps_ip="$TEST_VPS_IP"
            local compose_src="$PROJECT_DIR/docker-compose.test.yml"
            local caddyfile_src="$PROJECT_DIR/Caddyfile.test"
            local remote_dir="/docker/divestreams-test"
            local domain="test.divestreams.com"
            local auth_url="https://test.divestreams.com"
            local app_url="https://test.divestreams.com"
            ;;
        *)
            log_error "Unknown environment: $env"
            usage
            ;;
    esac

    log_step "=== DiveStreams $env Deployment ==="
    log_info "Target VPS: $vps_ip"
    log_info "Remote dir: $remote_dir"
    log_info "Domain:     $domain"

    setup_ssh_key

    # Create remote directory
    log_step "Creating remote directory $remote_dir..."
    ssh_exec "$vps_ip" "mkdir -p $remote_dir"

    # Login to GHCR on the VPS
    log_step "Authenticating with GHCR on VPS..."
    ssh_exec "$vps_ip" "echo '$GITHUB_TOKEN' | docker login ghcr.io -u shooter51 --password-stdin"

    # Copy compose file
    log_step "Copying docker-compose.yml..."
    scp_to "$compose_src" "$vps_ip" "$remote_dir/docker-compose.yml"

    # Copy appropriate Caddyfile
    local caddyfile_dest
    if [[ "$env" == "test" ]]; then
        caddyfile_dest="$remote_dir/Caddyfile.test"
    else
        caddyfile_dest="$remote_dir/Caddyfile"
    fi
    log_step "Copying Caddyfile..."
    scp_to "$caddyfile_src" "$vps_ip" "$caddyfile_dest"

<<<<<<< HEAD
    # Copy Alloy config
    log_step "Copying Alloy config..."
    ssh_exec "$vps_ip" "mkdir -p $remote_dir/config/alloy"
    scp_to "$PROJECT_DIR/config/alloy/config.alloy" "$vps_ip" "$remote_dir/config/alloy/config.alloy"

=======
>>>>>>> worktree-agent-afd855f5
    # Generate and upload .env file
    log_step "Generating .env file..."
    local env_file
    env_file=$(mktemp /tmp/divestreams-env-XXXXXX)
    trap 'rm -f "$env_file"' EXIT

    cat > "$env_file" <<ENV
DB_HOST=${DB_HOST}
DB_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD:-changeme}
AUTH_SECRET=${AUTH_SECRET}
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
AUTH_URL=${auth_url}
APP_URL=${app_url}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
PLATFORM_ADMIN_EMAIL=${PLATFORM_ADMIN_EMAIL}
PLATFORM_ADMIN_PASSWORD=${PLATFORM_ADMIN_PASSWORD}
PLATFORM_ADMIN_NAME=${PLATFORM_ADMIN_NAME:-Platform Admin}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM:-noreply@divestreams.com}
S3_ENDPOINT=${S3_ENDPOINT}
S3_REGION=${S3_REGION:-us-east-1}
S3_BUCKET=${S3_BUCKET}
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
CDN_URL=${CDN_URL}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
<<<<<<< HEAD
GRAFANA_MIMIR_URL=${GRAFANA_MIMIR_URL}
GRAFANA_MIMIR_USERNAME=${GRAFANA_MIMIR_USERNAME}
GRAFANA_MIMIR_API_KEY=${GRAFANA_MIMIR_API_KEY}
GRAFANA_TEMPO_URL=${GRAFANA_TEMPO_URL}
GRAFANA_TEMPO_USERNAME=${GRAFANA_TEMPO_USERNAME}
GRAFANA_TEMPO_API_KEY=${GRAFANA_TEMPO_API_KEY}
=======
>>>>>>> worktree-agent-afd855f5
ENV

    # Prod-only vars
    if [[ "$env" == "prod" ]]; then
        cat >> "$env_file" <<ENV
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
STRIPE_WEBHOOK_SECRET_THIN=${STRIPE_WEBHOOK_SECRET_THIN}
ENV
    fi

    # Test-only vars
    if [[ "$env" == "test" ]]; then
        cat >> "$env_file" <<ENV
DISABLE_RATE_LIMIT=true
ENV
    fi

    log_step "Uploading .env file to VPS..."
    scp_to "$env_file" "$vps_ip" "$remote_dir/.env"
    ssh_exec "$vps_ip" "chmod 600 $remote_dir/.env"

    # Pull images and start stack
    log_step "Pulling images..."
    ssh_exec "$vps_ip" "cd $remote_dir && docker compose pull"

    log_step "Starting containers..."
    ssh_exec "$vps_ip" "cd $remote_dir && docker compose up -d"

    # Wait for containers to be healthy
    wait_containers_healthy "$vps_ip" "$remote_dir" 300

    # Show container status
    log_step "Container status:"
    ssh_exec "$vps_ip" "cd $remote_dir && docker compose ps"

    # Verify app responds
    log_step "Verifying app health at https://$domain/api/health ..."
    local health_status
    local attempts=0
    local max_attempts=12

    while [[ $attempts -lt $max_attempts ]]; do
        health_status=$(curl -sf --max-time 10 "https://$domain/api/health" 2>/dev/null || echo "")

        if [[ -n "$health_status" ]]; then
            log_info "Health check response: $health_status"
            break
        fi

        attempts=$((attempts + 1))
        if [[ $attempts -lt $max_attempts ]]; then
            log_info "Health check attempt $attempts/$max_attempts failed, retrying in 15s..."
            sleep 15
        fi
    done

    if [[ $attempts -ge $max_attempts ]]; then
        log_warn "Health check did not respond — check Caddy TLS provisioning (may take a few minutes for first-time SSL)."
    fi

    echo ""
    log_step "=== Deployment Complete: $env ==="
    log_info "App URL: https://$domain"
    log_info "Remote dir: $remote_dir"
}

main "$@"
