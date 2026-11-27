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
  qa: claude-sonnet-5-5
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
| `regate`         | none: asked         | The commands that re-check a finished branch, run from the repository root of a worktree at the branch's head. `[]` leaves it to CI. A list of commands, or a mapping with `allowed_failures`: see below.                 |
| `skills`         | none                | Companion skills a brief names. See below.                                                                                                                                                                                |
| `triage_labels`  | each role's name    | The repository's own mapping of the five triage roles to its labels. See below.                                                                                                                                           |
| `models`         | the harness default | The model for each kind of work. See below.                                                                                                                                                                               |
| `harness`        | none: detected      | The harness the Chief of Staff runs on, as an id from [HARNESSES.md](HARNESSES.md#the-harnesses). See below.                                                                                                              |
| `executors`      | this harness        | Another harness for one kind of Delegation. Not the default. See below.                                                                                                                                                   |
| `limits`         | see below           | How many building Delegations run at once, and the shared resources that have one holder at a time.                                                                                                                       |
| `decisions`      | see below           | Where a human decision is recorded, so a reviewer of the pull request can see it.                                                                                                                                         |
| `ready_to_merge` | see below           | What Ready to Merge requires beyond green CI and a clean merge into the default branch as it now is.                                                                                                                      |
| `spec`           | see below           | How a spec run (`--spec <n>`) lands its work. A run on a set of issues reads none of it.                                                                                                                                  |
| `tracker`        | `detect`            | The issue tracker a Team Run (`--spec <n> --team`) reads its tickets from. See below.                                                                                                                                     |
| `team`           | see below           | A Team Run's state labels, and how much a Shared Board row keeps. Only a Team Run reads it.                                                                                                                               |
| `records`        | local only          | Where Run Records are kept off the machine, and whether close-out offers the upload. See below.                                                                                                                           |
| `prune`          | no pruning          | Whether old, closed-out run folders are deleted from this machine. See below.                                                                                                                                             |

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

### `regate`

A list of commands, or a mapping when some tests are known to fail:

| Key                | Meaning                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands`         | The commands, as the list above. Required in the mapping form.                                                                                                       |
| `allowed_failures` | Optional. Tests that fail on the default branch too, each `test` (its name as the runner prints it) with the `reason` it may fail. A name listed twice is a problem. |

```yaml
regate:
  commands:
    - uv run pytest
    - npm test
  allowed_failures:
    - test: test_the_launcher_reads_the_key
      reason: fails on main under macOS bash 3.2, tracked in #123
```

`node "<skill>/config.mjs" regate <sha> --out <file>` runs the commands and compares what failed to this list ([SKILL.md](SKILL.md#7-verify-each-report)). A failure that is not listed fails the re-gate, and is named. An entry only excuses named test failures: a command that exits with anything but 1 (pytest's 2 to 5 are not test failures), that prints a failure no test name accounts for (a coverage threshold, `--cov-fail-under`), or that counts more failures than it names, fails the re-gate even when every named test is listed. Give each command one test runner, since `cmd1; cmd2` hides a failure of `cmd2` behind the exit and names of `cmd1`; chain with `&&`. An entry is for a test that fails on the default branch as well: it stops a known failure from being read by eye each time, and a fix removes its entry. `check` prints the commands as `regate` and the list as `regate_allowed_failures`, `[]` when there is none.

#### The commands

Both run from the repository root, or with `--repo <dir>`, and print what they did.

`node "<skill>/config.mjs" regate <sha> --out <file>` runs the `commands` in order, from a detached worktree at `<sha>`, made beside `<file>` and removed after, even when a command fails. `<file>` must be inside `run_dir`. The commands are the repository's own config, never the commit's. It writes each command's exit code and output to `<file>` as JSON. A failing command's tests are read from its output: Node's `failing tests:` summary and `ℹ fail <n>`, and pytest's `FAILED <id>` lines and its count. A name is matched whole, against the test's own name or its whole pytest id. It exits 1 when any failure is not on the list, naming it, which includes a command that fails with no test named and one that counts more failures than it names. Exit 2 is bad usage.

`node "<skill>/config.mjs" land <branch> --cut <sha> --onto <integration> --fence <glob>...` is [SPEC.md](SPEC.md#on-an-integration-branch) item 5's landing. `<branch>` is a branch or a commit. It refuses unless the commit descends from `--cut`, every path changed since `--cut` matches a `--fence` glob (quote them, so the shell does not expand them; where `<integration>` is an ancestor of the commit, the paths checked are the ones the move changes on `<integration>`, so a path an earlier ticket landed counts if this branch's merge changed it back, and one it left identical does not), no worktree has `<integration>` checked out, and `<integration>` is an ancestor of the commit. Only then does it run `git update-ref refs/heads/<integration> <new> <old>`. It never merges, rebases or pushes. A refusal prints JSON with `landed: false`, a `refusal` code (`unknown-ref`, `not-descended`, `outside-fence`, `checked-out`, `not-fast-forward` or `moved`) and its `cause`, and exits 1.

### `models`

| Key        | The work                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `analysis` | Analysis Delegations, and the Chief of Staff's own analysis.                                    |
| `build`    | Building Delegations.                                                                           |
| `review`   | The code-review phase of a building brief, where the harness lets a phase run on its own model. |
| `qa`       | QA Delegations: composing a QA Plan and running it.                                             |

Each value is a model name the Executor's harness accepts, passed as written: with `executors` set for that kind of work, a model on that harness. Unset, that work runs on the harness's default model.

### `harness`

An id from [HARNESSES.md](HARNESSES.md#the-harnesses), such as `claude-code-desktop` or `cursor`. Unset, the run finds its harness at step 1, from the environment and the session's tools, and asks when it cannot tell. Set, it pins the harness: when what the run finds disagrees, the run raises it as a Decision Request before it goes on. An id with no harness file is a problem. A pinned harness below Support Level `verified` is a note, and its Dispatch Plan waits for the human's "go".

### `executors`

| Key        | The Delegations |
| ---------- | --------------- |
| `build`    | Building        |
| `analysis` | Analysis        |
| `qa`       | QA              |

Each value is a harness id whose Delegations of that kind run as that harness's headless run, started from the Chief of Staff's shell, instead of on the Chief of Staff's own harness ([HARNESSES.md](HARNESSES.md#executors-on-another-harness)). For example, a Chief of Staff in Cursor with `executors: { build: claude-code-cli }` builds with `claude -p`. Its CLI must be installed and signed in, `models` for that work names a model there, and its Support Level and Limits join the Dispatch Plan's. Unset, every Delegation runs on the Chief of Staff's harness. A value that names the pinned `harness` is that harness's own default, and moves nothing. Any other harness with no headless run, such as `claude-code-desktop` named from Cursor, is a problem here. So is `qa` naming a harness whose headless run cannot carry QA (its harness file's **Headless QA** line is `none`), such as `gemini-cli` or `devin`.

### `limits`

| Key        | Default | Meaning                                                                                                                                                                                              |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `building` | `3`     | The most building Delegations running at once. A whole number of 1 or more. Analysis and QA Delegations do not count.                                                                                |
| `shared`   | `[]`    | Named resources only one Delegation may hold at a time, such as a database its migrations change or a port its tests bind. A Delegation that holds one is planned into a wave no other holder is in. |

The **QA Stack** is a shared resource whether or not `shared` names it: every QA Delegation whose QA config runs against a `stack` holds it, so two never run at once. The skill cannot know which ports or containers that stack uses. When a building Delegation's tests use the same ones, name them in `shared` and say so in the scope fence, so the building Delegation is kept apart from QA.

### `decisions`

| Key      | Default        | Meaning                                                                                                                                                                                       |
| -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `to`     | `pull-request` | `pull-request`: the Delegation adds the decision to its own pull request's body. `issue-comment`: a comment on the issue, which is a write as the human, drafted and approved like any other. |
| `marker` | none           | A line the record starts with, so a reviewer or a tool can find it, such as an HTML comment.                                                                                                  |

### `ready_to_merge`

A Delegation is Ready to Merge only when every check on its head has passed and its branch merges cleanly into the default branch as it now is, and is not behind it where the repository requires branches to be up to date, unless the human chose to merge it as it is ([SKILL.md](SKILL.md#the-default-branch-check)). These keys add to that; they never take either away.

| Key               | Default   | Meaning                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review`          | `settled` | `settled`: every review comment is fixed or answered. `approved`: that, and an approving review.                                                                                                                                                                                                                                                                                                                    |
| `qa`              | `none`    | `report`: each pull request's head is QA'd by a QA Delegation, and Ready to Merge needs its result for that head.                                                                                                                                                                                                                                                                                                   |
| `qa_labels`       | `[]`      | With `qa: report`, the report is required only for an issue carrying one of these labels. Any other `qa` is a problem.                                                                                                                                                                                                                                                                                              |
| `review_workflow` | `detect`  | The Caller of Agent-kit's review workflow, whose run on a head the review must wait for (SKILL.md step 7). `detect`: the Caller found under `.github/workflows/`, by a job that `uses:` `agent-review-reusable.yml`, if any; when more than one has such a job, the run asks which. A path directly under `.github/workflows/`: that file, which must be in the repository. `none`: no review workflow to wait for. |

### `spec`

Read only by a spec run ([SPEC.md](SPEC.md#the-landing)).

| Key                  | Default                | Meaning                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing`            | `ask`                  | `integration-branch`: each ticket lands on one local branch, which ends in one pull request. `per-ticket`: each ticket opens its own pull request, and a later wave waits for its blockers to be merged. `ask`: the Dispatch Plan asks, with what each costs. Either way, the plan says which it is. |
| `integration_branch` | `orchestrate/spec-<n>` | The integration branch's name, with `<n>` replaced by the spec's number. `<n>` must be in it, and is its only placeholder; with it filled in, the name must be a valid git branch name. The branch is local: it is pushed only on a yes.                                                             |

### `tracker`

Read only by a Team Run ([TEAM.md](TEAM.md#find-the-tracker)).

| Value    | Meaning                                                                                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detect` | The default. The tracker is read from the host of the repository's git remote (`origin`, or its only remote; with several and none named `origin`, the run asks which): `github.com` is `github`, `gitlab.com` is `gitlab`. Any other host is asked about. |
| `github` | GitHub, pinned. Needed for GitHub on any host but `github.com`.                                                                                                                                                                                            |
| `gitlab` | GitLab, pinned. Needed for a self-hosted GitLab on its own domain.                                                                                                                                                                                         |

A pinned value that disagrees with what the remote's host points to is a question to the human, never a silent choice. `check` prints a `tracker` report: `pinned` (null for `detect`), `remote`, `remote_host` and `detected`. A null `remote` is asked about too, whatever the pin, since a Team Run fetches and pushes on that remote ([TEAM.md](TEAM.md#find-the-tracker)). Any other value is a problem. A run without `--team` reads neither.

### `team`

Read only by a Team Run ([TEAM.md](TEAM.md)).

| Key               | Default         | Meaning                                                                                                                                                                                         |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `labels`          | `team: <state>` | The label for each of the six coarse states a ticket can be in: `planned`, `parked`, `running`, `waiting`, `ready_to_merge` and `merged`. Give all six, or leave `labels` out for the defaults. |
| `recent_activity` | `5`             | How many milestones a Shared Board row keeps in its Recent activity list. A whole number of 1 or more.                                                                                          |

The default labels are `team: planned`, `team: parked`, `team: running`, `team: waiting`, `team: ready to merge` and `team: merged`. In YAML, quote a label that holds `: `:

```yaml
team:
  labels:
    planned: "team: planned"
    parked: "team: parked"
    running: "team: running"
    waiting: "team: waiting"
    ready_to_merge: "team: ready to merge"
    merged: "team: merged"
  recent_activity: 5
```

A `labels` mapping that leaves a state out, names a key that is not one of the six, or gives one label to two states (compared without case, as the tracker compares them) is a problem.

### `records`

Read by the close-out ([SKILL.md](SKILL.md#10-close-out)), by `--upload <run>` ([RUN.md](RUN.md#uploading-the-run-record)), and by `--dashboard` ([RUN.md](RUN.md#the-past-runs-dashboard)). A run with no `records` key keeps its Run Record on the machine and offers nothing.

| Key          | Default                             | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repository` | `host/owner/repo` from the remote   | This repository's name in a Sink's paths, for a renamed or mirrored repository: `host/owner/repo`, three plain segments, or `host/<group>/…/<project>` for a GitLab project in a subgroup (`gitlab.com/grp/sub/widgets`); a `github.com` name has exactly three. Unset, it is read from the `origin` remote (or the only remote; with several and none named `origin`, the run asks). Records are never moved between namespaces. |
| `upload`     | `offer`                             | `offer`: once a Sink is set, the close-out offers to upload the Run Record. `never`: it does not offer; `--upload <run>` still works.                                                                                                                                                                                                                                                                                             |
| `raw`        | none: raw folders are never offered | `sink`: the one place raw run folders may go, a mapping of the keys below with `type: s3` only. Unset, raw folders are never offered. See [`raw`](#raw) below.                                                                                                                                                                                                                                                                    |
| `sink`       | none: local only                    | The one private place Run Records are uploaded to, a mapping of the keys below. Unset, Run Records stay in `<run_dir>/records/`.                                                                                                                                                                                                                                                                                                  |

`sink`'s keys:

| Key        | Default                  | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`     | none: required           | The Sink's kind. `github`: a private GitHub repository, written with `gh api` Contents calls ([sinks/github.md](sinks/github.md)). `gitlab`: a private GitLab project, written with `glab api` Repository Files calls ([sinks/gitlab.md](sinks/gitlab.md)). `s3`: any S3-compatible bucket, signed with SigV4 ([sinks/s3.md](sinks/s3.md)). `github` is `verified`; `gitlab` and `s3` are at Support Level `documented` until a run has uploaded to them and read the record back. Any other value is a problem.           |
| `repo`     | none: required           | The Sink repository or project: `owner/name`, or `host/owner/name` for GitHub Enterprise or a self-hosted GitLab. Without a host it is on `github.com`, or on `gitlab.com` for a `gitlab` Sink. A `gitlab` project may sit in subgroups (`group/sub/name`, or `host/group/sub/name`): its first segment is read as the host only when it has a dot, so a group whose name has a dot is written with its host in front (`gitlab.com/my.group/sub/name`). Required for `github` and `gitlab`, and a problem on an `s3` Sink. |
| `branch`   | the repository's default | The branch the records are written to. Not used by an `s3` Sink.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `endpoint` | none: required for `s3`  | An `s3` Sink's store: its https URL, such as `https://<account>.r2.cloudflarestorage.com`, with no path, query or password (`http` only for `localhost`). A problem on a `github` or `gitlab` Sink.                                                                                                                                                                                                                                                                                                                        |
| `bucket`   | none: required for `s3`  | An `s3` Sink's bucket name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `region`   | none: required for `s3`  | An `s3` Sink's region, such as `us-east-1`; `auto` for R2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

```yaml
records:
  repository: github.com/acme/widgets # default: host/owner/repo from the git remote
  upload: offer # offer | never; default offer once a sink is set
  sink: # unset: local only
    type: github # github | gitlab | s3
    repo: acme/run-records # owner/name or host/owner/name
    branch: main # default: that repo's default branch
```

#### `raw`

```yaml
records:
  raw: # unset: raw folders are never offered
    sink:
      type: s3 # s3 only
      endpoint: https://<account>.r2.cloudflarestorage.com
      bucket: acme-run-records
      region: auto
```

`raw.sink` takes the keys of an `s3` Sink (`type`, `endpoint`, `bucket`, `region`) and nothing else, and its `type` can only be `s3`: any other type is a problem, with the line. Why `s3` only: a raw run folder may quote private issue text, command output and file contents, so it goes only where the bucket's own lifecycle rule deletes it, and only a bucket can do that (a git Sink cannot expire a file). It is independent of `records.sink`: a repository may set either, both, or neither, and it may be the same bucket. The same credentials are read, from the environment only, and a secret-looking value is a problem. Before uploading, the skill reads the bucket's lifecycle ([sinks/s3.md](sinks/s3.md#lifecycle)) and uploads nothing unless an enabled rule expires `raw/`; it never writes bucket configuration. The close-out asks for its own yes at every close-out, and the Dispatch Plan cannot list it as a routine write ([RUN.md](RUN.md#uploading-the-raw-run-folder)). Raw paths are `raw/<host>/<owner>/<repo>/<login>/<run-id>/<path>`, one object per file, every namespace segment lowercased.

A record's path in the Sink is `records/<host>/<owner>/<repo>/<login>/<run-id>.json`, every segment lowercased, so one Sink serves many repositories and two never collide. The login is the tracker login, overridable only by the `ORCHESTRATE_OPERATOR` environment variable, and with none, nothing uploads. The config holds no credential: `gh` or `glab` signs in as the person who runs it, and an `s3` Sink reads its credentials only from the environment variables `ORCHESTRATE_S3_ACCESS_KEY_ID` and `ORCHESTRATE_S3_SECRET_ACCESS_KEY`, so a value in the config that looks like a secret is a problem. There is no local overlay, so a person opts out by answering "Not now" at close-out.

### `prune`

Read by the close-out ([SKILL.md](SKILL.md#10-close-out)) and by `node records.mjs prune`. A run with no `prune` key deletes nothing.

| Key          | Default          | Meaning                                                                                                                                                                     |
| ------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `after_days` | none: no pruning | A whole number of 1 or more. Closed-out run folders whose Run Record closed more than this many days ago are deleted from `<run_dir>`. Setting it is the consent to delete. |

```yaml
prune:
  after_days: 90 # unset: no pruning; setting it is the consent
```

Only a **closed-out** run folder is deleted: one with a Run Record beside it in `<run_dir>/records/`, whose `closed_at` is older than `after_days`. An open run (no Run Record yet), a closed run newer than the setting, and `<run_dir>/records/` with every record in it are never touched. With no `prune` key, the close-out asks once whether to prune at 90 days, and writes `prune.after_days: 90` into the config only on a yes. A "no" is remembered in `<run_dir>/prune-declined` on this machine, and is not asked again.

## Readiness check

`node "<skill>/config.mjs" check` prints JSON: the config's `path` (null when there is none), its `problems`, the `effective` values with every default applied, the `harness` report ([HARNESSES.md](HARNESSES.md#finding-the-harness)), the `tracker` report ([above](#tracker)), and `readiness`: what the run still **needs** (asked for, in one message) and **notes** (said, and the run goes on). It needs `read_first`, `routes.commit`, `routes.pull_request` and `regate`, and `ready_to_merge.qa` when a QA config (`qa.config.yml`, `qa.config.yaml` or `qa.config.json`) is at the repository root and the config does not set it. With a QA config and `qa: none` set, it notes that the run plans no QA. `qa_config` in the output is that file's name, or null. It exits 1 on any problem and 2 on bad usage; `--repo <dir>` reads another repository.

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
