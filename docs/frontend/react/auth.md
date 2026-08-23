# React authentication

Client-side authentication and authorization for the React SPA.

Related: [System Architecture — Authentication flow](../../reference/architecture.md#authentication-flow), [Auth API](../../reference/api/auth.md), [Security Features](../../reference/SECURITY_FEATURES.md).

## Flow (client)

1. **Login** — form posts credentials to `POST /api/v1/auth/login` (with CSRF).
2. **Token storage**
   - Access token → Redux / memory only (not `localStorage`)
   - Refresh token → HttpOnly cookie set by the backend (not readable by JS)
   - Session restore hint → non-secret `localStorage` flag so a reload, a new tab, or a browser restart can attempt cookie refresh
3. **Authenticated requests** — Axios client attaches `Authorization: Bearer <access_token>` and sends cookies (`withCredentials: true`).
4. **Refresh** — on HTTP 401 (when a session hint exists), interceptor calls `POST /auth/new_access_token` with CSRF; cookie is sent automatically; retries the original request or logs out. A 401 from the refresh endpoint itself is excluded from this path so it cannot recurse.
5. **Logout** — calls backend logout (allowlist cleared + cookie cleared server-side) and clears client memory/hint.

Backend session invalidation uses a Redis **allowlist** (`app/utils/token.py`), not a JWT `jti` blacklist. See [ADR 0001](../../adr/0001-pyjwt-sole-jwt-library.md) and [ADR 0006](../../adr/0006-httponly-refresh-token-cookies.md).

## CSRF

State-changing auth calls (login, refresh, logout, password change, etc.) require CSRF. Obtain/attach tokens via the auth/CSRF service layer; see [Security Features](../../reference/SECURITY_FEATURES.md) and `react-frontend` CSRF-related services/tests.

## Route and UI guards

- **Route level** — `ProtectedRoute` (and layout wrappers) require authentication and optionally roles/permissions.
- **Component level** — `usePermissions` / `useAuth` gate buttons and panels (`user.create`, `role.read`, …).

Keep permission **names** aligned with backend permission records.

## Security checklist (frontend)

- Do not persist access or refresh tokens in `localStorage`.
- Rely on backend logout to clear the HttpOnly refresh cookie; clear the session hint on logout / failed refresh.
- Prefer sanitized user input before display; rely on backend validation as the source of truth.
- Treat CORS misconfiguration as an ops issue — see [CORS troubleshooting](../../troubleshooting/CORS_TROUBLESHOOTING.md).

## Where the code lives

| Concern | Typical location |
| --- | --- |
| Login / signup / password reset UI | `src/features/auth/` |
| Auth Redux slice | `src/store/slices/authSlice.ts` |
| Axios + interceptors | `src/services/api.ts`, `authTokenManager.ts` |
| Hooks | `src/hooks/useAuth.ts`, `usePermissions.ts` |
| Route guards | `src/components/auth/` / `src/components/layout/` |
