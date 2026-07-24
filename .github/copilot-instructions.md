# FastAPI RBAC Project Guide for AI Assistants

Short harness instructions for GitHub Copilot and other AI assistants. **Architecture narrative lives in the docs site** — do not re-embed long System Architecture / directory-tree / auth-flow manuals here (see issue #72).

This project is a user-management microservice: FastAPI backend + React/TypeScript frontend implementing RBAC authentication and authorization.

## Canonical documentation (read first)

| Topic | Canonical path |
| --- | --- |
| System architecture, directory layout, domain model, Redis allowlist auth flow | [`docs/reference/architecture.md`](../docs/reference/architecture.md) |
| Product / tech-stack overview | [`docs/getting-started/PROJECT_OVERVIEW.md`](../docs/getting-started/PROJECT_OVERVIEW.md) |
| Frontend patterns | [`docs/frontend/react/architecture.md`](../docs/frontend/react/architecture.md) (section: [`docs/frontend/`](../docs/frontend/index.md)) |
| Auth API contracts | [`docs/reference/api/auth.md`](../docs/reference/api/auth.md) |
| Security features | [`docs/reference/SECURITY_FEATURES.md`](../docs/reference/SECURITY_FEATURES.md) |
| Domain vocabulary / ADR conflicts | [`docs/agents/domain.md`](../docs/agents/domain.md) |
| JWT / allowlist ADR | [`docs/adr/0001-pyjwt-sole-jwt-library.md`](../docs/adr/0001-pyjwt-sole-jwt-library.md) |
| Testing | [`docs/development/TESTING.md`](../docs/development/TESTING.md), [`docs/frontend/react/testing.md`](../docs/frontend/react/testing.md), [`backend/test/README.md`](../backend/test/README.md) |
| Frontend troubleshooting | [`docs/troubleshooting/frontend-issues.md`](../docs/troubleshooting/frontend-issues.md) |
| Knowledge graph | [`docs/agents/graphify.md`](../docs/agents/graphify.md) |
| Commit messages (mandatory SSOT) | [`docs/agents/commit-messages.md`](../docs/agents/commit-messages.md) |
| Release notes agent (canonical) | [`docs/agents/release-notes-agent.md`](../docs/agents/release-notes-agent.md) |
| Release skill (Release PR) | [`.claude/skills/release/SKILL.md`](../.claude/skills/release/SKILL.md) |

If `graphify-out/graph.json` exists, prefer `graphify query` / `path` / `explain` for “how does X connect to Y” questions.

**Commit messages are mandatory:** follow [`docs/agents/commit-messages.md`](../docs/agents/commit-messages.md) strictly (plain conventional commits, no emoji, component/domain scopes). Do not invent alternate formats.

## Coding constraints

### Backend placement

- Models → `backend/app/models/`
- CRUD → `backend/app/crud/`
- Endpoints → `backend/app/api/v1/endpoints/`
- Schemas → `backend/app/schemas/`
- Session invalidation → Redis **allowlist** helpers in `backend/app/utils/token.py` (not a jti blacklist)

### SQLModel async idioms and tests

- Async DB queries must use SQLModel `.exec()` with `AsyncSession` (not `.execute()` for SQLModel queries):

  ```python
  result = await db.exec(select(User).where(User.email == email))
  users = result.all()
  ```

- Integration tests should prefer API-driven flows for user actions.
- Use existing fixtures and factories for test data and boundary mocks.
- Details: `backend/test/README.md`.

### Frontend placement

- Features → `react-frontend/src/features/`
- Shared UI → `react-frontend/src/components/`
- Keep Pydantic schemas and TypeScript interfaces aligned.
- Patterns: [`docs/frontend/react/architecture.md`](../docs/frontend/react/architecture.md)

### When making changes

1. Follow existing layering (models / crud / endpoints / features).
2. Update backend schemas and frontend types together.
3. Add tests near the affected seam (`backend/test/…`, frontend component tests).
4. Document protected-endpoint role requirements and non-obvious behavior.
5. Validate input, apply RBAC checks, avoid leaking sensitive details in errors.
6. Use the standard API response shape and appropriate HTTP status codes.
7. Match project style (Black/isort/flake8/mypy backend; Prettier/ESLint frontend).

## Workflow rules

### Backend test runner

Use `backend/test_runner.py` only:

```bash
python backend/test_runner.py all
python backend/test_runner.py unit
python backend/test_runner.py integration
python backend/test_runner.py specific --path backend/test/unit/test_crud_user.py
```

See `python backend/test_runner.py --help` and `backend/test/README.md`.

### Linting, formatting, type checking

After code changes, run tools in the **affected** package directory.

**Backend** (`backend/`):

```bash
mypy . --exclude alembic
black .
isort .
flake8 .
```

**Frontend** (`react-frontend/`):

```bash
npx prettier --write .
npx eslint . --fix
```

Do not treat a change as complete until these pass.

### Dependency and environment management

- Prefer versions already pinned in `backend/requirements.txt` / `react-frontend/package.json`.
- For local backend tests, load `.env.test.local` (if present) via `python-dotenv` before running scripts that need env vars.
- Activate the correct Python venv before backend commands.
- Document new env vars in the appropriate `.env*.example` files.

### Agent command execution

- Check the current working directory before running shell commands.
- Only `cd` when not already in the target directory.
- Prefer `cd <dir> && <cmd>` (bash) or `cd <dir>; <cmd>` (PowerShell) when a directory change is required.
