<#
.SYNOPSIS
  Rebuild or incrementally update the project graphify knowledge graph.

.DESCRIPTION
  Default: incremental `graphify update` (AST only, no API key).
  -Full: extract --code-only then cluster-only --no-label.

.PARAMETER Full
  Run a full code-only extract + cluster instead of incremental update.
#>
[CmdletBinding()]
param(
    [switch]$Full
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Set-Location $RepoRoot

if (-not (Get-Command graphify -ErrorAction SilentlyContinue)) {
    Write-Error "graphify CLI not found. Install with: uv tool install graphifyy"
}

if ($Full) {
    Write-Host "Full code-only extract..."
    graphify extract . --code-only --out .
    Write-Host "Clustering (no LLM labels)..."
    graphify cluster-only . --no-label
} else {
    if (-not (Test-Path "graphify-out\graph.json")) {
        Write-Host "No graphify-out/graph.json found; running full extract first..."
        graphify extract . --code-only --out .
        graphify cluster-only . --no-label
    } else {
        Write-Host "Incremental update..."
        graphify update .
    }
}

Write-Host "Done. See graphify-out/GRAPH_REPORT.md and docs/agents/graphify.md"
