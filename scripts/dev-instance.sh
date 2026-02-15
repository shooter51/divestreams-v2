#!/usr/bin/env bash
# Dev VPS Instance Manager
# Manages isolated DiveStreams Docker instances on the dev VPS.
# Each instance gets its own app, worker, postgres, and redis containers.
#
# Usage:
#   ./scripts/dev-instance.sh create <name> [--tag <image-tag>]
#   ./scripts/dev-instance.sh destroy <name>
#   ./scripts/dev-instance.sh list
#   ./scripts/dev-instance.sh logs <name> [--follow]
#   ./scripts/dev-instance.sh status <name>
#   ./scripts/dev-instance.sh pull [--tag <image-tag>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.dev-vps.yml"
PORTS_FILE="/opt/divestreams/ports.json"
CADDY_CONFIG="/etc/caddy/Caddyfile"
MAX_INSTANCES=8
BASE_PORT=3001

# Ensure ports registry exists
mkdir -p /opt/divestreams
[ -f "$PORTS_FILE" ] || echo '{}' > "$PORTS_FILE"

log() { echo "[dev-instance] $*"; }
err() { echo "[dev-instance] ERROR: $*" >&2; exit 1; }

# Find next available port starting from BASE_PORT
next_port() {
    local used_ports
    used_ports=$(jq -r 'to_entries[].value' "$PORTS_FILE" 2>/dev/null | sort -n)
    local port=$BASE_PORT
    while echo "$used_ports" | grep -q "^${port}$"; do
        port=$((port + 1))
    done
    echo "$port"
}

# Register a port for an instance
register_port() {
    local name=$1 port=$2
    local tmp=$(mktemp)
    jq --arg name "$name" --arg port "$port" '. + {($name): ($port | tonumber)}' "$PORTS_FILE" > "$tmp"
    mv "$tmp" "$PORTS_FILE"
}

# Unregister a port
unregister_port() {
    local name=$1
    local tmp=$(mktemp)
    jq --arg name "$name" 'del(.[$name])' "$PORTS_FILE" > "$tmp"
    mv "$tmp" "$PORTS_FILE"
}

# Get port for an instance
get_port() {
    local name=$1
    jq -r --arg name "$name" '.[$name] // empty' "$PORTS_FILE"
}

# Count current instances
instance_count() {
    jq 'length' "$PORTS_FILE"
}

# Update Caddy config with current instances
update_caddy() {
    log "Updating Caddy configuration..."

    # Build instance blocks from ports registry
    local instance_blocks=""
    while IFS='=' read -r name port; do
        name=$(echo "$name" | tr -d '"')
        port=$(echo "$port" | tr -d '"')
        [ -z "$name" ] || [ -z "$port" ] && continue
        instance_blocks+="
${name}.dev.divestreams.com {
    import security_headers
    reverse_proxy localhost:${port}
}
"
    done < <(jq -r 'to_entries[] | "\(.key)=\(.value)"' "$PORTS_FILE" 2>/dev/null)

    # Replace content between markers in Caddyfile
    local tmp=$(mktemp)
    awk -v blocks="$instance_blocks" '
        /^# BEGIN INSTANCES/ { print; print blocks; skip=1; next }
        /^# END INSTANCES/   { skip=0 }
        !skip { print }
    ' "$CADDY_CONFIG" > "$tmp"
    mv "$tmp" "$CADDY_CONFIG"

    # Reload Caddy
    if command -v caddy &>/dev/null; then
        caddy reload --config "$CADDY_CONFIG" 2>/dev/null || log "Warning: Caddy reload failed"
    elif systemctl is-active caddy &>/dev/null; then
        systemctl reload caddy 2>/dev/null || log "Warning: Caddy reload failed"
    fi
}

