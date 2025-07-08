# Role Groups API

This document provides information about the role group management endpoints of the FastAPI RBAC API.

## Role Group Endpoints

### GET /api/v1/role-groups
Retrieve a list of role groups.

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
      "name": "core-admins",
      "description": "Core admin group"
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

### POST /api/v1/role-groups
Create a new role group.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "managers",
  "description": "Managers group"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "managers",
    "description": "Managers group"
  }
}
```

### PATCH /api/v1/role-groups/{role_group_id}
Update a role group.

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

### DELETE /api/v1/role-groups/{role_group_id}
Delete a role group.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Role group deleted successfully"
}
```
