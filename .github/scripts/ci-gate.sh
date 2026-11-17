#!/usr/bin/env bash
# The CI gate's verdict (#381). ci.yml's `CI gate` job is the only required
# status check, so this script decides whether a change may merge.
#
# NEEDS holds the gate job's `toJSON(needs)`: the result of `changes` (change
# detection) and of each area it calls (backend, frontend, docs), plus the
# areas detection marked as touched. The gate passes only when:
#   - change detection succeeded, and
#   - every area either succeeded, or was skipped while detection said the
#     change does not touch it.
# A failed, cancelled or missing area fails the gate, and so does an area that
# was skipped although its files changed. The called backend workflow's result
# covers Backend Lint, Test, Integration Test and Coverage together.
#
# Tested by ci-gate.test.sh, which ci.yml runs on every change.
set -uo pipefail

needs="${NEEDS:?NEEDS must hold toJSON(needs) of the gate job}"
fail=0

result() { jq -r --arg job "$1" '.[$job].result // "missing"' <<<"$needs"; }
touched() { jq -r --arg area "$1" '.changes.outputs[$area] // ""' <<<"$needs"; }

report() { # report <ok|FAIL> <message>
  echo "$1 $2"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "- $1 $2" >>"$GITHUB_STEP_SUMMARY"; fi
  if [ "$1" = FAIL ]; then fail=1; fi
}

check_area() { # check_area <job> <touched: true|false|"">
  local job="$1" expected="$2" res
  res="$(result "$job")"
  case "$res" in
    success) report ok "$job: success" ;;
    skipped)
      if [ "$expected" = false ]; then
        report ok "$job: skipped, its area is untouched"
      else
        report FAIL "$job: skipped, but change detection said its area changed (touched='$expected')"
      fi
      ;;
    *) report FAIL "$job: $res" ;;
  esac
}

detection="$(result changes)"
if [ "$detection" = success ]; then
  report ok "changes: success"
else
  report FAIL "changes: change detection $detection"
fi

docs=false
if [ "$(touched explainers)" = true ] || [ "$(touched mkdocs)" = true ]; then docs=true; fi
if [ "$detection" != success ]; then docs=""; fi

check_area backend "$(touched backend)"
check_area frontend "$(touched frontend)"
check_area docs "$docs"

exit "$fail"
