#!/bin/bash
set -e

# Wait until PostgreSQL is ready
until pg_isready -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# Run init.sql manually if you want every time
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init.sql || true

# Start the original entrypoint
exec docker-entrypoint.sh postgres
