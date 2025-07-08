# Permissions API

This document provides information about the permission management endpoints of the FastAPI RBAC API.

## Permission Endpoints

### GET /api/v1/permissions
Retrieve a list of permissions.

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
      "name": "user.create",
      "description": "Create user permission"
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

### POST /api/v1/permissions
Create a new permission.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "user.delete",
  "description": "Delete user permission"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "user.delete",
    "description": "Delete user permission"
  }
}
```

### PATCH /api/v1/permissions/{permission_id}
Update a permission.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "user.update",
  "description": "Update user permission"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "user.update",
    "description": "Update user permission"
  }
}
```

### DELETE /api/v1/permissions/{permission_id}
Delete a permission.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Permission deleted successfully"
}
```
