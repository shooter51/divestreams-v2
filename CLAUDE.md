# DiveStreams v2 - Claude Code Configuration

## Project Overview
Multi-tenant SaaS platform for dive shop and dive tour management. Built with React Router v7, PostgreSQL (multi-tenant with schema-per-tenant), Redis, and Caddy.

## Beads Issue Tracking - REQUIRED BEFORE CODE CHANGES

**IMPORTANT: Always use Beads to track work before making code changes.**

### Before Starting Work
```bash
bd ready                    # Show issues ready to work on
bd create --title "..."     # Create new issue for the task
bd show DIVE-xxx            # View issue details
```

### During Work
```bash
bd update DIVE-xxx --status in-progress  # Mark as in progress
bd comments DIVE-xxx --add "..."         # Add progress notes
```

### After Completing Work
```bash
bd close DIVE-xxx           # Close the issue
bd list                     # Verify status
```

### Key Commands
```bash
bd status                   # Overview of all issues
bd list                     # List open issues
bd search "keyword"         # Find issues
bd graph                    # Show dependency graph
```

**Issue Prefix:** `DIVE-`
**Sync Branch:** `beads-sync`

## Deployment

### CI/CD Pipeline - THE ONLY WAY TO DEPLOY
**IMPORTANT: NEVER deploy directly. ALWAYS use the CI/CD pipeline via git push.**

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  develop    │───>│  Unit Tests │───>│  Build :dev │───>│  Deploy Dev │
│  branch     │    │  (fast)     │    │   Docker    │    │    VPS      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  staging    │───>│ Tests + E2E │───>│ Build :test │───>│ Deploy Test │
│  branch     │    │  (full)     │    │   Docker    │    │    VPS      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                v smoke tests
┌─────────────┐                                         ┌─────────────┐
│    main     │─────────────────────────────────────────>│   Deploy    │
│   branch    │        (retag test → latest)             │ Production  │
└─────────────┘                                         └─────────────┘
```

### Three Environments

| Environment | Purpose | Users |
|-------------|---------|-------|
| **Dev** | AI agent sandbox - remote development, feature testing, defect reproduction. Supports multiple simultaneous Docker instances. | AI agents |
| **Test** | Human QA - manual product testing, feedback, QA tasks. Stable always-on instance. | Tom, QA team |
| **Production** | Live production environment. | End users |

### Deployment Workflow

**To deploy to DEV (fast path - unit tests only):**
```bash
git checkout develop
git merge <feature-branch>
git push origin develop
```
This triggers: lint → typecheck → unit tests → build Docker `:dev` → deploy to Dev VPS

**To deploy to TEST (full test gate):**
```bash
git checkout staging
git merge develop  # or feature branch
git push origin staging
```
This triggers: lint → typecheck → unit tests → E2E tests → build Docker `:test` → deploy to Test VPS → smoke tests

**To deploy to PRODUCTION:**
```bash
git checkout main
git merge staging
git push origin main
```
This retags `ghcr.io/shooter51/divestreams-app:test` → `:latest` and deploys to production VPS.

### VPS Infrastructure

| Environment | VPS ID | IP Address | Docker Project | Image Tag | Domain |
|-------------|--------|------------|----------------|-----------|--------|
| **Dev** | 1296511 | 62.72.3.35 | divestreams-dev | :dev | dev.divestreams.com |
| **Test** | 1271895 | 76.13.28.28 | divestreams-test | :test | test.divestreams.com |
| **Production** | 1239852 | 72.62.166.128 | divestreams-prod | :latest | divestreams.com |

VPS IDs are stored as GitHub environment variables (`DEV_VPS_ID`, `TEST_VPS_ID`, `PROD_VPS_ID`).

**Containers (Test & Production):**
| Container | Image | Purpose |
|-----------|-------|---------|
| app | ghcr.io/shooter51/divestreams-app | Main React Router application (port 3000 internal) |
| worker | ghcr.io/shooter51/divestreams-app | Background job processor |
| zapier-worker | ghcr.io/shooter51/divestreams-app | Zapier integration worker |
| db | postgres:16-alpine | PostgreSQL database |
| redis | redis:7-alpine | Redis cache/queue |
| caddy | caddy:2-alpine | Reverse proxy with SSL (ports 80/443) |

### Dev VPS - Multi-Instance Architecture

The Dev VPS supports multiple simultaneous DiveStreams instances for AI agent use. Each instance is fully isolated with its own app, worker, database, and Redis.

**Instance Management (run on Dev VPS):**
```bash
scripts/dev-instance.sh create <name> [--tag <image-tag>]  # Create instance
scripts/dev-instance.sh destroy <name>                      # Destroy instance
scripts/dev-instance.sh list                                # List all instances
scripts/dev-instance.sh logs <name> [--follow]              # View logs
scripts/dev-instance.sh status <name>                       # Show status
scripts/dev-instance.sh pull [--tag <image-tag>]            # Pull latest image
```

**Examples:**
```bash
scripts/dev-instance.sh create default                     # Default instance at default.dev.divestreams.com
scripts/dev-instance.sh create feature-dark-mode --tag dev-abc123  # Specific commit
scripts/dev-instance.sh destroy feature-dark-mode          # Clean up when done
```

Max ~8 simultaneous instances (depends on VPS RAM).

### Docker Compose Files

| File | Environment | Usage |
|------|-------------|-------|
| `docker-compose.prod.yml` | Production VPS | Pre-built `:latest` image |
| `docker-compose.test.yml` | Test VPS | Pre-built `:test` image |
| `docker-compose.dev-vps.yml` | Dev VPS | Parameterized template for multi-instance |
| `docker-compose.yml` | Local | Builds from Dockerfile |
| `docker-compose.dev.yml` | Local | Infrastructure only (postgres, redis, minio) |

### Caddyfiles

| File | Environment | Purpose |
|------|-------------|---------|
| `Caddyfile` | Production | Handles `divestreams.com` + `*.divestreams.com` with on-demand TLS |
| `Caddyfile.test` | Test VPS | Handles `test.divestreams.com` + `*.test.divestreams.com` |
| `Caddyfile.dev` | Dev VPS | System-level Caddy, routes `*.dev.divestreams.com` to instances |

### Check Deployment Status
```bash
# Check CI/CD pipeline status
gh run list --limit 5
gh run view <run-id>
```

### Database Migrations
Migrations run automatically on container startup via `scripts/docker-entrypoint.sh`.

**How it works:**
1. Container waits for PostgreSQL to be ready
2. Runs migrations via `scripts/run-migrations.mjs`
3. Optionally sets up platform admin (if env vars set)
4. Starts the application

**To add new migrations:**
1. Update schema in `lib/db/schema/` files
2. Run `npm run db:generate` locally to generate migration SQL
3. Rebuild and deploy the Docker image
4. Migrations will run on next container restart

### Fresh Deployment
Use `mcp__hostinger-mcp__VPS_createNewProjectV1` with the appropriate docker-compose file:
- Production: `docker-compose.prod.yml`
- Test: `docker-compose.test.yml`
- Dev: `docker-compose.dev-vps.yml` (managed via `scripts/dev-instance.sh`)

### VPS Docker Auth (Emergency Only)
All VPSs must be authenticated with GHCR. If auth expires (unauthorized errors in logs):
```bash
# Re-authenticate on any VPS
echo "<GITHUB_PAT>" | docker login ghcr.io -u shooter51 --password-stdin
```

### Git Remotes
- **origin**: `https://github.com/shooter51/divestreams-v2.git`

