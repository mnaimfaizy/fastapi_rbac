# The response file

Every Response round writes one `review-response.json`: one entry per finding on the round's Work list, each with its Verdict. Run by a person, it is written at `<working_dir>/pr-<n>/review-response.json` (ADAPTER.md), never committed, and shown as the round's summary before anything is posted. Run in CI, the trusted script reads it as an unverified claim and checks every entry against what was actually pushed.

Check a file with:

```bash
node "<skill>/response.mjs" check <path to review-response.json>
```

It exits 0 and prints the summary, or prints each problem with its place in the file and exits 1. Exit 2 is a usage error.

## Fields

| Field                  | Required         | Meaning                                                                                                                                                                                                                            |
| ---------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `findings`             | yes              | One entry per finding on the Work list, in Work list order. An empty list is valid: a round with no findings still writes the file.                                                                                                |
| `findings[].thread_id` | yes              | The GraphQL node id of the review thread (`PRRT_…`). For a top-level comment or review the person chose to treat as a finding, the node id of that comment or review: it gets a reply, and is never resolved.                      |
| `findings[].verdict`   | yes              | `fixed`, `addressed` or `declined` (DESIGN.md, Verdicts).                                                                                                                                                                          |
| `findings[].reply`     | yes              | The reply posted on the thread: what changed and why it answers the finding, what on the branch already handles it, or why it is declined. Public text: never a token, an environment value or a file from outside the repository. |
| `findings[].commit`    | for `fixed` only | The full SHA of the one commit that fixes this finding. Required for `fixed`, and absent for `addressed` and `declined`, which claim no commit.                                                                                    |

No other field is allowed, at the top level or in an entry. The rule the schema below cannot say: **one entry per thread**, so a `thread_id` appears at most once.

A `fixed` entry is a claim. The thread is resolved only when that commit was pushed to the pull request's head **and** changes the file the finding is on (DESIGN.md, Resolution rule); otherwise it gets the reply and stays open.

## Schema

The schema below is the contract. `response.mjs` reads it from this file, so the check and this page cannot disagree. A host's own parser of the file (a CI flow's trusted script, say) can be tested against the same block: it must accept every file this schema accepts and refuse every file it refuses.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "review-response.json",
  "type": "object",
  "required": ["findings"],
  "additionalProperties": false,
  "properties": {
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["thread_id", "verdict", "reply"],
        "additionalProperties": false,
        "properties": {
          "thread_id": { "type": "string", "pattern": "\\S" },
          "verdict": { "enum": ["fixed", "addressed", "declined"] },
          "reply": { "type": "string", "pattern": "\\S" },
          "commit": { "type": "string", "pattern": "^(?:[0-9a-f]{40}|[0-9a-f]{64})$" }
        },
        "if": { "properties": { "verdict": { "const": "fixed" } } },
        "then": { "required": ["commit"] },
        "else": { "not": { "required": ["commit"] } }
      }
    }
  }
}
```

`pattern` `\S` means "not empty and not only whitespace". A commit SHA is lowercase hex, 40 characters (SHA-1) or 64 (SHA-256), never an abbreviation: an abbreviation can name a different commit by the time it is read.

## Example

```json
{
  "findings": [
    {
      "thread_id": "PRRT_kwDOexample1",
      "verdict": "fixed",
      "commit": "3f2c1e9a8b7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e",
      "reply": "Guarded the empty list before reading its first item; the new test covers it."
    },
    {
      "thread_id": "PRRT_kwDOexample2",
      "verdict": "addressed",
      "reply": "Already handled: the caller checks the length on line 40 before it calls this."
    },
    {
      "thread_id": "PRRT_kwDOexample3",
      "verdict": "declined",
      "reply": "Renaming this would change the public API the issue asked us to keep. Reply here if you want it in its own issue."
    }
  ]
}
```

## The summary

`check` prints one line per entry, then the counts, so the person sees the whole round before confirming what is posted:

```text
fixed      PRRT_kwDOexample1  3f2c1e9a8b7d
addressed  PRRT_kwDOexample2
declined   PRRT_kwDOexample3
3 findings: 1 fixed, 1 addressed, 1 declined
```
