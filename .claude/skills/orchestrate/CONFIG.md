# Orchestrate config

The repository's facts live in one file at its root, `orchestrate.config.yml`; the skill body names no repository command, skill, label or path. The skill reads it through `config.mjs`, which checks it before a run uses any of it.

```yaml
run_dir: tmp/orchestrate # gitignored; the board and both Activity Logs live here
read_first: [AGENTS.md, CONTRIBUTING.md, GLOSSARY.md]
routes:
  commit: "Conventional Commits, one logical change each: git commit"
  pull_request: "gh pr create --draft --fill, body ends with Closes #<n>"
  merge: "gh pr merge <n> --merge" # printed, never run
regate:
  - uv run pytest
  - npm test
skills: { implement: tdd, triage: triage, review: code-review }
triage_labels: docs/agents/triage-labels.md # or a mapping of the five roles
models:
  analysis: claude-sonnet-5-5
  build: claude-opus-5-5
  review: claude-opus-5-5
limits:
  building: 3
  shared: [database migrations, "port 5432"]
decisions: { to: pull-request }
ready_to_merge:
  review: settled # settled | approved
  qa: report # none | report
  qa_labels: [ui]
spec:
  landing: integration-branch # ask | integration-branch | per-ticket
  integration_branch: orchestrate/spec-<n>
```

## Lookup order and dialects

The first file present is the config: `orchestrate.config.yml`, then `orchestrate.config.yaml`, then `orchestrate.config.json`. The search stops there; a key it does not carry takes its default, never another file's value.

**JSON** is read whole, and is the dialect for anything the YAML subset cannot say.

**YAML** is read in this subset only:

- block mappings and block sequences, indented with spaces; a sequence may sit at its key's own indent (`regate:` then `- npm test`);
- plain, single-quoted or double-quoted scalars;
- flow lists and flow mappings that open and close on one line, nested freely (`{ building: 2, shared: [database] }`, `[]`);
- full-line `#` comments, and a trailing ` # comment` after a value;
- every scalar is a string: `building: 3` and `building: "3"` read the same.

A formatter such as Prettier wraps a long flow mapping across lines, which takes it outside the subset: write long entries in block style, as `routes` is written above.

Tabs, anchors, aliases, multi-line scalars, flow collections that span lines, a ` #` comment inside a flow collection, a `: ` inside an unquoted value, escapes inside quotes, duplicate keys, unknown keys at any level, keys with no value, and values of the wrong shape are **problems**. A problem is never a silent default: `config.mjs` names each one with its line, in both dialects, and exits 1, and the run stops until it is fixed.

## Keys

| Key              | Default             | Meaning                                                                                                                                                                                                                   |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run_dir`        | `tmp/orchestrate`   | Where run folders are kept, relative to the repository root. Keep it gitignored: nothing in it is committed. When it is not, the skill offers to add it to the root `.gitignore`, and writes nothing there without a yes. |
| `read_first`     | none: asked         | The documents every Delegation reads before it plans: agent instructions, contributing guide, glossary. Each must be in the repository. `[]` for none.                                                                    |
| `routes`         | see below           | How a Delegation commits and opens its pull request, and how the human merges.                                                                                                                                            |
| `regate`         | none: asked         | The commands that re-check a finished branch, run from the repository root of a worktree at the branch's head. `[]` leaves it to CI.                                                                                      |
| `skills`         | none                | Companion skills a brief names. See below.                                                                                                                                                                                |
| `triage_labels`  | each role's name    | The repository's own mapping of the five triage roles to its labels. See below.                                                                                                                                           |
| `models`         | the harness default | The model for each kind of work. See below.                                                                                                                                                                               |
| `limits`         | see below           | How many building Delegations run at once, and the shared resources that have one holder at a time.                                                                                                                       |
| `decisions`      | see below           | Where a human decision is recorded, so a reviewer of the pull request can see it.                                                                                                                                         |
| `ready_to_merge` | see below           | What Ready to Merge requires beyond green CI and a clean merge.                                                                                                                                                           |
| `spec`           | see below           | How a spec run (`--spec <n>`) lands its work. A run on a set of issues reads none of it.                                                                                                                                  |

A value in any route, command or skill name is free text: the brief carries it as written, so a route can be a command, a skill to use, or a sentence of convention.

### `routes`

| Key            | Default     | Meaning                                                                                                 |
| -------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `commit`       | none: asked | How a Delegation commits: the message convention, and the command or skill that makes the commit.       |
| `pull_request` | none: asked | How a Delegation opens its pull request: the command or skill, draft or not, and what the body carries. |
| `merge`        | none        | The merge command printed in the close-out, once per pull request in the merge order. It is never run.  |

### `skills`

| Key         | Meaning                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| `implement` | The skill a building Delegation implements with.                                   |
| `triage`    | The skill an analysis Delegation uses on an issue not ready for an agent.          |
| `review`    | The skill a building Delegation reviews its own diff with before its final commit. |

Each is the name of a skill the Executor's harness has installed. Unset, the brief names none, and the readiness check says so.

### `triage_labels`

Either the path of a document in the repository that maps the roles to labels (the skill reads it at the start of each run, and it must be there), or a mapping of roles to labels:

```yaml
triage_labels:
  ready-for-agent: agent-ready
  wontfix: declined
