# Agent-kit integration

**This file is the single source of truth for how this repository adopts [Agent-kit](https://github.com/mnaimfaizy/agent-kit).** CLAUDE.md and AGENTS.md link here and do not restate it. Tracking issue: [#299](https://github.com/mnaimfaizy/fastapi_rbac/issues/299).

Agent-kit supplies reusable GitHub Actions workflows that run Claude Code in this repository. It has two flows:

| Flow | Stage | Status here |
| --- | --- | --- |
| Security audit | 1 | Caller added; off until the Kill switch is set |
| Plan → implement → review | 2 | Not adopted yet; blocked on [mnaimfaizy/agent-kit#52](https://github.com/mnaimfaizy/agent-kit/issues/52) |

For the kit's own terms (Caller, Kill switch, Trigger label, Verified plan, Threat pack), see the [Agent-kit glossary](https://github.com/mnaimfaizy/agent-kit/blob/main/CONTEXT.md). They are tooling terms, not product terms, so they stay out of this repository's `CONTEXT.md`.

## Vocabulary: actor allowlist

Agent-kit calls the list of GitHub logins allowed to trigger a run its "Allowlist". In this repository, **Allowlist** already means the Redis token allowlist (see `CONTEXT.md`). Here, always write **actor allowlist** for the kit's list. It is the `allowlist_actors` input, and it is currently `["mnaimfaizy"]`. Scheduled runs act as the last login to edit the schedule.

## Pinned tag

Current pin: **`v1.0.0-alpha.8`** (commit `6925074e07dca1d40b7186097ac144fcb76c1202`).

Agent-kit uses a split contract: the reusable workflows are referenced remotely (`uses: …@<tag>`), and the files below are copied in **from the same tag**. Never mix tags.

## Kit-owned files

These files are copied from the pinned tag and committed. They are an explicit exception to the rule that engineering skills come from the user-level install. **Do not edit them by hand.** Change them only by re-copying from a new tag.

| Path | Used by |
| --- | --- |
| `.claude/skills/code-review/` | review flow; also replaces the user-level `code-review` skill inside this repo, so local reviews match CI |
| `.claude/skills/security-audit/` | audit flow |
| `.claude/skills/security-finding-triage/` | triaging an audit advisory by hand |
| `.claude/skills/security-response/` | responding to a confirmed finding by hand |
| `.github/agent-runtime/` | every flow (hook that confines agent file reads to the workspace) |
| `.github/agent-pipeline/` | plan and implement (prompts, draft-PR fallback) |
| `.github/security-audit/` | audit (prompt, advisory publisher, email notifier) |

The reusable workflows (`*-reusable.yml`) are **not** copied.

## Consumer-owned files

| Path | Purpose |
| --- | --- |
| `.github/workflows/agent-kit-security-audit.yml` | Audit Caller: weekly `full` run (Monday 03:00 UTC) plus manual dispatch |
| `.security/threat-model.md` | Threat pack: assets, trust boundaries, attack paths. Public |
| `.security/findings-ledger.md` | Threat pack: concept-id fingerprints of known findings only. Public; never holds details |

## Settings

| Kind | Name | Notes |
| --- | --- | --- |
| Secret | `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token`. All flows |
| Secret | `AGENT_KIT_ADVISORIES_TOKEN` | Fine-grained PAT, this repository only, **Repository security advisories: Read and write**. Track its expiry |
| Variable | `CLAUDE_SECURITY_AUDIT_ENABLED` | Audit Kill switch. The audit runs only when this is exactly `true` |
| Variable | `CLAUDE_MODEL` | `claude-opus-5-5`. Per-flow overrides (`CLAUDE_MODEL_AUDIT`, …) are left unset |

The optional extras are not used: the Dependabot alerts token (Dependabot alerts are off on this repository) and the SMTP email notice.

## Turning the audit on

1. Add the two secrets above.
2. `gh variable set CLAUDE_SECURITY_AUDIT_ENABLED --body true`
3. Actions → **Agent-kit security audit** → Run workflow. On success, the log shows counts only. The report is in Security → Advisories as a draft.
4. Triage with the `security-finding-triage` skill, and record each finding's concept id in the findings ledger.

To stop the audit, set the variable to anything else or delete it. No commit is needed.

## Stage 2 prerequisites (plan → implement → review)

Do all of these before the pipeline Caller lands:

1. **Kit fix shipped.** [agent-kit#52](https://github.com/mnaimfaizy/agent-kit/issues/52) makes the implementer's branch prefix set by the Caller, so agent branches follow [`branch-names.md`](branch-names.md). Bump every pin and copied file to the tag that ships it, in one PR.
2. **Tag ruleset.** Protect `v*` tags, because a tag push publishes to Docker Hub. Only admins and GitHub Actions (`release-tag-on-merge.yml` pushes tags with `GITHUB_TOKEN`) may bypass it:

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

3. **Release-branch creation.** Add a `creation` rule to the existing **Release branch** ruleset (`release/**/*`). Its bypass list is already admins and maintainers only:

   ```bash
   gh api repos/mnaimfaizy/fastapi_rbac/rulesets/19662085 --jq '{name,target,enforcement,conditions,bypass_actors,rules:(.rules + [{"type":"creation"}])}' \
     | gh api -X PUT repos/mnaimfaizy/fastapi_rbac/rulesets/19662085 --input -
   ```

4. **Claude GitHub App** installed on this repository, so the implementer's draft PRs start CI.
5. **Pipeline Caller:**
   - `verify_commands` run the fast checks only:
     - backend: `black --check`, `isort --check-only`, `flake8` with the strict `E9,F63,F7,F82` set, `mypy app`, and `pytest test/unit/` (SQLite; needs the CI env vars)
     - frontend: `npm run lint`, `npm run format -- --check`, `npm run build`
   - `setup_commands` install Python 3.10 with uv, then run `pip install -r backend/requirements.txt` and `npm ci --legacy-peer-deps`.
   - API, integration and e2e suites are left to PR CI.
6. **Labels:** `agent:plan`, `agent:implement` and `agent:review`, then set `CLAUDE_PIPELINE_ENABLED=true`.

## Labels: triage state versus trigger

`ready-for-agent` is a triage **state**: the issue is fully specified. `agent:plan` is a **Trigger label**: it starts a run, and the run removes it. A maintainer adds `agent:plan` by hand to an issue that is `ready-for-agent`. Nothing links the two automatically.

## Upgrading

1. Read the Agent-kit CHANGELOG between the current tag and the new one. A Major bump means Caller changes.
2. Re-copy the kit-owned files from the new tag, overwriting:

   ```bash
   TAG=v1.0.0-alpha.8
   git clone --depth 1 --branch "$TAG" https://github.com/mnaimfaizy/agent-kit.git /tmp/agent-kit
   cp -R /tmp/agent-kit/.claude/skills/{code-review,security-audit,security-finding-triage,security-response} .claude/skills/
   cp -R /tmp/agent-kit/.github/agent-runtime /tmp/agent-kit/.github/agent-pipeline /tmp/agent-kit/.github/security-audit .github/
   rm -rf /tmp/agent-kit
   ```

3. Bump every `uses: mnaimfaizy/agent-kit/…@<tag>` to the new tag **in the same commit**, and update the pin above.
4. Diff the Callers against the new tag's `examples/` for new or renamed inputs.

Dependabot ignores pre-release tags (`.github/dependabot.yml`), so every bump is manual until Agent-kit ships a stable tag.
