# Roles API

This document provides information about the role management endpoints of the FastAPI RBAC API.

## Endpoints

### GET /api/v1/roles

Retrieve a paginated list of roles. Supports optional filtering by name pattern (use \* as wildcard).

**Query Parameters:**

- `name_pattern` (string, optional): Filter roles by name pattern (e.g., "admin*" or "*manager\*")
- Pagination params: `page`, `size`, etc.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": [
    { "id": "uuid", "name": "admin", "description": "Administrator role", ... }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

### GET /api/v1/roles/list

Retrieve a list of all roles (no pagination).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": [
    { "id": "uuid", "name": "admin", "description": "Administrator role", ... }
  ]
}
```

### GET /api/v1/roles/{role_id}

Get a role by its ID.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "admin", "description": "Administrator role", ... }
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
  "description": "Manager role",
  "role_group_id": "uuid-optional"
}
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "manager", "description": "Manager role", ... }
}
```

### PUT /api/v1/roles/{role_id}

Update a role by its ID.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "name": "updated_name",
  "description": "Updated description",
  "role_group_id": "uuid-optional",
  "permission_ids": ["uuid1", "uuid2"]
}
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "updated_name", "description": "Updated description", ... }
}
```

### DELETE /api/v1/roles/{role_id}

Delete a role by its ID. Fails with 409 if the role has permissions or is assigned to users.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**
204 No Content

**Error Responses:**

- 409 Conflict: Role has permissions or is assigned to users
- 404 Not Found: Role does not exist

### POST /api/v1/roles/{role_id}/permissions

Assign permissions to a role (replace all permissions).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "permission_ids": ["uuid1", "uuid2"]
}
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "admin", "permissions": [ ... ] },
  "message": "Permissions assigned successfully"
}
```

### DELETE /api/v1/roles/{role_id}/permissions

Remove multiple permissions from a role. Accepts permission IDs as query params or in JSON body.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Query Example:**
`/api/v1/roles/{role_id}/permissions?permission_ids=uuid1&permission_ids=uuid2`

**Body Example:**

```json
{
  "permission_ids": ["uuid1", "uuid2"]
}
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "admin", "permissions": [ ... ] },
  "message": "Permissions removed successfully"
}
```

### DELETE /api/v1/roles/{role_id}/permissions/{permission_id}

Remove a single permission from a role by permission ID (path param).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "admin", "permissions": [ ... ] },
  "message": "Permission removed successfully"
}
```

## Error Responses

- 403 Forbidden: Cannot modify system role permissions
- 404 Not Found: Role or permission not found
- 409 Conflict: Role has permissions or is assigned to users
- 500 Internal Server Error: Unexpected error

## Notes

- All endpoints require authentication and appropriate permissions (e.g., `role.read`, `role.create`, `role.update`, `role.delete`).
- See backend code for detailed permission requirements and error handling.
