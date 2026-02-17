#!/bin/bash

# Durable cleanup script for Vibe Kanban workspaces
# This script safely tears down local development infrastructure

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info "Cleaning up Vibe Kanban workspace..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    log_warn "Docker not found - nothing to clean up"
    exit 0
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    log_warn "Docker daemon is not running - nothing to clean up"
    exit 0
fi

# Stop and remove containers
log_info "Stopping Docker containers..."
if docker compose -f docker-compose.dev.yml down 2>/dev/null; then
    log_info "Docker containers stopped successfully"
else
    log_warn "No Docker containers to stop or docker-compose.dev.yml not found"
fi

log_info "Cleanup completed successfully!"
