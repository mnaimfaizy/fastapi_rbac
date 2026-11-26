# GitHub

- **Id:** `github`
- **Support Level:** `documented`. No Team Run has been recorded on GitHub yet; the first one that reaches its close-out moves it, citing its Activity Logs.
- **Facts from:** the `gh` CLI, version 2.102.0, read on 2026-11-19 (`gh issue view --json`, `gh issue edit`, `gh pr view --json`, `gh repo view --json`, `gh label list --json`, `gh api user`, `gh api` for issue comments), and GitHub's REST API for sub-issues and issue dependencies, as [SPEC.md](../SPEC.md#read-the-spec) reads them, on 2026-11-13.

Every command runs from the repository root, with `gh` signed in as the teammate. `<owner>/<repo>` is `gh repo view --json nameWithOwner --jq .nameWithOwner`.

## Operations

### `viewer`

```bash
gh api user --jq .login
```

The login of the signed-in user. A ticket is this teammate's when its only assignee has this login.

### `spec-tickets`

```bash
gh api --paginate --slurp repos/<owner>/<repo>/issues/<n>/sub_issues
```

One array of pages: read every page. Each item is a ticket, with `number`, `title`, `state` (`open` or `closed`), `assignees[].login` and `labels[].name`. Why `--paginate --slurp`: [SPEC.md](../SPEC.md#read-the-spec).

### `blockers`

```bash
gh api --paginate --slurp repos/<owner>/<repo>/issues/<n>/dependencies/blocked_by
```

Each item is an issue that blocks ticket `<n>`, with its `number` and `state`. A "Blocked by" section in the ticket's body, listing issues by number, is a blocker too, read the same way ([SPEC.md](../SPEC.md#read-the-spec)).

### `merged`

```bash
gh issue view <n> --json closedByPullRequestsReferences --jq '.closedByPullRequestsReferences[].number'
gh pr view <pr> --json state,mergedAt
```

The first lists the pull requests that close ticket `<n>`. The ticket's pull request is merged when one of them has `state` `MERGED`. A closed ticket with no merged pull request is not merged: it was closed by hand, so it is a question for the human, not a cleared blocker.

### `public`

```bash
gh repo view --json visibility --jq .visibility
```

`PUBLIC` means anyone can read the repository's issues, so a Shared Board row is on the open web. `PRIVATE` and `INTERNAL` do not.

### `labels`

```bash
gh label list --limit 1000 --json name --jq '.[].name'
```

Every label name in the repository. `gh label list` returns 30 labels unless `--limit` says more.

### `create-label`

```bash
gh label create "<name>" --description "orchestrate Team Run state"
```

Creates one label. It is a write as the human: made only on the yes to the Dispatch Plan's one ask for the missing state labels ([TEAM.md](../TEAM.md#missing-state-labels)), never as a routine write. It needs write access to the repository; a refusal is shown to the human as `gh` printed it.

### `row`

```bash
gh api --paginate repos/<owner>/<repo>/issues/<n>/comments \
  --jq '.[] | select(.body | contains("<!-- orchestrate:shared-board-row ")) | {id, author: .user.login, updated_at, body}'
```

One JSON object per line, for the row comments on ticket `<n>`, oldest first: each comment whose body carries the hidden marker `<!-- orchestrate:shared-board-row `, with its comment `id`, its `author`, its `updated_at` and its `body`. The marker's own `ticket`, `run` and `author` fields are read from the body ([TEAM.md](../TEAM.md#the-row)). No output means the ticket has no row yet. `--jq` runs on each page, so `--slurp`, which `gh` refuses with `--jq`, is not needed.

### `write-row`

```bash
gh api repos/<owner>/<repo>/issues/<n>/comments -F body=@<file> --jq .id
gh api -X PATCH repos/<owner>/<repo>/issues/comments/<id> -F body=@<file> --jq .id
```

The first creates ticket `<n>`'s row comment from `<file>`, the row as written in the run folder, and prints the new comment's id: record it on the board. The second edits the row comment `<id>` in place. `-F body=@<file>` reads the value from the file, so the body is never quoted on the command line. Commenting needs only read access and the right to comment on the issue; editing a comment needs its author, or write access. A refusal is logged as `gh` printed it, and the run goes on.

An edit of a comment that was deleted fails with `HTTP 404`: the row is re-created with the first command ([TEAM.md](../TEAM.md#a-persons-edits)).

### `set-state`

```bash
gh issue edit <n> --add-label "<new>" --remove-label "<old>" [--remove-label "<old>" …]
gh issue view <n> --json labels --jq '.labels[].name'
```

The first adds the label for the ticket's coarse state and removes each other state label it carries, in one edit; a label the ticket does not carry is not named. The second reads the labels back. GitHub drops a label change silently, with no error, when the teammate has no Triage or Write access to the repository: when the read-back does not show exactly the new state label among the six, each name compared ignoring case and spaces at either end, as GitHub compares label names, the label write did not hold, and the row comment stays the record ([TEAM.md](../TEAM.md#states-and-labels)). `--add-label` with a label the repository does not have fails with an error, so a missing state label is never named here. `--add-label` and `--remove-label` split their value on commas, so a state label whose name has a comma cannot be set here: `gh` would name two labels, and the write does not hold, as above. `config.mjs check` does not refuse such a name, and the default `team.labels` have none.

### `pull-head`

```bash
gh pr view <pr> --json state,headRefName,headRefOid
git fetch <remote> "pull/<pr>/head"
```

The first gives the pull request's `state`, its head branch and its head commit. The second fetches that commit from `<remote>`, the remote `check` reports in its `remote` field ([TEAM.md](../TEAM.md#find-the-tracker)), from a fork as well, so `git merge-tree` can test-merge it against this teammate's branch. Read it only for a pull request whose `state` is `OPEN`.

## Check before use

- `closedByPullRequestsReferences` lists the pull requests whose body closes the issue; a pull request that only mentions it is not listed. A merged pull request is still listed: on 2026-11-19, with `gh` 2.102.0, an issue closed by a merged pull request listed it, both in `gh issue view --json closedByPullRequestsReferences` and in the GraphQL field, with and without `includeClosedPrs: true`, which gave its `state` as `MERGED`. GitHub describes the field as listing open pull requests, and `includeClosedPrs` defaults to false, so one closed without being merged may be left out: it is not merged either way. The first Team Run that relies on `merged` records in its Activity Log what it returned.
- The sub-issues and dependencies endpoints, as [SPEC.md](../SPEC.md#read-the-spec) says.
- Whether `gh issue edit` exits non-zero when GitHub drops a label change ([#303](https://github.com/mnaimfaizy/agent-kit/issues/303)) is not confirmed, which is why `set-state` reads the labels back. The first Team Run that writes a state label records the read-back in its Activity Log.
- That `PATCH` on a deleted comment fails with `HTTP 404`. The first Team Run that re-creates a deleted row records in its Activity Log what the edit printed.
- The `row` filter reads the `body` of every comment on the ticket, page by page; not confirmed past a few hundred comments.
