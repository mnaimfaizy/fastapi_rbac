# Frontend Issues

Common React / Vite / auth client problems and fixes.

Related: [Frontend overview](../frontend/index.md), [React architecture](../frontend/react/architecture.md), [CORS Troubleshooting](./CORS_TROUBLESHOOTING.md), [Common Issues](./common-issues.md).

## CORS errors

Symptoms: browser blocks `localhost:8000` calls from the Vite origin.

- Ensure `BACKEND_CORS_ORIGINS` includes the frontend origin.
- Confirm the API is up and `VITE_API_BASE_URL` is correct.
- Inspect preflight `OPTIONS` in DevTools.

## Token refresh / 401 loops

- Confirm refresh token is present in localStorage and not corrupted.
- Verify Axios 401 interceptor and refresh endpoint behavior.
- Clear storage and log in again if tokens are inconsistent.

## Environment variables

- Vite vars must be prefixed with `VITE_`.
- Restart the dev server after `.env` changes.
- Confirm values are wired in `vite.config.ts` / import.meta.env usage.

## TypeScript drift

- Keep `src/models/` aligned with backend Pydantic schemas.
- Run a production build (`npm run build`) to catch type errors early.

## Redux state surprises

- Ensure the app is wrapped in the Redux `Provider`.
- Check slice initial state and DevTools for unexpected resets (access token is intentionally in-memory only).

## Performance

- Prefer route-level code splitting (`React.lazy`) for heavy features.
- Cancel pending requests on unmount (`AbortController`).
- Avoid oversized objects in Redux.

## Build / Docker / Nginx

- Resolve import paths and peer deps before Docker builds.
- For SPA refresh 404s, configure Nginx fallback to `index.html`.
- Keep API proxy / CORS headers consistent with the backend.

## Tests

- Install Testing Library / Vitest deps matching `package.json`.
- Wrap hook/component tests with a Redux `Provider` and realistic preloaded auth state.
