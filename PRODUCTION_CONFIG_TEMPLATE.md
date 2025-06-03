# Production Environment Configuration Template

## Backend Environment (.env.production)

Replace the following values with production-specific settings:

```bash
#############################################
# FastAPI environment variables - Production
#############################################
MODE=production
PROJECT_NAME=your-project-name
DEBUG=false
LOG_LEVEL=INFO

# Security Keys - CHANGE ALL OF THESE IN PRODUCTION
SECRET_KEY=your_strong_production_secret_key_here
JWT_SECRET_KEY=your_strong_jwt_secret_key_here
JWT_VERIFICATION_SECRET_KEY=your_strong_jwt_verification_secret_key
JWT_REFRESH_SECRET_KEY=your_strong_jwt_refresh_secret_key
JWT_RESET_SECRET_KEY=your_strong_jwt_reset_secret_key
ENCRYPT_KEY=your_32_byte_base64_encoded_encryption_key

# CORS and URLs - CRITICAL: Update for your domain
BACKEND_CORS_ORIGINS=["https://yourdomain.com"]
FRONTEND_URL=https://yourdomain.com

# Database Configuration
DATABASE_USER=your_db_user
DATABASE_PASSWORD=your_strong_db_password
DATABASE_NAME=your_db_name

# Redis Configuration
REDIS_PASSWORD=your_strong_redis_password

# Email Configuration (if using email features)
EMAILS_ENABLED=true
SMTP_HOST=your.smtp.server.com
SMTP_USER=your_email@yourdomain.com
SMTP_PASSWORD=your_email_password
EMAILS_FROM_EMAIL=noreply@yourdomain.com

# Admin User
FIRST_SUPERUSER_EMAIL=admin@yourdomain.com
FIRST_SUPERUSER_PASSWORD=your_strong_admin_password
```

## Frontend Environment (.env.production)

```bash
# API Configuration
VITE_API_BASE_URL=/api/v1

# App Configuration
VITE_APP_NAME=Your App Name
VITE_APP_VERSION=1.0.0

# Security tokens
VITE_AUTH_TOKEN_NAME=auth_token
VITE_REFRESH_TOKEN_NAME=refresh_token

# Feature flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ADVANCED_FEATURES=true
```

## Security Checklist

- [ ] All default passwords changed
- [ ] Strong, random secret keys generated
- [ ] CORS origins restricted to production domain only
- [ ] Database port not exposed to host
- [ ] Redis port not exposed to host (unless needed)
- [ ] SSL/TLS certificates properly configured
- [ ] Email configuration tested
- [ ] Backup strategy in place
- [ ] Monitoring and logging configured
- [ ] Resource limits set for containers
- [ ] Regular security updates scheduled

## Generate Strong Secrets

Use these commands to generate secure values:

```powershell
# Generate random 32-byte key for encryption
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Generate random 64-character secret
-join ((1..64) | ForEach-Object { '{0:X}' -f (Get-Random -Maximum 16) })
```

Or use Python:

```python
import secrets
import base64

# For encryption key (32 bytes)
encryption_key = base64.b64encode(secrets.token_bytes(32)).decode()
print(f"ENCRYPT_KEY={encryption_key}")

# For JWT secrets (64 characters)
jwt_secret = secrets.token_urlsafe(48)
print(f"JWT_SECRET_KEY={jwt_secret}")
```