cmd_create() {
    local name="${1:?Usage: dev-instance.sh create <name> [--tag <image-tag>]}"
    local tag="dev"

    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --tag) tag="${2:?--tag requires a value}"; shift 2 ;;
            *) err "Unknown option: $1" ;;
        esac
    done

    # Validate name (alphanumeric + hyphens only)
    [[ "$name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || err "Instance name must be lowercase alphanumeric with hyphens"

    # Check if already exists
    [ -n "$(get_port "$name")" ] && err "Instance '$name' already exists (port $(get_port "$name"))"

    # Check max instances
    local count
    count=$(instance_count)
    [ "$count" -ge "$MAX_INSTANCES" ] && err "Maximum $MAX_INSTANCES instances reached (currently $count). Destroy one first."

    local port
    port=$(next_port)
    log "Creating instance '$name' on port $port with image tag '$tag'..."

    register_port "$name" "$port"

    INSTANCE_NAME="$name" \
    HOST_PORT="$port" \
    IMAGE_TAG="$tag" \
    docker compose -f "$COMPOSE_FILE" -p "ds-${name}" up -d

    update_caddy

    log "Instance '$name' created successfully"
    log "  URL: https://${name}.dev.divestreams.com"
    log "  Port: $port"
    log "  Containers: ds-${name}-app, ds-${name}-worker, ds-${name}-db, ds-${name}-redis"
}

cmd_destroy() {
    local name="${1:?Usage: dev-instance.sh destroy <name>}"

    [ -z "$(get_port "$name")" ] && err "Instance '$name' not found"

    log "Destroying instance '$name'..."

    local port
    port=$(get_port "$name")

    INSTANCE_NAME="$name" \
    HOST_PORT="$port" \
    docker compose -f "$COMPOSE_FILE" -p "ds-${name}" down -v

    unregister_port "$name"
    update_caddy

    log "Instance '$name' destroyed"
}

cmd_list() {
    log "Active instances:"
    if [ "$(instance_count)" -eq 0 ]; then
        echo "  (none)"
        return
    fi

    printf "  %-20s %-6s %-40s\n" "NAME" "PORT" "URL"
    printf "  %-20s %-6s %-40s\n" "----" "----" "---"
    while IFS='=' read -r name port; do
        name=$(echo "$name" | tr -d '"')
        port=$(echo "$port" | tr -d '"')
        [ -z "$name" ] && continue
        printf "  %-20s %-6s %-40s\n" "$name" "$port" "https://${name}.dev.divestreams.com"
    done < <(jq -r 'to_entries[] | "\(.key)=\(.value)"' "$PORTS_FILE" 2>/dev/null)
}

cmd_logs() {
    local name="${1:?Usage: dev-instance.sh logs <name> [--follow]}"
    shift
    local follow=""
    [[ "${1:-}" == "--follow" ]] && follow="-f"

    [ -z "$(get_port "$name")" ] && err "Instance '$name' not found"

    local port
    port=$(get_port "$name")

    INSTANCE_NAME="$name" \
    HOST_PORT="$port" \
    docker compose -f "$COMPOSE_FILE" -p "ds-${name}" logs $follow
}

cmd_status() {
    local name="${1:?Usage: dev-instance.sh status <name>}"

    [ -z "$(get_port "$name")" ] && err "Instance '$name' not found"

    local port
    port=$(get_port "$name")

    INSTANCE_NAME="$name" \
    HOST_PORT="$port" \
    docker compose -f "$COMPOSE_FILE" -p "ds-${name}" ps
}

cmd_pull() {
    local tag="dev"
    while [[ $# -gt 0 ]]; do
        case $1 in
            --tag) tag="${2:?--tag requires a value}"; shift 2 ;;
            *) err "Unknown option: $1" ;;
        esac
    done

    log "Pulling ghcr.io/shooter51/divestreams-app:${tag}..."
    docker pull "ghcr.io/shooter51/divestreams-app:${tag}"
    log "Pull complete"
}

# Main dispatch
case "${1:-}" in
    create)  shift; cmd_create "$@" ;;
    destroy) shift; cmd_destroy "$@" ;;
    list)    cmd_list ;;
    logs)    shift; cmd_logs "$@" ;;
    status)  shift; cmd_status "$@" ;;
    pull)    shift; cmd_pull "$@" ;;
    *)
        echo "Usage: dev-instance.sh <command> [args]"
        echo ""
        echo "Commands:"
        echo "  create <name> [--tag <image-tag>]  Create a new instance"
        echo "  destroy <name>                      Remove an instance"
        echo "  list                                List all instances"
        echo "  logs <name> [--follow]              View instance logs"
        echo "  status <name>                       Show container status"
        echo "  pull [--tag <image-tag>]            Pull latest image"
        exit 1
        ;;
esac
