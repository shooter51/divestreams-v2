#!/usr/bin/env bash
# dr-failover.sh — Disaster Recovery Failover
#
# Promotes the Phoenix read replica to primary and brings up production
# on the Phoenix VPS when the Boston datacenter is unavailable.
#
# Usage:
#   ssh root@100.109.71.112   # Phoenix VPS via Tailscale
#   /docker/dr-failover.sh
#
# Prerequisites:
#   - This script must be pre-deployed to Phoenix VPS at /docker/dr-failover.sh
#   - The read replica must be running at /docker/divestreams-replica/
#   - The production .env must be pre-staged at /docker/dr-failover-env
#   - Cloudflare API token must be set in the env file
#
# What this script does:
#   1. Confirms Boston is unreachable
#   2. Stops test containers (free resources)
#   3. Promotes the PostgreSQL replica to primary
#   4. Creates production docker project with DR-specific compose
#   5. Updates Cloudflare DNS to point prod domains to Phoenix
#   6. Starts production containers
#   7. Waits for health check
#
# Recovery Point: Last replicated WAL position (typically seconds of data)
# Recovery Time: ~5 minutes from script start to production serving

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────

BOSTON_DB_TAILSCALE="100.104.105.34"
BOSTON_APP_TAILSCALE="100.112.155.18"
PHOENIX_TAILSCALE="100.109.71.112"

CLOUDFLARE_ZONE_ID="912605970a7d6bf122bf6b7430b2d2ea"

# DNS record IDs (from Cloudflare — these are stable)
DNS_ROOT_ID="bcf40f7204385ff9edac4e3cdac67bed"        # divestreams.com → proxied
DNS_WILDCARD_PROD_ID="8cd2be60ca964d9056591dbc51d9436a" # *.divestreams.com → not proxied
DNS_WWW_ID="cb60b0090858d5d78a139b3b7849c429"          # www.divestreams.com → proxied

PHOENIX_PUBLIC_IP="62.72.3.35"

# Paths
REPLICA_DIR="/docker/divestreams-replica"
TEST_DIR="/docker/divestreams-test"
PROD_DIR="/docker/divestreams-prod-dr"
ENV_FILE="/docker/dr-failover-env"

# ─── Colors ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $(date +%H:%M:%S) $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date +%H:%M:%S) $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date +%H:%M:%S) $*" >&2; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $(date +%H:%M:%S) $*"; }

die() { log_error "$*"; exit 1; }

# ─── Pre-checks ──────────────────────────────────────────────────────────────

preflight() {
    log_step "════════════════════════════════════════════════════"
    log_step "  DISASTER RECOVERY FAILOVER — DiveStreams"
    log_step "════════════════════════════════════════════════════"
    echo ""

    # Must be running on Phoenix
    local my_ip
    my_ip=$(tailscale ip -4 2>/dev/null || echo "unknown")
    if [[ "$my_ip" != "$PHOENIX_TAILSCALE" ]]; then
        die "This script must run on the Phoenix VPS (expected Tailscale IP $PHOENIX_TAILSCALE, got $my_ip)"
    fi
    log_info "Running on Phoenix VPS ✓"

    # Check replica is running
    if ! docker ps --format '{{.Names}}' | grep -q divestreams-replica; then
        die "Replica container 'divestreams-replica' is not running"
    fi
    log_info "Replica container is running ✓"

    # Check env file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        die "DR env file not found at $ENV_FILE — deploy it first"
    fi
    log_info "DR env file present ✓"

    # Check Cloudflare token
    local cf_token
    cf_token=$(grep CLOUDFLARE_API_TOKEN "$ENV_FILE" | cut -d= -f2-)
    if [[ -z "$cf_token" ]]; then
        die "CLOUDFLARE_API_TOKEN not found in $ENV_FILE"
    fi
    export CF_TOKEN="$cf_token"
    log_info "Cloudflare API token present ✓"
}

# ─── Step 1: Confirm Boston is down ──────────────────────────────────────────

