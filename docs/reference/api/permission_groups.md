# Permission Groups API

This document provides information about the permission group management endpoints of the FastAPI RBAC API.

## Endpoints

### GET /api/v1/permission-groups

Retrieve a paginated list of permission groups.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

- Pagination params: `page`, `size`, etc.

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "user-management",
      "description": "Permissions for managing users",
      "created_at": "...",
      "updated_at": "...",
      "created_by_id": "uuid",
      "permissions": [ ... ],
      "groups": [ ... ]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

### GET /api/v1/permission-groups/{group_id}

Get a permission group by its ID, with permissions and child groups.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "name": "user-management",
    "description": "Permissions for managing users",
    "created_at": "...",
    "updated_at": "...",
    "created_by_id": "uuid",
    "permissions": [ ... ],
    "groups": [ ... ]
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
  "description": "Permissions held by administrators"
}
```

`description` is optional on both kinds of write: at most 255 characters, trimmed, and a blank string or `null` means the group has none.

**Response:**

```json
{
  "data": { "id": "uuid", "name": "admin-permissions", "description": "Permissions held by administrators", ... }
}
```

### PUT /api/v1/permission-groups/{group_id}

Update a permission group by its ID.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "name": "updated_group",
  "description": "What the group is for"
}
```

`description` is optional on both kinds of write: at most 255 characters, trimmed, and a blank string or `null` means the group has none. Leaving it out keeps the saved description.

**Response:**

```json
{
  "data": { "id": "uuid", "name": "updated_group", "description": "What the group is for", ... }
}
```

### DELETE /api/v1/permission-groups/{group_id}

Delete a permission group by its ID. Fails with 409 if the group has child groups or permissions.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**
204 No Content

**Error Responses:**

- 409 Conflict: Group has child groups or permissions
- 404 Not Found: Group does not exist

## Error Responses

- 403 Forbidden: Insufficient permissions
- 404 Not Found: Group not found
- 409 Conflict: Group has child groups or permissions
- 500 Internal Server Error: Unexpected error

## Notes

- All endpoints require authentication and appropriate permissions (e.g., `permission_group.read`, `permission_group.create`, `permission_group.update`, `permission_group.delete`).
- See backend code for detailed permission requirements and error handling.
