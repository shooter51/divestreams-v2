# CI/CD Pipeline Design for DiveStreams v2

**Date:** 2026-01-14
**Status:** Approved

## Overview

Two-environment CI/CD pipeline using GitHub Actions with branch-based deployments to Hostinger VPSs.

## Infrastructure

| Environment | VPS ID | IP Address | Hostname | Domain |
|-------------|--------|------------|----------|--------|
| Staging | 1271895 | 76.13.28.28 | srv1271895.hstgr.cloud | staging.divestreams.com |
| Production | 1239852 | 72.62.166.128 | srv1239852.hstgr.cloud | divestreams.com |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│                    (tommiePinball/divestreams-v2)                │
└─────────────────────┬───────────────────────┬───────────────────┘
                      │                       │
              push to staging           merge PR to main
                      │                       │
                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Actions CI/CD                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Lint → Typecheck → Unit Tests → E2E Tests → Build      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                    Build Docker Image                            │
│                    Push to GHCR                                  │
└─────────────────────┬───────────────────────┬───────────────────┘
                      │                       │
                      ▼                       ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   STAGING VPS (1271895)  │     │  PRODUCTION VPS (1239852) │
│   76.13.28.28            │     │   72.62.166.128          │
│   ─────────────────────  │     │   ─────────────────────  │
│   • staging.divestreams  │     │   • divestreams.com      │
│   • Isolated PostgreSQL  │     │   • Isolated PostgreSQL  │
│   • Redis                │     │   • Redis                │
│   • Caddy (SSL)          │     │   • Caddy (SSL)          │
└─────────────────────────┘     └─────────────────────────┘
```

## Deployment Flow

### Branch Strategy

- **`staging` branch:** Direct pushes allowed. Deploys to staging VPS.
- **`main` branch:** Protected. Requires PR with all checks passing. Deploys to production VPS.

### Branch Protection Rules for `main`

- Require pull request before merging
- Require status checks to pass: `test`, `e2e`, `build`
- Require branches to be up to date before merging
- No direct pushes allowed

### Image Tagging

- `staging` branch builds → `ghcr.io/shooter51/divestreams-app:staging`
- `main` branch builds → `ghcr.io/shooter51/divestreams-app:latest`

## Pipeline Stages

```
┌──────────┐    ┌─────────┐
│   test   │    │   e2e   │   ← Run in parallel (~4-5 min)
└────┬─────┘    └────┬────┘
     │               │
     └───────┬───────┘
             ▼
        ┌─────────┐
        │  build  │              ← ~2-3 min
        └────┬────┘
             ▼
        ┌─────────┐
        │ deploy  │              ← ~1 min
        └────┬────┘
             ▼
      ┌────────────┐
      │ smoke-test │             ← Only on staging (~2 min)
      └────────────┘

Total: ~8-10 minutes
```

### Stage Details

1. **test** - Lint, typecheck, unit tests (769 tests), integration tests
2. **e2e** - Playwright E2E tests against test server in CI
3. **build** - Build Docker image, push to GHCR with appropriate tag
4. **deploy** - Trigger Hostinger API to pull and restart containers
5. **smoke-test** - Run E2E smoke tests against live staging URL (staging only)

## GitHub Actions Workflow

File: `.github/workflows/deploy.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: shooter51/divestreams-app

jobs:
  # ─────────────────────────────────────────────
  # Unit & Integration Tests
  # ─────────────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --run

  # ─────────────────────────────────────────────
  # E2E Tests (in CI, before deploy)
  # ─────────────────────────────────────────────
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: divestreams_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/divestreams_test
          REDIS_URL: redis://localhost:6379
          AUTH_SECRET: test-secret
          APP_URL: http://localhost:5173

  # ─────────────────────────────────────────────
  # Build Docker Image
  # ─────────────────────────────────────────────
  build:
    needs: [test, e2e]
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - id: meta
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "tag=latest" >> $GITHUB_OUTPUT
          else
            echo "tag=staging" >> $GITHUB_OUTPUT
          fi
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.tag }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─────────────────────────────────────────────
  # Deploy
  # ─────────────────────────────────────────────
  deploy:
    needs: build
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.env.outputs.name }}
    steps:
      - id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "name=production" >> $GITHUB_OUTPUT
          else
            echo "name=staging" >> $GITHUB_OUTPUT
          fi
      - name: Deploy to Staging
        if: github.ref == 'refs/heads/staging'
        run: |
          curl -X POST "https://api.hostinger.com/v1/vps/1271895/projects/divestreams-staging/update" \
            -H "Authorization: Bearer ${{ secrets.HOSTINGER_API_TOKEN }}"
      - name: Deploy to Production
        if: github.ref == 'refs/heads/main'
        run: |
          curl -X POST "https://api.hostinger.com/v1/vps/1239852/projects/divestreams-v2/update" \
            -H "Authorization: Bearer ${{ secrets.HOSTINGER_API_TOKEN }}"
      - name: Wait for deployment
        run: sleep 30

  # ─────────────────────────────────────────────
  # Smoke Tests (against live staging)
  # ─────────────────────────────────────────────
  smoke-test:
    needs: deploy
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run smoke tests against staging
        run: npm run test:e2e:smoke
        env:
          BASE_URL: https://staging.divestreams.com
