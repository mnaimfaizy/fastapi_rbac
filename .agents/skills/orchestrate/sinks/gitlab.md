# GitLab

- **Id:** `gitlab`
- **Support Level:** `documented`. No run has uploaded to a GitLab sink yet, and no command below has been run against a GitLab instance; the first run that does moves it, citing its Activity Log.
- **Facts from:** the `glab` CLI, version 1.116.0 (`glab api` with `--method`, `--header`, `--input`, `--hostname`), and GitLab's REST API for projects, project members, the repository tree and Repository Files, as [SINKS.md](../SINKS.md) names them, read on 2026-11-25.

Every command runs with `glab` signed in as the person who runs the skill (`glab auth login`, or `glab auth login --hostname <host>` for a self-hosted GitLab). `<project>` is the config's `records.sink.repo`, `owner/name` or `host/owner/name`, with the whole `owner/name` URL-encoded as one segment (`acme%2Frun-records`); the host is `gitlab.com` when none is given. A project in a subgroup is `group/sub/name` (or `host/group/sub/name`), and its whole namespace is encoded the same way (`group%2Fsub%2Fname`): the first segment is read as the host only when it has a dot, so a group whose name has a dot is written with its host in front. Every command takes `--hostname <host>`, `gitlab.com` too, because inside a clone `glab api` otherwise sends the request to that clone's host. `<ref>` is `records.sink.branch`; unset, it is the project's `default_branch`, read once with one `glab api --hostname <host> projects/<project>` call, because the Repository Files API always needs a ref. `<path>` is `records/<host>/<owner>/<repo>/<login>/<run-id>.json`, every segment lowercased ([CONFIG.md](../CONFIG.md#records)), where a repository in a GitLab subgroup has its whole namespace in place of `<owner>` (`records/gitlab.com/grp/sub/widgets/<login>/<run-id>.json`), so the dashboard parses a path from its end, URL-encoded as one segment (`records%2Fgitlab.com%2F…`). `glab api` has no `--jq`: the skill reads the JSON itself.

## Access

- **The writer** needs the **Developer** role or higher on the sink project, and a branch that role may push to: a protected default branch that allows only Maintainers to push needs `records.sink.branch` set to a branch the writer can push to. The upload writes one new file per run and never changes or deletes one.
- **The reader** (the dashboard) needs the **Reporter** role, and nothing more: it never writes, so it can be given to someone who may only look. Below Reporter a private project's files cannot be read.
- Access never comes from the config: `glab` holds the sign-in, and the skill never reads or writes a token.

## Operations

### `visibility`

```bash
glab api --hostname <host> projects/<project>
```

The answer's `visibility` is `private`, `internal` or `public`. Run before every read and write: the upload goes ahead only on `private`. `internal` and `public` are refused, and so is an answer that cannot be read, with no override: a project can be made public after it was set as the sink.

### `access`

```bash
glab api --hostname <host> "projects/<project>/members/all?per_page=100&page=<n>"
```

One entry per member, direct or inherited; pages are followed from `1` until one is empty, and the count is the number of people with access that the disclosure shows. A refusal means the count is left out of the disclosure, never that the upload stops.

### `read`

```bash
glab api --hostname <host> "projects/<project>/repository/files/<path>/raw?ref=<ref>"
```

The file's bytes. A `404` means the path is not there yet; any other failure stops the upload.

### `create`

```bash
glab api --hostname <host> -X POST -H "Content-Type: application/json" "projects/<project>/repository/files/<path>" --input -
```

With a JSON body on standard input: `{"branch": "<ref>", "commit_message": "Add Run Record <run-id>", "encoding": "base64", "content": "<base64 of the record>"}`. GitLab does not document a create-only write, so the path is read first, every time (`read`, above), and the create is sent only when it is not there. A `400` saying the file already exists means it was created in between, and is read again the same way. A `409` is retried the same way: the path is read again first, and identical bytes there mean the upload is done.

### `list`

```bash
glab api --hostname <host> "projects/<project>/repository/tree?recursive=true&path=records&ref=<ref>&per_page=100&page=<n>"
```

Every blob with its `path`: the listing is recursive and paginated, and pages are followed from `1` until one is empty, since a server may cap `per_page` below what was asked. `path` is the folder of the prefix asked for. A `404` on that folder is an empty listing, when the project itself can be read. Used by the dashboard, which lists `records/` this way, reads only the paths its cache lacks (`read`, above), and checks `visibility` first. A project that cannot be read is a warning on the page, not a failure.

## The upload is create-only

- Identical bytes already at the path count as already uploaded, so repeating `--upload <run>` is safe.
- Different bytes at the path stop the upload: nothing is overwritten, and the clash is shown.
- A record that fails the safe-field check, or has no login, is never uploaded.

## Retention

A git repository cannot expire a file, and the disclosure says so: a record uploaded here is kept until someone with write access deletes it by hand. Anyone who can read the project can read every record in it.

## Check before use

- No upload has run against a real GitLab project yet: the POST body and its `--input -`, the `400` and `409` texts, the `404` texts, and the pagination of `members/all` and `repository/tree` are read from `glab`'s and GitLab's documentation, and are exercised in tests against a fake transport only.
- Whether the read-then-create is race-free: GitLab documents no create-only write, so two writers to one path can both read "missing", and the second create then fails with the "already exists" `400`, which the retry reads again.
- Whether an `internal` project should be accepted on a self-managed instance: it is refused for now, as it is on GitHub Enterprise.
