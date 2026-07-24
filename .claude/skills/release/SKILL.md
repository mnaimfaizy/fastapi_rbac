---
name: release
description: >-
  Prepare a Release PR for FastAPI RBAC: propose SemVer, gather commits since
  the last tag, draft release notes via the release-notes sub-agent, run
  create-release scripts in Release PR mode, and return the PR URL. Use when
  the user asks to cut a release, open a release PR, or ship a version.
disable-model-invocation: true
---

# Release

Orchestrate a **Release PR** (not a direct tag). After merge, CI tags and publishes Docker images.

## Canonical docs

- Commit format: [`docs/agents/commit-messages.md`](../../../docs/agents/commit-messages.md)
- Notes agent behavior: [`docs/agents/release-notes-agent.md`](../../../docs/agents/release-notes-agent.md)
- Harness wrapper (Cursor): [`.cursor/agents/release-notes.md`](../../../.cursor/agents/release-notes.md)
- Scripts: `scripts/deployment/release/Create-Release.ps1` / `create-release.sh`

## Preconditions

- Clean working tree; start from up-to-date `main` (scripts enforce this with `-Yes` / `--yes`).
- `gh` CLI authenticated.
- Do **not** use `-DirectTag` / `--direct-tag` unless the user explicitly demands the emergency path.

## Workflow

Copy and track:

```text
Release progress:
- [ ] 1. Sync main / confirm clean tree
- [ ] 2. Propose version; wait for user confirm or override
- [ ] 3. Gather commits since previous tag
- [ ] 4. Draft notes via release-notes sub-agent
- [ ] 5. Write notes to a temp file
- [ ] 6. Run create-release (Release PR mode, non-interactive)
- [ ] 7. Return only the PR URL (+ one-line next steps)
```

### 1. Sync

```powershell
git checkout main
git pull origin main
git status
```

### 2. Propose version

- Read `VERSION` and latest tag: `git tag -l --sort=-v:refname` / `git describe --tags --abbrev=0`
- Inspect commits since last tag for SemVer hints (`feat` → minor, `fix` → patch, breaking → major; prerelease suffixes if current line is beta/rc)
- **Propose** `vX.Y.Z` (or prerelease) and **wait** for the user to confirm or override
- Never invent a version and proceed without confirmation

### 3. Gather commits

```powershell
git log <previous_tag>..HEAD --pretty=format:"%s%n%b%n---"
```

If no previous tag, use full history (same as scripts).

### 4. Draft notes (sub-agent — mandatory)

Do **not** draft the release-notes section yourself.

1. Read [`.cursor/agents/release-notes.md`](../../../.cursor/agents/release-notes.md) (or `.claude/agents/release-notes.md` in Claude).
2. Launch a **Task / sub-agent** with:
   - Version (confirmed)
   - Previous tag
   - Commit list from step 3
   - Today’s date (`YYYY-MM-DD`)
   - Instruction: follow [`docs/agents/release-notes-agent.md`](../../../docs/agents/release-notes-agent.md) exactly; return **only** the markdown section
3. Prefer the model noted in the harness wrapper’s `MODEL:` field when the UI allows choosing a model.

### 5. Temp notes file

Write the sub-agent output to a temp path, e.g. `$env:TEMP/release-notes-<version>.md` (must be the full `### v…` section).

### 6. Create Release PR

**PowerShell (Windows):**

```powershell
cd scripts/deployment/release
.\Create-Release.ps1 -Version vX.Y.Z -NotesFile $notesPath -Yes
```

**Bash:**

```bash
./scripts/deployment/release/create-release.sh -v vX.Y.Z --notes-file "$notesPath" --yes
```

Optional dry-run first: add `-DryRun` / `--dry-run` (still writes `changelog.txt`; does not mutate VERSION/notes/remotes).

### 7. Finish

- Print the **PR URL** from the script output (primary deliverable).
- One-line reminder: after merge, `release-tag-on-merge` creates the tag + GitHub Release and dispatches `docker-publish` (manual `v*` tag push or Actions → Run workflow still work).
- Do not merge the PR unless the user asks.
- Do not push tags yourself.

## Out of scope

- Production deploy
- Editing `*.dockerhub.md`
- `-DirectTag` unless explicitly requested
- Rewriting historical commits
