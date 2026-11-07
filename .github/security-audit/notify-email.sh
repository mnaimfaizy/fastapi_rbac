#!/usr/bin/env bash
set -euo pipefail

REPORT_PATH="${1:-}"
MODE="${2:-notice}"
if [[ -z "${REPORT_PATH}" ]]; then
  # With empty-report, the first argument is the session transcript instead.
  echo "usage: notify-email.sh <report-path> [publish-failed] | <session-path> empty-report" >&2
  exit 1
fi

if [[ ! -f "${REPORT_PATH}" ]]; then
  if [[ "${MODE}" == "empty-report" ]]; then
    echo "session transcript not found at ${REPORT_PATH}" >&2
  else
    echo "report not found at ${REPORT_PATH}" >&2
  fi
  exit 1
fi

if [[ -z "${NOTIFY_EMAIL_TO:-}" || -z "${NOTIFY_EMAIL_FROM:-}" ]]; then
  echo "email notification skipped: missing sender/recipient configuration"
  if [[ "${MODE}" == "publish-failed" ]]; then
    echo "The report was not delivered anywhere and is lost."
    exit 1
  elif [[ "${MODE}" == "empty-report" ]]; then
    # If the failed-run draft also failed, this was the transcript's only copy.
    echo "The session transcript was not delivered by email."
    exit 1
  fi
  exit 0
fi

COUNT="$(grep -E '^- \*\*Finding count:\*\* ' "${REPORT_PATH}" | sed -E 's/^- \*\*Finding count:\*\* ([0-9]+)$/\1/' || true)"
if [[ -z "${COUNT}" ]]; then
  COUNT="0"
fi

# Print at most <max> bytes of <file>: all of it, or its first <head> bytes and
# its last bytes with a marker between. Duplicated in
# publish-draft-advisory.sh deliberately: the staged copies are runnable
# scripts, not a library.
head_tail() {
  local file="$1" max="$2" head="$3" size
  size="$(wc -c < "$file" | tr -d '[:space:]')"
  if [ "$size" -le "$max" ]; then
    cat "$file"
    return
  fi
  local tail=$((max - head - 64))
  head -c "$head" "$file"
  printf '\n\n[... %d bytes omitted ...]\n\n' "$((size - head - tail))"
  tail -c "$tail" "$file"
}

# The body travels to Python as a private file, not an environment variable:
# on Linux an environment string over 128 KiB makes execve fail, and a report
# or transcript can be that large.
BODY_FILE="$(umask 077 && mktemp "${RUNNER_TEMP:-/tmp}/security-audit-email-body.XXXXXX")"
trap 'rm -f "$BODY_FILE"' EXIT

SUBJECT="Security audit completed (${COUNT} findings)"
if [[ "${MODE}" == "publish-failed" ]]; then
  # The draft advisory could not be created, so this email is the report's
  # only copy off the runner. It carries the full report, and only here.
  SUBJECT="[publish failed] Security audit report (${COUNT} findings)"
  {
    printf '%s\n\n' "The private draft advisory could not be created. The full report follows; fix the advisories token."
    head -c 200000 "${REPORT_PATH}"
  } > "$BODY_FILE"
elif [[ "${MODE}" == "empty-report" ]]; then
  # The agent wrote no report, so the job fails. The transcript is the only
  # record of why; it goes to the configured mailbox and the private draft only.
  # The clue is at its end, so keep its start and its end.
  SUBJECT="[empty report] Security audit run failed"
  {
    printf '%s\n\n' "The audit agent finished without writing a report, so the job failed. Its session transcript follows."
    head_tail "${REPORT_PATH}" 200000 8000
  } > "$BODY_FILE"
else
  printf '%s\n' "Security audit completed with ${COUNT} Medium+ finding(s). Full details are available in the private draft GHSA." > "$BODY_FILE"
fi
export SUBJECT BODY_FILE MODE

# The step runs in the audited workspace. A stdin script puts the current
# directory first on sys.path, so a module file there would load before the
# standard library while the SMTP secret is in the environment. Run isolated
# (-I: no current directory, no user site, no PYTHON* variables) and from
# outside the workspace.
cd "${RUNNER_TEMP:-/tmp}"
python3 -I - <<'PY'
import os
import smtplib
import ssl
from email.message import EmailMessage

to_addr = os.environ.get("NOTIFY_EMAIL_TO", "")
from_addr = os.environ.get("NOTIFY_EMAIL_FROM", "")
host = os.environ.get("NOTIFY_EMAIL_SMTP_HOST", "")
port = int(os.environ.get("NOTIFY_EMAIL_SMTP_PORT", "587"))
username = os.environ.get("NOTIFY_EMAIL_SMTP_USERNAME", "")
password = os.environ.get("NOTIFY_EMAIL_SMTP_PASSWORD", "")
subject = os.environ.get("SUBJECT", "")
with open(os.environ["BODY_FILE"], encoding="utf-8", errors="replace") as f:
    body = f.read()

if not host:
    print("email notification skipped: SMTP host is not configured")
    if os.environ.get("MODE") == "publish-failed":
        print("The report was not delivered anywhere and is lost.")
        raise SystemExit(1)
    if os.environ.get("MODE") == "empty-report":
        print("The session transcript was not delivered by email.")
        raise SystemExit(1)
    raise SystemExit(0)

msg = EmailMessage()
msg["Subject"] = subject
msg["From"] = from_addr
msg["To"] = to_addr
msg.set_content(body)

# starttls() without a context uses the stdlib's unverified one: the session
# is encrypted but the server is not authenticated, and the password follows.
# Verify the certificate and hostname against the system trust store.
tls = ssl.create_default_context()

with smtplib.SMTP(host, port, timeout=30) as smtp:
    smtp.starttls(context=tls)
    if username:
        smtp.login(username, password)
    smtp.send_message(msg)

print("email notification sent")
PY
