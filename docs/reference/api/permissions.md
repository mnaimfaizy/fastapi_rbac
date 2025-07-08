# Permissions API

This document provides information about the permission management endpoints of the FastAPI RBAC API.

## Endpoints

### GET /api/v1/permissions

Retrieve a paginated list of permissions. Optionally filter by group ID.

**Query Parameters:**

- `group_id` (UUID, optional): Filter permissions by group
- Pagination params: `page`, `size`, etc.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": [
    { "id": "uuid", "name": "user.create", "description": "Create user permission", ... }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

### GET /api/v1/permissions/{permission_id}

Get a permission by its ID.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "user.create", "description": "Create user permission", ... }
}
```

### POST /api/v1/permissions

Create a new permission. The name will be formatted based on the group.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "name": "delete", // Will be formatted as groupname.delete
  "description": "Delete user permission",
  "group_id": "uuid"
}
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "user.delete", "description": "Delete user permission", ... }
}
```

### DELETE /api/v1/permissions/{permission_id}

Delete a permission by its ID. Fails with 409 if the permission is in use by any roles.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "user.delete", ... },
  "message": "Permission deleted successfully"
}
```

**Error Responses:**

- 409 Conflict: Permission is in use by one or more roles
- 404 Not Found: Permission does not exist

## Error Responses

- 403 Forbidden: Insufficient permissions
- 404 Not Found: Permission not found
- 409 Conflict: Permission is in use by roles
- 500 Internal Server Error: Unexpected error

## Notes

- All endpoints require authentication and appropriate permissions (e.g., `permission.read`, `permission.create`, `permission.delete`).
- See backend code for detailed permission requirements and error handling.
