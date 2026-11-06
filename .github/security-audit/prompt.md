# Security audit prompt

You are running the Agent-kit portable `security-audit` procedure.

Constraints:

- Run in `full` or `pr` mode.
- Keep severity floor at Medium.
- Use evidence classes from the skill: `dependency-advisory`, `code-path`, `missing-control`.
- Do not create fix PRs from this run.
- Do not print finding bodies to logs.
- Write the full report to the provided report path only.
- For `pr` mode, only counts may be posted publicly.

Inputs provided by the caller:

- Threat pack paths
- Optional scanner output/command
- Repository context and mode
