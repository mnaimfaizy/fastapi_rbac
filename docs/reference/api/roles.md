# Roles API

This document provides information about the role management endpoints of the FastAPI RBAC API.

## Role Endpoints

### GET /api/v1/roles
Retrieve a list of roles.

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
      "name": "admin",
      "description": "Administrator role"
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

### POST /api/v1/roles
Create a new role.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "manager",
  "description": "Manager role"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "manager",
    "description": "Manager role"
  }
}
```

### PATCH /api/v1/roles/{role_id}
Update a role.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "updated_name",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "updated_name",
    "description": "Updated description"
  }
}
```

### DELETE /api/v1/roles/{role_id}
Delete a role.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Role deleted successfully"
}
```
