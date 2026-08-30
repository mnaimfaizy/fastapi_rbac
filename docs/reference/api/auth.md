# Authentication API

This document provides comprehensive information about the authentication endpoints of the FastAPI RBAC API. It is fully aligned with the backend implementation as of July 2025.

---

## Overview

- All endpoints are under `/api/v1/auth`.
- Most endpoints are public, but some require authentication (e.g., logout, change password).
- All responses are wrapped in a `data` field and may include a `message`.
- Error responses follow the standard error format with appropriate HTTP status codes.
- CSRF protection is required for state-changing operations (see CSRF section).

---

## Endpoints

### POST /api/v1/auth/login

Log in a user with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**

```json
{
  "data": {
    "access_token": "...",
    "token_type": "bearer",
    "user": { "...": "..." }
  },
  "message": "Login successful"
}
```

Sets an HttpOnly `refresh_token` cookie (path `/api/v1/auth`). The refresh token is not returned in the JSON body for the SPA.

**Error Responses:**

- 422 Unprocessable Entity: Invalid credentials, locked account, unverified email
- 400 Bad Request: Input sanitization failed

---

### POST /api/v1/auth/register

Register a new user (self-service, public).

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "SecurePassw0rd!47",
  "first_name": "Jane",
  "last_name": "Smith"
}
```

The password must satisfy the complexity policy in settings -- the same policy
the password-reset and change-password endpoints apply. `SecurePassword123!`
would be rejected for the sequential run `123`.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "is_active": true,
    "verified": false,
    ...
  },
  "message": "Registration successful. Please check your email to verify your account."
}
```

**Error Responses:**

- 400 Bad Request: Invalid input, password too long, rate limit exceeded, or a
  password that fails the complexity policy. A complexity failure answers with
  an object rather than a string:

  ```json
  {
    "detail": {
      "message": "Password does not meet complexity requirements.",
      "errors": ["Password must be at least 12 characters long"]
    }
  }
  ```

---

### POST /api/v1/auth/verify-email

Verify a user's email address using a verification token.

**Request Body:**

```json
{
  "token": "verification_token"
}
```

**Response:**

```json
{
  "data": { ...user fields... },
  "message": "Email verified successfully."
}
```

**Error Responses:**

- 400 Bad Request: `"This verification link is invalid or has expired. Please request a new verification email and try again."` — returned identically for an unknown address, a disabled account, and a wrong, expired or already-used token, so the response never confirms that an account exists (#137). The audit log records which it was.
- 401 Unauthorized: the token itself failed JWT validation

---

### POST /api/v1/auth/resend-verification-email

Resend the verification email to a user (rate-limited).

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "If the email exists and the account is not verified, a verification email has been sent."
}
```

**Error Responses:**

- 429 Too Many Requests: Rate limit exceeded
- 400 Bad Request: Invalid email

---

### POST /api/v1/auth/logout

Log out a user by clearing Redis allowlist entries for access/refresh tokens and deleting the HttpOnly `refresh_token` cookie. Requires CSRF (cookie-authenticated mutation).

**Request Headers:**

```
Authorization: Bearer <access_token>
X-CSRF-Token: <csrf_token>
```

**Response:**

```json
{
  "message": "Successfully logged out"
}
```

**Permissions:** Authenticated user

---

### POST /api/v1/auth/change_password

Change the current user's password (authenticated).

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword456!"
}
```

**Response:**

```json
{
  "data": {
    "access_token": "...",
    "token_type": "bearer",
    "user": { "...": "..." }
  },
  "message": "Password changed successfully."
}
```

Re-issues the HttpOnly `refresh_token` cookie (refresh token omitted from JSON).

**Error Responses:**

- 400 Bad Request: Invalid current password, password complexity, password reuse
- 401 Unauthorized: Not authenticated

---

### POST /api/v1/auth/password-reset/request

Request a password reset email (public, rate-limited).

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "If the email exists and the account is active, a password reset link has been sent."
}
```

The same `200` and the same message are returned for an unknown address, a disabled account, and an active one (#137). Only `MODE=development` differs, where the reset token is echoed back for MailHog.

**Error Responses:**

- 400 Bad Request: Invalid email
- 429 Too Many Requests: Rate limit exceeded

---

### POST /api/v1/auth/password-reset/confirm

Reset a user's password using a reset token.

**Request Body:**

```json
{
  "token": "reset_token",
  "new_password": "NewPassword456!"
}
```

**Response:**

```json
{
  "message": "Password has been reset successfully."
}
```

**Error Responses:**

- 400 Bad Request: `"This password reset link is invalid or has expired. Please request a new password reset and try again."` — returned identically for an unknown address, a disabled account, and a token that is wrong, expired or not allow-listed (#137)
- 400 Bad Request: password complexity or password-history failures, which describe the submitted password and stay distinct

---

### POST /api/v1/auth/new_access_token

Refresh an access token. Prefer the HttpOnly `refresh_token` cookie (first-party SPA). Requires CSRF. Optional JSON body `refresh_token` is a documented fallback for non-browser API clients.

**Cookie:** `refresh_token` (HttpOnly; path scoped to `/api/v1/auth`)

**Request Body (optional):**

```json
{
  "refresh_token": "..."
}
```

**Response:**

```json
{
  "data": {
    "access_token": "...",
    "token_type": "bearer"
  },
  "message": "Access token generated correctly"
}
```

**Error Responses:**

- 401 Unauthorized: Missing, invalid, or expired refresh token
- 403 Forbidden: CSRF failure or refresh token not on Redis allowlist

---

### GET /api/v1/auth/csrf-token

Get a CSRF token for use in state-changing operations (required for POST/PUT/DELETE).

**Response:**

```json
{
  "data": { "csrf_token": "..." },
  "message": "CSRF token generated successfully"
}
```

---

## Error Responses

- 400 Bad Request: Invalid input, password complexity, invalid token
- 401 Unauthorized: Missing or invalid token
- 403 Forbidden: Not allowed
- 404 Not Found: User not found
- 409 Conflict: Email already registered
- 422 Unprocessable Entity: Validation errors, locked account, unverified email
- 429 Too Many Requests: Rate limit exceeded
- 500 Internal Server Error: Unexpected error

---

## Security Notes

- All state-changing endpoints require a valid CSRF token (see `/csrf-token`).
- Passwords must meet complexity requirements and cannot be reused (see backend settings).
- Rate limits apply to registration, password reset, and verification email endpoints.
- Tokens are JWTs and must be included in the `Authorization` header as `Bearer <token>`.
- Always use HTTPS in production.

---

## See Also

- [Users API](./users.md) for user management endpoints.
- [Roles API](./roles.md) for role management endpoints.
- [Permission API](./permissions.md) for permission management endpoints.
