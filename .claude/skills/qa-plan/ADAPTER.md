# QA config

The repository's facts live in one file at its root, `qa.config.yml`; the skill body names no host. One file serves two skills: `qa-plan` reads `working_dir`, `plan:` and `hazards`, and `manual-qa` reads `working_dir` and `run:`. Each ignores the other's section. Both read it through the same reader, `adapter.mjs`, which `qa-plan` owns and `manual-qa` carries a byte-identical copy of.

```yaml
working_dir: tmp/qa # gitignored; plans and reports are composed here
plan:
  base_ref: origin/main
  suites:
    - name: backend
      command: "pytest --junitxml=reports/backend.xml"
      junit: reports/backend.xml
      surfaces: ["backend/**"]
      services: ["postgres", "redis"]
  publish: # first matching rule wins
    - { when_label: prd, to: tracker-issue, label: qa }
    - { default: true, to: working-copy }
  tracker: github # github | none
hazards:
  - { pack: docs/agents/qa-hazards/auth.md }
run: # manual-qa's section; never stops qa-plan
  target: stack
```

## Lookup order and dialects

The first file present is the config: `qa.config.yml`, then `qa.config.yaml`, then `qa.config.json`. The search stops there; a key it does not carry takes its default, never another file's value.

**JSON** is read whole, and is the dialect for anything the YAML subset cannot say.

**YAML** is read in this subset only:

- block mappings and block sequences, indented with spaces; a sequence may sit at its key's own indent (`suites:` then `- name: backend`);
- plain, single-quoted or double-quoted scalars;
- flow lists and flow mappings that open and close on one line, nested freely (`{ name: api, surfaces: ["api/**"] }`, `[]`);
- full-line `#` comments, and a trailing ` # comment` after a value;
- every scalar is a string: `default: true` and `default: "true"` read the same.

A formatter such as Prettier wraps a long flow mapping across lines, which takes it outside the subset: write long entries in block style, as `suites` is written above.

Tabs, anchors, aliases, multi-line scalars, flow collections that span lines, escapes inside quotes, a ` #` comment inside a flow collection (`{ name: api # note }`), a `: ` inside an unquoted value (`command: npm test: unit`, `[x: y]`: quote the value), duplicate keys, unknown keys at any level, and values of the wrong shape are **problems**. A list item that is only a comment (`- # disabled`) is an item with no value, as in real YAML, so where a string or mapping is expected it is a value of the wrong shape. A problem is never a silent default: `adapter.mjs` names each one with its line (with its key path in JSON) and exits 1, and the skill stops until it is fixed.

## Keys

| Key             | Default      | Meaning                                                                                                                                                               |
| --------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `working_dir`   | `tmp/qa`     | Where plans and reports are composed, relative to the repository root. Keep it gitignored: nothing in it is committed.                                                |
| `plan.base_ref` | none: asked  | The ref the pull request merges into (`origin/main`). The merge-base is computed against it.                                                                          |
| `plan.suites`   | none: asked  | The test suites CI runs. See below.                                                                                                                                   |
| `plan.publish`  | working copy | Where a confirmed plan goes. See below.                                                                                                                               |
| `plan.tracker`  | `none`       | `github`, or `none`. `none` keeps every plan in the working copy, whatever `publish` says. A `tracker-issue` or `pr-comment` rule with no `tracker` set is a problem. |
| `hazards`       | none         | Hazard packs, as `{ pack: <path> }`. See below.                                                                                                                       |
| `run`           | none         | `manual-qa`'s section. `check --for plan` does not check it; `manual-qa`'s `ADAPTER.md` documents it, and `check --for run` checks it.                                |

### `plan.suites` entries

