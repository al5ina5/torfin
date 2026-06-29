#!/usr/bin/env bash
# Install local git hook so `git push` deploys to thinktower after a successful push.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d .git ]; then
  echo "Not a git repository. Run from the Torfin project root."
  exit 1
fi

chmod +x scripts/git-push-with-deploy.sh

git config --local alias.push '!bash scripts/git-push-with-deploy.sh'

echo "Installed local push hook for this repo."
echo "  git push  →  push to GitHub, then npm run thinktower"
echo "  SKIP_DEPLOY=1 git push  →  push only, no deploy"
