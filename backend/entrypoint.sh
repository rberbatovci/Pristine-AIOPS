#!/bin/sh

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if nc -z postgresql 5432; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo "Attempt $i: PostgreSQL not ready yet, retrying in 2 seconds..."
  sleep 2
done

# Start FastAPI
echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000