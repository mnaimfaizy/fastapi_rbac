# ADR 0006: HttpOnly cookies for refresh tokens

## Status

Accepted

## Context

Refresh tokens were persisted in the SPA `localStorage` (`tokenStorage.ts`), which makes them readable to any XSS on the origin and enables full session takeover. The frontend already uses `withCredentials` and CSRF (`fastapi-csrf-protect`) for cookie-based CSRF defense. Issue [#66](https://github.com/mnaimfaizy/fastapi_rbac/issues/66) requires migrating refresh delivery/storage to HttpOnly cookies while keeping access tokens in memory only.

## Decision

1. **Refresh token delivery:** Backend sets an HttpOnly cookie on login / change-password; clears it on logout. Cookie name defaults to `refresh_token` (`REFRESH_TOKEN_COOKIE_NAME`).
2. **Cookie flags:**
   - `HttpOnly=true` always
   - `Secure` defaults to true when `MODE=production`, otherwise false (localhost HTTP). Override with `REFRESH_COOKIE_SECURE`.
   - `SameSite=Lax` by default (`REFRESH_COOKIE_SAMESITE`); use `none` only with Secure for true cross-site API hosts.
   - `Path` scoped to `{API_V1_STR}/auth` so the cookie is only sent to auth routes.
   - Optional `REFRESH_COOKIE_DOMAIN` for shared parent domains (e.g. `.example.com`).
3. **Access token:** Remains in JSON responses and SPA memory (Redux + module variable). Never written to `localStorage`.
4. **CSRF:** Required on cookie-authenticated state-changing auth routes: login (existing), `new_access_token`, `logout`, and `change_password` (existing).
5. **Redis allowlist:** Unchanged. Refresh JWTs are still added to `user:{id}:refresh` and cleared on logout. **No refresh rotation** in this change — `/new_access_token` reuses the existing refresh cookie/JWT and does not re-set the cookie (rotation remains a follow-up).
6. **Client model:** First-party SPA is **cookie-primary**. Optional JSON body `refresh_token` on `/auth/new_access_token` is retained as a documented fallback for non-browser API clients; the SPA does not send it.
7. **Session restore:** SPA stores a non-secret `localStorage` hint (`auth_session_active`) after successful login/refresh so it can attempt cookie refresh without probing on every anonymous visit. `localStorage` (not `sessionStorage`) because the hint must outlive the tab — the refresh cookie is valid for `REFRESH_TOKEN_EXPIRE_MINUTES`, so a new tab or browser restart must still be able to restore. The hint is not a credential; possessing it grants nothing without the HttpOnly cookie. Legacy `localStorage` refresh keys are cleared on logout/migrate.
8. **Refresh-endpoint 401s:** `/auth/new_access_token` answers 401 for a missing or expired refresh cookie. The SPA's 401 interceptor excludes that endpoint from its refresh-and-retry path, so a stale hint with no cookie fails once and logs out instead of recursing.

## CORS / deploy notes

- `allow_credentials=True` is already enabled. Browsers reject `Access-Control-Allow-Origin: *` with credentials — set `BACKEND_CORS_ORIGINS` to the exact frontend origin(s).
- Frontend and API on different sites need either a shared cookie domain + appropriate SameSite, or SameSite=None; Secure.

## Consequences

- XSS can no longer read refresh tokens via `document.cookie` / `localStorage`.
- Cross-origin and mobile non-browser clients must use the documented body fallback or a future dedicated API auth path.
- Existing sessions with only `localStorage` refresh tokens require re-login after deploy.
- Docs that described localStorage refresh (and undocumented rotation) must be updated to match this ADR.
