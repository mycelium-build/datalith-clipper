#!/usr/bin/env bash
# Decides which CI jobs the change since <base> needs. Prints and (when set) appends to $GITHUB_OUTPUT:
#   code=true|false      anything that the build, the checks or the tests can read changed
#   licenses=true|false  an input of `npm run licenses:check` changed
# An unknown base (first push, force push, unreadable revision) or any unexpected failure yields true.
#
# Usage: scripts/ci/changes.sh <base-revision>      (compares it with HEAD)
set -uo pipefail

base="${1:-}"

emit() {
    echo "code=$1"
    echo "licenses=$2"
    if [ -n "${GITHUB_OUTPUT:-}" ]; then
        {
            echo "code=$1"
            echo "licenses=$2"
        } >>"$GITHUB_OUTPUT"
    fi
    exit 0
}
unknown() { echo "::notice title=Full CI::$*" >&2; emit true true; }

[ -n "$base" ] || unknown "no base revision"
git rev-parse --verify -q "${base}^{commit}" >/dev/null || unknown "base $base is not available"
files=$(git diff --name-only "$base" HEAD) || unknown "cannot diff $base with HEAD"

# Exclusion list: files that neither the build, nor the checks, nor the tests read.
# `vp fmt --check` also formats the Markdown among them: the separate `format` job still covers it.
# Everything else, including any new path, counts as code.
is_excluded() {
    case "$1" in
        .github/workflows/ci.yml) return 1 ;;
        .github/*) return 0 ;;
        README.md | CHANGELOG.md | CONTRIBUTING.md) return 0 ;;
        docs/*) return 0 ;;
        .pre-commit-config.yaml | renovate.json | .env.example | release-please-config.json | .release-please-manifest.json) return 0 ;;
        scripts/hooks/* | scripts/renovate-post-upgrade.sh) return 0 ;;
        *) return 1 ;;
    esac
}

# Inputs of licenses:check: lockfile, package.json, notices, project license, license scripts and the
# source resolver (its license files are bundled assets).
is_license_input() {
    case "$1" in
        package.json | package-lock.json | THIRD-PARTY-NOTICES.md | LICENSE) return 0 ;;
        scripts/licenses/* | scripts/lib/source.ts | scripts/sync-assets.ts | .github/workflows/ci.yml) return 0 ;;
        *) return 1 ;;
    esac
}

code=false
licenses=false
while IFS= read -r file; do
    [ -n "$file" ] || continue
    is_excluded "$file" || code=true
    is_license_input "$file" && licenses=true
done <<<"$files"

echo "Changed files:" >&2
sed 's/^/  /' <<<"$files" >&2
emit "$code" "$licenses"
