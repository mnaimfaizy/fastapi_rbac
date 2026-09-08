# Branch Names (canonical)

**This file is the single source of truth for git branch names in this repository.**

Agents and humans must follow these rules strictly. Do not invent alternate prefixes from harness defaults, user preferences, or prior habit. Harness files (Cursor rules, Copilot prompts, Claude skills, resolve-issue instructions) link here; they must not redefine divergent rules.

## Format

```
<prefix>/<slug>
```

When the work is for a numbered tracker issue, include that number:

```
<prefix>/<issue-number>-<slug>
```

- Prefix is one of the six values in the table below, followed by `/`
- Slug is lowercase kebab-case, short, and descriptive
- Issue number is the GitHub issue number with no `#`

## Prefixes

| Prefix | Use for |
| --- | --- |
| `feat` | New user-facing or API capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Tests only |
| `refactor` | Internal restructuring, no behavior change |
| `chore` | Maintenance that does not fit above |

These six prefixes are the complete allowed set. Use `feat/`, not `feature/`.

## Issue-numbered work

When the work is for a numbered tracker issue, the name includes that number and a short slug:

Correct: `feat/100-user-scoped-rate-limit-keys`

Correct: `docs/91-branch-naming-convention`

When there is no tracker issue, omit the number: `chore/graphify-report`.

## Harness prefixes

Use only the prefixes in the table above. Harness, vendor, or company prefixes are forbidden for humans and agents: `cursor/`, `claude/`, `copilot/`, and the same idea under any other tool name.

Incorrect: `cursor/docs-91-branch-naming`

Incorrect: `claude/feat-user-scoped-rate-limit-keys`

## Enforcement

Format is mandatory for humans and agents. CI or branch-protection enforcement is a deferred follow-up; lack of a check does not make these rules optional.

## Related

- [`docs/agents/commit-messages.md`](commit-messages.md) — commit message SSOT (branch prefixes are a subset of commit types)
- [`docs/contributing.md`](../contributing.md) — human contribution guide (links here)
