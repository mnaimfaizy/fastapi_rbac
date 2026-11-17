#!/usr/bin/env bash
# Feeds ci-gate.sh simulated `needs` results and checks each verdict (#381).
# Run: bash .github/scripts/ci-gate.test.sh
set -uo pipefail
gate="$(dirname "$0")/ci-gate.sh"
failures=0

# needs_json <changes-result> <backend> <frontend> <explainers> <mkdocs> <backend-result> <frontend-result> <docs-result>
needs_json() {
  jq -n --arg cr "$1" --arg b "$2" --arg f "$3" --arg e "$4" --arg m "$5" \
    --arg br "$6" --arg fr "$7" --arg dr "$8" '{
      changes: {result: $cr, outputs: (if $cr == "success" then {backend: $b, frontend: $f, explainers: $e, mkdocs: $m} else {} end)},
      backend: {result: $br, outputs: {}},
      frontend: {result: $fr, outputs: {}},
      docs: {result: $dr, outputs: {}}
    }'
}

case_() { # case_ <name> <expected pass|fail> <json>
  local name="$1" want="$2" json="$3" got
  if NEEDS="$json" GITHUB_STEP_SUMMARY="" bash "$gate" >/dev/null 2>&1; then got=pass; else got=fail; fi
  if [ "$got" = "$want" ]; then
    printf 'ok    %-58s %s\n' "$name" "$got"
  else
    printf 'WRONG %-58s got %s, want %s\n' "$name" "$got" "$want"
    failures=$((failures + 1))
  fi
}

#     name                                                     want  changes  b     f     e     m     backend   frontend  docs
case_ "everything changed, everything passed"                  pass "$(needs_json success true true true true success success success)"
case_ "docs-only: backend and frontend skipped, untouched"     pass "$(needs_json success false false false true skipped skipped success)"
case_ "nothing relevant changed: every area skipped"           pass "$(needs_json success false false false false skipped skipped skipped)"
case_ "backend-only: frontend skipped, untouched"              pass "$(needs_json success true false false false success skipped skipped)"
case_ "area ran although untouched (fail-open run)"            pass "$(needs_json success false false false false success success success)"
case_ "backend skipped although backend changed"               fail "$(needs_json success true false false false skipped skipped skipped)"
case_ "docs skipped although mkdocs changed"                   fail "$(needs_json success false false false true skipped skipped skipped)"
case_ "docs skipped although explainers changed"               fail "$(needs_json success false false true false skipped skipped skipped)"
case_ "backend failed (e.g. Integration Test or Coverage)"     fail "$(needs_json success true false false false failure skipped skipped)"
case_ "frontend cancelled"                                     fail "$(needs_json success false true false false skipped cancelled skipped)"
case_ "docs failed"                                            fail "$(needs_json success false false false true skipped skipped failure)"
case_ "change detection failed, every area passed"             fail "$(needs_json failure x x x x success success success)"
case_ "change detection failed, areas skipped"                 fail "$(needs_json failure x x x x skipped skipped skipped)"
case_ "change detection cancelled"                             fail "$(needs_json cancelled x x x x skipped skipped skipped)"
case_ "an area is missing from needs"                          fail "$(jq -n '{changes:{result:"success",outputs:{backend:"false",frontend:"false",explainers:"false",mkdocs:"false"}},backend:{result:"skipped"},frontend:{result:"skipped"}}')"
case_ "NEEDS is not JSON"                                     fail "not json"

if [ "$failures" -gt 0 ]; then
  echo "$failures gate case(s) wrong"
  exit 1
fi
echo "all gate cases right"