confirm_boston_down() {
    log_step "Step 1: Confirming Boston is unreachable..."

    local db_reachable=false
    local app_reachable=false

    if ping -c 2 -W 3 "$BOSTON_DB_TAILSCALE" &>/dev/null; then
        db_reachable=true
    fi

    if ping -c 2 -W 3 "$BOSTON_APP_TAILSCALE" &>/dev/null; then
        app_reachable=true
    fi

    if $db_reachable && $app_reachable; then
        log_warn "Both Boston VPSs are REACHABLE."
        log_warn "This doesn't look like a datacenter failure."
        echo ""
        echo -e "${RED}Are you sure you want to proceed with failover? This will:${NC}"
        echo "  - Promote the replica to primary (IRREVERSIBLE without resync)"
        echo "  - Stop test containers"
        echo "  - Point production DNS to Phoenix"
        echo ""
        read -rp "Type 'FAILOVER' to confirm: " confirm
        if [[ "$confirm" != "FAILOVER" ]]; then
            die "Failover aborted by user"
        fi
    elif $db_reachable; then
        log_warn "DB VPS reachable but App VPS is down"
        log_warn "Consider restarting the App VPS instead of full failover"
        read -rp "Type 'FAILOVER' to confirm: " confirm
        if [[ "$confirm" != "FAILOVER" ]]; then
            die "Failover aborted by user"
        fi
    else
        log_info "Boston DB VPS: unreachable ✓ (confirms outage)"
        log_info "Boston App VPS: $(if $app_reachable; then echo 'reachable'; else echo 'unreachable ✓'; fi)"
    fi

    # Record the last replicated position
    log_info "Last WAL replay timestamp (Recovery Point):"
    docker exec divestreams-replica psql -U divestreams -p 5433 -d divestreams -t -c \
        "SELECT pg_last_xact_replay_timestamp();" 2>/dev/null || echo "  (unable to query)"
}

# ─── Step 2: Stop test containers ────────────────────────────────────────────

stop_test() {
    log_step "Step 2: Stopping test containers to free resources..."

    if [[ -d "$TEST_DIR" ]]; then
        cd "$TEST_DIR"
        docker compose down 2>/dev/null || true
        log_info "Test containers stopped ✓"
    else
        log_info "No test directory found, skipping"
    fi
}

# ─── Step 3: Promote replica ────────────────────────────────────────────────

promote_replica() {
    log_step "Step 3: Promoting replica to primary..."

    docker exec divestreams-replica psql -U divestreams -p 5433 -d divestreams -c \
        "SELECT pg_promote();" || die "Failed to promote replica"

    # Wait for promotion to complete
    sleep 3

    local in_recovery
    in_recovery=$(docker exec divestreams-replica psql -U divestreams -p 5433 -d divestreams -t -c \
        "SELECT pg_is_in_recovery();" | tr -d ' ')

    if [[ "$in_recovery" == "f" ]]; then
        log_info "Replica promoted to primary ✓ (pg_is_in_recovery = false)"
    else
        die "Promotion failed — pg_is_in_recovery is still true"
    fi
}

# ─── Step 4: Create production environment ───────────────────────────────────

