# DiveStreams v2 - Claude Code Configuration

## Project Overview
Multi-tenant SaaS platform for dive shop and dive tour management. Built with React Router v7, PostgreSQL (multi-tenant with schema-per-tenant), Redis, and Caddy.

## Deployment

### VPS Details
- **Provider**: Hostinger VPS
- **VPS ID**: 1239852
- **IP Address**: 72.62.166.128
- **Hostname**: srv1239852.hstgr.cloud
- **OS**: Ubuntu 24.04 LTS
- **Plan**: KVM 4 (4 CPUs, 16GB RAM, 200GB disk)

### Docker Compose Project
- **Project Name**: `divestreams-v2`
- **Location on VPS**: `/docker/divestreams-v2/docker-compose.yml`

**Containers:**
| Container | Image | Purpose |
|-----------|-------|---------|
| divestreams-app | divestreams-v2-app | Main React Router application (port 3000 internal) |
| divestreams-worker | divestreams-v2-worker | Background job processor |
| divestreams-db | postgres:16-alpine | PostgreSQL database |
| divestreams-redis | redis:7-alpine | Redis cache/queue |
| divestreams-caddy | divestreams-v2-caddy | Reverse proxy with SSL (ports 80/443) |

### Deployment Process
**IMPORTANT: Always follow these steps in order:**

1. **Build Docker image for linux/amd64:**
   ```bash
   docker buildx build --platform linux/amd64 -t ghcr.io/shooter51/divestreams-app:latest --push .
   ```

2. **Push is automatic with --push flag above.** If needed separately:
   ```bash
   gh auth token | docker login ghcr.io -u shooter51 --password-stdin
   docker push ghcr.io/shooter51/divestreams-app:latest
   ```

3. **Deploy from registry to VPS:**
   ```
   mcp__hostinger-mcp__VPS_updateProjectV1(virtualMachineId: 1239852, projectName: "divestreams-v2")
   ```
   Or for fresh deployment, use createNewProjectV1 with inline docker-compose YAML that references:
   `image: ghcr.io/shooter51/divestreams-app:latest`

**Note:** VPS has Docker logged into GHCR. If auth expires, SSH in and run:
```bash
ssh root@72.62.166.128
echo "TOKEN" | docker login ghcr.io -u shooter51 --password-stdin
```

### Git Remotes
- **origin**: `git@github-tommie:tommiePinball/divestreams-v2.git` (SSH)
- **shooter51**: `https://github.com/shooter51/divestreams-v2.git` (HTTPS)

Use `shooter51` remote for deployment (public HTTPS URL works with Hostinger).

### Environment Variables (Production)
Set in `/docker/divestreams-v2/.env` on VPS:
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
- **Testing**: Vitest (312 tests)
- **Reverse Proxy**: Caddy (auto SSL)

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

### Check VPS Status
```
mcp__hostinger-mcp__VPS_getProjectListV1(virtualMachineId: 1239852)
mcp__hostinger-mcp__VPS_getProjectContainersV1(virtualMachineId: 1239852, projectName: "divestreams-v2")
mcp__hostinger-mcp__VPS_getProjectLogsV1(virtualMachineId: 1239852, projectName: "divestreams-v2")
```
