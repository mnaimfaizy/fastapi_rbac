# Dashboard API

This document provides information about the dashboard endpoints of the FastAPI RBAC API.

## Dashboard Endpoints

### GET /api/v1/dashboard/overview
Retrieve system overview metrics for the dashboard.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": {
    "user_count": 100,
    "active_users": 80,
    "role_count": 5,
    "permission_count": 20
  }
}
```

### GET /api/v1/dashboard/activity
Retrieve recent activity logs for the dashboard.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "timestamp": "2025-07-08T12:00:00Z",
      "actor": "admin@example.com",
      "action": "user.created",
      "resource": "user",
      "resource_id": "uuid-string"
    }
  ]
}
```
