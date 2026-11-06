#!/usr/bin/env bash
# Publish a security-audit report as a draft repository Security Advisory (private until published).
# Always creates a draft for full audits (including clean runs) so maintainers can see what the
# agent produced. Finding bodies and CLI transcripts must NEVER be printed to public Actions logs.
#
# Usage: publish-draft-advisory.sh <report.md> [cli-log] [session.md]
# The vulnerability package name defaults to the repository name. Set SECURITY_AUDIT_PACKAGE to override.
set -euo pipefail

REPORT="${1:?report file required}"
CLI_LOG="${2:-}"
SESSION="${3:-}"

if [ ! -f "$REPORT" ]; then
  echo "missing report: $REPORT" >&2
  exit 1
fi

OWNER="${GITHUB_REPOSITORY%/*}"
REPO="${GITHUB_REPOSITORY#*/}"
PACKAGE="${SECURITY_AUDIT_PACKAGE:-$REPO}"
DATE="$(date -u +%Y-%m-%d)"
RUN_URL="${SECURITY_AUDIT_RUN_URL:-}"
MODE="${SECURITY_AUDIT_MODE:-full}"

out() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1" >> "$GITHUB_OUTPUT"
  fi
}

# Safe metadata only (no finding bodies) — helps debug false cleans in Actions logs.
echo "Report path: $REPORT"
echo "Report bytes: $(wc -c < "$REPORT" | tr -d '[:space:]')"
# The report is written by the agent and this log is world-readable, so no line
# of the report may reach stdout. Read one key at a time and emit its value only
# when the whole value matches a closed pattern. Duplicated in the workflow's
# Collect transcript step deliberately — the staged copy is a runnable script,
# not a library, and that step must not source a helper out of the workspace.
report_field() {
  sed -n "s/^- [*][*]$1:[*][*][[:space:]]*//p" "$REPORT" | tail -n 1 | sed 's/[[:space:]]*$//'
}

log_report_field() {
  local value
  value="$(report_field "$1")"
  if [ -z "$value" ]; then
    echo "$1: (absent)"
  elif printf '%s' "$value" | grep -qxiE "$2"; then
    echo "$1: $value"
  else
    echo "$1: (unrecognized)"
  fi
}

echo "Report metadata (validated):"
log_report_field "Mode" 'pr|full'
log_report_field "Date" '[0-9]{4}-[0-9]{2}-[0-9]{2}'
log_report_field "Max severity" 'none|medium|high|critical'
log_report_field "Finding count" '[0-9]{1,6}'
# Scope is free text by contract, so only its presence is reportable.
if grep -qE '^- [*][*]Scope:[*][*]' "$REPORT"; then
  echo "Scope: present (free text, not logged)"
else
  echo "Scope: (absent)"
fi

COUNT="$(grep -cE '^### F[0-9]+ [—-]' "$REPORT" || true)"
COUNT="$(printf '%s' "$COUNT" | tr -d '[:space:]')"
if [ -z "$COUNT" ]; then COUNT=0; fi

echo "Parsed F-headings: $COUNT"

# The header count is agent-authored, so it is bounded before it reaches the log
# or the mismatch message. Its value is already reported by log_report_field
# above; only the mismatch verdict below needs it.
HEADER_COUNT="$(report_field "Finding count")"
HEADER_MALFORMED=false
if [ -n "$HEADER_COUNT" ] && ! printf '%s' "$HEADER_COUNT" | grep -qxE '[0-9]{1,6}'; then
  HEADER_MALFORMED=true
  HEADER_COUNT=""
fi

FORMAT_MISMATCH=false
if [ "$HEADER_MALFORMED" = "true" ]; then
  FORMAT_MISMATCH=true
  echo "WARNING: header Finding count is not a plain number."
elif [ "$COUNT" = "0" ] && [ -n "$HEADER_COUNT" ] && [ "$HEADER_COUNT" != "0" ]; then
  FORMAT_MISMATCH=true
  echo "WARNING: header Finding count=$HEADER_COUNT but no '### Fn —' headings matched."
fi

