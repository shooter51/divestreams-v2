#!/bin/sh
set -e

echo "DiveStreams v2 - Starting..."

# Wait for database to be ready
echo "Waiting for database..."
MAX_RETRIES=30
RETRY_COUNT=0
until node -e "
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
sql\`SELECT 1\`.then(() => { sql.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Database connection failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Database not ready yet... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "Database is ready!"

# Always run migrations (they are idempotent)
echo "Running database migrations..."
node /app/scripts/run-migrations.mjs
echo "Migrations complete!"

# Create platform admin if PLATFORM_ADMIN_EMAIL is set
if [ -n "$PLATFORM_ADMIN_EMAIL" ] && [ -n "$PLATFORM_ADMIN_PASSWORD" ]; then
  echo "Checking for platform admin setup..."
  node /app/scripts/setup-admin.mjs
fi

# Start the application
echo "Starting DiveStreams application..."
exec npm run start
