# API Reference

This section provides detailed documentation for the FastAPI RBAC project's API.

---

## API Versioning

- **Base URL:** `/api/v1/`
- All endpoints documented here are under the `/api/v1/` namespace.
- Versioning allows for future changes without breaking existing clients.

---

## Authentication

- Most endpoints require authentication via a Bearer token (JWT).
- Obtain tokens using the [Authentication API](./api/auth.md).
- Include the token in the `Authorization` header:
  `Authorization: Bearer <access_token>`
- Some endpoints (registration, password reset, email verification) are public.
- State-changing operations require a CSRF token (see [Authentication API](./api/auth.md#csrf)).

---

## Error Handling

- All error responses use standard HTTP status codes and a JSON error format.
- Common error codes: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Unprocessable Entity), 429 (Too Many Requests), 500 (Internal Server Error).
- See each endpoint's documentation for specific error cases and examples.

---

## API Endpoints

- **[Authentication API](./api/auth.md):** Endpoints for user login, logout, registration, password reset, email verification, token management, and CSRF.
- **[Users API](./api/users.md):** Endpoints for user management (list, create, update, delete, self-profile, bulk update, assign roles).
- **[Roles API](./api/roles.md):** Endpoints for role management (list, create, update, delete, assign/remove permissions).
- **[Role Groups API](./api/role_groups.md):** Endpoints for managing hierarchical role groups and bulk operations.
- **[Permissions API](./api/permissions.md):** Endpoints for permission management (list, create, update, delete, group-based filtering).
- **[Permission Groups API](./api/permission_groups.md):** Endpoints for managing permission groups and their hierarchy.
- **[Dashboard API](./api/dashboard.md):** Endpoints for analytics, reporting, and system overview.

---

## General Usage Notes

- All requests and responses use JSON.
- Use the provided request/response examples in each endpoint doc as a guide.
- Pagination is supported on most list endpoints via `page` and `size` query parameters.
- Filtering and search options are available on many endpoints (see docs for details).
- All endpoints are protected by role-based access control (RBAC); required roles/permissions are listed per endpoint.
- For full details on authentication, permissions, and error handling, see the [Authentication API](./api/auth.md) and [Users API](./api/users.md).

---

## Quick Start

1. **Register or obtain an account** (see [Authentication API](./api/auth.md#register)).
2. **Log in** to receive your access and refresh tokens.
3. **Use your access token** in the `Authorization` header for all protected endpoints.
4. **Explore user, role, and permission management** using the endpoints above.
5. **Check the Dashboard API** for analytics and system health.

---

For further details, see each API reference page linked above, or consult the backend code for advanced usage and customization.
