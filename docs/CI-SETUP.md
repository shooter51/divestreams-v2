# CI Services Setup on Dev VPS

The GitHub Actions self-hosted runner is hosted on **Dev VPS (1296511)**.

The runner needs persistent PostgreSQL and Redis containers to run tests.

## Quick Setup

SSH to Dev VPS and run:

```bash
cd /path/to/divestreams-v2
docker compose -f docker-compose.ci-simple.yml up -d
```

This creates:
- `ci-postgres` container on port 5432
- `ci-redis` container on port 6379

## Create E2E Database

After the containers start, create the second database for E2E tests:

```bash
docker exec ci-postgres psql -U test -d testdb -c "CREATE DATABASE testdb_e2e;"
docker exec ci-postgres psql -U test -d testdb -c "GRANT ALL PRIVILEGES ON DATABASE testdb_e2e TO test;"
```

## Verify Setup

```bash
# Check containers are running
docker ps | grep ci-

# Test PostgreSQL
docker exec ci-postgres pg_isready -U test

# Test Redis
docker exec ci-redis redis-cli ping

# Verify databases exist
docker exec ci-postgres psql -U test -c "\l" | grep testdb
```

## Expected Output

```
Services running:
  - PostgreSQL: 127.0.0.1:5432 (user: test, pass: test)
    - testdb (for unit/integration tests)
    - testdb_e2e (for e2e tests)
  - Redis: 127.0.0.1:6379
```

## Maintenance

```bash
# View logs
docker logs ci-postgres
docker logs ci-redis

# Restart services
docker restart ci-postgres ci-redis

# Stop services (not recommended - needed for CI)
docker stop ci-postgres ci-redis

# Remove services (data is preserved in volumes)
docker rm ci-postgres ci-redis
```

## Via Hostinger MCP (Alternative)

If Hostinger MCP is available:

```bash
# Use the createNewProjectV1 tool with:
# - VPS ID: 1296511 (Dev VPS)
# - Project name: ci-services
# - Docker compose file: docker-compose.ci-simple.yml
```

Then manually create the testdb_e2e database as shown above.
