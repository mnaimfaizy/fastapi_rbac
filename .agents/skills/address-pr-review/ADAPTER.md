# Address PR Review config

The config holds the repository's facts; the skill body names no host. A repository may add `address-pr-review.config.yml` (or `.yaml` / `.json`) at its root. Every key is optional: a missing file, or a missing key, takes the default below. Every step reads it through one reader, `adapter.mjs`.

```bash
node "<skill>/adapter.mjs" check [--repo <dir>]
```

Exit 0 prints `{"path": ..., "config": ...}`: the file it read (`null` when there is none) and the effective settings, defaults filled in. Exit 1 prints each problem as `<file> line <n>: <problem>`. Exit 2 is a usage error.

## Lookup order and dialects

The first file present is the config: `address-pr-review.config.yml`, then `.yaml`, then `.json`. A key it does not carry takes the default; the search does not go on into another file, and files are never merged.

**JSON** is read whole and is the dialect for anything the YAML subset cannot say.

**YAML** is read in this subset only:

- one top-level mapping, its keys at column 1;
- plain, single-quoted or double-quoted scalars, with an optional trailing ` # comment`;
- a list as a block sequence of scalars, indented or at the key's own indent (`reviewer_logins:` then `- github-actions`), or as a one-line flow list (`[a, 'b']`, `[]`);
- full-line `#` comments anywhere;
- `true` and `false` are booleans; every other value is a string.

Everything else is a **problem**, named with its line: a tab in the indentation, a first key not at column 1, unexpected indentation, a line that is not `key: value`, a duplicate key, an unterminated quote or text after a closing quote, a flow mapping, an anchor or alias, a multi-line scalar, a flow list not closed on its line, an empty list item, a nested mapping, an unknown key, and a value of the wrong shape. A JSON file that does not parse, or is not an object, is a problem on the line the parser names. A problem is never a silent default: `check` exits 1, and the skill stops before it reads the pull request.

## Keys

| Key               | Default                 | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reviewer_logins` | `[github-actions]`      | The logins whose review threads are Findings. A non-empty list of GitHub logins, a trailing `[bot]` allowed. The default is the login the kit's own review flow posts as. Add a third-party review bot's login to answer its threads too. Anything else that posts as one of these logins looks like that reviewer: see DESIGN.md, Trust.                                                                                                                                                                                                                                          |
| `working_dir`     | `tmp/address-pr-review` | Where each round's worktree and response file go (`<working_dir>/pr-<n>/`), relative to the repository root and inside it. Keep it ignored by git: the skill stops if it is not.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `worktree`        | `true`                  | `true`: fix in a `git worktree` under `working_dir`, detached at the round's start head, so your checkout never moves. `false`: fix in the current checkout, which must be clean and at the start head.                                                                                                                                                                                                                                                                                                                                                                            |
| `commit_command`  | unset: `git commit -F`  | A command that commits the staged change, for a repository with its own commit runner. It runs with the round's worktree as its working directory. It must contain `{message_file}`, which is replaced by the absolute path of the file holding the commit message.                                                                                                                                                                                                                                                                                                                |
| `push_command`    | unset: `git push`       | A command that pushes the worktree's `HEAD` to the pull request's head branch. It runs with the round's worktree as its working directory. It must contain `{branch}`, which is replaced by that branch's name. It may never force-push, delete or mirror: a short-flag group holding `f` or `d` (`-f`, `-vf`, `-d`), a long option starting `--for`, `--de`, `--mi` or `--pru` (git accepts abbreviations), and a refspec starting with `+` or `:`, quoted or not, are problems. This guards against accidents in a command the repository writes; it is not a security boundary. |

Without `push_command`, the push is `git push origin HEAD:refs/heads/{branch}`.

## Example

```yaml
# address-pr-review.config.yml
reviewer_logins:
  - github-actions
  - coderabbitai # a third-party review bot
working_dir: tmp/address-pr-review # gitignored
worktree: true
commit_command: "npm run commit -- --file {message_file}"
push_command: git push origin HEAD:refs/heads/{branch}
```

The same as JSON:

```json
{
  "reviewer_logins": ["github-actions", "coderabbitai"],
  "working_dir": "tmp/address-pr-review",
  "worktree": true,
  "commit_command": "npm run commit -- --file {message_file}",
  "push_command": "git push origin HEAD:refs/heads/{branch}"
}
```

## Tests

The contract suites are every `*.test.mjs` in this folder: `node --test <this folder>/*.test.mjs`. `adapter.test.mjs` covers the lookup order, the defaults and each problem class; `response.test.mjs` covers RESPONSE.md's schema against good and bad files under `fixtures/responses/`.
