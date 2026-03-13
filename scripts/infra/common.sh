#!/usr/bin/env bash
# Common functions for DiveStreams infrastructure scripts
# Source this file: source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()    { echo -e "${BLUE}[STEP]${NC}  $*"; }

die() {
    log_error "$*"
    exit 1
}

# Set up SSH key from env var or file path
# Sets SSH_KEY_FILE to the path of the key (may be a temp file)
# Registers cleanup on EXIT if a temp file was created
setup_ssh_key() {
    if [[ -n "${SSH_KEY_FILE:-}" && -f "$SSH_KEY_FILE" ]]; then
        log_info "Using SSH key from file: $SSH_KEY_FILE"
        return 0
    fi

    if [[ -n "${SSH_PRIVATE_KEY:-}" ]]; then
        SSH_KEY_FILE=$(mktemp /tmp/divestreams-ssh-XXXXXX)
        echo "$SSH_PRIVATE_KEY" > "$SSH_KEY_FILE"
        chmod 600 "$SSH_KEY_FILE"
        trap 'rm -f "$SSH_KEY_FILE"' EXIT
        log_info "SSH key loaded from SSH_PRIVATE_KEY env var (temp file: $SSH_KEY_FILE)"
        return 0
    fi

    die "No SSH key provided. Set SSH_PRIVATE_KEY or SSH_KEY_FILE."
}

# Run a command over SSH on a remote host
# Usage: ssh_exec <ip> <command>
ssh_exec() {
    local ip="$1"
    shift
    ssh \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=30 \
        -i "$SSH_KEY_FILE" \
        root@"$ip" "$@"
}

# Copy a file to a remote host
# Usage: scp_to <local_path> <ip> <remote_path>
scp_to() {
    local local_path="$1"
    local ip="$2"
    local remote_path="$3"
    scp \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=30 \
        -i "$SSH_KEY_FILE" \
        "$local_path" root@"$ip":"$remote_path"
}

# Copy a file from a remote host
# Usage: scp_from <ip> <remote_path> <local_path>
scp_from() {
    local ip="$1"
    local remote_path="$2"
    local local_path="$3"
    scp \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=30 \
        -i "$SSH_KEY_FILE" \
        root@"$ip":"$remote_path" "$local_path"
}

# Require that env vars are set
# Usage: require_env VAR1 VAR2 ...
require_env() {
    local missing=0
    for var in "$@"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable not set: $var"
            missing=1
        fi
    done
    [[ $missing -eq 0 ]] || die "Missing required environment variables."
}

# Poll Hostinger API for VPS state
# Usage: wait_for_vps_running <vps_id> [max_wait_seconds]
wait_for_vps_running() {
    local vps_id="$1"
    local max_wait="${2:-300}"
    local elapsed=0
    local interval=15

    log_step "Waiting for VPS $vps_id to become running (max ${max_wait}s)..."

    while [[ $elapsed -lt $max_wait ]]; do
        local state
        state=$(hostinger_get_vps_state "$vps_id")

        if [[ "$state" == "running" ]]; then
            log_info "VPS $vps_id is running."
            return 0
        fi

        log_info "VPS $vps_id state: $state (waited ${elapsed}s, checking again in ${interval}s)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    die "VPS $vps_id did not reach 'running' state within ${max_wait}s (last state: $state)"
}

# Get VPS state from Hostinger API
# Returns the state string (e.g. "running", "stopped", "installing")
hostinger_get_vps_state() {
    local vps_id="$1"
    require_env HOSTINGER_API_TOKEN
    curl -sf \
        -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
        -H "Content-Type: application/json" \
        "https://developers.hostinger.com/api/vps/v1/virtual-machines/$vps_id" \
        | jq -r '.state // .status // "unknown"'
}

# Get VPS IP from Hostinger API
hostinger_get_vps_ip() {
    local vps_id="$1"
    require_env HOSTINGER_API_TOKEN
    curl -sf \
        -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
        -H "Content-Type: application/json" \
        "https://developers.hostinger.com/api/vps/v1/virtual-machines/$vps_id" \
        | jq -r '.main_ip_address // .ip_address // empty'
}

# Make a Hostinger API call (POST)
# Usage: hostinger_post <path> [json_body]
hostinger_post() {
    local path="$1"
    local body="${2:-{\}}"
    require_env HOSTINGER_API_TOKEN
    curl -sf \
        -X POST \
        -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$body" \
        "https://developers.hostinger.com/api/vps/v1${path}"
}
