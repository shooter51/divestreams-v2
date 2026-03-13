# DiveStreams v2 - Claude Code Configuration

## Project Overview
Multi-tenant SaaS platform for dive shop and dive tour management. Built with React Router v7, PostgreSQL (multi-tenant with schema-per-tenant), Redis, and Caddy.

## Directory Structure
**IMPORTANT: Follow the directory structure policy when creating or organizing files.**

- **Policy**: See `docs/policies/directory-structure-policy.md` for full details
- **Quick Reference**: See `docs/guides/directory-structure-quick-reference.md`
- **Validation**: Run `npm run validate:structure` before commits
- **Key Rules**:
  - Root directory: Config files only (no documentation)
  - Documentation: Organized in `docs/` subdirectories
  - File naming: Use kebab-case (e.g., `stripe-setup.md`)
  - Tests: Mirror the structure of code they test

## Defect Tracking — Beads Task Tracker

**IMPORTANT: Use `bd` (beads) CLI for defect tracking. Do NOT use vibe-kanban.**

Beads is backed by Dolt SQL server (auto-starts via launchd on login). Issue prefix: `DS`.
`docs/defects.md` is kept as a human-readable summary but beads is the source of truth.

### Defect Repair Workflow

When a defect is found during development or testing:

1. **Create Defect Issue**
   ```bash
   bd create "Short description" --label bug --label medium --body "Steps to reproduce, expected vs actual"
   ```

2. **Fix the Defect**
   - Fix the issue
   - Ensure all unit tests pass: `npm test -- --run`
   - Run lint and typecheck: `npm run lint && npm run typecheck`

3. **Close the Issue**
   ```bash
   bd update DS-xxxx --status done
   ```

4. **Update docs/defects.md** — mark the row as Fixed with brief notes

### Key beads commands

```bash
bd list                                          # Show all open issues
bd create "title" --label bug --label medium \
  --body "description"                           # Create issue
bd show DS-p1h                                   # View issue details
bd update DS-p1h --status done                   # Close issue
bd dolt test                                     # Verify Dolt connection
```

### Severity labels
- `critical` — Production blocking, data loss, security
- `high` — Major functionality broken, no workaround
- `medium` — Functionality broken but workaround exists
- `low` — Minor issues, cosmetic bugs, edge cases

### If Dolt server is not running
```bash
launchctl start com.dolt.sql-server
```

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

# Check test status for your issue
npm run vibe:check -- --issue=DIVE-1234

# Run tests with coverage
npm run test:coverage

# Enforce coverage thresholds
npm run coverage:enforce
```

### Enforcement Points

1. **Pre-commit hook** - Validates tests exist and pass
2. **CI/CD pipeline** - Blocks deployment if coverage insufficient
3. **Pull requests** - Requires coverage thresholds met
4. **Vibe Kanban** - Tracks test completion per issue

### Complete Documentation

See [TESTING.md](./docs/guides/testing.md) for:
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
- [ ] Vibe issue marked complete

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

# Check test status for your issue
npm run vibe:check -- --issue=DIVE-1234

# Run tests with coverage
npm run test:coverage

# Enforce coverage thresholds
npm run coverage:enforce
```

### Enforcement Points

1. **Pre-commit hook** - Validates tests exist and pass
2. **CI/CD pipeline** - Blocks deployment if coverage insufficient
3. **Pull requests** - Requires coverage thresholds met
4. **Vibe Kanban** - Tracks test completion per issue

### Complete Documentation

See [TESTING.md](./docs/guides/testing.md) for:
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
- [ ] Vibe issue marked complete

## Deployment

### CI/CD Pipeline - THE ONLY WAY TO DEPLOY
**IMPORTANT: NEVER deploy directly. ALWAYS use the CI/CD pipeline via git push.**

```
Feature PR → develop     ci.yml: lint + typecheck + unit + integration (DB service container) + build check → auto-merge
Push to develop          promote.yml: auto-create PR develop→test with auto-merge
PR to test               ci.yml: same checks → auto-merge
Push to test             deploy-test.yml: build :test → deploy Test VPS → E2E against test.divestreams.com
Manual PR test→main      No automated tests (Tom reviews on test.divestreams.com)
Push to main             deploy-prod.yml: retag :test→:latest → deploy Production VPS
```

