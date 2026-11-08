#!/usr/bin/env bash
# prek hook: runs `npm run licenses:check` when dependency or license files change.
# Stale notices are regenerated and staged, so the commit goes through with them.
# Any other failure of the check (or of the generation) stops the commit.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if npm run --silent licenses:check; then
    exit 0
fi

# The check fails when THIRD-PARTY-NOTICES.md is stale, and also when its inputs are broken.
# Regenerating fails in the second case; in the first it changes the file.
npm run --silent licenses:generate
if git diff --quiet -- THIRD-PARTY-NOTICES.md; then
    exit 1
fi
git add -- THIRD-PARTY-NOTICES.md
echo "License notices were stale: regenerated and staged THIRD-PARTY-NOTICES.md." >&2
