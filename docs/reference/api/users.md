# Users API

This document provides information about the user management endpoints of the FastAPI RBAC API.

## User Endpoints

### GET /api/v1/users

Retrieve a list of users.

**Request Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters:**

- `page` (integer, optional): Page number for pagination.
- `limit` (integer, optional): Number of items per page.
- `search` (string, optional): Search term for filtering users.

**Response:**

```json
{
  "data": [
    {
      "id": "uuid-string",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_active": true,
      "roles": [
        {
          "id": "uuid-string",
          "name": "admin"
        }
      ],
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### GET /api/v1/users/{user_id}

Retrieve a specific user by ID.

**Request Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "is_active": true,
  "roles": [
    {
      "id": "uuid-string",
      "name": "admin"
    }
  ],
  "created_at": "2023-01-01T00:00:00Z",
  "updated_at": "2023-01-01T00:00:00Z"
}
```

### POST /api/v1/users

Create a new user.

**Request Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "first_name": "Jane",
  "last_name": "Smith",
  "role_ids": ["uuid-string"]
}
```

**Response:**

```json
{
  "id": "uuid-string",
  "email": "newuser@example.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "is_active": true,
  "roles": [
    {
      "id": "uuid-string",
      "name": "user"
    }
  ],
  "created_at": "2023-01-01T00:00:00Z",
  "updated_at": "2023-01-01T00:00:00Z"
}
```

### PUT /api/v1/users/{user_id}

Update an existing user.

**Request Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**

```json
{
  "first_name": "Updated",
  "last_name": "Name",
  "role_ids": ["uuid-string"]
}
```

**Response:**

```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "first_name": "Updated",
  "last_name": "Name",
  "is_active": true,
  "roles": [
    {
      "id": "uuid-string",
      "name": "admin"
    }
  ],
  "created_at": "2023-01-01T00:00:00Z",
  "updated_at": "2023-01-01T00:00:00Z"
}
```

### DELETE /api/v1/users/{user_id}

Delete a user.

**Request Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```json
{
  "message": "User successfully deleted"
}
```
