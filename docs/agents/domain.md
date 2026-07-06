# Domain Docs

How engineering skills should consume domain documentation in this repository.

## Before exploring, read these

- `README.md`
- `DOCUMENTATION.md`
- `docs/index.md`
- `docs/internal/` (if present for architecture and decision notes)

## File structure guidance

- Backend domain and RBAC behavior: `backend/app/`
- Frontend domain and UI behavior: `react-frontend/src/`
- Published docs and references: `docs/`

## Vocabulary rules

- Use RBAC terms consistently: user, role, permission, role group, permission group.
- Prefer existing project terms over introducing synonyms.

## ADR and architecture conflicts

When implementation conflicts with documented architecture or behavior:

1. Call out the conflict explicitly.
2. Propose the smallest viable change.
3. Update docs and references in the same change when possible.