```

## Secrets Required

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Built-in, used for GHCR push |
| `HOSTINGER_API_TOKEN` | Trigger deployments via Hostinger API |

## Environment Variables

### Staging (VPS 1271895)

```env
NODE_ENV=staging
DATABASE_URL=postgresql://divestreams:${DB_PASSWORD}@postgres:5432/divestreams
REDIS_URL=redis://redis:6379
AUTH_SECRET=${AUTH_SECRET}
AUTH_URL=https://staging.divestreams.com
APP_URL=https://staging.divestreams.com
# Use test API keys for third-party services
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### Production (VPS 1239852)

```env
NODE_ENV=production
DATABASE_URL=postgresql://divestreams:${DB_PASSWORD}@postgres:5432/divestreams
REDIS_URL=redis://redis:6379
AUTH_SECRET=${AUTH_SECRET}
AUTH_URL=https://divestreams.com
APP_URL=https://divestreams.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Staging Docker Compose

Project: `divestreams-staging`
Location: `/docker/divestreams-staging/docker-compose.yml`

```yaml
services:
  app:
    image: ghcr.io/shooter51/divestreams-app:staging
    container_name: divestreams-staging-app
    restart: unless-stopped
    environment:
      - NODE_ENV=staging
      - PORT=3000
      - DATABASE_URL=postgresql://divestreams:${DB_PASSWORD:-staging_pass}@postgres:5432/divestreams
      - REDIS_URL=redis://redis:6379
      - AUTH_SECRET=${AUTH_SECRET}
      - AUTH_URL=https://staging.divestreams.com
      - APP_URL=https://staging.divestreams.com
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - staging-network

  postgres:
    image: postgres:16-alpine
    container_name: divestreams-staging-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: divestreams
      POSTGRES_PASSWORD: ${DB_PASSWORD:-staging_pass}
      POSTGRES_DB: divestreams
    volumes:
      - staging_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U divestreams"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - staging-network

  redis:
    image: redis:7-alpine
    container_name: divestreams-staging-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - staging_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - staging-network

  caddy:
    image: caddy:2-alpine
    container_name: divestreams-staging-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - staging_caddy_data:/data
      - staging_caddy_config:/config
    command: caddy reverse-proxy --from staging.divestreams.com --to app:3000
    depends_on:
      - app
    networks:
      - staging-network

networks:
  staging-network:
    driver: bridge

volumes:
  staging_postgres_data:
  staging_redis_data:
  staging_caddy_data:
  staging_caddy_config:
```

## Implementation Steps

### 1. Prepare Staging VPS (one-time)

```bash
ssh root@76.13.28.28

# Authenticate Docker with GHCR
gh auth token | docker login ghcr.io -u shooter51 --password-stdin

# Create project directory
mkdir -p /docker/divestreams-staging
```

### 2. Deploy Staging Docker Compose Project

Use Hostinger MCP to create the `divestreams-staging` project on VPS 1271895.

### 3. Configure DNS

Add A record: `staging.divestreams.com` → `76.13.28.28`

### 4. Set Up GitHub Repository

1. Add secret: `HOSTINGER_API_TOKEN`
2. Create `.github/workflows/deploy.yml` (contents above)
3. Configure branch protection for `main`:
   - Require pull request
   - Require status checks: `test`, `e2e`
   - Require up-to-date branches

### 5. Create Staging Branch

```bash
git checkout -b staging
git push -u origin staging
```

### 6. Test the Pipeline

1. Push to `staging` → Verify staging deployment
2. Create PR to `main` → Verify checks run
3. Merge PR → Verify production deployment

## Rollback Procedure

If a deployment fails or introduces bugs:

### Staging
```bash
# Revert to previous commit
git checkout staging
git revert HEAD
git push origin staging
```

### Production
```bash
# Revert merge commit
git checkout main
git revert -m 1 HEAD
git push origin main
```

Or manually deploy previous image:
```bash
ssh root@72.62.166.128
cd /docker/divestreams-v2
docker compose pull  # Will get previous :latest if reverted
docker compose up -d
```

## Monitoring

- **GitHub Actions:** Check workflow runs at `https://github.com/tommiePinball/divestreams-v2/actions`
- **Staging logs:** `docker logs divestreams-staging-app` on VPS 1271895
- **Production logs:** `docker logs divestreams-app` on VPS 1239852
- **Hostinger:** Use MCP tools to check project status
