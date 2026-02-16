#!/bin/bash

# Test Database Setup Script
# Sets up PostgreSQL and Redis containers for integration testing

set -e

echo "🔧 Setting up test database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

# Function to stop existing test containers
stop_test_containers() {
  echo "🛑 Stopping existing test containers..."
  docker-compose -f docker-compose.test-db.yml down -v 2>/dev/null || true
}

# Function to start test containers
start_test_containers() {
  echo "🚀 Starting test database containers..."
  docker-compose -f docker-compose.test-db.yml up -d

  echo "⏳ Waiting for PostgreSQL to be ready..."
  RETRIES=30
  COUNT=0
  until docker exec divestreams-test-db pg_isready -U test_user -d divestreams_test > /dev/null 2>&1; do
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $RETRIES ]; then
      echo "❌ PostgreSQL failed to start within 30 seconds"
      exit 1
    fi
    sleep 1
  done

  echo "⏳ Waiting for Redis to be ready..."
  COUNT=0
  until docker exec divestreams-test-redis redis-cli ping > /dev/null 2>&1; do
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $RETRIES ]; then
      echo "❌ Redis failed to start within 30 seconds"
      exit 1
    fi
    sleep 1
  done

  echo "✅ Test database containers are ready!"
}

# Function to run migrations
run_migrations() {
  echo "📦 Running database migrations..."

  # Load test environment variables
  export $(cat .env.test | grep -v '^#' | xargs)

  # Run migrations
  npm run db:migrate

  echo "✅ Migrations completed!"
}

# Function to seed test data (optional)
seed_test_data() {
  echo "🌱 Seeding test data..."

  # Load test environment variables
  export $(cat .env.test | grep -v '^#' | xargs)

  # Seed subscription plans
  node scripts/seed-subscription-plans.mjs || true

  echo "✅ Test data seeded!"
}

# Function to check status
check_status() {
  echo "📊 Test database status:"
  docker-compose -f docker-compose.test-db.yml ps

  echo ""
  echo "📝 Connection info:"
  echo "  PostgreSQL: postgresql://test_user:test_password@localhost:5433/divestreams_test"
  echo "  Redis: redis://localhost:6380"
  echo ""
  echo "🧪 To run integration tests:"
  echo "  npm run test:integration"
}

# Parse command line arguments
case "${1:-start}" in
  start)
    stop_test_containers
    start_test_containers
    run_migrations
    seed_test_data
    check_status
    ;;
  stop)
    stop_test_containers
    echo "✅ Test database stopped and cleaned up"
    ;;
  restart)
    stop_test_containers
    start_test_containers
    run_migrations
    check_status
    ;;
  migrate)
    run_migrations
    ;;
  seed)
    seed_test_data
    ;;
  status)
    check_status
    ;;
  reset)
    echo "⚠️  Resetting test database (all data will be lost)..."
    stop_test_containers
    start_test_containers
    run_migrations
    seed_test_data
    echo "✅ Test database reset complete"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|migrate|seed|status|reset}"
    echo ""
    echo "Commands:"
    echo "  start    - Start test database and run migrations (default)"
    echo "  stop     - Stop and remove test database containers"
    echo "  restart  - Restart test database containers"
    echo "  migrate  - Run database migrations only"
    echo "  seed     - Seed test data only"
    echo "  status   - Show test database status"
    echo "  reset    - Reset test database (stop, start, migrate, seed)"
    exit 1
    ;;
esac
