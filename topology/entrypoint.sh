#!/bin/sh
set -e

# Render gobgp.conf from template
envsubst < /app/gobgp.conf.template > /app/gobgp.conf

# Start GoBGP with gRPC enabled
exec gobgpd -f /app/gobgp.conf --api-hosts=:50051
