# Commit Messages (canonical)

**This file is the single source of truth for commit message format in this repository.**

Agents and humans must follow these rules strictly. Do not invent alternate formats from other harness files, user preferences, or prior habit. Harness files (Cursor rules, Copilot prompts, Claude skills, pre-commit instructions) link here; they must not redefine divergent rules.

Release history is written to [`docs/release-notes.md`](../release-notes.md). Commit types below map to those sections so a release-notes agent can categorize commits reliably. Changelog tooling notes live in [`.changelogrc.md`](../../.changelogrc.md).

## Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

- Imperative mood: "add", "fix", "update" — not "added", "fixed", "updated"
- Subject ~50–72 characters; no trailing period
- Body explains what and why when the change is non-obvious
- One logical change per commit when practical

## Emoji policy

**Forbidden.** Do not put emoji in the commit subject or as a prefix.

Correct: `feat(auth): add two-factor authentication`

Incorrect: `✨ feat(auth): add two-factor authentication`

## Types

| Type | Use for | In release notes? | Release-notes section |
| --- | --- | --- | --- |
| `feat` | New user-facing or API capability | Yes | New Features |
| `fix` | Bug fix | Yes | Bug Fixes |
| `perf` | Performance improvement | Yes | Performance |
| `security` | Security fix or hardening | Yes | Security |
| `docs` | Documentation only | Often | Documentation |
| `refactor` | Internal restructuring, no behavior change | Sometimes | Code Improvements / Technical Details |
| `test` | Tests only | Rarely | Testing / Technical Details |
| `build` | Build system, packaging, dependencies tooling | Rarely | Build System / Technical Details |
| `ci` | CI/CD workflows and config | Rarely | CI/CD / Technical Details |
| `chore` | Maintenance that does not fit above | Rarely | Maintenance / omit if internal-only |
| `style` | Formatting, whitespace, lint-only (no logic) | No | — (omit from user-facing notes) |
| `revert` | Revert a previous commit | Yes if user-facing | Match the reverted change’s section |

Breaking changes always surface under **Breaking Changes** in release notes regardless of type (see below).

## Scopes (component / domain)

Use a **component or domain** scope, not a top-level directory name (`backend`, `react-frontend`). Prefer the lists below; omit scope only when the change is truly repo-wide and no component fits.

### Backend

- `api` — API endpoints and routes
- `auth` — Authentication and authorization
- `db` — Database models and migrations
- `crud` — CRUD operations
- `deps` — Dependency injection / deps layer
- `config` — Configuration
- `worker` — Celery worker tasks
- `email` — Email functionality
- `security` — Security features

### Frontend

- `ui` — User interface components
- `auth` — Authentication flows
- `api` — API service calls
- `state` — Redux / client state
- `types` — TypeScript types
- `routing` — React Router
- `forms` — Form components
- `components` — Shared reusable components

### Infrastructure

- `docker` — Docker configuration
- `ci` — CI/CD workflows
- `deploy` — Deployment scripts
- `docs` — Documentation site / agent docs
- `release` — Release process

## Breaking changes

Indicate with either:

- `!` after the type or scope: `feat!:` or `feat(api)!:`
- and/or a footer line starting with `BREAKING CHANGE:`

These map to the **Breaking Changes** section in `docs/release-notes.md` and imply a major SemVer bump.

## Issue footers

When a commit resolves an issue:

```
Fixes #123
```

or

```
Closes #456
```

## Examples

```
feat(auth): add two-factor authentication support

Implemented TOTP-based 2FA for enhanced security.
Users can now enable 2FA in their profile settings.

Closes #123
```

```
fix(api): resolve rate limiting bypass vulnerability

Fixed issue where rate limiting could be bypassed
by using different case variations of email addresses.

Fixes #456
```

```
feat(api)!: redesign authentication API endpoints

BREAKING CHANGE: Authentication endpoints have been restructured.
- Renamed /auth/login to /auth/token
- Changed response format for /auth/user endpoint
- Removed deprecated /auth/legacy endpoint

Migration guide: docs/migration-v2.md
```

```
docs(release): clarify release-notes SSOT and Hub README sources
```

## Mapping commits → release notes

For drafting [`docs/release-notes.md`](../release-notes.md) from commits since the last tag:

1. Parse conventional commits (`type`, optional `scope`, subject, breaking markers).
2. Place each commit in the section from the Types table above.
3. Promote any commit with `!` or `BREAKING CHANGE:` into **Breaking Changes**.
4. Rewrite subjects into user-facing bullets; drop pure `chore` / `style` / internal-only items unless they matter to operators.
5. Ephemeral `changelog.txt` from `git log` is a draft only — never a committed SSOT. There is no root `CHANGELOG.md`.

SemVer bump hints (see also `.changelogrc.md`): patch for `fix`/`perf`/`docs`; minor for non-breaking `feat`; major for breaking changes.

## Enforcement

Format is mandatory for humans and agents. A commit-msg / commitlint hook is a deferred follow-up; lack of a hook does not make these rules optional.

## Related

- [`.changelogrc.md`](../../.changelogrc.md) — changelog section mapping, SemVer bump rules, tooling notes
- [`docs/release-notes.md`](../release-notes.md) — committed release history (SSOT)
- [`docs/agents/release-notes-agent.md`](release-notes-agent.md) — how to draft a release-notes section from commits
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
