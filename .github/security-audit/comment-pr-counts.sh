#!/usr/bin/env bash
set -euo pipefail

PR_NUMBER="${1:-}"
FINDING_COUNT="${2:-}"

if [[ -z "${PR_NUMBER}" || -z "${FINDING_COUNT}" ]]; then
  echo "usage: comment-pr-counts.sh <pr-number> <finding-count>" >&2
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required" >&2
  exit 1
fi

if ! [[ "${FINDING_COUNT}" =~ ^[0-9]+$ ]]; then
  echo "finding count must be numeric" >&2
  exit 1
fi

gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  "/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" \
  -f body="Security audit completed with ${FINDING_COUNT} Medium+ finding(s). Full details are in the private draft advisory."
