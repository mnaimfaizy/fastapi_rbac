#!/usr/bin/env bash
# The only way an agent commits in this repository. Adapted from the Agent-kit
# commit-pipeline Pattern guide (v1.0.0-beta.9); see docs/agents/commit-pipeline.md.
#
# It refuses an empty index, secret-looking paths and a checkout without the
# pre-commit hook, runs `git commit` with every hook, and ends each failure with
# a trailer that names a reason and the next command to run.
#
#   bash scripts/development/commit-runner.sh --message-file <path>
#
# There is deliberately no flag that skips hooks. Do not add one.
# On Windows, run it from Git Bash.

set -uo pipefail

RUNNER="bash scripts/development/commit-runner.sh"

# Each pattern matches only the line pre-commit prints when that hook FAILS
# (`<hook name>....Failed`). Passed hooks also print their name, so a bare name
# would label the wrong check. Hook names come from .pre-commit-config.yaml.
FORMAT_PATTERN='^(trailing whitespace|fix end of files|black|isort)\.+Failed'
FORMAT_HINT='git diff --name-only (the files the hook rewrote); review the rewrite, git add those paths by name, then run the runner again.'

LINT_PATTERN='^(flake8|mypy)\.+Failed'
LINT_SCOPE_PATTERN='^(flake8|mypy)\.+Failed'
LINT_HINT_TEMPLATE='pre-commit run %s --files $(git diff --cached --name-only)'

EXPLAINER_PATTERN='^explainer pages match the code\.+Failed'
EXPLAINER_HINT='python scripts/docs/check_explainers.py   (then the command for each scope; see .claude/skills/commit-change/SKILL.md)'

HOOK_PATTERN='\.+Failed|pre-commit'

trailer() {
  # trailer <reason> <hint> [scope] [paths]
  {
    printf -- '---\n'
    printf 'commit-runner: failed\n'
    printf 'reason: %s\n' "$1"
    [ -n "${3:-}" ] && printf 'scope: %s\n' "$3"
    [ -n "${4:-}" ] && printf 'paths: %s\n' "$4"
    printf 'hint: %s\n' "$2"
    printf -- '---\n'
  } >&2
}

fail() {
  # fail <message> <reason> <hint> [scope] [paths]
  printf '%s\n' "$1" >&2
  trailer "$2" "$3" "${4:-}" "${5:-}"
  exit 1
}

# A secret-looking path, judged by its file name only. A backstop for an
# accidental stage, not a secret scanner. `.env` also covers `.sandcastle/.env`,
# which must never be created or committed.
is_secret_path() {
  local base="${1##*/}"
  case "$base" in
    .env.example | .env.sample | .env.template) return 1 ;;
    .env | .env.*) return 0 ;;
    credentials.json) return 0 ;;
    *.pem | *.p12 | *.pfx | *.keystore | *.key) return 0 ;;
    id_rsa | id_dsa | id_ecdsa | id_ed25519) return 0 ;;
  esac
  return 1
}

message_file=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --message-file)
      [ "$#" -ge 2 ] || fail "--message-file needs a path." unknown "$RUNNER --message-file <path>"
      message_file="$2"
      shift 2
      ;;
    -h | --help)
      sed -n '2,13p' "$0"
      exit 0
      ;;
    *)
      fail "Unknown argument: $1" unknown "$RUNNER --message-file <path>"
      ;;
  esac
done

[ -n "$message_file" ] || fail "A message file is required." unknown "$RUNNER --message-file <path>"
[ -r "$message_file" ] || fail "Cannot read $message_file." unknown "Write the message to a file, then pass its path."
grep -q '[^[:space:]]' "$message_file" || fail "The commit message is empty." unknown "Draft the message again."

if git diff --cached --quiet; then
  fail "Nothing is staged." empty-index "Stage the intended paths by name (never git add .), then run $RUNNER again."
fi

blocked=""
while IFS= read -r path; do
  [ -n "$path" ] || continue
  if is_secret_path "$path"; then
    blocked="${blocked:+$blocked, }$path"
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR)

if [ -n "$blocked" ]; then
  fail "Refusing to commit secret-looking paths: $blocked" secret \
    "git restore --staged <path> for each path, then run $RUNNER again." "" "$blocked"
fi

# Without the hook, `git commit` succeeds and proves nothing; CI is then the
# first check to run.
hook_path="$(git rev-parse --git-path hooks/pre-commit)"
if [ ! -x "$hook_path" ]; then
  fail "The pre-commit hook is not installed, so no checks would run." hooks-missing \
    "pre-commit install   (installs all four hook types), then run $RUNNER again."
fi

output_file="$(mktemp)"
trap 'rm -f "$output_file"' EXIT

# The hooks run here. Their output reaches the terminal and is kept for the
# classifier below.
git commit --file "$message_file" 2>&1 | tee "$output_file"
status="${PIPESTATUS[0]}"

if [ "$status" -eq 0 ]; then
  exit 0
fi

# Order matters: a formatter rewrite can shift lines an explainer cites, so
# format is reported first, then lint, then explainer drift.
if grep -Eqi "$FORMAT_PATTERN" "$output_file"; then
  trailer format "$FORMAT_HINT"
elif grep -Eqi "$LINT_PATTERN" "$output_file"; then
  scope="$(sed -nE "s/${LINT_SCOPE_PATTERN}.*/\\1/p" "$output_file" | sort -u | paste -sd, -)"
  hint=""
  for hook in ${scope//,/ }; do
    # shellcheck disable=SC2059
    hint="${hint:+$hint ; }$(printf "$LINT_HINT_TEMPLATE" "$hook")"
  done
  trailer lint "$hint" "$scope"
elif grep -Eqi "$EXPLAINER_PATTERN" "$output_file"; then
  # check_explainers.py prints one "== <kind> (<n>)" heading per kind of drift.
  scope="$(sed -nE 's/^== (.*) \([0-9]+\)$/\1/p' "$output_file" | sort -u | paste -sd, -)"
  trailer explainer-drift "$EXPLAINER_HINT" "$scope"
elif grep -Eqi "$HOOK_PATTERN" "$output_file"; then
  trailer hook "Read the hook output above, fix that check, then run $RUNNER again."
else
  trailer unknown "Read the git output above, fix the cause, then run $RUNNER again."
fi

exit "$status"
