#!/usr/bin/env bash
# Use the same latest-stable assets as a normal build when regenerating notices.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
npm ci --ignore-scripts
npm run sync-assets
npm run licenses:generate
