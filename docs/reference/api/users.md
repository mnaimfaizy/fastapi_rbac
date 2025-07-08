# Users API

This document provides comprehensive information about the user management endpoints of the FastAPI RBAC API. It is fully aligned with the backend implementation as of July 2025.

---

## Overview

- All endpoints require authentication (Bearer token) and appropriate permissions.
- Most endpoints require `admin` or `manager` roles, except for self-profile endpoints.
- All responses are wrapped in a `data` field and may include a `message`.
- Error responses follow the standard error format with appropriate HTTP status codes.

---

## Endpoints

### GET /api/v1/users

Retrieve a paginated list of users. Supports optional filtering by email.

**Query Parameters:**

- `email` (string, optional): Filter users by email (exact match).
- Pagination params: `page`, `size`, etc.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "is_active": true,
        "is_superuser": false,
        "verified": true,
        "roles": [
          { "id": "uuid", "name": "admin", "description": "Administrator role" }
        ],
        "permissions": ["user.read", "user.update"],
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T00:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "pages": 1
  }
}
```

**Permissions:** `user.read` (admin/manager)

---

### GET /api/v1/users/list

Retrieve a paginated list of users (same as above, but always paginated, admin/manager only).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**
_Same as above._

**Permissions:** `users.read` (admin/manager)

---

### GET /api/v1/users/order_by_created_at

Retrieve a paginated list of users ordered by creation date.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**
_Same as above, but ordered by `created_at`._

**Permissions:** `users.read` (admin/manager)

---

### GET /api/v1/users/me

Get the current user's profile information.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "email": "me@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "is_active": true,
    "is_superuser": false,
    "verified": true,
    "roles": [ ... ],
    "permissions": [ ... ],
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z"
  }
}
```

**Permissions:** Authenticated user

---

### GET /api/v1/users/{user_id}

Retrieve a specific user by ID.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "is_superuser": false,
    "verified": true,
    "roles": [ ... ],
    "permissions": [ ... ],
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z"
  }
}
```

**Permissions:** `users.read` (admin/manager)

---

### POST /api/v1/users

Create a new user (admin only).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "first_name": "Jane",
  "last_name": "Smith",
  "role_id": ["uuid"]
}
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "is_active": true,
    "is_superuser": false,
    "verified": true,
    "roles": [ ... ],
    "permissions": [ ... ],
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z"
  },
  "message": "User created successfully and verified"
}
```

**Permissions:** `users.create` (admin)

---

### PUT /api/v1/users/{user_id}

Update an existing user (admin only).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "first_name": "Updated",
  "last_name": "Name",
  "role_id": ["uuid"]
}
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "Updated",
    "last_name": "Name",
    "is_active": true,
    "is_superuser": false,
    "verified": true,
    "roles": [ ... ],
    "permissions": [ ... ],
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z"
  },
  "message": "User updated successfully"
}
```

**Permissions:** `users.update` (admin)

---

### PUT /api/v1/users/me

Update the current user's own profile (cannot update roles, email, or password here).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "first_name": "NewName",
  "last_name": "NewLastName"
}
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "email": "me@example.com",
    "first_name": "NewName",
    "last_name": "NewLastName",
    ...
  },
  "message": "Profile updated successfully"
}
```

**Permissions:** `self.update_profile` (authenticated user)

---

### PUT /api/v1/users/bulk-update

Bulk update users (admin only).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "user_ids": ["uuid1", "uuid2"],
  "updates": {
    "first_name": "BulkUpdated"
  }
}
```

**Response:**

```json
{
  "data": [
    { "id": "uuid1", "first_name": "BulkUpdated", ... },
    { "id": "uuid2", "first_name": "BulkUpdated", ... }
  ],
  "message": "Bulk update successful"
}
```

**Permissions:** `users.update` (admin)

---

### DELETE /api/v1/users/{user_id}

Delete a user by ID (admin only). Cannot delete self or users with roles assigned.

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "data": { "id": "uuid", ... },
  "message": "User removed"
}
```

**Error Responses:**

- 409 Conflict: User has roles assigned ("User has N role(s) assigned and cannot be deleted. Please remove all roles first.")
- 403 Forbidden: Cannot delete self
- 404 Not Found: User does not exist

**Permissions:** `users.delete` (admin)

---

### POST /api/v1/users/{user_id}/roles

Assign one or more roles to a user (admin only).

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
  "message": "Roles assigned successfully"
}
```

**Permissions:** `user.update` (admin)

---

## Error Responses

- 400 Bad Request: Invalid input, missing required fields
- 401 Unauthorized: Missing or invalid token
- 403 Forbidden: Insufficient permissions, cannot delete self
- 404 Not Found: User or role not found
- 409 Conflict: User has roles assigned and cannot be deleted
- 422 Unprocessable Entity: Validation errors, locked account, unverified email, etc.
- 500 Internal Server Error: Unexpected error

---

## Notes

- All endpoints require authentication and appropriate permissions.
- Use `/api/v1/users/me` and `/api/v1/users/me` (PUT) for self-profile operations.
- Use `/api/v1/users/list` for paginated admin/manager user listing.
- Use `/api/v1/users/{user_id}/roles` to assign roles to a user.
- For authentication, registration, password reset, and verification endpoints, see the **Auth API** documentation.
- See backend code for detailed permission requirements and error handling.
