# Run Record sinks

A **Sink** is a store off the machine that receives Run Records. `local` is always on: the record is written to `<run_dir>/records/<run-id>.json`. One more sink may be set in the config's `records.sink` ([CONFIG.md](CONFIG.md#records)); the upload at close-out and `--upload <run>` write to it through the operations below, and only these: the first five on every sink, and `lifecycle` on an `s3` sink alone. How each one is done on one sink is in that sink's own file under [sinks/](sinks/): load only the file for the sink the config names.

| Operation    | Kind  | What it gives                                                                                                                                          |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `visibility` | read  | Whether the sink is private. Run before every read and write: an upload refuses anything but private, with no override; the dashboard warns and reads. |
| `access`     | read  | How many people can read the sink, for the disclosure. Left out of the disclosure when it cannot be read.                                              |
| `read`       | read  | The bytes at one path, or that the path is not there.                                                                                                  |
| `create`     | write | Create one file at a path, and nothing else: it never changes or deletes one.                                                                          |
| `list`       | read  | Every path under a prefix, for the dashboard.                                                                                                          |
| `lifecycle`  | read  | `s3` only: the bucket's lifecycle rules, which raw-folder upload reads to find a rule that expires `raw/`. Never written.                              |

`sinks/<sink>.md` is named for a value of `records.sink.type`. It opens with these bullets, each on its own line in this form:

- `- **Id:** \`<sink>\``, the file's own name.
- `- **Support Level:** \`<level>\``, then what it rests on, in the vocabulary harness files use ([HARNESSES.md](HARNESSES.md#support-level)).
- `- **Facts from:**` where and when each fact was read.

Then a `## Access` section giving the writer's access and the reader's, a `###` section for each operation above that the sink has (`lifecycle` in `sinks/s3.md` alone), headed with its name in backticks, giving the command and how to read its output, and a `## Check before use` section for every fact no run has confirmed yet.

**The path** is `records/<host>/<owner>/<repo>/<login>/<run-id>.json`, every segment lowercased: the host keeps different forges apart, so two repositories never collide in one shared sink, even with one run id or one login. `<owner>` is the whole namespace of a GitLab project in a subgroup (`gitlab.com/grp/sub/widgets`), so a path is parsed from its end. `<host>/<owner>/<repo>` is `records.repository`, or the `origin` remote (or the only remote; with several and none named `origin`, the run asks which). `<login>` is the tracker login, which is also the record's `run.operator`, overridden only by `ORCHESTRATE_OPERATOR`; with no login, nothing is uploaded.

**The dashboard reads through the same operations:** `visibility` first, then `list` under `records/`, then `read` of each path its cache lacks, so a sink type is written once. It needs read access only, and reads the namespaces from the paths, since there is no index file. A sink that cannot be read is a warning on the page, never a failure.

**Whoever can read the sink reads every record.** A sink holds each teammate's records under their login, and the dashboard shows them side by side; anyone with read access sees every one of them, whatever the page shows or hides. Who uploads (each person's yes, or an approved routine write) and who can read the sink are the organization's controls; no page setting stands in for them.

**The write is create-only.** Identical bytes already at the path count as already uploaded; different bytes stop the upload; a parallel-write conflict is retried.

**The sinks, and their Support Level** (the level its own file states, in the vocabulary harness files use: [HARNESSES.md](HARNESSES.md#support-level)):

| Sink     | Support Level | File                               |
| -------- | ------------- | ---------------------------------- |
| `github` | `verified`    | [sinks/github.md](sinks/github.md) |
| `gitlab` | `documented`  | [sinks/gitlab.md](sinks/gitlab.md) |
| `s3`     | `documented`  | [sinks/s3.md](sinks/s3.md)         |

A sink's Support Level is the one its own file states, and the Dispatch Plan and the disclosure name it while it is below `verified` ([RUN.md](RUN.md#uploading-the-run-record)): `github` is `verified`, while `gitlab` and `s3` ship at `documented` until a run has uploaded to them and the dashboard has read the record back, citing its Activity Log. For a sink, `verified` means a run uploaded a record to it and the dashboard read that record back from it.

**Raw run folders** go only to an `s3` sink, set separately as `records.raw.sink`, and only when that bucket's own lifecycle rule expires `raw/`: the access the upload needs, and the lifecycle read, are in [sinks/s3.md](sinks/s3.md#raw-run-folders).

**Moving a sink.** Copy `records/` to the new sink under the same paths; create-only makes a repeated copy safe. [sinks/s3.md](sinks/s3.md#moving-to-a-new-sink) shows how for a bucket. Azure Blob, Bitbucket, Gitea and Forgejo are not sinks today.