### Two Environments

| Environment | Purpose | Users |
|-------------|---------|-------|
| **Test** | QA - manual product testing, feedback, CI/CD integration tests. | Tom, QA team, AI agents |
| **Production** | Live production environment. | End users |

### Auto-Promotion Pipeline

The pipeline is fully automated from feature PR to test, with a manual gate at production.

**1. Feature PR → develop** (developer action)
- Open PR targeting `develop`
- `ci.yml` runs: lint, typecheck, unit tests, integration tests (DB service container), Docker build check
- Branch protection requires `test` check to pass
- Auto-merge enabled on pass

**2. develop → test** (automatic)
- `promote.yml` auto-creates PR `develop → test` with auto-merge enabled
- `ci.yml` runs same checks on test PR
- Auto-merge fires when checks pass

**3. test → main** (manual)
- Tom creates PR `test → main` after QA on test.divestreams.com
- No automated checks required — Tom reviews and merges

**4. main → production** (automatic)
- `deploy-prod.yml` retags `:test` → `:latest`, deploys to Production VPS

### VPS Infrastructure

| VPS | Role | VPS ID | Public IP | Tailscale IP | Docker Project | Image Tag | Domain |
|-----|------|--------|-----------|--------------|----------------|-----------|--------|
| **Production** | App | 1296511 | 62.72.3.35 | 100.109.71.112 | divestreams-prod | :latest | divestreams.com |
| **Test** | App | 1271895 | 76.13.28.28 | 100.112.155.18 | divestreams-test | :test | test.divestreams.com |
| **Database** | PostgreSQL | 1239852 | 72.62.166.128 | 100.104.105.34 | divestreams-db | postgres:16-alpine | N/A |

All VPSs are on Tailscale (tailnet). DB connections use Tailscale IPs. Port 5432 on DB VPS is blocked from public access.

VPS IDs are stored as GitHub environment variables (`TEST_VPS_ID`, `PROD_VPS_ID`).

**App VPS Containers (Test & Production):**
| Container | Image | Purpose |
|-----------|-------|---------|
| app | ghcr.io/shooter51/divestreams-app | Main React Router application (port 3000 internal) |
| worker | ghcr.io/shooter51/divestreams-app | Background job processor |
| zapier-worker | ghcr.io/shooter51/divestreams-app | Zapier integration worker |
| redis | redis:7-alpine | Redis cache/queue |
| caddy | caddy:2-alpine | Reverse proxy with SSL (ports 80/443) |

**DB VPS Container:**
| Container | Image | Purpose |
|-----------|-------|---------|
| divestreams-db | postgres:16-alpine | Shared PostgreSQL (serves both test and production databases) |

### Docker Compose Files

| File | Environment | Usage |
|------|-------------|-------|
| `docker-compose.prod.yml` | Production VPS | Pre-built `:latest` image, no local DB |
| `docker-compose.test.yml` | Test VPS | Pre-built `:test` image, no local DB |
| `docker-compose.db.yml` | DB VPS | PostgreSQL-only, shared by test and prod |
| `docker-compose.yml` | Local | Builds from Dockerfile |

### Caddyfiles

| File | Environment | Purpose |
|------|-------------|---------|
| `Caddyfile` | Production | Handles `divestreams.com` + `*.divestreams.com` with on-demand TLS |
| `Caddyfile.test` | Test VPS | Handles `test.divestreams.com` + `*.test.divestreams.com` |

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
SSH into the relevant VPS and deploy using the appropriate docker-compose file:
- Production: `docker-compose.prod.yml`
- Test: `docker-compose.test.yml`
- Database VPS: `docker-compose.db.yml`

### VPS Docker Auth (Emergency Only)
All VPSs must be authenticated with GHCR. If auth expires (unauthorized errors in logs):
```bash
# Re-authenticate on any VPS
echo "<GITHUB_PAT>" | docker login ghcr.io -u shooter51 --password-stdin
```

