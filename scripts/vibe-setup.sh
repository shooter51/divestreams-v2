#!/bin/bash

# Durable setup script for Vibe Kanban workspaces
# This script is idempotent and can be run multiple times safely

set -e  # Exit on error
set -u  # Exit on undefined variable

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

# Step 1: Copy .mcp.json if it exists in parent directory
log_info "Setting up MCP configuration..."
if [ -f ~/divestreams-v2/.mcp.json ]; then
    cp ~/divestreams-v2/.mcp.json .mcp.json
    log_info ".mcp.json copied successfully"
elif [ -f .mcp.json ]; then
    log_info ".mcp.json already exists"
else
    log_warn ".mcp.json not found in ~/divestreams-v2/ - continuing without it"
fi

# Step 2: Install dependencies
log_info "Installing npm dependencies..."
if npm ci --legacy-peer-deps; then
    log_info "Dependencies installed successfully"
else
    log_error "npm ci failed, trying npm install as fallback..."
    npm install --legacy-peer-deps
fi

# Step 3: Create .env file if it doesn't exist
log_info "Setting up environment file..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        log_info ".env created from .env.example"
        log_warn "Remember to update .env with your actual credentials"
    else
        log_warn ".env.example not found - you'll need to create .env manually"
    fi
else
    log_info ".env already exists"
fi

# Step 4: Install git hooks
log_info "Installing git hooks..."
if [ -f package.json ] && grep -q "hooks:install" package.json; then
    npm run hooks:install 2>/dev/null || log_warn "hooks:install script failed (this is OK for Vibe workspaces)"
else
    log_warn "hooks:install script not found in package.json"
fi

# Step 5: Check if Docker is available
if ! command -v docker &> /dev/null; then
    log_warn "Docker not found - skipping local development infrastructure setup"
    log_warn "You'll need to configure remote database connection in .env"
    exit 0
fi

# Step 6: Check if Docker daemon is running
if ! docker info &> /dev/null; then
    log_warn "Docker daemon is not running - skipping local development infrastructure setup"
    log_warn "Start Docker Desktop and run this script again, or configure remote database in .env"
    exit 0
fi

# Step 7: Clean up any existing containers from previous runs
log_info "Cleaning up any existing containers..."
if docker compose -f docker-compose.dev.yml ps -q 2>/dev/null | grep -q .; then
    log_info "Stopping existing containers..."
    docker compose -f docker-compose.dev.yml down
fi

# Step 8: Start Docker infrastructure
log_info "Starting local development infrastructure (postgres, redis, minio)..."
if docker compose -f docker-compose.dev.yml up -d; then
    log_info "Docker containers started successfully"
else
    log_error "Failed to start Docker containers"
    exit 1
fi

# Step 9: Wait for PostgreSQL to be ready
log_info "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until docker exec divestreams-db pg_isready -U divestreams &> /dev/null || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $((RETRY_COUNT % 5)) -eq 0 ]; then
        log_info "Still waiting for PostgreSQL... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    fi
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "PostgreSQL failed to become ready after $MAX_RETRIES seconds"
    docker compose -f docker-compose.dev.yml logs postgres
    exit 1
fi

log_info "PostgreSQL is ready!"

# Step 10: Wait for Redis to be ready
log_info "Waiting for Redis to be ready..."
RETRY_COUNT=0
until docker exec divestreams-redis redis-cli ping &> /dev/null || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $((RETRY_COUNT % 5)) -eq 0 ]; then
        log_info "Still waiting for Redis... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    fi
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "Redis failed to become ready after $MAX_RETRIES seconds"
    docker compose -f docker-compose.dev.yml logs redis
    exit 1
fi

log_info "Redis is ready!"

# Step 11: Push database schema
log_info "Pushing database schema..."
if npm run db:push; then
    log_info "Database schema pushed successfully"
else
    log_warn "db:push failed - you may need to run migrations manually"
    log_warn "Try: npm run db:generate && npm run db:migrate"
fi

# Step 12: Verify everything is running
log_info "Verifying services..."
if docker compose -f docker-compose.dev.yml ps | grep -q "Up"; then
    log_info "✓ Docker services are running"
else
    log_warn "Some Docker services may not be running properly"
    docker compose -f docker-compose.dev.yml ps
fi

log_info "=========================================="
log_info "Setup completed successfully!"
log_info "=========================================="
log_info "Services running:"
log_info "  - PostgreSQL: localhost:5432"
log_info "  - Redis: localhost:6379"
log_info "  - MinIO: localhost:9000 (console: localhost:9001)"
log_info ""
log_info "Next steps:"
log_info "  1. Copy .env.example to .env if needed"
log_info "  2. Run 'npm run dev' to start the development server"
log_info "=========================================="
