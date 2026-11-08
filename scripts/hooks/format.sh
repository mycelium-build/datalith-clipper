#!/usr/bin/env bash
# prek hook: formats the files being committed (prek passes them as arguments) and stages the result,
# so the commit goes through formatted. prek sets unstaged changes aside while hooks run, so only
# staged content is formatted. If formatting conflicts with unstaged changes of the same file,
# prek drops the fix and stops the commit.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

npx --no-install vp fmt --write -- "$@"
git add -- "$@"
