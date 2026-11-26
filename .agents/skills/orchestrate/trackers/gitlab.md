# GitLab

- **Id:** `gitlab`
- **Support Level:** `documented`. Written from GitLab's documentation and `glab`'s help alone: no Team Run has been recorded on GitLab yet, and no command below has been run against a GitLab instance. The first Team Run that reaches its close-out on GitLab moves it, citing its Activity Logs.
- **Facts from:** docs.gitlab.com (REST API for issues, notes, issue links, labels, merge requests and projects; user docs for linked issues, labels, quick actions and permissions; GitLab.com and self-managed rate limits), read on 2026-11-19 for Agent-kit's research in [#304](https://github.com/mnaimfaizy/agent-kit/issues/304); and the `glab` CLI, version 1.116.0, its `glab api` help read on 2026-11-19.

Every command runs from the repository root, with `glab` signed in as the teammate: `glab auth login`, or `glab auth login --hostname <host>` for a self-hosted GitLab, which the config's `tracker: gitlab` pin names ([CONFIG.md](../CONFIG.md#tracker)). Inside a clone, `glab api` sends each request to the remote's own host and fills `:id` with the project's id, so no command names the host or the project. `glab api` has no `--jq`: its output is piped to `jq`, and with `--paginate --output ndjson` each item of every page comes out as one JSON line, so no page is lost.

GitLab numbers issues and merge requests apart, each from 1 per project: in the API both are the `iid`. `<n>` below is an issue's `iid` and `<mr>` a merge request's.

Everything here works on GitLab Free. Where a Premium feature would add something, the operation says what Free does instead; a Team Run never needs one.

## Writing the row on GitLab

