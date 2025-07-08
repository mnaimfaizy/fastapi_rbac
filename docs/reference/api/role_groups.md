# Role Groups API

This document provides information about the role group management endpoints of the FastAPI RBAC API.

## Endpoints

### GET /api/v1/role-groups

Retrieve a paginated list of role groups with hierarchical structure (root groups at top level, children nested).

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
      "name": "core-admins",
      "parent_id": null,
      "children": [ ... ],
      "roles": [ ... ],
      "created_at": "...",
      "updated_at": "...",
      "created_by_id": "uuid"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

### GET /api/v1/role-groups/{group_id}

Get a role group by its ID, with full hierarchy and optional nested roles.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Query Parameters:**

- `include_nested_roles` (boolean, optional): Include roles for nested groups

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "name": "core-admins",
    "parent_id": null,
    "children": [ ... ],
    "roles": [ ... ],
    "created_at": "...",
    "updated_at": "...",
    "created_by_id": "uuid"
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
  "parent_id": "uuid-optional"
}
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "managers", "parent_id": null, ... }
}
```

### PUT /api/v1/role-groups/{group_id}

Update a role group by its ID.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "name": "updated_group",
  "parent_id": "uuid-optional"
}
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "updated_group", "parent_id": null, ... }
}
```

### DELETE /api/v1/role-groups/{group_id}

Delete a role group by its ID. Fails with 409 if the group has child groups or assigned roles.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**
204 No Content

**Error Responses:**

- 409 Conflict: Group has child groups or assigned roles
- 404 Not Found: Group does not exist

### POST /api/v1/role-groups/bulk

Create multiple role groups in bulk.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
[{ "name": "group1" }, { "name": "group2", "parent_id": "uuid-optional" }]
```

**Response:**

```json
{
  "data": [ ... ],
  "message": "Successfully created 2 role groups"
}
```

### DELETE /api/v1/role-groups/bulk

Delete multiple role groups in bulk.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "group_ids": ["uuid1", "uuid2"]
}
```

**Response:**

```json
{
  "message": "Successfully deleted 2 role groups"
}
```

### POST /api/v1/role-groups/{group_id}/roles

Add roles to a role group (with circular dependency check).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "role_ids": ["uuid1", "uuid2"]
}
```

**Response:**

```json
{
  "data": { ...updated group... }
}
```

**Error Responses:**

- 409 Conflict: Circular dependency detected
- 400 Bad Request: Invalid UUID format

### DELETE /api/v1/role-groups/{group_id}/roles

Remove roles from a role group.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "role_ids": ["uuid1", "uuid2"]
}
```

**Response:**

```json
{
  "data": { ...updated group... }
}
```

**Error Responses:**

- 400 Bad Request: Invalid UUID format

### POST /api/v1/role-groups/{group_id}/clone

Clone a role group (with all role assignments) to a new name.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "new_name": "cloned-group-name"
}
```

**Response:**

```json
{
  "data": { ...cloned group... },
  "message": "Successfully cloned role group 'source' to 'cloned-group-name'"
}
```

### POST /api/v1/role-groups/sync-roles

Synchronize roles with role groups based on the role_group_id field.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "message": "Successfully synchronized role-group mappings. Created: 2, Skipped: 0",
  "data": { "created": 2, "skipped": 0 }
}
```

## Error Responses

- 403 Forbidden: Insufficient permissions
- 404 Not Found: Group or role not found
- 409 Conflict: Group has child groups, assigned roles, or circular dependency
- 400 Bad Request: Invalid UUID format
- 500 Internal Server Error: Unexpected error

## Notes

- All endpoints require authentication and appropriate permissions (e.g., `role_group.read`, `role_group.create`, `role_group.update`, `role_group.delete`).
- See backend code for detailed permission requirements and error handling.
