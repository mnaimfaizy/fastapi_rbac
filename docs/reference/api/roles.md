# Roles API

This document provides information about the role management endpoints of the FastAPI RBAC API.

## Endpoints

### GET /api/v1/roles

Retrieve a paginated list of roles. Supports optional filtering by name pattern (use \* as wildcard).

Each role carries its `permissions`, and each permission carries its `group` (`{ "id", "name" }`, or `null` when the permission has no group). `user_count` is the number of users who hold the role.

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
    {
      "id": "uuid",
      "name": "admin",
      "description": "Administrator role",
      "user_count": 2,
      "permissions": [
        {
          "id": "uuid",
          "name": "user.read",
          "group": { "id": "uuid", "name": "User" }
        }
      ],
      ...
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

### GET /api/v1/roles/list

Retrieve a list of all roles (no pagination). Each role has the same `permissions[].group` and `user_count` fields as the paginated list.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "admin",
      "description": "Administrator role",
      "user_count": 2,
      "permissions": [
        {
          "id": "uuid",
          "name": "user.read",
          "group": { "id": "uuid", "name": "User" }
        }
      ],
      ...
    }
  ]
}
```

### GET /api/v1/roles/{role_id}

Get a role by its ID. Needs `role.read`.

The role has the same `permissions[].group` and `user_count` as the list reads. It also carries `users`, the holders of the role (`id`, `email`, `first_name`, `last_name`), under these rules:

- `users` is present only when the caller also holds `user.read` (a superuser always does). A caller with `role.read` alone gets `user_count` and `"users": null` (the key is present, its value is `null`), because holder identities need `user.read` everywhere else in the API.
- `users` lists at most the first 25 holders, ordered by email. `user_count` is always the full count, so `len(users)` can be smaller than `user_count`.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "name": "admin",
    "description": "Administrator role",
    "user_count": 2,
    "permissions": [
      {
        "id": "uuid",
        "name": "user.read",
        "group": { "id": "uuid", "name": "User" }
      }
    ],
    "users": [
      {
        "id": "uuid",
        "email": "admin@example.com",
        "first_name": "Ada",
        "last_name": "Min"
      }
    ],
    ...
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
  "description": "Manager role",
  "role_group_id": "uuid-optional",
  "permission_ids": ["uuid-optional"]
}
```

**Response:**

```json
{
  "data": { "id": "uuid", "name": "manager", "description": "Manager role", ... }
}
```

### PUT /api/v1/roles/{role_id}

Update a role by its ID. Omit `permission_ids` to leave the role's permissions alone; send it to replace them.

A system role (`admin`, `system` or `superuser`) can't be renamed and its permissions can't be changed here, for any caller. Its description and role group can still be edited, and resending its current name and permissions is allowed.

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

Add permissions to a role. Permissions already on the role are left as they are.

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

## Role-permission ceiling

Holding `role.update` or `role.create` lets a caller edit roles. It does not let them put more authority on a role than they have. These rules apply wherever a role's permissions are written: `POST /roles` and `PUT /roles/{role_id}` (through `permission_ids`), `POST /roles/{role_id}/permissions`, `DELETE /roles/{role_id}/permissions` and `DELETE /roles/{role_id}/permissions/{permission_id}`.

- A superuser is not limited.
- Anyone else can add or remove only permissions they already hold.
- Anyone else cannot change the permissions of a role they hold.
- Only changes are checked. Resending a role's current permissions, or assigning one already on it, is allowed.
- Every rule is checked before anything is written, so a refused request changes nothing.

Each refusal is a 403 Forbidden with a `detail` naming the rule.

---

## Error Responses

- 403 Forbidden: Insufficient permissions, a system role's permissions or name changed, or refused by the [role-permission ceiling](#role-permission-ceiling)
- 404 Not Found: Role or permission not found
- 409 Conflict: Role has permissions or is assigned to users
- 500 Internal Server Error: Unexpected error

## Notes

- All endpoints require authentication and appropriate permissions (e.g., `role.read`, `role.create`, `role.update`, `role.delete`).
- See backend code for detailed permission requirements and error handling.
