#!/bin/bash
# Setup persistent PostgreSQL and Redis containers for CI runner on VPS
# Run this once on the VPS to set up the CI infrastructure

set -e

echo "Setting up persistent CI services (PostgreSQL and Redis)..."

# Stop and remove existing containers if they exist
docker stop ci-postgres ci-redis 2>/dev/null || true
docker rm ci-postgres ci-redis 2>/dev/null || true

# Start PostgreSQL container
echo "Starting PostgreSQL container..."
docker run -d \
  --name ci-postgres \
  --restart unless-stopped \
  -p 5432:5432 \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=testdb \
  -v ci-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine

# Start Redis container
echo "Starting Redis container..."
docker run -d \
  --name ci-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  -v ci-redis-data:/data \
  redis:7-alpine

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 5

# Test PostgreSQL connection
echo "Testing PostgreSQL connection..."
docker exec ci-postgres pg_isready -U test || {
  echo "ERROR: PostgreSQL is not ready"
  exit 1
}

# Test Redis connection
echo "Testing Redis connection..."
docker exec ci-redis redis-cli ping | grep -q PONG || {
  echo "ERROR: Redis is not responding"
  exit 1
}

echo ""
echo "✅ CI services setup complete!"
echo ""
echo "Services running:"
echo "  - PostgreSQL: 127.0.0.1:5432 (user: test, pass: test, db: testdb)"
echo "  - Redis: 127.0.0.1:6379"
echo ""
echo "Containers are set to restart automatically (--restart unless-stopped)"
echo "To stop: docker stop ci-postgres ci-redis"
echo "To view logs: docker logs ci-postgres (or ci-redis)"