### Git Remotes
- **origin**: `https://github.com/shooter51/divestreams-v2.git`

### Branch Strategy
- `develop` → CI only (no VPS deployment, auto-promotes to test)
- `test` → Test VPS (human QA)
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

**Protected branches:** `main`, `develop`, `test` (never deleted)

### Branch Protection Rules
All three branches are protected. Direct pushes are blocked — changes must go through PRs.

| Branch | Required CI Checks | PR Required | Approvals | Notes |
|--------|-------------------|-------------|-----------|-------|
| **develop** | `test` | Yes | 0 | Fast gate for AI agent work |
| **test** | `test` | Yes | 0 | Full gate, auto-merge from develop |
| **main** | None | Yes | 1 (Tom) | Manual production gate |

**All CI gates are enforced.** Lint errors, type errors, and test failures will block deployment.

### AI Agent Workflow (Vibe Coding)
```
1. Agent creates feature branch and opens PR to develop
2. ci.yml runs: lint, typecheck, unit, integration, build check → auto-merge
3. promote.yml: auto-create PR develop→test → ci.yml runs → auto-merge
4. deploy-test.yml: build :test + deploy Test → E2E runs (non-blocking)
5. Tom creates PR test→main, reviews on test.divestreams.com → merges
6. deploy-prod.yml: retag :test→:latest → deploy Production
```

### Auto-Promotion Prerequisites
Before the auto-promotion pipeline works, these GitHub settings must be configured:

1. **PROMOTION_PAT secret** — Fine-grained PAT with Contents + Pull Requests read/write
2. **Auto-merge enabled** — Settings → General → Pull Requests → Allow auto-merge
3. **Main branch requires 1 approval** — Settings → Branches → main → Required approving reviews: 1
4. **Labels** — `auto-promotion` label created for auto-promotion PRs

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
- `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` - Object storage
- `CDN_URL` - CDN URL for images

### GitHub Repository Configuration
**Environments:** `test`, `production`
**Environment Variables:** `TEST_VPS_ID`, `PROD_VPS_ID`, `TEST_VPS_IP`, `PROD_VPS_IP`, `DB_VPS_IP`, `PLATFORM_ADMIN_NAME`
**Secrets:** `HOSTINGER_API_TOKEN`, `VPS_SSH_KEY`, all app secrets (environment-level), `PROMOTION_PAT`, `HOSTINGER_API_TOKEN` (repo-level)

### Check VPS Status (Monitoring Only)
```bash
# Production VPS
ssh root@62.72.3.35 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# Test VPS
ssh root@76.13.28.28 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# DB VPS
ssh root@72.62.166.128 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

## Tech Stack
- **Framework**: React Router v7 (Remix-style)
- **Database**: PostgreSQL 16 with Drizzle ORM
- **Cache/Queue**: Redis 7
- **Styling**: Tailwind CSS
- **Testing**: Vitest + Playwright (80 E2E workflow tests)
- **Reverse Proxy**: Caddy (auto SSL)
- **CI/CD**: GitHub Actions
- **Private Networking**: Tailscale (VPS-to-VPS communication)

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

## Demo Data Seeding Policy — API-First Approach

The SQL seed file at `scripts/sql/demo-seed.sql` is the source of truth for demo data.
It is ALWAYS generated by the API seed pipeline. **Never edit it manually.**

### Pipeline
1. `npm run seed:api` — seeds demo.test.divestreams.com via HTTP form actions
2. `npm run seed:export` — exports the DB to scripts/sql/demo-seed.sql
3. Commit both the updated seed scripts AND the regenerated SQL

### When to Regenerate
Re-run `npm run seed:full` on any commit that:
- Adds or modifies a database migration (lib/db/schema/ or scripts/migrations/)
- Changes a form action endpoint for tours, trips, courses, sessions, equipment, bookings, customers
- Modifies field names, required fields, or validation rules on those actions
- Adds new entity types that should appear in the demo

### Why API-First
Seeding via HTTP actions guarantees:
- All validation runs (catches schema mismatches early)
- All side effects fire (emails, notifications, audit logs)
- The seed data is provably loadable by the real application
- The SQL export is identical to what the app produces
