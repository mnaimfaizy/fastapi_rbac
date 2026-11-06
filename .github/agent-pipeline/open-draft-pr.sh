#!/usr/bin/env bash
set -euo pipefail

ISSUE_NUMBER="${1:-}"
BASE_BRANCH="${2:-main}"
# The branch to open the PR from. Defaults to the checked-out branch; the
# workflow passes it explicitly because it runs from the trusted commit.
HEAD_BRANCH="${3:-}"

if [[ -z "${ISSUE_NUMBER}" ]]; then
  echo "usage: open-draft-pr.sh <issue-number> [base-branch] [head-branch]" >&2
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required" >&2
  exit 1
fi

CURRENT_BRANCH="${HEAD_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
TITLE="Implement verified plan for #${ISSUE_NUMBER}"
BODY="$(cat <<EOF
Implements the trusted verified plan for issue #${ISSUE_NUMBER}.

Closes #${ISSUE_NUMBER}

Contract notes:
- draft PR only
- no merge/approve/ready action by implementer
- workflow files are out of scope
EOF
)"

set +e
PR_OUTPUT="$(gh pr create --repo "$GITHUB_REPOSITORY" --draft --base "$BASE_BRANCH" --head "$CURRENT_BRANCH" --title "$TITLE" --body "$BODY" 2>&1)"
STATUS=$?
set -e

if [[ $STATUS -eq 0 ]]; then
  echo "$PR_OUTPUT"
  exit 0
fi

DEFAULT_BRANCH="$(gh repo view "$GITHUB_REPOSITORY" --json defaultBranchRef --jq .defaultBranchRef.name)"
COMPARE_URL="https://github.com/${GITHUB_REPOSITORY}/compare/${DEFAULT_BRANCH}...${CURRENT_BRANCH}?expand=1"
ERROR_BODY="$(cat <<EOF
Implementer could not open draft PR.

Exact gh error:
\`\`\`
${PR_OUTPUT}
\`\`\`

Compare link:
${COMPARE_URL}
EOF
)"

gh issue comment "$ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "$ERROR_BODY"
echo "$PR_OUTPUT" >&2
exit 0
