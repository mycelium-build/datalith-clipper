#!/usr/bin/env bash
# Renovate post-upgrade task: THIRD-PARTY-NOTICES.md lists dependency versions, so regenerate it after a bump.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

npm ci --ignore-scripts
npm run licenses:generate
