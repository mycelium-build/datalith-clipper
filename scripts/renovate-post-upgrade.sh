#!/usr/bin/env bash
# Renovate post-upgrade task: regenerate notices from the updated dependencies and the
# same pinned datalith-app assets used by CI. The source repository is public.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

npm ci --ignore-scripts
source_ref=$(sed -nE 's/^    DATALITH_SOURCE_REF: ([^[:space:]]+)[[:space:]]*$/\1/p' .github/workflows/ci.yml)
if [[ -z "$source_ref" || "$source_ref" == *$'\n'* ]]; then
    echo "Cannot read the pinned DATALITH_SOURCE_REF from .github/workflows/ci.yml" >&2
    exit 1
fi
source_dir=$(mktemp -d)
trap 'rm -rf "$source_dir"' EXIT
git clone --depth 1 --single-branch --branch "$source_ref" \
    https://github.com/mycelium-build/datalith-app.git "$source_dir"
# Use this exact checkout, without depending on Renovate forwarding credentials or
# on another repository's cached clone. CI normally forbids local source overrides.
env -u CI DATALITH_SOURCE_DIR="$source_dir" npm run sync-assets
npm run licenses:generate
