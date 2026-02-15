#!/bin/bash
# PostgreSQL initialization script for CI databases
# Runs once when the container is first created

set -e

# Create additional database for E2E tests (separate from unit tests)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE testdb_e2e;
    GRANT ALL PRIVILEGES ON DATABASE testdb_e2e TO test;
EOSQL

echo "CI databases created: testdb (unit tests), testdb_e2e (e2e tests)"
