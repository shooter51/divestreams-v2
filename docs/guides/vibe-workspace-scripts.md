# Vibe Kanban Workspace Scripts

This document describes the durable setup and cleanup scripts used by Vibe Kanban workspaces.

## Overview

Vibe Kanban workspaces use automated scripts to set up and tear down development environments. These scripts are designed to be:

- **Idempotent**: Can be run multiple times safely
- **Durable**: Handle failures gracefully with proper error checking
- **Informative**: Provide clear feedback about what's happening
- **Fallback-friendly**: Continue working even when Docker isn't available

## Scripts

### `scripts/vibe-setup.sh`

**Purpose**: Initialize a Vibe Kanban workspace with all dependencies and infrastructure.

**What it does**:

1. Copies `.mcp.json` from `~/divestreams-v2/` if available
2. Installs npm dependencies with `npm ci --legacy-peer-deps`
3. Creates `.env` from `.env.example` if it doesn't exist
4. Installs git hooks (optional, won't fail if unavailable)
5. Checks if Docker is available and running
6. Starts local development infrastructure (PostgreSQL, Redis, MinIO)
7. Waits for PostgreSQL and Redis to be ready (max 30 seconds each)
8. Pushes database schema with `npm run db:push`
9. Verifies all services are running

**Usage**:
```bash
./scripts/vibe-setup.sh
```

**Exit codes**:
- `0`: Success (or partial success with warnings)
- `1`: Critical failure (e.g., Docker failed to start)

**Graceful fallbacks**:
- If `.mcp.json` doesn't exist → continues
- If git hooks fail → logs warning, continues
- If Docker not installed → logs warning, exits cleanly
- If Docker daemon not running → logs warning, exits cleanly
- If `db:push` fails → logs warning with manual fix instructions, continues

### `scripts/vibe-cleanup.sh`

**Purpose**: Tear down local development infrastructure when done with workspace.

**What it does**:

1. Checks if Docker is available and running
2. Stops and removes Docker containers via `docker compose down`

**Usage**:
```bash
./scripts/vibe-cleanup.sh
```

**Exit codes**:
- `0`: Success (or Docker not available)

**Graceful fallbacks**:
- If Docker not installed → logs warning, exits cleanly
- If Docker daemon not running → logs warning, exits cleanly
- If no containers running → logs warning, exits cleanly

## Vibe Kanban Configuration

These scripts are configured in Vibe Kanban's repository settings:

```javascript
{
  "setup_script": "./scripts/vibe-setup.sh",
  "cleanup_script": "./scripts/vibe-cleanup.sh",
  "dev_server_script": "npm run dev"
}
```

## Local Development Infrastructure

The setup script starts three services via `docker-compose.dev.yml`:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | 5432 | PostgreSQL database |
| redis | redis:7-alpine | 6379 | Redis cache/queue |
| minio | minio/minio:latest | 9000, 9001 | S3-compatible object storage |

## Environment Variables

The setup script automatically creates `.env` from `.env.example` with these defaults:

```bash
DATABASE_URL=postgresql://divestreams:divestreams_dev@localhost:5432/divestreams
REDIS_URL=redis://localhost:6379
AUTH_SECRET=generate-a-secure-secret-here
AUTH_URL=http://localhost:5173
# ... and more
```

## Troubleshooting

### Setup script fails with "Docker daemon is not running"

**Solution**: Start Docker Desktop and run the setup script again.

### Setup script fails with "PostgreSQL failed to become ready"

**Solution**:
1. Check Docker Desktop is running
2. Run `docker compose -f docker-compose.dev.yml logs postgres` to see errors
3. Try stopping containers: `docker compose -f docker-compose.dev.yml down`
4. Run setup script again

### Setup script fails with "db:push failed"

**Solution**: The setup script will continue despite this warning. You can manually run:
```bash
npm run db:generate
npm run db:migrate
```

### Containers already exist from previous workspace

**Solution**: The setup script automatically cleans up existing containers before starting new ones. No action needed.

## Design Principles

### Idempotency

All scripts can be run multiple times safely:
- `.env` creation checks if file exists first
- Docker cleanup removes existing containers before starting new ones
- npm ci ensures clean dependency installation

### Error Handling

Scripts use `set -e` to exit on errors, but handle expected failures:
- Optional steps (like git hooks) won't stop execution
- Missing dependencies (like Docker) provide helpful warnings
- Database schema push failures include manual fix instructions

### User Feedback

Scripts provide color-coded output:
- **Green [INFO]**: Successful operations
- **Yellow [WARN]**: Non-critical issues or skipped steps
- **Red [ERROR]**: Critical failures

### Durability

Scripts wait for services to be ready:
- PostgreSQL: Up to 30 seconds with `pg_isready` checks
- Redis: Up to 30 seconds with `redis-cli ping` checks
- Progress updates every 5 attempts

## Updating Scripts

To update the Vibe Kanban repository configuration:

```javascript
// Update setup script
mcp__vibe_kanban__update_setup_script({
  repo_id: "2e2baa81-971b-4735-a0cc-d445d4338e00",
  script: "./scripts/vibe-setup.sh"
})

// Update cleanup script
mcp__vibe_kanban__update_cleanup_script({
  repo_id: "2e2baa81-971b-4735-a0cc-d445d4338e00",
  script: "./scripts/vibe-cleanup.sh"
})

// Verify changes
mcp__vibe_kanban__get_repo({
  repo_id: "2e2baa81-971b-4735-a0cc-d445d4338e00"
})
```

## See Also

- [Directory Structure Quick Reference](./directory-structure-quick-reference.md)
- [Testing Guide](../../TESTING.md)
- [Deployment Guide](../CLAUDE.md#deployment)
