#!/bin/sh
set -eu

mkdir -p /data /media/movies

if [ "$(id -u)" = "0" ]; then
  chown -R node:node /data /media/movies 2>/dev/null || true
  exec su -s /bin/sh node -c 'exec node server.mjs'
fi

exec node server.mjs
