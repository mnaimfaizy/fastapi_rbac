# Agent-kit integration

**This file is the single source of truth for how this repository adopts [Agent-kit](https://github.com/mnaimfaizy/agent-kit).** CLAUDE.md and AGENTS.md link here and do not restate it. Tracking issue: [#299](https://github.com/mnaimfaizy/fastapi_rbac/issues/299).

Agent-kit supplies reusable GitHub Actions workflows that run Claude Code in this repository. It has two flows:

| Flow | Stage | Status here |
| --- | --- | --- |
| Security audit | 1 | Adopted; runs weekly while the Kill switch is `true` |
| Plan → implement → review | 2 | Caller landed; off until the prerequisites below are done and its Kill switch is `true` |

For the kit's own terms (Caller, Kill switch, Trigger label, Verified plan, Threat pack), see the [Agent-kit glossary](https://github.com/mnaimfaizy/agent-kit/blob/main/GLOSSARY.md). They are tooling terms, not product terms, so they stay out of this repository's `CONTEXT.md`.

## Vocabulary: actor allowlist

Agent-kit calls the list of GitHub logins allowed to trigger a run its "Allowlist". In this repository, **Allowlist** already means the Redis token allowlist (see `CONTEXT.md`). Here, always write **actor allowlist** for the kit's list. It is the `allowlist_actors` input, and it is currently `["mnaimfaizy"]`. Scheduled runs act as the last login to edit the schedule.

## Pinned tag

Current pin: **`v1.0.0-alpha.9`** (commit `ac52d893057c287c2707e6678649256c09e1388c`).

Agent-kit uses a split contract: the reusable workflows are referenced remotely (`uses: …@<tag>`), and the files below are copied in **from the same tag**. Never mix tags.

## Kit-owned files

These files are copied from the pinned tag and committed. They are an explicit exception to the rule that engineering skills come from the user-level install. **Do not edit them by hand.** Change them only by re-copying from a new tag.

| Path | Used by |
| --- | --- |
| `.claude/skills/code-review/` | review flow; also replaces the user-level `code-review` skill inside this repo, so local reviews match CI |
| `.claude/skills/security-audit/` | audit flow |
| `.claude/skills/security-finding-triage/` | triaging an audit advisory by hand |
| `.claude/skills/security-response/` | responding to a confirmed finding by hand |
| `.github/agent-runtime/` | every flow: hooks that confine agent reads to the workspace and, for implement, writes to the working tree; implement's git-config and push guards |
| `.github/agent-pipeline/` | plan and implement (prompts, draft-PR fallback) |
| `.github/security-audit/` | audit (prompt, advisory publisher, email notifier) |

The reusable workflows (`*-reusable.yml`) are **not** copied.

## Consumer-owned files

| Path | Purpose |
| --- | --- |
| `.github/workflows/agent-kit-security-audit.yml` | Audit Caller: weekly `full` run (Monday 03:00 UTC) plus manual dispatch |
| `.github/workflows/agent-kit-pipeline.yml` | Pipeline Caller: plan and implement on issue labels, review on PR labels, plus manual dispatch |
| `.security/threat-model.md` | Threat pack: assets, trust boundaries, attack paths. Public |
| `.security/findings-ledger.md` | Threat pack: concept-id fingerprints of known findings only. Public; never holds details |

## Settings

| Kind | Name | Notes |
| --- | --- | --- |
| Secret | `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token`. All flows |
| Secret | `AGENT_KIT_ADVISORIES_TOKEN` | Fine-grained PAT, this repository only, **Repository security advisories: Read and write**. Track its expiry |
| Variable | `CLAUDE_SECURITY_AUDIT_ENABLED` | Audit Kill switch. The audit runs only when this is exactly `true` |
| Variable | `CLAUDE_PIPELINE_ENABLED` | Pipeline Kill switch. Unset until every step in "Turning the pipeline on" is done |
| Variable | `CLAUDE_MODEL` | `claude-opus-5-5`. Per-flow overrides (`CLAUDE_MODEL_AUDIT`, …) are left unset |

The optional extras are not used: the Dependabot alerts token (Dependabot alerts are off on this repository) and the SMTP email notice.

## Turning the audit on

1. Add the two secrets above.
2. `gh variable set CLAUDE_SECURITY_AUDIT_ENABLED --body true`
3. Actions → **Agent-kit security audit** → Run workflow. On success, the log shows counts only. The report is in Security → Advisories as a draft. If the agent writes no report, the job still fails with `Empty report`, but it first files a private draft advisory marked as a failed run, with the session transcript, so the cause can be read there. The log's `Final line:` verdict says whether the agent believed it had finished.
4. Triage with the `security-finding-triage` skill, and record each finding's concept id in the findings ledger.

To stop the audit, set the variable to anything else or delete it. No commit is needed.

## Plan → implement → review

The pipeline Caller is `.github/workflows/agent-kit-pipeline.yml`. Each job runs when its Trigger label is added, or from **Run workflow** with `mode` set:

| Trigger | On | What runs |
| --- | --- | --- |
| `agent:plan` | issue | Posts a plan comment that starts with `<!-- agent-kit-plan -->`. Only a plan comment by `github-actions[bot]` counts as the Verified plan |
| `agent:implement` | issue with a Verified plan | Writes the change on a branch, runs the verify commands in a job with no write credential, then opens a draft PR |
| `agent:review` | pull request | Reviews the PR with the kit-owned `code-review` skill against the Verified plan, or against a `<!-- agent-kit-brief -->` comment by a login in `trusted_spec_authors` (`["mnaimfaizy"]`). Fork PRs are skipped |

Caller choices:

- **Branch names** follow [`branch-names.md`](branch-names.md): `branch_name_template` is `{{prefix}}{{entityNumber}}-{{description}}`, and `branch_prefix` comes from the issue's labels: `bug` gives `fix/`, `documentation` gives `docs/`, `cleanup`, `maintenance` or `dependencies` give `chore/`, anything else gives `feat/`. A manual dispatch has no issue payload, so it always gets `feat/`. If the name already exists, the action falls back to its default `claude/…` naming.
- **`setup_commands`** take Python 3.10 and Node 22 from the runner's tool cache (no downloads), create a venv under `$RUNNER_TEMP`, install `backend/requirements.txt` and run `npm ci --legacy-peer-deps`, and start a Redis container for the unit tests. They run in both the implement and verify jobs.
- **`verify_commands`** run the fast checks only, with Backend CI's non-secret test settings (database, signing-key and superuser settings keep their `config.py` defaults):
  - backend: `black --check`, `isort --check-only`, `flake8` with the strict `E9,F63,F7,F82` set, `mypy app`, and `pytest test/unit/` (SQLite)
  - frontend: `npm run lint`, `npm run format -- --check`, `npm run build`
  - API, integration and e2e suites are left to PR CI.
- **`extra_allowed_tools`** is left empty. The implementer cannot run the test suite itself; the verify job does. Widening it would let agent-written code run with the Claude App token.
- Each job asks for only the permissions its reusable workflow needs. Runs are serialised per issue or PR.

## Turning the pipeline on

Do all of these first. The Caller is safe to have on `main` before then, because nothing runs while the Kill switch is unset.

1. **Claude GitHub App** installed on this repository, so the implementer's draft PRs start CI.
2. **Stop the App merging its own PR.** The **Strict rules for main branch** ruleset (id `19662620`) requires a pull request, but with zero required approvals that does not stop the Claude GitHub App merging its own pull request. Add an `update` rule so only the bypass roles can change `main`. Its bypass list is already admins and maintainers. Merges then need the bypass, which skips required checks, so wait for CI before merging:

   ```bash
   gh api repos/mnaimfaizy/fastapi_rbac/rulesets/19662620 --jq '{name,target,enforcement,conditions,bypass_actors,rules:(.rules + [{"type":"update","parameters":{"update_allows_fetch_and_merge":false}}])}' \
     | gh api -X PUT repos/mnaimfaizy/fastapi_rbac/rulesets/19662620 --input -
   ```

3. **Tag ruleset.** Protect `v*` tags, because a tag push publishes to Docker Hub. Only admins and GitHub Actions (`release-tag-on-merge.yml` pushes tags with `GITHUB_TOKEN`) may bypass it:

   ```bash
   gh api -X POST repos/mnaimfaizy/fastapi_rbac/rulesets --input - <<'EOF'
   {
     "name": "Release tags",
     "target": "tag",
     "enforcement": "active",
     "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
     "rules": [ { "type": "creation" }, { "type": "update" }, { "type": "deletion" }, { "type": "non_fast_forward" } ],
     "bypass_actors": [
       { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" },
       { "actor_id": 15368, "actor_type": "Integration", "bypass_mode": "always" }
     ]
   }
   EOF
   ```

4. **Release-branch creation.** Add a `creation` rule to the existing **Release branch** ruleset (`release/**/*`). Its bypass list is already admins and maintainers only:

   ```bash
   gh api repos/mnaimfaizy/fastapi_rbac/rulesets/19662085 --jq '{name,target,enforcement,conditions,bypass_actors,rules:(.rules + [{"type":"creation"}])}' \
     | gh api -X PUT repos/mnaimfaizy/fastapi_rbac/rulesets/19662085 --input -
   ```

5. **Labels:**

   ```bash
   gh label create agent:plan --color 5319E7 --description "Agent-kit: write a plan for this issue"
   ```

   ```bash
   gh label create agent:implement --color 5319E7 --description "Agent-kit: implement the Verified plan"
   ```

   ```bash
   gh label create agent:review --color 5319E7 --description "Agent-kit: review this pull request"
   ```

6. `gh variable set CLAUDE_PIPELINE_ENABLED --body true`
7. Try it on a small `ready-for-agent` issue: add `agent:plan`, read the plan, then add `agent:implement`, then add `agent:review` to the draft PR.

To stop the pipeline, set the variable to anything else or delete it.

## Labels: triage state versus trigger

`ready-for-agent` is a triage **state**: the issue is fully specified. `agent:plan` is a **Trigger label**: it starts a run, and the run removes it. A maintainer adds `agent:plan` by hand to an issue that is `ready-for-agent`. Nothing links the two automatically.

## Upgrading

1. Read the Agent-kit CHANGELOG between the current tag and the new one. A Major bump means Caller changes.
2. Replace the kit-owned folders with the new tag's copies. Delete them first, so files the kit removed don't linger:

   ```bash
   TAG=v1.0.0-alpha.9   # the new tag
   git clone --depth 1 --branch "$TAG" https://github.com/mnaimfaizy/agent-kit.git /tmp/agent-kit
   for p in .claude/skills/code-review .claude/skills/security-audit .claude/skills/security-finding-triage \
            .claude/skills/security-response .github/agent-runtime .github/agent-pipeline .github/security-audit; do
     rm -rf "$p" && cp -R "/tmp/agent-kit/$p" "$p"
   done
   rm -rf /tmp/agent-kit
   ```

3. Bump every `uses: mnaimfaizy/agent-kit/…@<tag>` to the new tag **in the same commit**, and update the pin above.
4. Diff the Callers against the new tag's `examples/` for new or renamed inputs.

Dependabot ignores pre-release tags (`.github/dependabot.yml`), so every bump is manual until Agent-kit ships a stable tag.
