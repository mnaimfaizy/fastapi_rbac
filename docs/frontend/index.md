# Frontend

Documentation for the UI layer of FastAPI RBAC.

## Current implementation

The shipped UI is a **React + TypeScript + Vite** app in [`react-frontend/`](https://github.com/mnaimfaizy/fastapi_rbac/tree/main/react-frontend).

| Page | Covers |
| --- | --- |
| [Setup](./react/setup.md) | Install, env files, local dev commands |
| [Architecture](./react/architecture.md) | Project layout and coding patterns |
| [Authentication](./react/auth.md) | Client auth, tokens, RBAC guards |
| [State management](./react/state.md) | Redux Toolkit slices and thunks |
| [UI components](./react/ui.md) | ShadCN / Tailwind |
| [Testing](./react/testing.md) | Vitest and Playwright |
| [Deployment](./react/deployment.md) | Docker, Nginx, production build |
| [Troubleshooting](../troubleshooting/frontend-issues.md) | Common client issues |

Cross-cutting system context: [System Architecture](../reference/architecture.md).

## Future frontend frameworks

This section is structured so additional UIs can be documented beside React without rewriting the nav:

```
docs/frontend/
├── index.md                 # this page
├── react/                   # current SPA (documented)
├── nextjs/                  # reserved — SSR / App Router (not implemented)
└── angular/                 # reserved — alternative client (not implemented)
```

When a second framework ships:

1. Add a subdirectory under `docs/frontend/` (for example `nextjs/`).
2. Mirror the same topic split (setup, architecture, auth, …) where it applies.
3. Register pages under the **Frontend** nav group in `mkdocs.yml`.
4. Keep shared backend contracts in [API Reference](../reference/index.md); do not fork API docs per UI.

Until then, treat **React** as the only supported frontend.
