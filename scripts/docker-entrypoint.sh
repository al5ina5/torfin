#!/bin/sh
set -eu

mkdir -p /data /media/movies
chown -R node:node /data /media/movies 2>/dev/null || true

exec su -s /bin/sh node -c 'exec node server.mjs'