The row ([TEAM.md](../TEAM.md#the-row)) is written as TEAM.md gives it, with two differences that GitLab's references need:

- **A merge request is `!<mr>`.** On GitLab `#<n>` links an issue, so where the row writes a pull request, `#<pr>`, write `!<mr>`: in the **Pull request** and **Conflicts with** lines, the headline and the milestones. A blocker in **Parked on** is an issue, and stays `#<n>`.
- **No line starts with `/`, after any spaces.** GitLab runs such a line of a note as a quick action, on create and on edit, and removes it from the note ([below](#write-row)). TEAM.md's form never starts a line with a value, and `write-row` checks the file before it sends it.

GitLab renders `<sub>` and hides the `<!-- … -->` marker, as GitHub does; **check before use**.

## Operations

### `viewer`

```bash
glab api user | jq -r .username
```

The signed-in user's username. A ticket is this teammate's when its only assignee has this username. On GitLab Free an issue has at most one assignee, so "needs one assignee" arises only on Premium.

### `spec-tickets`

```bash
glab api projects/:id/issues/<spec> | jq -r .description
glab api "projects/:id/issues?iids[]=<n>&iids[]=<n>&per_page=100" | jq -c '.[] | {iid, title, state, assignees: [.assignees[].username], labels}'
```

GitLab Free has no sub-issues: an issue's child items there are tasks, and an epic, which holds issues, is Premium. So a spec on GitLab lists its tickets as a task list in its description, one item per ticket, each starting with the ticket's reference: `- [ ] #<n>` (or `- [x] #<n>` once done). The first command reads the description; take the `#<n>` that opens each task-list item, in order, and nothing else in it. The second reads those tickets, up to 100 per call: one JSON line each, with its `iid`, `title`, `state` (`opened` or `closed`), its assignees' usernames, and `labels`, a list of names. A reference to another project (`group/project#<n>`) is outside the spec. A task-list item whose ticket the second command does not return cannot be read: SPEC.md's Decision Request for an edge to an issue that cannot be read. To re-read one ticket's assignees just before a row or label write ([TEAM.md](../TEAM.md#who-writes)), run the second command with that ticket's `iid` alone. Agent-kit chose this convention while building the Team Run ([#314](https://github.com/mnaimfaizy/agent-kit/issues/314)); it follows the task-list fallback that Agent-kit's [`docs/agents/issue-tracker.md`](https://github.com/mnaimfaizy/agent-kit/blob/main/docs/agents/issue-tracker.md) gives for a parent without sub-issues. A Team Run on GitLab reads the spec's tickets here, and plans the Tickets shape when this lists any ([TEAM.md](../TEAM.md#whose-tickets)). **Check before use** ([below](#check-before-use)).

### `blockers`

```bash
glab api --paginate --output ndjson projects/:id/issues/<n>/links | jq -c 'select(.link_type == "is_blocked_by") | {iid, state, project_id}'
glab api projects/:id/issues/<n> | jq -r .description
```

The first lists ticket `<n>`'s native blocking links: each issue that blocks it, from the ticket's side, has `link_type` `is_blocked_by`. Blocking links ("blocks", "is blocked by") are Premium; on GitLab Free there are none, and the first command prints nothing. A blocker with another `project_id` than the ticket's is outside the spec.

The second reads the ticket's description. On Free, and beside native links on Premium, its blockers are listed in a line at the top of it, `Blocked by: #<n>, #<n>`: its first line, blank lines skipped, when it starts with `Blocked by:`, each `#<n>` in it an issue of this project. A blocker named both ways counts once. Neither form gives a blocker's merged state: that is the `merged` operation's.

### `merged`

```bash
glab api --paginate --output ndjson projects/:id/issues/<n>/closed_by | jq -c '{iid, state, merged_at}'
```

The merge requests that close issue `<n>`, each with its `iid`, its `state` (`opened`, `closed`, `locked` or `merged`) and `merged_at`. The ticket's merge request is merged when one of them has `state` `merged`. Read it here, not from the issue closing: GitLab clears a blocking link when the blocker issue closes, and an issue can be closed by hand, or by a merge into a branch other than the default. A closed ticket with no merged merge request is not merged: it is a question for the human, not a cleared blocker. This also lists each ticket's open merge requests, `state` `opened`, for the check against a teammate's branch ([TEAM.md](../TEAM.md#conflicts-with-a-teammates-branch)).

### `public`

```bash
glab api projects/:id | jq -r .visibility
```

`public` means anyone can read the project's issues, so a Shared Board row is on the open web. `internal` means every signed-in user of that GitLab instance can read them, which is not the open web; the Dispatch Plan's public line is for `public` only. `private` is readable only by the project's members.

### `labels`

```bash
glab api --paginate --output ndjson "projects/:id/labels?include_ancestor_groups=true&per_page=100" | jq -r .name
```

Every label the project's issues can carry: its own and its groups'. A group label with a state label's name counts as present.

### `create-label`

```bash
glab api projects/:id/labels -f name="<name>" -f color="#6699cc" -f description="orchestrate Team Run state"
```

Creates one plain project label; GitLab requires a `color`. It is a write as the human: made only on the yes to the Dispatch Plan's one ask for the missing state labels ([TEAM.md](../TEAM.md#missing-state-labels)), never as a routine write. It needs the Planner role or higher in the project (Reporter before GitLab 17.7); a refusal is shown to the human as `glab` printed it. A name with `::` is a scoped label on Premium and a plain one on Free; the default `team.labels` have none.

### `row`

```bash
glab api --paginate --output ndjson "projects/:id/issues/<n>/notes?sort=asc&order_by=created_at&per_page=100" | jq -c 'select((.system | not) and (.body | contains("<!-- orchestrate:shared-board-row "))) | {id, author: .author.username, updated_at, body}'
```

One JSON object per line, for the row notes on ticket `<n>`, oldest first: each note that is not a system note (GitLab's own "added label" and "mentioned in" lines) and whose body carries the hidden marker `<!-- orchestrate:shared-board-row `, with its note `id`, its `author`'s username, its `updated_at` and its `body`. The marker's own `ticket`, `run` and `author` fields are read from the body ([TEAM.md](../TEAM.md#the-row)). No output means the ticket has no row yet.

### `write-row`

```bash
grep -nE '^[[:space:]]*/' <file>
glab api projects/:id/issues/<n>/notes -F body=@<file> | jq .id
glab api -X PUT projects/:id/issues/<n>/notes/<id> -F body=@<file> | jq .id
```

The first checks the row in `<file>`, as written in the run folder: it must print nothing. A line it prints starts with `/`, which GitLab would run as a quick action on the ticket (`/close`, `/assign`, `/label`) and remove from the note: that row is not sent, and the failure is logged as a failed write ([TEAM.md](../TEAM.md#when-a-row-is-written)), with the line. The second creates ticket `<n>`'s row note from `<file>` and prints the new note's id: record it on the board. The third edits the row note `<id>` in place. `-F body=@<file>` reads the value from the file, so the body is never quoted on the command line.

Each row is one note, written only by its author's Chief of Staff: TEAM.md's check of the assignee and of the marker's `run` and `author`, made before every write, is what keeps it so. GitLab does not: commenting needs the Guest role, and a teammate with Maintainer can edit anyone's note. GitLab strips carriage returns and trailing spaces from a note, so a `row` read back can differ from `<file>` in white space only; compare with the run folder's own copy, as TEAM.md says, never with the read-back. A refusal is logged as `glab` printed it, and the run goes on.

An edit of a note that was deleted fails with `404 Not found`: the row is re-created with the second command ([TEAM.md](../TEAM.md#a-persons-edits)).

### `set-state`

```bash
glab api -X PUT projects/:id/issues/<n> -f add_labels="<new>" -f remove_labels="<old>,<old>"
glab api projects/:id/issues/<n> | jq -r '.labels[]'
```

The first adds the label for the ticket's coarse state and removes each other state label it carries, in one edit; a label the ticket does not carry is not named, and with none to remove, `remove_labels` is left out. Each is a plain label: on Free labels are not exclusive, so the remove is what keeps the ticket at one state label. `add_labels` and `remove_labels` take names separated by commas, so a state label whose name has a comma cannot be set here: its write does not hold, as below. `config.mjs check` does not refuse such a name, and the default `team.labels` have none. The second reads the labels back. Setting a label on an existing issue needs the Planner role or higher (Reporter before 17.7), or the ticket's own author; whether GitLab refuses the change or drops it silently for a Guest is not known, which is why the labels are read back: when the read-back does not show exactly the new state label among the six, each name compared ignoring case and spaces at either end, as `config.mjs` assumes GitLab compares label names (**check before use**), the label write did not hold, and the row note stays the record ([TEAM.md](../TEAM.md#states-and-labels)).

`add_labels` with a label the project does not have creates it, as a project label: a missing state label is never named here, so a label is never made without the human's yes.

### `pull-head`

```bash
glab api projects/:id/merge_requests/<mr> | jq -c '{state, source_branch, sha}'
git fetch <remote> "refs/merge-requests/<mr>/head"
```

The first gives the merge request's `state`, its source branch and its head commit, `sha`. The second fetches that commit, from `<remote>`, the remote `check` reports in its `remote` field ([TEAM.md](../TEAM.md#find-the-tracker)), from a fork as well, since GitLab keeps every merge request's head under `refs/merge-requests/<mr>/head` in the target project, so `git merge-tree` can test-merge it against this teammate's branch. Read it only for a merge request whose `state` is `opened`.

## Rate limits

On gitlab.com, as of 2026-11-19: 2,000 authenticated API requests a minute per user, and 60 note creations a minute on issues and merge requests. Proposed per-plan limits, not in effect then, would hold Free at 5,000 an hour with a burst of 100 a minute. A self-managed instance's API limit is off by default, and creating notes is held to 300 a minute. A row is created once and then edited, and written only when it changes, so a Team Run stays well under all of these.

## Check before use

Nothing here has been run against GitLab. Each item below was not confirmed by the sources in **Facts from**; the first Team Run that relies on it records in its Activity Log what it found.

- **How a spec lists its tickets.** No run has read a spec's task list on GitLab yet: that GitLab keeps `- [ ] #<n>` as written in the description, and that `iids[]` returns each ticket. Whether an issue can be the parent of another issue on any tier is not confirmed either.
- **`is_blocked_by` on Free.** Whether a Free instance rejects or silently downgrades a `blocks` link, and so whether `links` can ever return `is_blocked_by` there. The `Blocked by:` line is read either way.
- **`closed_by` after the merge.** That `closed_by` still lists a merge request once it is merged, with `state` `merged`, and lists only those that close the issue (by "Closes #<n>" or the merge request's own setting), not ones that only mention it.
- **Quick actions on a note's edit.** GitLab's Notes API says it runs and removes quick actions on create and on update; whether a line with spaces before its `/` is run too is not confirmed, which is why `write-row`'s check allows none.
- **Label names and case.** That GitLab compares label names ignoring case, as GitHub does, so a project label `Team: Planned` is the `team: planned` label. `config.mjs check` and TEAM.md assume it.
- **A Guest's label change.** Applying labels to an existing issue needs Planner; whether GitLab answers a Guest with an error or drops the change silently. `set-state` reads the labels back either way.
- **The marker and `<sub>`.** That GitLab hides an HTML comment in a rendered note and renders `<sub>`.
- **`-F body=@<file>`.** That `glab api` sends the file's text as a string, and does not read a body that starts with `[`, `{`, a number, `true`, `false` or `null` as JSON. A row starts with `**`, so the run does not depend on it.
- **Editing a deleted note.** That `PUT` on a deleted note fails with `404 Not found`. The first Team Run that re-creates a deleted row records in its Activity Log what the edit printed.
- **Editing a note and the rate limit.** Whether a `PUT` on a note counts toward the note-creation limit.
- **`iids[]` paging.** That one `spec-tickets` read returns every ticket asked for, up to 100; a spec with more is read in groups of 100.