### Branch Strategy
- `develop` → Dev VPS (AI agent work)
- `staging` → Test VPS (human QA)
- `main` → Production (live)

### Environment Variables
Set in `.env` files on each VPS:
- `DB_PASSWORD` - PostgreSQL password
- `REDIS_PASSWORD` - Redis password
- `AUTH_SECRET` - Session signing secret
- `AUTH_URL` / `APP_URL` - Environment-specific URLs
- `ADMIN_PASSWORD` - Admin panel password
- `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` - Platform admin setup
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - Stripe integration (test keys for Test, live for Prod)
- `SMTP_*` - Email configuration
- `B2_ENDPOINT` / `B2_REGION` / `B2_BUCKET` / `B2_KEY_ID` / `B2_APP_KEY` - Object storage
- `CDN_URL` - CDN URL for images

### GitHub Repository Configuration
**Environments:** `dev`, `test`, `production`
**Environment Variables:** `DEV_VPS_ID`, `TEST_VPS_ID`, `PROD_VPS_ID`, `TEST_VPS_IP`
**Secrets:** `HOSTINGER_API_TOKEN`, `TEST_VPS_SSH_KEY` (environment-level)

### Check VPS Status (Monitoring Only)
```
# Dev VPS
mcp__hostinger-mcp__VPS_getProjectContainersV1(virtualMachineId: 1296511, projectName: "divestreams-dev")
mcp__hostinger-mcp__VPS_getProjectLogsV1(virtualMachineId: 1296511, projectName: "divestreams-dev")

# Test VPS
mcp__hostinger-mcp__VPS_getProjectContainersV1(virtualMachineId: 1271895, projectName: "divestreams-test")
mcp__hostinger-mcp__VPS_getProjectLogsV1(virtualMachineId: 1271895, projectName: "divestreams-test")

# Production VPS
mcp__hostinger-mcp__VPS_getProjectContainersV1(virtualMachineId: 1239852, projectName: "divestreams-prod")
mcp__hostinger-mcp__VPS_getProjectLogsV1(virtualMachineId: 1239852, projectName: "divestreams-prod")
```

**DO NOT use `VPS_updateProjectV1` directly - always deploy via CI/CD pipeline (git push).**

## Tech Stack
- **Framework**: React Router v7 (Remix-style)
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Cache/Queue**: Redis 7
- **Styling**: Tailwind CSS
- **Testing**: Vitest + Playwright (80 E2E workflow tests)
- **Reverse Proxy**: Caddy (auto SSL)
- **CI/CD**: GitHub Actions

## Multi-Tenant Architecture
- **PUBLIC schema with organization_id filtering** for data isolation
- Tenant resolution via subdomain (`demo.divestreams.com`)
- Central `public` schema for tenants table and subscription plans
- Each table has `organization_id` column for query-level filtering
- **Note:** `tenant_*` schemas exist but are not used in application queries

### Database Migrations
- All business tables belong in PUBLIC schema
- Use `organization_id` for multi-tenant filtering
- Never use `tenant_*` schemas in application code
- See `getTenantDb()` in `lib/db/tenant.server.ts` for implementation details
- Migrations run automatically on container startup via `scripts/docker-entrypoint.sh`

## Useful Commands

### Local Development
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm test             # Run all tests
npm run test:unit    # Unit tests only
npm run typecheck    # TypeScript check
```

### Database
```bash
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:studio    # Drizzle Studio
```
