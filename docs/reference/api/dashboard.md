# Dashboard API

This document provides information about the dashboard endpoints of the FastAPI RBAC API.

## Endpoints

### GET /api/v1/dashboard

Retrieve the dashboard metrics the caller is allowed to see. Any signed-in user can call it. The caller's permissions decide which fields are filled in, not the role name. A field the caller may not see is `null`, not zero and not a 403.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response (caller holds every permission below, for example an admin):**

```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "stats": {
      "total_users": 100,
      "active_users": 80,
      "locked_users": 2,
      "total_roles": 5,
      "total_role_groups": 3,
      "total_permissions": 29,
      "total_permission_groups": 7
    },
    "role_distribution": [
      { "name": "Admin", "count": 3 },
      { "name": "Manager", "count": 8 },
      { "name": "User", "count": 64 }
    ],
    "recent_sign_ins": [
      {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "signed_in_at": "2026-07-08T12:00:00Z"
      }
    ]
  }
}
```

**Which permission fills which field:**

| Permission              | Fields                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `user.read`             | `stats.total_users`, `stats.active_users`, `stats.locked_users`, `recent_sign_ins` |
| `role.read`             | `stats.total_roles`, `role_distribution`                                           |
| `role_group.read`       | `stats.total_role_groups`                                                          |
| `permission.read`       | `stats.total_permissions`                                                          |
| `permission_group.read` | `stats.total_permission_groups`                                                    |

A superuser is treated as holding all five.

**Response (caller holds none of them):**

```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "stats": {
      "total_users": null,
      "active_users": null,
      "locked_users": null,
      "total_roles": null,
      "total_role_groups": null,
      "total_permissions": null,
      "total_permission_groups": null
    },
    "role_distribution": null,
    "recent_sign_ins": null
  }
}
```

**Notes on the fields:**

- `role_distribution` counts a user once for each role they hold, so a user with several roles appears in each.
- `recent_sign_ins` holds the 10 newest sign-ins, newest first. A sign-in is a successful password login (`successful_login`) or a successful OAuth2 login (`oauth2_successful_login`). `signed_in_at` is a UTC timestamp.
- The earlier `active_sessions`, `recent_logins` (`last_active`) and `system_users_summary` fields no longer exist.

### GET /api/v1/dashboard/stats

Retrieve the same payload as `GET /api/v1/dashboard`. It is no longer admin-only: any signed-in user gets 200, and the permissions above decide which fields are `null`.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

- Same as `GET /api/v1/dashboard`.

## Error Responses

- 403 Forbidden: Missing, invalid or rejected access token.
- 500 Internal Server Error: Unexpected error.

## Notes

- All endpoints require authentication, and no endpoint here requires a specific permission.
- See `backend/app/api/v1/endpoints/dashboard.py` for the permission-to-field mapping.
