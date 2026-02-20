# DiveStreams v2 - Claude Code Configuration

## Project Overview
Multi-tenant SaaS platform for dive shop and dive tour management. Built with React Router v7, PostgreSQL (multi-tenant with schema-per-tenant), Redis, and Caddy.

## Directory Structure
**IMPORTANT: Follow the directory structure policy when creating or organizing files.**

- **Policy**: See `DIRECTORY_STRUCTURE_POLICY.md` for full details
- **Quick Reference**: See `docs/guides/directory-structure-quick-reference.md`
- **Validation**: Run `npm run validate:structure` before commits
- **Key Rules**:
  - Root directory: Config files only (no documentation)
  - Documentation: Organized in `docs/` subdirectories
  - File naming: Use kebab-case (e.g., `stripe-setup.md`)
  - Tests: Mirror the structure of code they test

## Code Coverage & Testing - REQUIRED FOR ALL FEATURES

**CRITICAL: No feature is complete until it has comprehensive test coverage.**

### Coverage Requirements

Every feature MUST have:
- ✅ **Unit tests** (70% coverage minimum)
- ✅ **Integration tests** (75% coverage minimum)
- ✅ **E2E workflow tests** (60% coverage minimum)
- ✅ **Pact contract tests** (for API routes, 100% coverage)
- ✅ **Combined coverage** (80% minimum)

### Quick Start

```bash
# Generate test scaffolding for a feature
npm run test:scaffold -- --file=app/routes/tenant/boats.tsx

# Run tests with coverage
npm run test:coverage

# Enforce coverage thresholds
npm run coverage:enforce
```

### Enforcement Points

1. **Pre-commit hook** - Validates tests exist and pass
2. **CI/CD pipeline** - Blocks deployment if coverage insufficient
3. **Pull requests** - Requires coverage thresholds met

### Complete Documentation

See [TESTING.md](./TESTING.md) for:
- Detailed testing workflow
- Test type requirements
- Coverage configuration
- Troubleshooting guide
- Best practices

**Feature Definition of Done:**
- [ ] All test types implemented
- [ ] Coverage thresholds met
- [ ] Pre-commit hook passes
- [ ] CI/CD pipeline passes

## Deployment

### CI/CD Pipeline - THE ONLY WAY TO DEPLOY
**IMPORTANT: NEVER deploy directly. ALWAYS use the CI/CD pipeline via git push.**

```
Feature PR -> develop    ci.yml: lint + typecheck + unit ("test" check)
                         merge
develop push             deploy.yml: build :dev -> deploy Dev -> auto-create PR develop->staging
                         ci.yml: test + e2e -> auto-merge
staging push             deploy.yml: sanity -> build :test -> deploy Test -> smoke -> Release PR
                         Tom approves + merges
main push                deploy.yml: pact gate -> retag :test->:latest -> deploy Production
```

### Three Environments

| Environment | Purpose | Users |
|-------------|---------|-------|
| **Dev** | AI agent sandbox - remote development, feature testing, defect reproduction. Supports multiple simultaneous Docker instances. | AI agents |
| **Test** | Human QA - manual product testing, feedback, QA tasks. Stable always-on instance. | Tom, QA team |
| **Production** | Live production environment. | End users |

### Auto-Promotion Pipeline

The pipeline is fully automated from feature PR to production-ready, with a manual gate only at production.

**1. Feature PR → develop** (developer action)
- Open PR targeting `develop`
- `ci.yml` runs: lint, typecheck, unit tests, pact consumer
- Branch protection requires `test` check to pass
- Developer merges PR

**2. develop → staging** (automatic)
- `deploy.yml` builds `:dev` image, deploys to Dev VPS
- Auto-creates PR `develop → staging` with auto-merge enabled
- `ci.yml` runs on that PR: `test` + `e2e` (full suite)
- Auto-merge fires when checks pass

**3. staging → main** (automatic PR, manual merge)
- `deploy.yml` runs sanity check, builds `:test`, deploys to Test VPS, runs smoke tests
- Auto-creates Release PR `staging → main` with Tom as reviewer
- Tom tests on test.divestreams.com, approves, and merges

**4. main → production** (automatic)
- Pact can-i-deploy hard gate
- Retags `:test` → `:latest`, deploys to Production VPS

**End-to-end timing:** ~35-45 min from feature merge to "ready for production"

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

