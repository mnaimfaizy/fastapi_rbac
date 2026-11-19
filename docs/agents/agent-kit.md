# Agent-kit integration

**This file is the single source of truth for how this repository adopts [Agent-kit](https://github.com/mnaimfaizy/agent-kit).** CLAUDE.md and AGENTS.md link here and do not restate it. Tracking issue: [#299](https://github.com/mnaimfaizy/fastapi_rbac/issues/299).

Agent-kit supplies reusable GitHub Actions workflows that run Claude Code in this repository. It has three flows:

| Flow | Stage | Status here |
| --- | --- | --- |
| Security audit | 1 | Adopted; runs weekly while the Kill switch is `true` |
| Plan → implement → review | 2 | Adopted; runs on its Trigger labels while the Kill switch is `true` |
| Review response | 3 | Adopted ([#366](https://github.com/mnaimfaizy/fastapi_rbac/issues/366)); off until its Kill switch is `true` |

For local, sandboxed agent runs on your own machine (Claude Code, Cursor or Copilot), see the [Sandcastle runbook](sandcastle.md) instead.

For the kit's own terms (Caller, Kill switch, Trigger label, Verified plan, Threat pack), see the [Agent-kit glossary](https://github.com/mnaimfaizy/agent-kit/blob/main/GLOSSARY.md). They are tooling terms, not product terms, so they stay out of this repository's `CONTEXT.md`.

## Vocabulary: actor allowlist

Agent-kit calls the list of GitHub logins allowed to trigger a run its "Allowlist". In this repository, **Allowlist** already means the Redis token allowlist (see `CONTEXT.md`). Here, always write **actor allowlist** for the kit's list. It is the `allowlist_actors` input, and it is currently `["mnaimfaizy"]`. Scheduled runs act as the last login to edit the schedule.

## Pinned tag

Current pin: **`v1.0.0-beta.9`** (commit `fb9321333cb20caa5a6e1aeb564c9d72a3e151c5`).

Agent-kit uses a split contract: the reusable workflows are referenced remotely (`uses: …@<tag>`), and the files below are copied in **from the same tag**. Never mix tags.

## Kit-owned files

These files are copied from the pinned tag and committed. They are an explicit exception to the rule that engineering skills come from the user-level install. **Do not edit them by hand.** Change them only by re-copying from a new tag. The tag's `kit-owned-paths.txt` is the authoritative list; this table mirrors it.

| Path | Used by |
| --- | --- |
| `.claude/skills/code-review/` | review flow; also replaces the user-level `code-review` skill inside this repo, so local reviews match CI |
| `.claude/skills/security-audit/` | audit flow |
| `.claude/skills/security-finding-triage/` | triaging an audit advisory by hand |
| `.claude/skills/security-response/` | responding to a confirmed finding by hand |
| `.claude/skills/explainer/` | optional: writing an Explainer Page by hand; no flow uses it |
| `.claude/skills/instruction-drift-audit/` | optional: comparing repo-owned instructions to upstream docs by hand; no flow uses it |
| `.claude/skills/qa-plan/` | by hand (`/qa-plan` on an open pull request): writes a QA Plan of the manual checks CI does not prove. Reads `qa.config.yml` |
| `.claude/skills/manual-qa/` | by hand (`/manual-qa` on a QA Plan): runs it against a QA Stack or a hosted test environment, and saves a local screenshot at each scenario's result. Reads `qa.config.yml` and the QA Accounts seeder |
| `.claude/skills/plain-prose/` | optional: `/plain-prose` on a file or pasted text rewrites prose a person reads (PR bodies, READMEs, ADRs) into plain sentences; no flow uses it |
| `.claude/skills/address-pr-review/` | review response flow; also by hand (`/address-pr-review <n>` on an open pull request): answers its unresolved review threads, shows every reply first and posts only after you confirm. Optional config `address-pr-review.config.yml` (not added here; defaults apply) |
| `.claude/skills/orchestrate/` | optional: `/orchestrate #12 #34` runs a set of issues through other agent sessions; reads `orchestrate.config.yml`. `/orchestrate --spec <n> --team` is a Team Run ([below](#orchestrate-team-run)); no flow uses it |
| `.github/agent-runtime/` | every flow: hooks that confine agent reads to the workspace and, for implement, writes to the working tree; implement's git-config and push guards; review's `review-threads.mjs`, which posts each finding as an inline thread |
| `.github/agent-pipeline/` | plan and implement (prompts, draft-PR fallback) |
| `.github/security-audit/` | audit (prompt, advisory publisher, email notifier) |
| `.github/agent-review-response/` | review response (trusted script `review-response.mjs`: gate, Work list, publish) |

The reusable workflows (`*-reusable.yml`) are **not** copied.

## Consumer-owned files

| Path | Purpose |
| --- | --- |
| `.github/workflows/agent-kit-security-audit.yml` | Audit Caller: weekly `full` run (Monday 03:00 UTC) plus manual dispatch |
| `.github/workflows/agent-kit-pipeline.yml` | Pipeline Caller: plan and implement on issue labels, review on PR labels, plus manual dispatch |
| `.github/workflows/agent-kit-review-response.yml` | Review response Caller: one Response round on the `agent:address-review` PR label, or on the review handoff's dispatch in auto mode |
| `.security/threat-model.md` | Threat pack: assets, trust boundaries, attack paths. Public |
| `.security/findings-ledger.md` | Threat pack: concept-id fingerprints of known findings only. Public; never holds details |
| `orchestrate.config.yml` | Settings for the `orchestrate` skill: what to read first, the commit and pull request routes, the re-gate commands, QA for Ready to Merge, and the Team Run's `tracker` and `team` labels |
| `qa.config.yml` | Settings for `qa-plan` and `manual-qa`: the base ref and test suites, PR-comment delivery, the QA Stack commands and the QA Accounts roles. See [QA Accounts](../reference/qa-accounts.md) |

## Settings

| Kind | Name | Notes |
| --- | --- | --- |
| Secret | `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token`. All flows |
| Secret | `AGENT_KIT_ADVISORIES_TOKEN` | Fine-grained PAT, this repository only, **Repository security advisories: Read and write**. Track its expiry |
| Secret | `RELEASE_TAG_DEPLOY_KEY` | Private half of the write deploy key `release-tag-on-merge.yml` pushes `v*` tags with (see the tag ruleset step). Not an Agent-kit secret, but the tag ruleset depends on it |
| Variable | `CLAUDE_SECURITY_AUDIT_ENABLED` | Audit Kill switch. The audit runs only when this is exactly `true` |
| Variable | `CLAUDE_AGENT_FLOW_ENABLED` | Agent flow Kill switch (plan, implement, review). The flow runs only when this is exactly `true`. Renamed from `CLAUDE_PIPELINE_ENABLED` in v1.0.0-beta.8, with no fallback |
| Variable | `CLAUDE_PLAN_ENABLED`, `CLAUDE_IMPLEMENT_ENABLED`, `CLAUDE_REVIEW_ENABLED` | Optional. Exactly `false` turns off that one Stage while the flow is on. Left unset |
| Variable | `CLAUDE_REVIEW_RESPONSE_ENABLED` | Review response Kill switch. A round runs only when this is exactly `true` |
| Variable | `CLAUDE_REVIEW_RESPONSE_MODE` | Optional. Exactly `auto` turns on the review handoff; unset is manual (label only) |
| Variable | `CLAUDE_MODEL` | The model for every Stage; the Callers fall back to `claude-opus-5-5` when it is unset. Per-Stage overrides `CLAUDE_<STAGE>_MODEL` (`CLAUDE_PLAN_MODEL`, `CLAUDE_IMPLEMENT_MODEL`, `CLAUDE_REVIEW_MODEL`, `CLAUDE_REVIEW_RESPONSE_MODEL`, `CLAUDE_SECURITY_AUDIT_MODEL`) are left unset |
| Variable | `CLAUDE_EFFORT` | Optional reasoning effort for every Stage, with per-Stage overrides `CLAUDE_<STAGE>_EFFORT`. Unset leaves the model's default |

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
- **`setup_commands`** take Node 22 from the runner's tool cache and Python 3.10 from it when present. `ubuntu-latest` is Ubuntu 26.04, which caches no CPython 3.10, so they then install 3.10 with `pipx run uv` (a download from PyPI and python-build-standalone). They create a venv under `$RUNNER_TEMP`, install `backend/requirements.txt` and run `npm ci --legacy-peer-deps`, and start a Redis container for the unit tests. They run in both the implement and verify jobs.
- **`verify_commands`** run the fast checks only, with Backend CI's non-secret test settings (database, signing-key and superuser settings keep their `config.py` defaults):
  - backend: `black --check`, `isort --check-only`, `flake8` with the strict `E9,F63,F7,F82` set, `mypy app`, and `pytest test/unit/` (SQLite)
  - frontend: `npm run lint`, `npm run format:check`, `npm run build`
  - API, integration and e2e suites are left to PR CI.
- **`extra_allowed_tools`** is left empty. The implementer cannot run the test suite itself; the verify job does. Widening it would let agent-written code run with the Claude App token.
- Each job asks for only the permissions its reusable workflow needs. Runs are serialised per issue or PR. The review job grants `actions: write` (required from v1.0.0-beta.7, even in manual mode) for the review response handoff.
- The review job posts every finding as an inline review thread (from v1.0.0-beta.8, through the Kit-owned `.github/agent-runtime/review-threads.mjs`), and its tracking comment is a Review report with `### Checked` and `### Fixed` sections. Those threads are what Review response answers.
- The review job passes the `response_*` handoff inputs. They hand nothing off unless `CLAUDE_REVIEW_RESPONSE_MODE` is exactly `auto`.

## Turning the pipeline on

Do all of these first. The Caller is safe to have on `main` before then, because nothing runs while the Kill switch is unset.

1. **Claude GitHub App** installed on this repository, so the implementer's draft PRs start CI.
2. **Stop the App merging its own PR.** The **Strict rules for main branch** ruleset (id `19662620`) requires a pull request, but with zero required approvals that does not stop the Claude GitHub App merging its own pull request. Add an `update` rule so only the bypass roles can change `main`. Its bypass list is already admins and maintainers. Merges then need the bypass, which skips required checks, so wait for CI before merging:

   ```bash
   gh api repos/mnaimfaizy/fastapi_rbac/rulesets/19662620 --jq '{name,target,enforcement,conditions,bypass_actors,rules:(.rules + [{"type":"update","parameters":{"update_allows_fetch_and_merge":false}}])}' \
     | gh api -X PUT repos/mnaimfaizy/fastapi_rbac/rulesets/19662620 --input -
   ```

3. **Tag ruleset.** Protect `v*` tags, because a tag push publishes to Docker Hub. On a personal-account repository GitHub Actions cannot be a ruleset bypass actor, so `release-tag-on-merge.yml` pushes its tag over SSH with a deploy key, and only admins and deploy keys may bypass:
   1. Make a key pair (no passphrase) outside the repository:

      ```bash
      ssh-keygen -t ed25519 -N "" -C "release-tag-on-merge" -f ~/release-tag-deploy-key
      ```

   2. Add the public key as a deploy key **with write access**:

      ```bash
      gh repo deploy-key add ~/release-tag-deploy-key.pub --repo mnaimfaizy/fastapi_rbac --title "release-tag-on-merge" --allow-write
      ```

   3. Store the private key as the Actions secret `RELEASE_TAG_DEPLOY_KEY`, then delete both key files:

      ```bash
      gh secret set RELEASE_TAG_DEPLOY_KEY --repo mnaimfaizy/fastapi_rbac < ~/release-tag-deploy-key && rm ~/release-tag-deploy-key ~/release-tag-deploy-key.pub
      ```

   4. Create the ruleset:

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
          { "actor_type": "DeployKey", "bypass_mode": "always" }
        ]
      }
      EOF
      ```

   A deploy key with write access can push any branch or tag, so treat `RELEASE_TAG_DEPLOY_KEY` like an admin credential. Only `release-tag-on-merge.yml` reads it.

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

6. `gh variable set CLAUDE_AGENT_FLOW_ENABLED --body true`
7. Try it on a small `ready-for-agent` issue: add `agent:plan`, read the plan, then add `agent:implement`, then add `agent:review` to the draft PR.

To stop the pipeline, set the variable to anything else or delete it. To stop one Stage only, set `CLAUDE_PLAN_ENABLED`, `CLAUDE_IMPLEMENT_ENABLED` or `CLAUDE_REVIEW_ENABLED` to `false`.

## Review response

The Review response Caller is `.github/workflows/agent-kit-review-response.yml`. It answers the code review on a pull request: each unresolved review thread started by `github-actions` (the kit reviewer) is a Finding, and gets the Verdict `fixed` (one commit), `addressed` or `declined`. Agent-kit's guide: [docs/review-response.md](https://github.com/mnaimfaizy/agent-kit/blob/v1.0.0-beta.9/docs/review-response.md).

| Trigger | On | What runs |
| --- | --- | --- |
| `agent:address-review` | pull request into `main`, from this repository | One Response round: the agent fixes in a read-only job, then a fresh job pushes the commits to the PR's own branch (never force), replies on the threads, resolves the ones its fix changed, and posts one summary comment that starts with `<!-- agent-review-response -->` |
| Review handoff | auto mode only | A finished `agent:review` run that left findings dispatches the Caller on `main` with `pr_number`. At most two rounds per PR. A round never starts a new review |

Caller choices:

- **`allowlist_actors`** is `["mnaimfaizy"]`, the same as the pipeline. Only those logins can start a round, and only their thread replies count as Maintainer guidance.
- **`reviewer_logins`** is empty, so Findings are only the kit reviewer's threads.
- **`setup_commands`** and **`verify_commands`** are the implement job's, except that Redis binds to `127.0.0.1`. npm install scripts are always off in this job. The agent runs `verify_commands` before each fix commit.
- **`ci_workflow`** is `.github/workflows/ci.yml`. A push made with the job token holds the PR's CI runs for approval; the round starts the held `ci.yml` run for the commit it pushed. `ci.yml` is the only pull request CI workflow and calls the backend, frontend and docs checks.
- A round refuses fork PRs, PRs into any branch but `main`, Dependabot PRs and PRs that change a protected path. Review those by hand.
- The round reads its trusted script, hooks and skill from `main`'s tip, so the Kit-owned paths must be merged before the first round.

## Turning review response on

1. **Label:**

   ```bash
   gh label create agent:address-review --color 5319E7 --description "Agent-kit: answer this pull request's review"
   ```

2. `gh variable set CLAUDE_REVIEW_RESPONSE_ENABLED --body true`
3. Optional: `gh variable set CLAUDE_REVIEW_RESPONSE_MODE --body auto` so a review with findings starts a round on its own. Leave it unset for manual mode.
4. Try it on a PR that `agent:review` has reviewed: add `agent:address-review`, then read the summary comment and approve the held CI runs.

No new secret is needed: the flow uses `CLAUDE_CODE_OAUTH_TOKEN` and the job token. To stop it, set the variable to anything else or delete it.

## Labels: triage state versus trigger

`ready-for-agent` is a triage **state**: the issue is fully specified. `agent:plan` is a **Trigger label**: it starts a run, and the run removes it. A maintainer adds `agent:plan` by hand to an issue that is `ready-for-agent`. Nothing links the two automatically.

## Orchestrate Team Run

A Team Run (`/orchestrate --spec <n> --team`, from v1.0.0-beta.9) splits one spec's tickets between teammates. Each teammate runs their own Chief of Staff, on their own machine, over the tickets assigned to them alone. Everyone reads one **Shared Board** on GitHub: one row comment and one `team: …` state label per ticket. The skill's own guide is `.claude/skills/orchestrate/TEAM.md`.

Set up in `orchestrate.config.yml`: `tracker: github` (pinned) and the six `team.labels`, the agent-kit defaults. There is no member list. Whose ticket it is comes only from its GitHub assignee, and who is running comes from the `gh` login. Today the teammates are `mnaimfaizy` and `naimfaizy-bot` (the bot PC). Any other teammate needs write access, so they can be assigned, plus their own clone and `gh` login.

**Once, before the first Team Run,** create the state labels. A run that finds them missing asks to create them as you, in its Dispatch Plan.

```bash
gh label create "team: planned" --color C5DEF5 --description "orchestrate Team Run state: in the plan, not started"
gh label create "team: parked" --color FBCA04 --description "orchestrate Team Run state: waiting for a blocker's pull request to merge"
gh label create "team: running" --color 1D76DB --description "orchestrate Team Run state: its Delegation is working"
gh label create "team: waiting" --color D93F0B --description "orchestrate Team Run state: waiting on a decision"
gh label create "team: ready to merge" --color 0E8A16 --description "orchestrate Team Run state: Ready to Merge"
gh label create "team: merged" --color 6F42C1 --description "orchestrate Team Run state: its pull request is merged"
```

**Prepare the spec.** The spec is one issue. Its tickets are its GitHub **sub-issues**, and "blocked by" issue dependencies give the order. Assign each open ticket to exactly one person. A ticket with no assignee is listed but run by nobody, and so is one with two or more.

**Start.** Each teammate, in their own clone, runs:

```text
/orchestrate --spec <n> --team
```

The Dispatch Plan lists only your tickets, under "Teammates' tickets (not run here)", `unassigned` and "Needs one assignee". The GitHub tracker file is at Support Level `documented`, so the plan waits for your "go" even if you typed `go`. At "go" you approve the Shared Board writes on your own tickets. `go autonomous` lets your Chief of Staff rule only on your own Delegations. A Team Run always lands one pull request per ticket. A ticket blocked by a teammate's waits, `parked`, until that pull request is merged.

**Check status.** `/orchestrate --status` prints your latest run's board and the whole spec as a blocking tree in merge order. `/orchestrate --status --spec <n>` reads the Shared Board from GitHub alone, with no run of your own: use it as a reviewer, as the spec's owner, or as a teammate with no tickets. Neither writes anything.

**Resume.** `/orchestrate --resume <run>` continues from your run folder (`tmp/orchestrate/<run>`). It re-reads every ticket's assignee and brings the run in line with the Shared Board. A ticket newly assigned to you comes as an amended plan. A ticket reassigned away from you mid-run is asked about: hand it off, which pushes its branch, or ask for it back. After a lost machine, start a new Team Run: it offers to take your old rows over, and restarts each unfinished ticket from its branch.

Things to know here:

- This repository is public, so rows and state labels are readable by anyone. Briefs, reports, Decision Requests and the Ruling Ledger stay in your run folder.
- A Chief of Staff never assigns or reassigns a ticket, and never merges. The assignee and the merge are yours.
- The tracker file writes state labels with `gh issue edit`. This repository's classic Projects field makes `gh pr edit` fail, and `gh issue view --json projectCards` fails the same way, so `gh issue edit` may too. If it does, the run writes the label with `gh api`, as the comment in `orchestrate.config.yml` says.

## Upgrading

Use the `@mnaimfaizy/agent-kit` CLI, at the same version as the new tag. It needs the current pins to be `v1.0.0-alpha.11` or later.

1. Read the Agent-kit release notes and CHANGELOG between the current tag and the new one. A Major bump means Caller changes.
2. From a clean branch, run `upgrade`. It replaces every Kit-owned path (delete, then copy), rewrites all four `uses:` pins, prints the `examples/` diff, and runs the `doctor --ci` checks. It commits nothing:

   ```bash
   TAG=v1.0.0-beta.9   # the new tag; the CLI version is the tag without the leading v
   npx "@mnaimfaizy/agent-kit@${TAG#v}" upgrade --tag "$TAG"   # add --yes when there is no terminal
   ```

   The v1.0.0-beta.7 and v1.0.0-beta.8 CLIs refused their own tag's manifest (`".github/agent-review-response/" is not a permitted Kit-owned path`); v1.0.0-beta.9 fixed it ([agent-kit#301](https://github.com/mnaimfaizy/agent-kit/issues/301)). If `upgrade` ever refuses a manifest line, copy each path in the tag's `kit-owned-paths.txt` by hand instead (delete, then `git archive <tag> <path>`), and rewrite the `uses:` pins.
3. Apply anything relevant from the printed `examples/` diff to the Callers by hand (new or renamed inputs), and update the pin above.
4. Run the full check, then commit the pins and the Kit-owned paths **in the same commit**:

   ```bash
   npx "@mnaimfaizy/agent-kit@${TAG#v}" doctor
   ```

   `doctor` skips the Claude GitHub App check, because GitHub hides a personal account's installations; check that at <https://github.com/settings/installations>.

Dependabot ignores pre-release tags (`.github/dependabot.yml`), so every bump is manual until Agent-kit ships a stable tag.
