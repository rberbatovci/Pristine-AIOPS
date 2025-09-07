#!/bin/sh
set -e

# Render gobgp.conf from template
envsubst < /app/gobgp.conf.template > /app/gobgp.conf

# Start GoBGP daemon with the generated config and enable gRPC
exec gobgpd -f /app/gobgp.conf --api-hosts=:50051
