#!/usr/bin/env bash
set -euo pipefail

REPORT_PATH="${1:-}"
MODE="${2:-notice}"
if [[ -z "${REPORT_PATH}" ]]; then
  echo "usage: notify-email.sh <report-path> [publish-failed]" >&2
  exit 1
fi

if [[ ! -f "${REPORT_PATH}" ]]; then
  echo "report not found at ${REPORT_PATH}" >&2
  exit 1
fi

if [[ -z "${NOTIFY_EMAIL_TO:-}" || -z "${NOTIFY_EMAIL_FROM:-}" ]]; then
  echo "email notification skipped: missing sender/recipient configuration"
  if [[ "${MODE}" == "publish-failed" ]]; then
    echo "The report was not delivered anywhere and is lost."
    exit 1
  fi
  exit 0
fi

COUNT="$(grep -E '^- \*\*Finding count:\*\* ' "${REPORT_PATH}" | sed -E 's/^- \*\*Finding count:\*\* ([0-9]+)$/\1/' || true)"
if [[ -z "${COUNT}" ]]; then
  COUNT="0"
fi

SUBJECT="Security audit completed (${COUNT} findings)"
BODY="Security audit completed with ${COUNT} Medium+ finding(s). Full details are available in the private draft GHSA."
if [[ "${MODE}" == "publish-failed" ]]; then
  # The draft advisory could not be created, so this email is the report's
  # only copy off the runner. It carries the full report, and only here.
  SUBJECT="[publish failed] Security audit report (${COUNT} findings)"
  BODY="$(printf '%s\n\n%s\n' \
    "The private draft advisory could not be created. The full report follows; fix the advisories token." \
    "$(head -c 200000 "${REPORT_PATH}")")"
fi
export SUBJECT BODY MODE

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
body = os.environ.get("BODY", "")

if not host:
    print("email notification skipped: SMTP host is not configured")
    if os.environ.get("MODE") == "publish-failed":
        print("The report was not delivered anywhere and is lost.")
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
