#!/usr/bin/env bash
# Local git push wrapper: push to remote, then deploy to thinktower.
# Installed via: npm run install:hooks
#
# Skip deploy: SKIP_DEPLOY=1 git push

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command git push "$@"

if [ "${SKIP_DEPLOY:-}" = "1" ]; then
  echo "SKIP_DEPLOY=1 — skipping thinktower deploy."
  exit 0
fi

npm run thinktower