The Dev VPS supports multiple simultaneous DiveStreams instances for AI agent use. Shared `dev-postgres` and `dev-redis` containers provide infrastructure, while each instance gets its own app + worker containers and its own database within the shared PostgreSQL.

**Shared Infrastructure:**
- `dev-postgres` (port 5432) — shared PostgreSQL, each instance gets its own database (`ds_<name>`)
- `dev-redis` (port 6379) — shared Redis
- Started automatically on first `create`, or manually with `infra-up`

**Instance Management (run on Dev VPS):**
```bash
scripts/dev-instance.sh create <name> [--tag <image-tag>]  # Create instance
scripts/dev-instance.sh destroy <name>                      # Destroy instance
scripts/dev-instance.sh list                                # List all instances
scripts/dev-instance.sh logs <name> [--follow]              # View logs
scripts/dev-instance.sh status <name>                       # Show status
scripts/dev-instance.sh pull [--tag <image-tag>]            # Pull latest image
scripts/dev-instance.sh infra-up                            # Start shared postgres + redis
scripts/dev-instance.sh infra-down                          # Stop shared infra (no instances running)
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
| `docker-compose.dev-infra.yml` | Dev VPS | Shared postgres + redis infrastructure |
| `docker-compose.dev-vps.yml` | Dev VPS | Per-instance app + worker template |
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

### Branch Cleanup
**Automated cleanup of stale branches to keep the repository clean.**

**GitHub Action (Automatic):**
- Runs weekly on Sundays at 2 AM UTC
- Automatically deletes merged branches older than 30 days
- Reports on unmerged stale branches for manual review
- Manual trigger: Actions → "Cleanup Stale Branches" → Run workflow

**Local Script (Manual):**
```bash
# Preview what would be deleted (dry run)
./scripts/cleanup-branches.sh

# Preview with custom stale threshold
./scripts/cleanup-branches.sh --days 14

# Actually delete branches
./scripts/cleanup-branches.sh --live

# Delete with custom threshold
./scripts/cleanup-branches.sh --live --days 60
```

**What gets cleaned up:**
1. **Merged & stale** (30+ days): Automatically deleted (safe)
2. **Local-only branches**: Deleted if remote was already removed
3. **Unmerged & stale**: Reported for manual review (requires human decision)

**Protected branches:** `main`, `develop`, `staging` (never deleted)

### Branch Protection Rules
All three branches are protected. Direct pushes are blocked — changes must go through PRs.

| Branch | Required CI Checks | PR Required | Approvals | Notes |
|--------|-------------------|-------------|-----------|-------|
| **develop** | `test` | Yes | 0 | Fast gate for AI agent work |
| **staging** | `test` + `e2e` | Yes | 0 | Full gate, auto-merge from develop |
| **main** | `test` + `e2e` | Yes | 1 (Tom) | Manual production gate |

**All CI gates are enforced.** Lint errors, type errors, and test failures will block deployment.

### AI Agent Workflow
```
1. Agent creates feature branch and opens PR to develop
2. ci.yml runs test checks → merge PR
3. deploy.yml: build + deploy Dev → auto-create PR to staging (auto-merge)
4. ci.yml runs test + e2e on staging PR → auto-merge fires
5. deploy.yml: sanity + build + deploy Test → smoke tests → auto-create Release PR
6. Tom reviews on test.divestreams.com → approves + merges
7. deploy.yml: pact gate → retag → deploy Production
```

### Auto-Promotion Prerequisites
Before the auto-promotion pipeline works, these GitHub settings must be configured:

1. **PROMOTION_PAT secret** — Fine-grained PAT with Contents + Pull Requests read/write
2. **Auto-merge enabled** — Settings → General → Pull Requests → Allow auto-merge
3. **Main branch requires 1 approval** — Settings → Branches → main → Required approving reviews: 1
4. **Labels** — `auto-promotion` (green) and `release` (red) — created automatically on first run

### Checking CI Failures
```bash
# List recent CI runs
gh run list --limit 5

# View a specific run
gh run view <run-id>

# View failed job logs
gh run view <run-id> --log-failed

# Re-run failed jobs
gh run rerun <run-id> --failed
```

### Pre-Push Checklist (Run Before PR)
```bash
npm run lint         # Must have 0 errors (warnings OK)
npm run typecheck    # Must pass cleanly
npm test -- --run    # Must have 0 failures
```

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
**Secrets:** `HOSTINGER_API_TOKEN`, `TEST_VPS_SSH_KEY` (environment-level), `PROMOTION_PAT` (repo-level)

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
