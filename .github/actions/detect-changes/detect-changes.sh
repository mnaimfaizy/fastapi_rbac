#!/usr/bin/env bash
# Decide which CI areas a change touches and write backend, frontend,
# explainers and mkdocs (true/false) to $GITHUB_OUTPUT. See issue #381.
#
# Fail open: an event other than pull_request or push, a missing base, a git
# error, an empty diff, or a change to the CI definition itself sets every
# area to true. A wrong "true" costs minutes; a wrong "false" ships untested
# code, so every doubt resolves to true.
#
# CHANGED_FILES_FILE, when set, is read instead of asking git. The local
# simulation uses it; CI never sets it.
set -uo pipefail

AREAS=(backend frontend explainers mkdocs)
OUT="${GITHUB_OUTPUT:-/dev/stdout}"

emit() { # emit <area> <true|false>
  echo "$1=$2" >>"$OUT"
}

run_everything() {
  echo "Running every area: $1"
  for area in "${AREAS[@]}"; do emit "$area" true; done
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "Change detection ran every area: $1" >>"$GITHUB_STEP_SUMMARY"
  fi
  exit 0
}

# Both sides of a rename (--no-renames lists the old path as deleted), and
# paths verbatim rather than C-quoted (core.quotepath=false), so a file moved
# out of an area, or a non-ASCII name inside one, still counts for that area.
git_changed_files() { # git_changed_files <base> <head>
  git -c core.quotepath=false diff --name-only --no-renames "$1" "$2"
}

changed_files() {
  if [ -n "${CHANGED_FILES_FILE:-}" ]; then
    cat "$CHANGED_FILES_FILE"
    return
  fi
  case "${EVENT_NAME:-}" in
    pull_request)
      # actions/checkout puts the PR's merge commit at HEAD; its first parent
      # is the base branch tip, so this diff is exactly what the PR changes.
      git rev-parse --verify --quiet HEAD^2 >/dev/null || return 1
      git_changed_files HEAD^1 HEAD
      ;;
    push)
      local before="${BEFORE_SHA:-}"
      if [ -z "$before" ] || [[ "$before" =~ ^0+$ ]]; then return 1; fi
      git cat-file -e "$before^{commit}" 2>/dev/null ||
        git fetch --quiet --no-tags --depth=1 origin "$before" || return 1
      git_changed_files "$before" HEAD
      ;;
    *)
      return 1
      ;;
  esac
}

files="$(changed_files)" || run_everything "could not list changed files for event '${EVENT_NAME:-unset}'"
[ -n "$files" ] || run_everything "the change lists no files"

echo "Changed files:"
while IFS= read -r f; do echo "  $f"; done <<<"$files"

matches() { grep -qE "$1" <<<"$files" && echo true || echo false; }

# The CI definition: a change here must prove itself on every area.
if [ "$(matches '^(\.github/workflows/(ci|backend-ci|react-frontend-ci|docs-check)\.yml|\.github/actions/|\.github/scripts/ci-gate|codecov\.yml$)')" = true ]; then
  run_everything "the CI definition changed"
fi

declare -A run
# Backend unit tests also read some files outside backend/: the hub-runtime
# scripts and deployment guides (test_hub_runtime_superuser_password.py,
# test_production_key_checks.py), SECURITY_FEATURES.md and scripts/docker/.
run[backend]="$(matches '^(backend/|docs/deployment/|docs/reference/SECURITY_FEATURES\.md$|scripts/docker/)')"
run[frontend]="$(matches '^react-frontend/')"
# The explainer rules cite line ranges in backend/app and react-frontend/src.
run[explainers]="$(matches '^(backend/app/|react-frontend/src/|docs/explainers/|scripts/docs/)')"
run[mkdocs]="$(matches '^(docs/|mkdocs\.yml$|scripts/docs/)')"

for area in "${AREAS[@]}"; do
  emit "$area" "${run[$area]}"
  echo "$area=${run[$area]}"
done

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "| Area | Runs |"
    echo "|---|---|"
    for area in "${AREAS[@]}"; do echo "| $area | ${run[$area]} |"; done
  } >>"$GITHUB_STEP_SUMMARY"
fi
