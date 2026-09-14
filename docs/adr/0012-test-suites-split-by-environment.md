# ADR 0012: Test suites are split by environment, not by transport

## Status

Accepted

## Context

`backend/test/README.md` defined two test categories by shape. Unit tests were "isolated from external dependencies", used "mocks for database and external services", and were budgeted at "< 1 second per test". Integration tests were the ones that exercised "complete workflows and API endpoints".

The repository did not follow that. Nine files under `test/unit/` drove HTTP endpoints through `AsyncClient`, and each was added deliberately, several carrying a docstring apologising for its location. `test_token_flow_enumeration.py` said they lived there "deliberately", and `test_session_revocation.py` (#206) repeated the argument rather than referring to it. A ninth file appeared after issue [#212](https://github.com/mnaimfaizy/fastapi_rbac/issues/212) was filed to describe the problem, so the pattern was still accruing while being documented as an exception.

The original reason was that `test/unit/` was the only directory CI gated. Issue [#190](https://github.com/mnaimfaizy/fastapi_rbac/issues/190) has since closed and `backend-ci.yml` now runs a real `integration-test` job on every push and pull request, so that reason has expired. The misfiling outlasted its cause.

The obvious remedy — move the nine files to `test/integration/` — does not work, for a reason that is invisible from the test files themselves. In `docker-compose.test.minimal.yml` the application container and the test runner hold **different databases**:

```
fastapi_rbac_test        -> .../fastapi_rbac_test
fastapi_rbac_test_runner -> .../fastapi_rbac_test_runner
```

A stack test seeds through `user_factory` in the runner's database and calls endpoints served by the application container, which reads its own. The fixture is not visible to the code under test. This is not hypothetical: [#214](https://github.com/mnaimfaizy/fastapi_rbac/issues/214) records seven stack tests quarantined for asserting on in-process state, which is the same collision.

That fact identifies what the nine files actually have in common with the rest of `test/unit/`, and it is not their transport. They run **in-process** — `fixtures_app.py` selects an ASGI transport when the Docker stack is not active, and `fixtures_db.py` falls back to in-memory SQLite when `DATABASE_URL` is unset, which is the case in CI's `test` job. They need no external services. A stack test needs Postgres, Redis, a live server and a second database. That is the real line.

Of the 41 files then in `test/unit/`, 32 were genuine unit tests — mocked, fast, matching the README's stated budget — and 9 booted the application. Redefining "unit" to cover both would have made the README true at the cost of making a standard word mean something local, leaving the rule enforceable only by people who had read this ADR.

## Decision

1. **Test suites are separated by the environment a test requires, not by whether it speaks HTTP.** Transport is an implementation detail of a test; the environment is a property of what CI must provide to run it.

2. **Three directories, with these definitions.**
   - `test/unit/` — no application boot, no database. Mocks for external and internal collaborators. The "< 1 second per test" budget applies here and only here.
   - `test/api/` — in-process. Boots the app through an ASGI transport and may use the SQLite-backed session fixtures. No external services.
   - `test/integration/` — requires the Docker stack: Postgres, Redis, and a live server reached over HTTP.

3. **`test/unit/` and `test/api/` are gated by the same CI job.** `backend-ci.yml` runs `pytest test/unit/ test/api/`. The split communicates what a reader should expect from a directory; it is not a reason to run them separately, and a directory that only one of CI or `test_runner.py` runs is a directory whose failures reach nobody.

4. **Stack tests must not create database rows directly.** They seed through the API. This is not a style preference: the runner and the application container hold different databases, so a directly-inserted row is invisible to the code under test. The rule existed already at `test/README.md:16` without its reason, which is why it read as arbitrary and was overridden nine times.

5. **A test's location is justified by this ADR, not by its own docstring.** The per-file explanations are removed and replaced with a pointer here.

## Consequences

The README can be applied literally to a new test, which was the failure that opened #212: a contributor asking "where does this go?" now answers it from the environment the test needs, and the directory names carry that rule without requiring anyone to read this document.

The `test` job's wall-clock does not improve. The nine files cost what they always cost; they are now in a directory that says so, rather than diluting the "< 1 second per test" budget of the 32 files beside them. Making them faster is a separate question this ADR does not answer.

A fourth category becomes plausible later — in-process tests against real Postgres, for behaviour SQLite cannot model. It would sit between `api/` and `integration/` under the same rule, and would need its own CI wiring.

`test/api/` is a new directory in a repository where `test/unit/` has no `__init__.py` and `test/integration/` does. `pyproject.toml` sets pytest's `importlib` import mode, so neither is required for collection.

## Alternatives considered

**Move the nine files to `test/integration/`.** Rejected: they would break on the database split described above, joining the seven already quarantined under #214.

**Two categories, redefining `unit/` as "in-process".** Rejected: it fixes the documentation by changing what a standard word means. A contributor who has not read this ADR reads `test/unit/`, applies the ordinary definition, and misfiles exactly as before. It also dilutes the one directory with a meaningful speed budget.

**Document the exception and move nothing.** Rejected: it records an exception rather than a rule, so the tenth API-driven file re-opens the same argument. The ninth arriving mid-triage is evidence that it would.

## References

- Issue [#212](https://github.com/mnaimfaizy/fastapi_rbac/issues/212) — API-driven tests accumulate in `test/unit/` because it is the only gated directory
- Issue [#190](https://github.com/mnaimfaizy/fastapi_rbac/issues/190) — integration suite gated in CI, which expired the original reason
- Issue [#214](https://github.com/mnaimfaizy/fastapi_rbac/issues/214) — stack tests asserting on in-process state
- `backend/test/README.md` — the categories as applied
