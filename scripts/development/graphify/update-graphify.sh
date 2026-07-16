#!/usr/bin/env bash
# Rebuild or incrementally update the project graphify knowledge graph.
# Default: incremental `graphify update` (AST only, no API key).
# --full: extract --code-only then cluster-only --no-label.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

if ! command -v graphify >/dev/null 2>&1; then
  echo "graphify CLI not found. Install with: uv tool install graphifyy" >&2
  exit 1
fi

FULL=0
if [[ "${1:-}" == "--full" ]]; then
  FULL=1
fi

if [[ "$FULL" -eq 1 ]]; then
  echo "Full code-only extract..."
  graphify extract . --code-only --out .
  echo "Clustering (no LLM labels)..."
  graphify cluster-only . --no-label
else
  if [[ ! -f graphify-out/graph.json ]]; then
    echo "No graphify-out/graph.json found; running full extract first..."
    graphify extract . --code-only --out .
    graphify cluster-only . --no-label
  else
    echo "Incremental update..."
    graphify update .
  fi
fi

echo "Done. See graphify-out/GRAPH_REPORT.md and docs/agents/graphify.md"
