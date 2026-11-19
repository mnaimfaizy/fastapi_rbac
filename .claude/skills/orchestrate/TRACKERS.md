# Tracker operations

A Team Run ([TEAM.md](TEAM.md)) reads and writes the tracker through the operations below, and only these. How each one is done on one tracker is in that tracker's own file under [trackers/](trackers/): load only the file for the tracker this run is on, once [TEAM.md](TEAM.md#find-the-tracker) has named it. The rest of the skill stays bound to `gh`, as before.

| Operation      | Kind                      | What it gives                                                                                                                                                                             |
| -------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewer`       | read                      | The signed-in user's login: the teammate whose tickets this run builds.                                                                                                                   |
| `spec-tickets` | read                      | Each of the spec's tickets: its number, title, open or closed, its assignees' logins and its labels. Read again just before every row or label write, for the ticket's current assignees. |
| `blockers`     | read                      | The issues that block one ticket: the tracker's own blocking links, and a "Blocked by" list in its description.                                                                           |
| `merged`       | read                      | Whether a ticket's pull request is merged: the pull request that closes it, and its state.                                                                                                |
| `public`       | read                      | Whether the repository is public, so readable by anyone.                                                                                                                                  |
| `labels`       | read                      | The names of the repository's labels, to find which state labels are missing.                                                                                                             |
| `create-label` | write as the human, asked | Create one state label in the repository. Never routine: the Dispatch Plan asks once for all the missing labels.                                                                          |
| `row`          | read                      | A ticket's Shared Board row comments: each comment that carries the row's hidden marker, with its id, its author's login, its body and when it was last changed.                          |
| `write-row`    | routine write             | Create a ticket's row comment, or edit it by its comment id, with a body from a file. Approved once at "go", for this teammate's own tickets only, and the last write of one handed off.  |
| `set-state`    | routine write             | Set a ticket's single state label: add the one for its coarse state, remove any other of the six, and read its labels back. Approved with the row.                                        |
| `pull-head`    | read                      | The head branch and commit of an open pull request, to test-merge this teammate's branch against a teammate's.                                                                            |

## A tracker file

`trackers/<tracker>.md` is named for a value of the config's `tracker` key ([CONFIG.md](CONFIG.md#tracker)). It opens with these bullets, each on its own line in this form:

- `- **Id:** \`<tracker>\``, the file's own name.
- `- **Support Level:** \`<level>\``, then what it rests on, in the vocabulary harness files use ([HARNESSES.md](HARNESSES.md#support-level)).
- `- **Facts from:**` where and when each fact was read.

Then a `###` section for each operation above, headed with its name in backticks, giving the command and how to read its output, and a `## Check before use` section for every fact no run has confirmed yet. A contract test holds each file to every operation.
