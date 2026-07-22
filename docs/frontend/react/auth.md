# React authentication

Client-side authentication and authorization for the React SPA.

Related: [System Architecture — Authentication flow](../../reference/architecture.md#authentication-flow), [Auth API](../../reference/api/auth.md), [Security Features](../../reference/SECURITY_FEATURES.md).

## Flow (client)

1. **Login** — form posts credentials to `POST /api/v1/auth/login`.
2. **Token storage**
   - Access token → Redux memory (not `localStorage`)
   - Refresh token → `localStorage` (key from `VITE_REFRESH_TOKEN_NAME`)
3. **Authenticated requests** — Axios client attaches `Authorization: Bearer <access_token>`.
4. **Refresh** — on HTTP 401, interceptor calls the refresh endpoint; retries the original request or logs out.
5. **Logout** — calls backend logout (allowlist cleared server-side) and clears client tokens.

Backend session invalidation uses a Redis **allowlist** (`app/utils/token.py`), not a JWT `jti` blacklist. See [ADR 0001](../../adr/0001-pyjwt-sole-jwt-library.md).

## CSRF

State-changing calls expect CSRF protection as implemented with the backend. Obtain/attach tokens via the auth/CSRF service layer; see [Security Features](../../reference/SECURITY_FEATURES.md) and `react-frontend` CSRF-related services/tests.

## Route and UI guards

- **Route level** — `ProtectedRoute` (and layout wrappers) require authentication and optionally roles/permissions.
- **Component level** — `usePermissions` / `useAuth` gate buttons and panels (`user.create`, `role.read`, …).

Keep permission **names** aligned with backend permission records.

## Security checklist (frontend)

- Do not persist access tokens in `localStorage`.
- Clear refresh tokens on logout and failed refresh.
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
