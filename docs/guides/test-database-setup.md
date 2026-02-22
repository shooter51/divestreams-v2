# Test Database Setup

## Overview

This document describes the Docker-based test database infrastructure for running integration tests.

## Architecture

The test database setup uses Docker Compose to run isolated PostgreSQL and Redis containers for integration testing:

```
tests/integration/  ← Integration tests
        ↓
  .env.test        ← Test database connection config
        ↓
docker-compose.test-db.yml  ← PostgreSQL + Redis containers
        ↓
Database Migration Scripts  ← Create tables and seed data
```

## Quick Start

### 1. Start the Test Database

```bash
npm run test:db:start
```

This command will:
- Start PostgreSQL (port 5433) and Redis (port 6380) containers
- Wait for services to be healthy
- Run database migrations
- Seed test data (subscription plans, etc.)
- Display connection info

### 2. Run Integration Tests

```bash
npm run test:integration
```

### 3. Stop the Test Database

```bash
npm run test:db:stop
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run test:db:start` | Start database, run migrations, seed data |
| `npm run test:db:stop` | Stop and remove containers |
| `npm run test:db:restart` | Restart containers and run migrations |
| `npm run test:db:reset` | Full reset (stop, start, migrate, seed) |
| `npm run test:db:status` | Show container status and connection info |

## Test Database Configuration

### Connection Details

- **PostgreSQL**: `postgresql://test_user:test_password@localhost:5433/divestreams_test`
- **Redis**: `redis://localhost:6380`

These are configured in `.env.test`:

```bash
# Database
DATABASE_URL=postgresql://test_user:test_password@localhost:5433/divestreams_test

# Redis
REDIS_URL=redis://localhost:6380

# Auth
AUTH_SECRET=test-secret-key-for-testing-only
AUTH_URL=http://localhost:3000

# App
APP_URL=http://localhost:3000

# Stripe (test mode keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Docker Compose Services

The `docker-compose.test-db.yml` file defines two services:

#### PostgreSQL
- **Image**: `postgres:16-alpine`
- **Port**: 5433 (host) → 5432 (container)
- **Database**: `divestreams_test`
- **User**: `test_user`
- **Password**: `test_password`
- **Health Check**: `pg_isready` every 5 seconds

#### Redis
- **Image**: `redis:7-alpine`
- **Port**: 6380 (host) → 6379 (container)
- **Health Check**: `redis-cli ping` every 5 seconds

## Database Migrations

Migrations are run automatically by the setup script using the application's migration system:

```bash
# Migrations are applied via:
npm run db:migrate
```

The migrations create all tables in the PUBLIC schema with `organization_id` columns for multi-tenant isolation.

## Test Data Seeding

The setup script optionally seeds test data:

```bash
# Currently seeds subscription plans (if script exists):
node scripts/seed-subscription-plans.mjs
```

You can add more seed scripts to `scripts/setup-test-db.sh` as needed.

## Integration Test Pattern

Integration tests should use the test database by loading the `.env.test` configuration:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTenantDb } from "../lib/db/tenant.server";

describe("Database Integration Test", () => {
  const testOrgId = "test-org-id";

  beforeAll(async () => {
    // Database is already set up by setup script
    // Just create any test-specific data
  });

  afterAll(async () => {
    // Clean up test data if needed
  });

  it("should perform database operations", async () => {
    const db = getTenantDb(testOrgId);
    // Test your database queries here
  });
});
```

## Troubleshooting

### Docker Not Running

If you get "Docker is not running" errors:

```bash
# Check Docker status
docker info

# Start Docker Desktop (macOS)
open -a Docker
```

### Port Conflicts

If ports 5433 or 6380 are already in use:

1. Stop the conflicting services
2. Or modify ports in `docker-compose.test-db.yml`

### Database Connection Issues

```bash
# Check container status
npm run test:db:status

# View container logs
docker logs divestreams-test-db
docker logs divestreams-test-redis

# Restart containers
npm run test:db:restart
```

### Stale Data

If tests are failing due to stale data:

```bash
# Reset database to clean state
npm run test:db:reset
```

## CI/CD Integration

The test database setup is designed for local development. For CI/CD pipelines, consider:

1. **GitHub Actions**: Use service containers
   ```yaml
   services:
     postgres:
       image: postgres:16-alpine
       env:
         POSTGRES_USER: test_user
         POSTGRES_PASSWORD: test_password
         POSTGRES_DB: divestreams_test
       ports:
         - 5433:5432
   ```

2. **Testcontainers**: For environments where Docker is available in CI
   - Automatically manages container lifecycle
   - See `tests/setup/database.ts` for testcontainer setup

## Files

- `docker-compose.test-db.yml` - Docker Compose configuration
- `.env.test` - Test environment variables
- `scripts/setup-test-db.sh` - Management script
- `package.json` - npm scripts (test:db:*)

## Best Practices

1. **Always use test database for integration tests** - Never run integration tests against development or production databases

2. **Clean up after tests** - Use `afterAll` hooks to clean up test data

3. **Isolate test data by organization_id** - Always use unique organization IDs for different test suites

4. **Reset database between test runs** - Use `npm run test:db:reset` for a clean slate

5. **Don't commit .env.test changes** - Keep test credentials generic

## Next Steps

- Add more seed scripts for common test scenarios
- Create test data factories/fixtures
- Add database query performance benchmarks
- Expand integration test coverage for:
  - lib/db/queries/equipment
  - lib/db/queries/trips
  - lib/db/queries/tours
  - lib/auth/org-context

## Related Documentation

- [Integration Testing Guide](../tests/integration/lib/db/queries/README.md)
- [Testing Coverage Summary](../TESTING_COVERAGE_SUMMARY.md)
- [Vitest Configuration](../vitest.config.ts)