```

The roles are `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` and `wontfix`. A role the mapping leaves out keeps its own name as its label. Two roles with one label, or a key that is not one of the five, is a problem. Unset, each role's label is its name.

### `models`

| Key        | The work                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `analysis` | Analysis Delegations, and the Chief of Staff's own analysis.                                    |
| `build`    | Building Delegations.                                                                           |
| `review`   | The code-review phase of a building brief, where the harness lets a phase run on its own model. |

Each value is a model name the Executor's harness accepts, passed as written. Unset, that work runs on the harness's default model.

### `limits`

| Key        | Default | Meaning                                                                                                                                                                                              |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `building` | `3`     | The most building Delegations running at once. A whole number of 1 or more. Analysis Delegations do not count.                                                                                       |
| `shared`   | `[]`    | Named resources only one Delegation may hold at a time, such as a database its migrations change or a port its tests bind. A Delegation that holds one is planned into a wave no other holder is in. |

### `decisions`

| Key      | Default        | Meaning                                                                                                                                                                                       |
| -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `to`     | `pull-request` | `pull-request`: the Delegation adds the decision to its own pull request's body. `issue-comment`: a comment on the issue, which is a write as the human, drafted and approved like any other. |
| `marker` | none           | A line the record starts with, so a reviewer or a tool can find it, such as an HTML comment.                                                                                                  |

### `ready_to_merge`

A Delegation is Ready to Merge only when every check on its head has passed and its branch merges cleanly. These keys add to that; they never take either away.

| Key         | Default   | Meaning                                                                                                                |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `review`    | `settled` | `settled`: every review comment is fixed or answered. `approved`: that, and an approving review.                       |
| `qa`        | `none`    | `report`: a QA Report exists for the pull request's head.                                                              |
| `qa_labels` | `[]`      | With `qa: report`, the report is required only for an issue carrying one of these labels. Any other `qa` is a problem. |

### `spec`

Read only by a spec run ([SPEC.md](SPEC.md#the-landing)).

| Key                  | Default                | Meaning                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing`            | `ask`                  | `integration-branch`: each ticket lands on one local branch, which ends in one pull request. `per-ticket`: each ticket opens its own pull request, and a later wave waits for its blockers to be merged. `ask`: the Dispatch Plan asks, with what each costs. Either way, the plan says which it is. |
| `integration_branch` | `orchestrate/spec-<n>` | The integration branch's name, with `<n>` replaced by the spec's number. `<n>` must be in it, and is its only placeholder; with it filled in, the name must be a valid git branch name. The branch is local: it is pushed only on a yes.                                                             |

## Readiness check

`node "<skill>/config.mjs" check` prints JSON: the config's `path` (null when there is none), its `problems`, the `effective` values with every default applied, and `readiness`: what the run still **needs** (asked for, in one message) and **notes** (said, and the run goes on). It needs `read_first`, `routes.commit`, `routes.pull_request` and `regate`. It exits 1 on any problem and 2 on bad usage; `--repo <dir>` reads another repository.

### Answers given in chat

With no config, or one that leaves out what the run needs, the skill asks. The answers are a JSON object in the config's own shape, written to `answers.json` in the run folder, and read with `check --answers <path>`:

```json
{
  "read_first": ["AGENTS.md"],
  "routes": { "commit": "git commit", "pull_request": "gh pr create --draft" },
  "regate": []
}
```

They are laid over the config: a mapping answered for a mapping is merged key by key (`routes.commit` replaces only that route), and anything else replaces the config's value. A problem in an answer is named with the answers file and its line. The answers file must be inside `run_dir` (its merged value, since an answer may set it), so it is never committed and `--resume` finds it again. Writing the answers into the config file is a separate step, taken only on the human's yes.
