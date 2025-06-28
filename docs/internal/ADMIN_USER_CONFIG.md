# Admin User Creation Configuration - Environment Variables

This document outlines the new environment variables added to control admin user creation behavior in the FastAPI RBAC system.

## New Environment Variables

### ADMIN_CREATED_USERS_AUTO_VERIFIED

- **Type**: Boolean (true/false)
- **Default**: `true`
- **Description**: Whether admin-created users should be automatically verified without requiring email verification
- **Usage**:
  - `true`: Admin-created users have `verified=true` and can log in immediately
  - `false`: Admin-created users have `verified=false` and must verify their email before logging in

### ADMIN_CREATED_USERS_SEND_EMAIL

- **Type**: Boolean (true/false)
- **Default**: `false`
- **Description**: Whether to send verification emails to admin-created users
- **Usage**:
  - `true`: Send verification email to admin-created users (typically used when AUTO_VERIFIED=false)
  - `false`: No verification email sent to admin-created users

## Configuration Examples

### Standard Configuration (Recommended)

```bash
# Admin-created users are automatically verified and ready to use
ADMIN_CREATED_USERS_AUTO_VERIFIED=true
ADMIN_CREATED_USERS_SEND_EMAIL=false
```

### High Security Configuration

```bash
# Admin-created users must verify their email before logging in
ADMIN_CREATED_USERS_AUTO_VERIFIED=false
ADMIN_CREATED_USERS_SEND_EMAIL=true
```

### Manual Verification Configuration

```bash
# Admin-created users are not verified and no email is sent (manual verification required)
ADMIN_CREATED_USERS_AUTO_VERIFIED=false
ADMIN_CREATED_USERS_SEND_EMAIL=false
```

## Files Updated

The following environment files have been updated with these new variables:

### Development Environment

- `backend/.env.development` - Development configuration
- `backend/.env.local` - Local development overrides

### Testing Environment

- `backend/.env.test` - Test environment configuration

### Production Environment

- `backend/.env.production` - Production configuration
- `backend/production.env.example` - Production example file

### Example Files

- `backend/.env.example` - Main example environment file

## Code Changes

### Configuration (backend/app/core/config.py)

Added new configuration properties:

```python
# Admin User Creation Settings
ADMIN_CREATED_USERS_AUTO_VERIFIED: bool = True  # Auto-verify admin-created users
ADMIN_CREATED_USERS_SEND_EMAIL: bool = False  # Send verification email to admin-created users
```

### User Creation Endpoint (backend/app/api/v1/endpoints/user.py)

Updated the `POST /api/v1/users` endpoint to:

1. Use configuration settings to determine user verification status
2. Optionally send verification emails based on configuration
3. Provide appropriate response messages based on the action taken

## Behavior Matrix

| AUTO_VERIFIED | SEND_EMAIL | Result                                            |
| ------------- | ---------- | ------------------------------------------------- |
| `true`        | `false`    | User auto-verified, no email sent (default)       |
| `true`        | `true`     | User auto-verified, no email sent (email ignored) |
| `false`       | `true`     | User not verified, verification email sent        |
| `false`       | `false`    | User not verified, no email sent                  |

## Migration Notes

### For Existing Deployments

1. The default values maintain backward compatibility
2. Admin-created users will be auto-verified by default
3. No verification emails are sent by default

### For New Deployments

1. Review the configuration options
2. Choose the appropriate security level for your environment
3. Update environment files accordingly

## Testing

Use the provided test scripts to verify configuration:

- `test_admin_user_creation.py` - Tests user creation with current configuration
- `test_verification_email.py` - Tests email verification functionality

## Security Considerations

### Auto-Verification (ADMIN_CREATED_USERS_AUTO_VERIFIED=true)

- **Pros**: Convenient, users can log in immediately
- **Cons**: Less secure, no email ownership verification
- **Recommended for**: Trusted environments, internal systems

### Manual Verification (ADMIN_CREATED_USERS_AUTO_VERIFIED=false)

- **Pros**: More secure, verifies email ownership
- **Cons**: Additional step required, potential for unverified accounts
- **Recommended for**: Public-facing systems, high-security environments

## Troubleshooting

### Users Not Auto-Verified

Check that `ADMIN_CREATED_USERS_AUTO_VERIFIED=true` is set in your environment file.

### Verification Emails Not Sent

1. Verify `ADMIN_CREATED_USERS_SEND_EMAIL=true`
2. Check email configuration (`EMAILS_ENABLED=true`, SMTP settings)
3. Check MailHog (development) or email logs (production)

### Configuration Not Applied

1. Restart the application after changing environment variables
2. Verify environment file loading order
3. Check Docker container environment variables
