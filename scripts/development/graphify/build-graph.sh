#!/usr/bin/env bash
# Build the local graphify knowledge graph from scratch (AST only, no LLM).
#
# Run this once after installing graphify to opt in. After that, the
# post-commit, post-merge and post-rewrite hooks keep the graph current on their own.
# Re-run it after changing .graphifyignore, or whenever the graph looks wrong.
#
# Full guide: docs/agents/graphify.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

if ! command -v graphify >/dev/null 2>&1; then
  echo 'graphify not found. Install it with: uv tool install "graphifyy[mcp]==0.9.43"' >&2
  exit 1
fi

# Same seed as the refresh hook, so a rebuild and a refresh cluster alike.
export PYTHONHASHSEED=0

graphify extract . --code-only --out .
graphify cluster-only . --no-label

echo "Done. The graphify MCP server serves graphify-out/graph.json."
