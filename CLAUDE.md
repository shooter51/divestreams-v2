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
│   staging   │───▶│  Tests +    │───▶│   Build &   │───▶│   Deploy    │
│   branch    │    │  E2E (80)   │    │   Docker    │    │   Staging   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
┌─────────────┐                                         ┌─────────────┐
│    main     │────────────────────────────────────────▶│   Deploy    │
│   branch    │         (retag staging→latest)          │ Production  │
└─────────────┘                                         └─────────────┘
```

### Deployment Workflow

**To deploy to STAGING:**
```bash
git checkout staging
git merge <feature-branch>  # or commit changes directly
git push origin staging
```
This triggers: lint → typecheck → unit tests → E2E tests (80) → build Docker → deploy to staging VPS → smoke tests

**To deploy to PRODUCTION:**
```bash
git checkout main
git merge staging
git push origin main
```
This retags `ghcr.io/shooter51/divestreams-app:staging` → `:latest` and deploys to production VPS.

### VPS Infrastructure

| Environment | VPS ID | IP Address | Docker Project | Image Tag |
|-------------|--------|------------|----------------|-----------|
| **Production** | 1239852 | 72.62.166.128 | divestreams-v2 | :latest |
| **Staging** | 1271895 | 76.13.28.28 | divestreams-staging | :staging |

**Containers (both environments):**
| Container | Image | Purpose |
|-----------|-------|---------|
| divestreams-app | ghcr.io/shooter51/divestreams-app | Main React Router application (port 3000 internal) |
| divestreams-db | postgres:16-alpine | PostgreSQL database |
| divestreams-redis | redis:7-alpine | Redis cache/queue |
| divestreams-caddy | caddy:2-alpine | Reverse proxy with SSL (ports 80/443) |

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
2. Checks if schema exists (looks for `user` table)
3. If not, runs all SQL files from `/drizzle` directory
4. Then starts the application

**To add new migrations:**
1. Update schema in `lib/db/schema/` files
2. Run `npm run db:generate` locally to generate migration SQL
3. Rebuild and deploy the Docker image
4. Migrations will run on next container restart

### Fresh Deployment (if project doesn't exist)
Use `mcp__hostinger-mcp__VPS_createNewProjectV1` with this docker-compose YAML:

```yaml
services:
  app:
    image: ghcr.io/shooter51/divestreams-app:latest
    container_name: divestreams-app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://divestreams:${DB_PASSWORD:-divestreams_prod}@postgres:5432/divestreams
      - REDIS_URL=redis://redis:6379
      - AUTH_SECRET=${AUTH_SECRET}
      - AUTH_URL=https://divestreams.com
      - APP_URL=https://divestreams.com
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-DiveAdmin2024!}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - divestreams-network

  postgres:
    image: postgres:16-alpine
    container_name: divestreams-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: divestreams
      POSTGRES_PASSWORD: ${DB_PASSWORD:-divestreams_prod}
      POSTGRES_DB: divestreams
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U divestreams"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - divestreams-network

  redis:
    image: redis:7-alpine
    container_name: divestreams-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - divestreams-network

  caddy:
    image: caddy:2-alpine
    container_name: divestreams-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    command: caddy reverse-proxy --from divestreams.com --to app:3000
    depends_on:
      - app
    networks:
      - divestreams-network

networks:
  divestreams-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

**Environment variables to pass:**
```
AUTH_SECRET=divestreams-prod-secret-key-2024
DB_PASSWORD=divestreams_prod
NODE_ENV=production
ADMIN_PASSWORD=DiveAdmin2024!
```

### VPS Docker Auth (Emergency Only)
Both VPSs are authenticated with GHCR. If auth expires (unauthorized errors in logs), SSH in and copy config from production:
```bash
# Production → Staging auth sync
ssh root@72.62.166.128 "cat /root/.docker/config.json" | ssh root@76.13.28.28 "mkdir -p /root/.docker && cat > /root/.docker/config.json"
```

### Git Remotes
- **origin**: `https://github.com/shooter51/divestreams-v2.git`

### Environment Variables
Set in `.env` files on each VPS (`/docker/divestreams-v2/.env` or `/docker/divestreams-staging/.env`):
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `AUTH_SECRET` - Session signing secret
- `ADMIN_PASSWORD` - Admin panel password
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` - Stripe integration
- `SMTP_*` - Email configuration

## Tech Stack
- **Framework**: React Router v7 (Remix-style)
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Cache/Queue**: Redis 7
- **Styling**: Tailwind CSS
- **Testing**: Vitest + Playwright (80 E2E workflow tests)
- **Reverse Proxy**: Caddy (auto SSL)
- **CI/CD**: GitHub Actions

## Multi-Tenant Architecture
- Schema-per-tenant isolation (`tenant_<subdomain>`)
- Tenant resolution via subdomain (`demo.divestreams.com`)
- Central `public` schema for tenants table and subscription plans

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

### Check VPS Status (Monitoring Only)
```
# Production (VPS 1239852)
mcp__hostinger-mcp__VPS_getProjectContainersV1(virtualMachineId: 1239852, projectName: "divestreams-v2")
mcp__hostinger-mcp__VPS_getProjectLogsV1(virtualMachineId: 1239852, projectName: "divestreams-v2")

# Staging (VPS 1271895)
mcp__hostinger-mcp__VPS_getProjectContainersV1(virtualMachineId: 1271895, projectName: "divestreams-staging")
mcp__hostinger-mcp__VPS_getProjectLogsV1(virtualMachineId: 1271895, projectName: "divestreams-staging")
```

**DO NOT use `VPS_updateProjectV1` directly - always deploy via CI/CD pipeline (git push).**
