# Build the local graphify knowledge graph from scratch (AST only, no LLM).
#
# Run this once after installing graphify to opt in. After that, the
# post-commit and post-merge hooks keep the graph current on their own.
# Re-run it after changing .graphifyignore, or whenever the graph looks wrong.
#
# Full guide: docs/agents/graphify.md
$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $root

if (-not (Get-Command graphify -ErrorAction SilentlyContinue)) {
    Write-Error 'graphify not found. Install it with: uv tool install "graphifyy[mcp]==0.9.43"'
}

# Same seed as the refresh hook, so a rebuild and a refresh cluster alike.
$env:PYTHONHASHSEED = '0'

graphify extract . --code-only --out .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
graphify cluster-only . --no-label
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output 'Done. The graphify MCP server serves graphify-out/graph.json.'
