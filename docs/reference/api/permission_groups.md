# Permission Groups API

This document provides information about the permission group management endpoints of the FastAPI RBAC API.

## Permission Group Endpoints

### GET /api/v1/permission-groups
Retrieve a list of permission groups.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-string",
      "name": "user-management",
      "description": "User management permissions"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/permission-groups
Create a new permission group.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "admin-permissions",
  "description": "Admin permissions group"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "admin-permissions",
    "description": "Admin permissions group"
  }
}
```

### PATCH /api/v1/permission-groups/{permission_group_id}
Update a permission group.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "updated_group",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "updated_group",
    "description": "Updated description"
  }
}
```

### DELETE /api/v1/permission-groups/{permission_group_id}
Delete a permission group.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Permission group deleted successfully"
}
```
