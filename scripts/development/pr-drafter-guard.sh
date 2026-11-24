#!/usr/bin/env bash
# PreToolUse hook for the Claude pr-drafter sub-agent.
# Allows only read-only git inspection and `gh issue view`, and blocks
# everything else with exit code 2. Fails closed when jq is missing or the
# input is unreadable. See docs/agents/pr-pipeline.md.
set -u

block() {
  echo "Blocked by pr-drafter-guard: $1. Allowed: git status|diff|log|show|merge-base|rev-parse|rev-list, git branch --show-current, gh issue view (read-only, no shell operators)." >&2
  exit 2
}

command -v jq >/dev/null 2>&1 || block "jq is not installed, cannot inspect the command"

cmd="$(jq -r '.tool_input.command // empty' 2>/dev/null)" || block "unreadable hook input"
[ -n "$cmd" ] || block "empty command"

# shellcheck disable=SC2016 # literal characters to refuse, not an expansion.
case "$cmd" in
  *[';&|`$()<>']* | *$'\n'*) block "shell operators are not allowed" ;;
esac

if [[ "$cmd" =~ ^git\ (--no-pager\ )?(status|diff|log|show|merge-base|rev-parse|rev-list)($|\ ) ]]; then
  case "$cmd" in
    *--output* | *--ext-diff* | *--textconv* | *" -c "* | *--exec-path*) block "option can write files or run programs" ;;
  esac
  exit 0
fi

[[ "$cmd" =~ ^git\ (--no-pager\ )?branch\ --show-current$ ]] && exit 0

if [[ "$cmd" =~ ^gh\ issue\ view\ [0-9]+($|\ ) ]]; then
  case "$cmd" in
    *" --web"* | *" -w"*) block "gh issue view --web opens a browser" ;;
  esac
  exit 0
fi

block "command is not on the read-only list"
