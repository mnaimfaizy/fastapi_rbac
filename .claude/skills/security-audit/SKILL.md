---
name: security-audit
description: Medium+ threat-led security audit for a repository (`full` or `pr`) with private delivery requirements and no auto-fix.
disable-model-invocation: true
---

# Security audit

Portable procedure for security discovery. This skill does not ship a Consumer threat pack or findings ledger; Consumers supply those paths.

Report shape: [report-format.md](report-format.md)

## Modes

- `full`: whole repository, optionally narrowed by path
- `pr`: diff vs base plus adjacent call sites

`pr` mode does not file dependency-advisory findings.

## Evidence classes

- `dependency-advisory`: reachable GHSA/OSV/RUSTSEC/CVE from repository grounding files
- `code-path`: concrete code location shows failure
- `missing-control`: expected control site is missing

## Contract rules

- Severity floor is Medium.
- Never include finding bodies in public logs, artifacts, or public issues.
- Deliver full findings privately (draft GHSA is required by the kit contract).
- `pr` public comments, when used, are counts only.
- Do not auto-open fix PRs from this audit.

## Process

1. Confirm mode and scope.
2. Read available grounding files in the workspace (if any).
3. Walk threat-led attack paths and keep only reachable Medium+ findings.
4. Emit markdown using `report-format.md`.
5. Hand off to triage/response flow for remediation decisions.
