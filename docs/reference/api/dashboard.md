# Dashboard API

This document provides information about the dashboard endpoints of the FastAPI RBAC API.

## Endpoints

### GET /api/v1/dashboard

Retrieve dashboard data (stats, recent logins, system user summary). Data returned varies by user role.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response (admin):**

```json
{
  "data": {
    "stats": {
      "total_users": 100,
      "active_users": 80,
      "total_roles": 5,
      "total_permissions": 20,
      "active_sessions": 10
    },
    "recent_logins": [
      {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "last_active": "2025-07-08 12:00:00"
      }
    ],
    "system_users_summary": [
      {
        "id": "uuid",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "role": "admin",
        "status": "active",
        "last_active": "2025-07-08 11:00:00"
      }
    ]
  }
}
```

**Response (non-admin):**

```json
{
  "data": {
    "stats": {
      "total_users": 100
    },
    "recent_logins": null,
    "system_users_summary": null
  }
}
```

### GET /api/v1/dashboard/stats

Retrieve dashboard stats (alias for /dashboard). Admins only.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

- Same as above for admin users.
- 403 Forbidden for non-admin users.

## Error Responses

- 403 Forbidden: Insufficient permissions (for /dashboard/stats)
- 500 Internal Server Error: Unexpected error

## Notes

- All endpoints require authentication.
- Admins see full stats, recent logins, and user summaries. Non-admins see limited stats only.
- See backend code for detailed permission requirements and error handling.
