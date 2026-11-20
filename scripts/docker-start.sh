#!/bin/sh
# Starts the shop inside the Docker image.
#
# 1. Applies any new database changes with `prisma migrate deploy`. This only
#    ever adds what is missing, in order, and never resets or deletes data.
# 2. Starts the web server.
#
# If step 1 fails, the server is not started. During a Coolify deploy the new
# version then never passes its health check, so the previous version keeps
# serving customers. The deploy log shows the reason.
#
# Set MIGRATE_ON_START=false (for example on a second server) to skip step 1.
# Set WEB_CONCURRENCY=3 to run three copies of the shop in this container, so
# a busy shop can use three CPU cores. Unset or 1 runs one copy.
set -eu

if [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  echo "[start] Applying database changes..."
  if ! node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema /app/db/prisma/schema.prisma; then
    echo "[start] The database update failed, so the shop was not started. The previous version stays live." >&2
    echo "[start] P3005 means the database has no migration history yet (it needs a one-off baseline)." >&2
    echo "[start] P3009 means an earlier update failed part-way and must be resolved before trying again." >&2
    exit 1
  fi
fi

echo "[start] Starting the shop (copies: ${WEB_CONCURRENCY:-1})..."
# cluster.js runs one copy by default. Set WEB_CONCURRENCY=3 to use three cores.
exec node cluster.js
