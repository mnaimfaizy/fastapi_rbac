# GitHub

- **Id:** `github`
- **Support Level:** `verified`. It rests on `/orchestrate #378 #389` on `mnaimfaizy/agent-kit`, 2026-11-26 (run `2026-11-26-378-389`): `records.mjs upload` verified private visibility, read collaborator count (`1 person with access`) and created `records/github.com/mnaimfaizy/agent-kit/mnaimfaizy/2026-11-26-378-389.json` in `mnaimfaizy/orchestrate-run-records`, and `records.mjs dashboard` read that record back from the sink. Its Activity Log is in that run's folder, which is not committed.
- **Facts from:** the `gh` CLI, version 2.102.0, read on 2026-11-25 (`gh api` with `-X`, `--input`, `--jq`, `--hostname`, `--paginate`), and GitHub's REST API for repository contents, git trees, repository visibility and collaborators, as [SINKS.md](../SINKS.md) names them, read on 2026-11-25. `visibility`, `access`, `read`, `create` (`--input -`), and `list` (dashboard read-back) were confirmed in run `2026-11-26-378-389` on 2026-11-26.

Every command runs with `gh` signed in as the person who runs the skill. `<owner>/<repo>` is the config's `records.sink.repo`: `owner/name`, or `host/owner/name` for GitHub Enterprise, where every command also takes `--hostname <host>`. `<ref>` is `records.sink.branch`; unset, the calls leave `ref` and `branch` out and GitHub uses the repository's default branch. `<path>` is `records/<host>/<owner>/<repo>/<login>/<run-id>.json`, every segment lowercased ([CONFIG.md](../CONFIG.md#records)), with each segment URL-encoded.

## Access

- **The writer** needs **Contents: write** on the sink repository, and **Metadata: read**, which every token has. A classic token needs the `repo` scope. The upload writes one new file per run and never changes or deletes one.
- **The reader** (the dashboard) needs **Contents: read** and **Metadata: read**, and nothing more: it never writes, so it can be given to someone who may only look. A classic token needs the `repo` scope.
- Access never comes from the config: `gh` holds the sign-in, and the skill never reads or writes a token.

## Operations

### `visibility`

```bash
gh api repos/<owner>/<repo> --jq .visibility
```

`private`, `public` or `internal`. Run before every read and write: the upload goes ahead only on `private`. `public` and `internal` are refused, and so is an answer that cannot be read, with no override: a repository can be made public after it was set as the sink.

### `access`

```bash
gh api --paginate repos/<owner>/<repo>/collaborators --jq '.[].login'
```

One login per line; the count is the number of people with access that the disclosure shows. GitHub lists collaborators only to someone with push access, so a refusal means the count is left out of the disclosure, never that the upload stops.

### `read`

```bash
gh api -H "Accept: application/vnd.github.raw+json" "repos/<owner>/<repo>/contents/<path>?ref=<ref>"
```

The file's bytes. A `404` means the path is not there yet; any other failure stops the upload.

### `create`

```bash
gh api -X PUT repos/<owner>/<repo>/contents/<path> --input -
```

With a JSON body on standard input: `{"message": "Add Run Record <run-id>", "content": "<base64 of the record>", "branch": "<ref>"}`, with no `sha`, so the call can only create. A `409` (parallel Contents writes on one branch) is retried: the path is read again first, and identical bytes there mean the upload is done. A `422` means the path was created in between, and is read again the same way.

### `list`

```bash
gh api "repos/<owner>/<repo>/git/trees/<ref or HEAD>?recursive=1"
```

Every blob with its `path`. When the answer carries `"truncated": true`, the tree is walked one level at a time (`git/trees/<sha>`, no `recursive`) instead. Used by the dashboard, which lists `records/` with one such call, reads only the paths its cache lacks (`read`, above), and checks `visibility` first. A `404` or `403` on the sink is a warning on the page, not a failure.

## The upload is create-only

- Identical bytes already at the path count as already uploaded, so repeating `--upload <run>` is safe.
- Different bytes at the path stop the upload: nothing is overwritten, and the clash is shown.
- A record that fails the safe-field check, or has no login, is never uploaded.

## Retention

A git repository cannot expire a file, and the disclosure says so: a record uploaded here is kept until someone with write access deletes it by hand. Anyone who can read the repository can read every record in it.

## Check before use

- Parallel-write `409`/`422` retries on `create` have only been exercised in tests against a fake transport (`visibility`, `access`, `read`, `create` with `--input -`, and `list` were confirmed against `mnaimfaizy/orchestrate-run-records` in run `2026-11-26-378-389`).
- Whether an `internal` repository should be accepted on GitHub Enterprise: it is refused for now, as it is on GitLab.
