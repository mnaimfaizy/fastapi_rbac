---
name: security-audit
description: Medium+ threat-led security audit for a repository (`full` or `pr`) with private delivery requirements and no auto-fix.
disable-model-invocation: true
metadata:
  agent-kit-scope: repo
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
- Deliver full findings privately, as a draft security advisory (GHSA), which the kit contract requires. In CI the reusable workflow files the draft advisory from this report. By hand, nothing files it for you: file the draft advisory yourself, and keep the report out of anywhere public.
- `pr` public comments, when used, are counts only.
- Do not auto-open fix PRs from this audit.

## Process

1. Find the Threat pack: this repository's threat model and its findings ledger. You need both.
   - In CI, both are inlined later in this brief, under the headings "Threat model (inline for CI reliability)" and "Findings ledger". That counts as found.
   - By hand, read the repository's security-audit Caller (the workflow under `.github/workflows/` that uses `security-audit-reusable.yml`) for its `threat_model_path` and `findings_ledger_path`. With no Caller, look for `.security/threat-model.md` and `.security/findings-ledger.md` (the `agent-kit init` default).
   - If either is missing, stop before any other work. Say that `security-audit` is a Repo-scope skill: it needs a Threat pack in this repository, and Agent-kit's `docs/install-skills.md` (`https://github.com/mnaimfaizy/agent-kit/blob/main/docs/install-skills.md`) says how to set one up.
   - Do not check the install location. Where this skill is installed says nothing about the repository it audits.
2. Confirm mode and scope.
3. Read available grounding files in the workspace (if any).
4. Walk threat-led attack paths and keep only reachable Medium+ findings.
5. Emit markdown using `report-format.md`.
6. Hand off to triage/response flow for remediation decisions.
