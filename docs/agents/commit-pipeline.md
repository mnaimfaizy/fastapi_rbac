# Commit pipeline (canonical)

**This file is the single source of truth for how an agent commits in this repository.** Commit message format stays in [`commit-messages.md`](commit-messages.md); this file covers the route a commit takes.

Adapted from the Agent-kit [commit-pipeline Pattern guide](https://github.com/mnaimfaizy/agent-kit/blob/v1.0.0-beta.9/docs/patterns/commit-pipeline.md) (v1.0.0-beta.9). Agent-kit does not install or upgrade it, so these files are consumer-owned and not part of the kit-owned paths.

## Parts

| Part | File | Job |
| --- | --- | --- |
| Skill | [`.claude/skills/commit-change/SKILL.md`](../../.claude/skills/commit-change/SKILL.md) | Stages named paths, calls the drafter, runs the runner, repairs a failure. Load it whenever you commit. |
| Drafter | [`.claude/agents/commit-drafter.md`](../../.claude/agents/commit-drafter.md), [`.cursor/agents/commit-drafter.md`](../../.cursor/agents/commit-drafter.md) | Read-only. Drafts one message from the staged diff and returns text. Harness wrappers only; the rules live here. |
| Runner | [`scripts/development/commit-runner.sh`](../../scripts/development/commit-runner.sh) | The only place `git commit` runs. Checks the index, runs every hook, ends a failure with a trailer. |

## Rules

- Agents commit only through the runner: `bash scripts/development/commit-runner.sh --message-file <path>`. Never `git commit`, and never `--no-verify`.
- Stage named paths only. Never `git add .` or `git add -A`. Ask the user when nothing is staged, or when staged and unstaged changes are mixed.
- The drafter reads only `git diff --staged`, is read-only (the Cursor wrapper enforces it with `readonly: true`; the Claude wrapper grants `Bash` and narrows it with a `PreToolUse` hook, `scripts/development/commit-drafter-guard.sh`, that allows only `git status`, `diff`, `log` and `show`. Claude Code's subagent `tools` field cannot scope Bash to commands, so the hook is the documented way), and follows [`commit-messages.md`](commit-messages.md) (types, component/domain scopes, no emoji, `Closes #n` footers).
- The message goes to the runner as a file, not on stdin or in a quoted argument.
- Wait for the runner to finish. Do not cancel or background it.
- If the drafter proposes a split, ask which group goes first; do not commit every proposed message.
- Retry only after the narrow check named in the trailer's `hint` passes.

## The runner's checks

In order: message file present and non-empty, index not empty, no secret-looking staged path (by file name: `.env` and `.env.*` except the `.example`, `.sample` and `.template` forms, key and certificate files, `credentials.json`), the `pre-commit` hook is installed, then `git commit` with every hook.

## Failure trailer

The runner reprints the hook output, then ends every failure with:

```text
---
commit-runner: failed
reason: <reason>
scope: <only when the check named one>
paths: <only for reason secret>
hint: <the command to run next>
---
```

Field names and the reason set are an interface that agents parse: add reasons, do not rename them.

| `reason` | Meaning | What to do |
| --- | --- | --- |
| `empty-index` | Nothing staged | Stage the intended paths, draft again |
| `secret` | A staged path looks like a secret | `git restore --staged` each path in `paths` |
| `hooks-missing` | `.git/hooks/pre-commit` is not installed | `pre-commit install` |
| `format` | trailing-whitespace, end-of-file, black or isort rewrote files | Review `git diff`, stage the rewritten paths by name, retry |
| `lint` | flake8 or mypy failed (`scope` names which) | `pre-commit run <hook in scope> --files <staged paths>` (the hint spells it out), fix, retry |
| `explainer-drift` | A page under `docs/explainers/` no longer matches the code (`scope` lists the kinds of drift) | See below |
| `hook` | Another hook failed (for example `action-pins`) | Read the output above the trailer, fix that check |
| `unknown` | Anything else | Read the git output, fix the cause |

`format` is reported before `lint`, and `lint` before `explainer-drift`, because a formatter rewrite can move lines an explainer cites.

### `explainer-drift`

`scope` holds the headings printed by `scripts/docs/check_explainers.py`. Run `python scripts/docs/check_explainers.py` to see each finding with its own `fix:` line, then use the command for the scope. The full workflow is [`docs/development/explainer-pages.md`](../development/explainer-pages.md).

| `scope` heading | Command | Notes |
| --- | --- | --- |
| Cited code moved | `python scripts/docs/check_explainers.py --fix` | Pure line shifts only. If the same lines now appear more than once, use `--move <file:line>=<new line>` for the copy the page means. |
| Cited code changed | Compare the page's text with the new code, edit the page if it is now wrong, then `--accept <file or full citation>` | Never accept blindly: `--accept` records that the page was reviewed. |
| Citation with no anchor, Anchor with no citation | `--stamp` | After every new citation is checked against the code. |
| Manifest value no longer matches the code | Correct the value on the page | Re-run the checker. |
| Data block and beat log disagree | Make the static beat log say what the data block says | |
| Citation that names no single file | Name one file in the citation, or reword it so it is not a citation | The checker's `fix:` line names the page and context. |
| Checker configuration | Restore the manifest or data block, or add or remove the matching source rule | The checker's `fix:` line says which. |

Any heading not in this table is handled by the `fix:` line in the `python scripts/docs/check_explainers.py` output; the checker's `TITLES` map is the source of the headings.

Every page the command changes is staged by name, then the runner runs again. A pure `--fix` or `--stamp` does not need a prose change; say in the commit body that line ranges were updated.

## What was adapted, and what was left out

- The drafter's scopes and types come from `commit-messages.md` (including `security` and `revert`), not the pattern's generic list.
- The runner's failure patterns match this repo's `.pre-commit-config.yaml` hook names. Add a pattern when you add a hook.
- Added to the pattern: the `hooks-missing` check and the `explainer-drift` reason.
- Left out: the origin-line check on fix commits (`Introduced by #<pr>`). The repo has no fix-origin convention, and the pattern marks it optional.
- Left out: a commit-msg hook and its `message` reason. There is no message hook; the drafter is the only message check.
- The runner is Bash. On Windows, use Git Bash.

## Trying a failure on purpose

Stage a file with a lint error and a file named `.env.local`, ask the agent to commit, and check that it gets the `secret` trailer first, then `lint`, and fixes only what each names. Never create `.sandcastle/.env`.