create_prod_env() {
    log_step "Step 4: Creating production Docker environment..."

    mkdir -p "$PROD_DIR/config/alloy"

    # Copy the pre-staged .env and override DB_HOST to point to local replica
    cp "$ENV_FILE" "$PROD_DIR/.env"
    # Override DB connection to use local promoted replica
    sed -i "s|^DB_HOST=.*|DB_HOST=${PHOENIX_TAILSCALE}|" "$PROD_DIR/.env"
    # Change DB port to 5433 (replica port)
    if grep -q "^DB_PORT=" "$PROD_DIR/.env"; then
        sed -i "s|^DB_PORT=.*|DB_PORT=5433|" "$PROD_DIR/.env"
    else
        echo "DB_PORT=5433" >> "$PROD_DIR/.env"
    fi

    # Write DR-specific docker-compose that uses the local replica
    cat > "$PROD_DIR/docker-compose.yml" << 'COMPOSE'
services:
  app:
    image: ghcr.io/shooter51/divestreams-app:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://divestreams:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/divestreams
      - REDIS_URL=redis://:${REDIS_PASSWORD:-changeme}@redis:6379
      - AUTH_SECRET=${AUTH_SECRET}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - AUTH_URL=${AUTH_URL:-https://divestreams.com}
      - APP_URL=${APP_URL:-https://divestreams.com}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - STRIPE_WEBHOOK_SECRET_THIN=${STRIPE_WEBHOOK_SECRET_THIN}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT:-587}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM:-noreply@divestreams.com}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:?ADMIN_PASSWORD must be set}
      - PLATFORM_ADMIN_EMAIL=${PLATFORM_ADMIN_EMAIL}
      - PLATFORM_ADMIN_PASSWORD=${PLATFORM_ADMIN_PASSWORD}
      - PLATFORM_ADMIN_NAME=${PLATFORM_ADMIN_NAME:-Platform Admin}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_REGION=${S3_REGION:-us-east-1}
      - S3_BUCKET=${S3_BUCKET:-divestreams-images}
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
      - CDN_URL=${CDN_URL}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION:-us-east-1}
      - OTEL_SERVICE_NAME=divestreams-app-dr
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '3.0'
          memory: 8192M
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - divestreams-network
    extra_hosts:
      - "host.docker.internal:host-gateway"

  worker:
    image: ghcr.io/shooter51/divestreams-app:latest
    container_name: divestreams-dr-worker
    restart: unless-stopped
    command: npm run worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://divestreams:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/divestreams
      - REDIS_URL=redis://:${REDIS_PASSWORD:-changeme}@redis:6379
      - AUTH_SECRET=${AUTH_SECRET}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - AUTH_URL=${AUTH_URL:-https://divestreams.com}
      - APP_URL=${APP_URL:-https://divestreams.com}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT:-587}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM:-noreply@divestreams.com}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_REGION=${S3_REGION:-us-east-1}
      - S3_BUCKET=${S3_BUCKET:-divestreams-images}
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
      - CDN_URL=${CDN_URL}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION:-us-east-1}
      - OTEL_SERVICE_NAME=divestreams-worker-dr
    healthcheck:
      test: ["CMD", "node", "-e", "const r=require('ioredis');const c=new r(process.env.REDIS_URL);c.ping().then(()=>{c.disconnect();process.exit(0)}).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - divestreams-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  zapier-worker:
    image: ghcr.io/shooter51/divestreams-app:latest
    container_name: divestreams-dr-zapier-worker
    restart: unless-stopped
    command: npm run worker:zapier
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://divestreams:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/divestreams
      - REDIS_URL=redis://:${REDIS_PASSWORD:-changeme}@redis:6379
    healthcheck:
      test: ["CMD", "node", "-e", "const r=require('ioredis');const c=new r(process.env.REDIS_URL);c.ping().then(()=>{c.disconnect();process.exit(0)}).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - divestreams-network
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 256M

  redis:
    image: redis:7-alpine
    container_name: divestreams-dr-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-changeme} --maxmemory 768mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - divestreams-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1024M

  caddy:
    image: caddy:2-alpine
    container_name: divestreams-dr-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    depends_on:
      - app
    networks:
      - divestreams-network

networks:
  divestreams-network:
    driver: bridge

volumes:
  redis_data:
  caddy_data:
  caddy_config:
COMPOSE

    # Copy the production Caddyfile (handles divestreams.com + *.divestreams.com)
    # This file should be pre-staged alongside the env file
    if [[ -f /docker/dr-failover-Caddyfile ]]; then
        cp /docker/dr-failover-Caddyfile "$PROD_DIR/Caddyfile"
    else
        log_warn "No pre-staged Caddyfile at /docker/dr-failover-Caddyfile"
        log_warn "Using a minimal Caddyfile — tenant subdomains may not have full config"
        cat > "$PROD_DIR/Caddyfile" << 'CADDYFILE'
{
    email admin@divestreams.com
    on_demand_tls {
        ask http://app:3000/api/domain-check
    }
}

divestreams.com {
    reverse_proxy app:3000
    encode gzip
}

www.divestreams.com {
    redir https://divestreams.com{uri} permanent
}

*.divestreams.com {
    tls {
        on_demand
    }
    reverse_proxy app:3000
    encode gzip
}

:443 {
    tls {
        on_demand
    }
    reverse_proxy app:3000
    encode gzip
}
CADDYFILE
    fi

    log_info "Production DR environment created ✓"
}

# ─── Step 5: Update DNS ─────────────────────────────────────────────────────

update_dns() {
    log_step "Step 5: Updating Cloudflare DNS to point to Phoenix..."

    local api="https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records"

    # Update divestreams.com (proxied A record)
    local result
    result=$(curl -s -X PATCH "$api/$DNS_ROOT_ID" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"content\":\"$PHOENIX_PUBLIC_IP\"}")
    if echo "$result" | grep -q '"success":true'; then
        log_info "divestreams.com → $PHOENIX_PUBLIC_IP ✓"
    else
        log_error "Failed to update divestreams.com: $result"
    fi

    # Update *.divestreams.com (not proxied)
    result=$(curl -s -X PATCH "$api/$DNS_WILDCARD_PROD_ID" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"content\":\"$PHOENIX_PUBLIC_IP\"}")
    if echo "$result" | grep -q '"success":true'; then
        log_info "*.divestreams.com → $PHOENIX_PUBLIC_IP ✓"
    else
        log_error "Failed to update *.divestreams.com: $result"
    fi

    # Update www.divestreams.com (proxied)
    result=$(curl -s -X PATCH "$api/$DNS_WWW_ID" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"content\":\"$PHOENIX_PUBLIC_IP\"}")
    if echo "$result" | grep -q '"success":true'; then
        log_info "www.divestreams.com → $PHOENIX_PUBLIC_IP ✓"
    else
        log_error "Failed to update www.divestreams.com: $result"
    fi

    log_info "DNS updated — propagation may take up to 5 minutes for wildcard records"
}

# ─── Step 6: Start production ────────────────────────────────────────────────

start_production() {
    log_step "Step 6: Starting production containers..."

    # Stop existing test Caddy if it's still holding ports 80/443
    docker stop divestreams-test-caddy 2>/dev/null || true
    docker rm divestreams-test-caddy 2>/dev/null || true

    cd "$PROD_DIR"
    docker compose up -d

    log_info "Production containers starting..."
}

# ─── Step 7: Wait for health ─────────────────────────────────────────────────

wait_for_health() {
    log_step "Step 7: Waiting for production to become healthy..."

    local max_wait=120
    local waited=0

    while (( waited < max_wait )); do
        local status
        status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
            http://localhost:3000/api/health 2>/dev/null || echo "000")

        if [[ "$status" == "200" ]]; then
            log_info "App health check: 200 ✓ (after ${waited}s)"
            break
        fi

        sleep 5
        waited=$((waited + 5))
        echo -ne "  Waiting... ${waited}s / ${max_wait}s (last status: $status)\r"
    done
    echo ""

    if (( waited >= max_wait )); then
        log_error "App did not become healthy within ${max_wait}s"
        log_error "Check logs: docker logs divestreams-prod-dr-app-1"
        # Don't die — DNS is already updated, let the operator debug
    fi

    # Check HTTPS (may take a moment for Caddy to get certs)
    log_info "Waiting for TLS cert provisioning..."
    sleep 15

    local https_status
    https_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
        --resolve "divestreams.com:443:127.0.0.1" \
        https://divestreams.com/api/health 2>/dev/null || echo "000")
    log_info "HTTPS health check: $https_status (cert may still be provisioning)"
}

# ─── Summary ─────────────────────────────────────────────────────────────────

summary() {
    echo ""
    log_step "════════════════════════════════════════════════════"
    log_step "  FAILOVER COMPLETE"
    log_step "════════════════════════════════════════════════════"
    echo ""
    echo "  Production is now running on Phoenix VPS"
    echo ""
    echo "  App:      http://localhost:3000  (internal)"
    echo "  HTTPS:    https://divestreams.com (after DNS propagation)"
    echo "  Database: localhost:5433 (promoted replica)"
    echo ""
    echo "  DNS records updated:"
    echo "    divestreams.com      → $PHOENIX_PUBLIC_IP"
    echo "    *.divestreams.com    → $PHOENIX_PUBLIC_IP"
    echo "    www.divestreams.com  → $PHOENIX_PUBLIC_IP"
    echo ""
    echo -e "  ${YELLOW}IMPORTANT: After Boston is restored:${NC}"
    echo "    1. Do NOT restart the old primary — it has stale data"
    echo "    2. Resync Boston DB from Phoenix (now the source of truth)"
    echo "    3. Reconfigure streaming replication"
    echo "    4. Revert DNS via Terraform on your local machine"
    echo "    5. See: docs/operations/vps-role-swap-runbook.md Phase 10.5"
    echo ""
    log_info "Monitor: docker ps && docker logs -f divestreams-prod-dr-app-1"
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
    preflight
    confirm_boston_down
    stop_test
    promote_replica
    create_prod_env
    update_dns
    start_production
    wait_for_health
    summary
}

main "$@"