MAX="low"
if [ "$COUNT" != "0" ]; then
  MAX="medium"
  if grep -qiE '\*\*Severity:\*\*[[:space:]]*Critical' "$REPORT"; then
    MAX="critical"
  elif grep -qiE '\*\*Severity:\*\*[[:space:]]*High' "$REPORT"; then
    MAX="high"
  fi
fi

if [ "$COUNT" = "0" ]; then
  SUMMARY="[Security audit] ${DATE} — clean run (0 Medium+ findings)"
else
  SUMMARY="[Security audit] ${DATE} — ${COUNT} finding(s), max=${MAX}"
fi
if [ "$FORMAT_MISMATCH" = "true" ]; then
  SUMMARY="[Security audit] ${DATE} — FORMAT MISMATCH (header=${HEADER_COUNT:-unparseable}, headings=0)"
fi
SUMMARY="$(printf '%s' "$SUMMARY" | head -c 1024)"

# The body holds every finding and the session transcript: write it to a
# private, unpredictable file and remove it on exit.
BODY_FILE="$(umask 077 && mktemp "${RUNNER_TEMP:-/tmp}/security-audit-advisory-body.XXXXXX")"
trap 'rm -f "$BODY_FILE"' EXIT

{
  cat "$REPORT"
  echo
  echo "---"
  echo
  echo "## Run metadata"
  echo
  echo "- Mode: \`${MODE}\`"
  if [ -n "$RUN_URL" ]; then
    echo "- Actions run: ${RUN_URL}"
  fi
  echo "- Captured at (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ "$FORMAT_MISMATCH" = "true" ]; then
    echo "- Format mismatch: header Finding count=${HEADER_COUNT:-unparseable} but F-headings=${COUNT}"
  fi

  if [ -n "$SESSION" ] && [ -f "$SESSION" ] && [ -s "$SESSION" ]; then
    echo
    echo "---"
    echo
    echo "## Agent session transcript"
    echo
    # Leave room under the 65535 advisory description cap.
    head -c 40000 "$SESSION"
    echo
  elif [ -n "$CLI_LOG" ] && [ -f "$CLI_LOG" ] && [ -s "$CLI_LOG" ]; then
    echo
    echo "---"
    echo
    echo "## Agent CLI log (truncated)"
    echo
    echo '```'
    head -c 35000 "$CLI_LOG"
    echo
    echo '```'
  fi
} > "$BODY_FILE"

DESCRIPTION="$(head -c 65000 "$BODY_FILE")"

PAYLOAD="$(jq -n \
  --arg summary "$SUMMARY" \
  --arg description "$DESCRIPTION" \
  --arg severity "$MAX" \
  --arg package "$PACKAGE" \
  '{
    summary: $summary,
    description: $description,
    severity: $severity,
    vulnerabilities: [
      {
        package: { ecosystem: "other", name: $package },
        vulnerable_version_range: "*",
        patched_versions: null,
        vulnerable_functions: []
      }
    ]
  }')"

# The report exists only on this runner, so a transient failure must not
# discard it. A retry after a create that succeeded but lost its response
# files a duplicate draft; that is the cheaper failure.
RESP=""
for attempt in 1 2 3; do
  if RESP="$(gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "/repos/${OWNER}/${REPO}/security-advisories" \
    --input - <<<"$PAYLOAD")"; then
    break
  fi
  if [ "$attempt" = 3 ]; then
    echo "Publish failed after 3 attempts. If notify_email is configured, the next step" >&2
    echo "emails the full report; otherwise the report is lost. Fix the advisories token" >&2
    echo "and re-run the audit." >&2
    exit 1
  fi
  sleep $((attempt * 15))
done

GHSA="$(jq -r '.ghsa_id // empty' <<<"$RESP")"
if [ -z "$GHSA" ]; then
  echo "Draft advisory created."
else
  echo "Draft advisory created: ${GHSA} (details private to admins/security managers)."
fi
# Do NOT echo the advisory URL — public Actions logs would leak a private handle.
out "advisory_url="
out "ghsa_id=$GHSA"
out "finding_count=$COUNT"
out "max_severity=$MAX"
out "format_mismatch=$FORMAT_MISMATCH"
out "published=true"