| Key        | Required | Meaning                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     | yes      | Unique among the suites. Coverage claims name it.                                                                                                                                                                                                                                                                                                                                                              |
| `command`  | yes      | The command that runs it, from the repository root. `two-point.mjs` runs it at the head and at the merge-base, in a fresh worktree that holds tracked files only: no `node_modules`, virtual environment or build output. So it must install what it needs (`npm ci && npm test`, `uv run pytest`), or the merge-base will not build and the suite degrades.                                                   |
| `junit`    | no       | The JUnit XML file the command writes, relative to the repository root; deleted before each run. Without it, what the suite proves is read from its exit code alone, and tagged `[reconstructed]`.                                                                                                                                                                                                             |
| `surfaces` | no       | Globs of the paths it covers, so a changed path can be matched to the suites that test it.                                                                                                                                                                                                                                                                                                                     |
| `services` | no       | The QA Stack services it runs against for real, such as `["postgres", "redis"]`. Without it, the suite is taken to replace every such service with a double (SQLite, a mocked cache), so its claims never cover, alone, a promise that depends on one ([SKILL.md](SKILL.md#4-establish-what-automation-already-proves)). With a QA Stack in `run.stack` and no suite listing any, `check --for plan` notes it. |

#### Which shell runs `command`

`two-point.mjs` runs `command` in the platform's default shell, the one Node's `spawn` with `shell: true` picks: **`cmd.exe`** (`%ComSpec%`) on Windows, and **`/bin/sh`** on Linux and macOS. It never looks for `bash`, even where Git for Windows or WSL puts one on `PATH`. The command runs from the repository root at the head, and from the worktree's root at the merge-base.

One `qa.config.yml` serves a team on Windows and on Linux CI only when every `command` reads the same in both shells:

- Keep `command` to a program and its arguments, chained with `&&`, with forward-slash paths: `npm ci && npm test`, `uv run pytest --junitxml=reports/backend.xml`.
- Put anything more (a conditional, a file copy, an environment variable, a glob) in a script in the repository that `command` calls, in an interpreter every platform on the team has: `node scripts/test-backend.mjs`. `if not exist … copy …` is `cmd.exe` only; `[ -f … ] || cp …` and `VAR=value command` are `sh` only.
- Leave machine-specific paths, such as a local virtual environment's absolute path, out of a tracked config.
- A POSIX-looking command that passes on Windows is not portable when it passes only because a Unix tool (Git for Windows' `test.exe`, say) is on that machine's `PATH`.

### `plan.publish` rules

A list; the **first rule that matches wins**. Each rule has exactly one matcher and a target:

| Key          | Meaning                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `when_label` | Matches when the subject issue carries this label.                                                                                                                                                |
| `default`    | `true`: matches always. Rules after it are never reached, which is a problem.                                                                                                                     |
| `to`         | `working-copy` (the file in `working_dir`, and nothing else), `tracker-issue` (one issue per subject, edited on each revision), or `pr-comment` (one comment on the PR, edited on each revision). |
| `label`      | `tracker-issue` only: a label for the issue it creates.                                                                                                                                           |

With no rule matching, or no `publish` key, the plan stays in the working copy. `node "<skill>/adapter.mjs" delivery --label <label> …` prints the target for a subject's labels, and which rule chose it.

## Readiness check

`node "<skill>/adapter.mjs" check --for plan` prints the config path, its problems, the effective values (defaults applied), and `readiness`: what compose still **needs** (asked for), and **notes** (said, and compose goes on). It needs `plan.base_ref` and at least one suite; a suite without `junit` is a note. The skill asks for what is missing, composes on the answers given in chat, and saves them only when the person says yes. `adapter.mjs render < answers.json` prints the new body of the config the lookup found, in its own dialect, or of a new `qa.config.yml` when there is none. The answers are merged in (`plan` and `run` key by key) and every other key is kept. Writing a second file instead would shadow the first or be shadowed by it. YAML comments are not kept, and a YAML body reads back with no problems. `render --write` writes it. Over a YAML config that has comments, `--write` writes nothing and exits 3, naming the comment lines; `--write --drop-comments` writes it anyway. It refuses rather than warns because the person's yes was to the printed body, which has no comments, and a warning printed while writing comes too late to change that answer. A JSON config, a new file and a YAML config with no comments are written with `--write` alone. Nothing is assumed.

Answers the person did not save still reach `two-point.mjs`: `--answers <file>` reads the same JSON object `render` takes, from inside the effective `working_dir` (after the merge, since an answer may set `working_dir`). It merges the answers over the config the lookup found, or over none, exactly as `render` does, and checks the result as `render` checks the plan side. `--base` and `--suite` still win over the merged values. It writes no config file. A missing, non-JSON or non-object file, a file outside `working_dir`, or answers whose merged config has problems exit 2 before any suite runs.

## Hazard packs

A **Hazard pack** is a Markdown file the repository owns, describing one area where a QA run is easily fooled (sign-in, payments, caching, time zones). It has `when:` globs in its frontmatter and two sections:

```markdown
---
when: ["backend/auth/**", "**/login*"]
---

# Sign-in hazards

## Rule out first

- A session cookie left over from an earlier run: sign out, or use a fresh profile.

## Capture rules

- Never capture the password field, or a screen showing a one-time code.
```

- **`when:`** (required): globs over repository-relative paths, matched against the whole path. `**` spans directories, `*` and `?` stay inside one; braces and character classes are not special.
- **Rule out first** (required): `qa-plan` copies it into each scenario the pack matches, as _If this fails, first rule out_.
- **Capture rules** (required): `qa-plan` inlines it into the plan's Run brief; `manual-qa` obeys it while it runs the plan.

A pack applies when any path the diff changes matches one of its globs. `git diff --name-only <merge-base> <head> | node "<skill>/adapter.mjs" hazards` prints each matching pack with the paths it matched and both sections. A pack named in `hazards` that is missing, or that has no `when:`, an unknown frontmatter key, or a missing or empty section, is a problem.
