# graphify-out/

Local knowledge-graph artifacts for this repository.

- **Committed:** `GRAPH_REPORT.md` (summary) and this README
- **Gitignored:** `graph.json`, `graph.html`, `cache/`, and other generated files

Build and query instructions: [`docs/agents/graphify.md`](../docs/agents/graphify.md).

Quick start (from repo root):

```bash
graphify extract . --code-only --out .
graphify cluster-only . --no-label
graphify query "How does login connect to Redis token storage?"
```
