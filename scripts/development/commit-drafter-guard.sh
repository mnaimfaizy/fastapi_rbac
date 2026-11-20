#!/usr/bin/env bash
# PreToolUse hook for the Claude commit-drafter sub-agent.
# Allows only read-only git inspection commands and blocks everything else
# with exit code 2. Fails closed when jq is missing or the input is unreadable.
set -u

block() {
  echo "Blocked by commit-drafter-guard: $1. Allowed: git status|diff|log|show (read-only, no shell operators)." >&2
  exit 2
}

command -v jq >/dev/null 2>&1 || block "jq is not installed, cannot inspect the command"

cmd="$(jq -r '.tool_input.command // empty' 2>/dev/null)" || block "unreadable hook input"
[ -n "$cmd" ] || block "empty command"

case "$cmd" in
  *[';&|`$()<>']* | *$'\n'*) block "shell operators are not allowed" ;;
esac

if ! [[ "$cmd" =~ ^git\ (--no-pager\ )?(status|diff|log|show)($|\ ) ]]; then
  block "only git status, diff, log and show are allowed"
fi

case "$cmd" in
  *--output* | *--ext-diff* | *--textconv* | *" -c "* | *--exec-path*) block "option can write files or run programs" ;;
esac

exit 0
