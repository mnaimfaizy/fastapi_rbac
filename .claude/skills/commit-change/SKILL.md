---
name: commit-change
description: Use when the user asks to commit the current work, make a commit, or save the staged changes as a commit in this repository. Stages named paths, has the commit-drafter sub-agent draft the message from the staged diff, and commits only through scripts/development/commit-runner.sh so every pre-commit hook runs.
---

# Commit change

Canonical rules and the full failure table: [`docs/agents/commit-pipeline.md`](../../../docs/agents/commit-pipeline.md). Message format: [`docs/agents/commit-messages.md`](../../../docs/agents/commit-messages.md).

## Who does what

| Step | Owner |
| --- | --- |
| Inspect the tree and decide what to stage | You, asking the user when it is mixed |
| Draft the message from the staged diff | `commit-drafter` agent (read-only) |
| Run `git commit` with the hooks | `bash scripts/development/commit-runner.sh` |
| Repair a failure the runner reports | You, then run the runner again |

Never ask `commit-drafter` to stage, commit or fix anything.

## Rules

- Never run `git commit` yourself, and never use `--no-verify`. The only way to commit is `bash scripts/development/commit-runner.sh --message-file <path>`.
- Pass the message as a file. Do not pipe it on stdin or put it in a quoted argument.
- Wait for the runner to return. Do not cancel it, background it, or start other work while its hooks run.
- Never run `git add .` or `git add -A`. Stage the paths the user means to commit, by name.
- Do not stage a secret-looking file: `.env` or `.env.*` (except `.env.example`, `.env.sample`, `.env.template`), private keys, certificates, `credentials.json`. Never create or commit `.sandcastle/.env`. If one is already staged, unstage it with `git restore --staged <path>` and tell the user.
- If `commit-drafter` proposes a split, stop and ask which group to commit first. Do not commit every proposed message.
- Branch names follow [`docs/agents/branch-names.md`](../../../docs/agents/branch-names.md). Pushing, PRs and merging are not part of this skill.

## Steps

1. Run `git status --short`. If nothing is staged, list the changed and untracked paths and ask which to stage. If staged and unstaged changes are mixed, list both sets and ask before staging more.
2. Stage the intended paths by name, then confirm with `git status --short`.
3. Call `commit-drafter`. If it returns `NO_STAGED_CHANGES:`, go back to step 1.
4. Write its message to a temporary file. Add `Closes #<n>` only when you know the issue number.
5. Run `bash scripts/development/commit-runner.sh --message-file <path>` and wait for it.
6. On success, report the commit's short hash and subject.
7. On failure, read the trailer at the end of the output and act on its `reason` (below). Run the narrow check in `hint` until it passes, then run the same runner command again.

## Failure reasons

The runner ends every failure with a trailer: `commit-runner: failed`, `reason`, optional `scope` and `paths`, and `hint`.

| reason | What to do |
| --- | --- |
| `empty-index` | Stage the intended paths (asking the user), call `commit-drafter`, retry. |
| `secret` | Unstage every path in `paths`. Do not retry until they are out of the index. |
| `hooks-missing` | Run `pre-commit install`, then retry. |
| `format` | black, isort, trailing-whitespace or end-of-file rewrote files. Run `git diff --name-only`, check the rewrite, stage those paths by name, retry. |
| `lint` | flake8 or mypy failed; `scope` names which. Run `pre-commit run <hook in scope> --files $(git diff --cached --name-only)`, fix what it reports, stage the fix by name, retry. |
| `explainer-drift` | An explainer page no longer matches the code. See below. |
| `hook` | Read the hook output above the trailer (for example `action-pins`), fix that check, retry. |
| `unknown` | Read the output above the trailer, fix the cause, retry. |

### explainer-drift

`scope` lists the kinds of drift. Run `python scripts/docs/check_explainers.py` first: each finding names the page, the cited range and its own `fix:` line. Then, per `scope`:

| scope | Do this |
| --- | --- |
| `Cited code moved` | `python scripts/docs/check_explainers.py --fix` (pure line shifts only). If it leaves a citation alone because the lines now appear more than once, pick the right copy with `--move <file:line>=<new line>`. |
| `Cited code changed` | Read the page text beside the new code. Edit the page where it is now wrong, then `--accept <file or full citation>`. `--accept` records that you reviewed it, so never run it unread. |
| `Citation with no anchor` or `Anchor with no citation` | `python scripts/docs/check_explainers.py --stamp`, after checking each new citation against the code. |
| `Manifest value no longer matches the code` | Correct the value on the page. |
| `Data block and beat log disagree` | Make the beat log say what the data block says. |

Stage every page the command changed by name (it is under `docs/explainers/`), re-run `python scripts/docs/check_explainers.py` until it prints that every page matches, then run the runner again. If the change is only a line-range update, say so in the commit body. Workflow reference: [`docs/development/explainer-pages.md`](../../../docs/development/explainer-pages.md).

Do not retry until the check in `hint` passes.
