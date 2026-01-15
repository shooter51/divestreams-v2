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
| divestreams-app | ghcr.io/shooter51/divestreams-app:latest | Main React Router application (port 3000 internal) |
| divestreams-db | postgres:16-alpine | PostgreSQL database |
| divestreams-redis | redis:7-alpine | Redis cache/queue |
| divestreams-caddy | caddy:2-alpine | Reverse proxy with SSL (ports 80/443) |

### Deployment Process
**IMPORTANT: Always follow these steps in order:**

1. **Build Docker image for linux/amd64 and push:**
   ```bash
   docker buildx build --platform linux/amd64 -t ghcr.io/shooter51/divestreams-app:latest --push .
   ```

2. **Deploy to VPS:**
   ```
   mcp__hostinger-mcp__VPS_updateProjectV1(virtualMachineId: 1239852, projectName: "divestreams-v2")
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

### VPS Docker Auth
VPS has Docker logged into GHCR. If auth expires, SSH in and run:
```bash
ssh root@72.62.166.128
gh auth token | docker login ghcr.io -u shooter51 --password-stdin
```

### Git Remotes
- **origin**: `https://github.com/shooter51/divestreams-v2.git` (HTTPS - primary)
- **shooter51**: `https://github.com/shooter51/divestreams-v2.git` (HTTPS - alias)

Use `origin` or `shooter51` remote for deployment.

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
