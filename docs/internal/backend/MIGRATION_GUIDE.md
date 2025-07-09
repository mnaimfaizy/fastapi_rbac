# Migration Guide: Environment Variables Consolidation

## Overview

This guide helps existing users migrate from the old dual-file system (`.env.example` and `production.env.example`) to the new consolidated `.env.example` file.

## What Changed

- **Removed**: `production.env.example`
- **Updated**: `.env.example` now contains all variables for both development and production
- **Added**: Clear comments indicating production-specific values
- **Improved**: Better organization and documentation of variables

## Migration Steps

### For Development Environments

If you're using the project for development:

1. **Backup your current `.env` file** (if you have one):

   ```bash
   cp .env .env.backup
   ```

2. **Compare with new `.env.example`**:

   ```bash
   diff .env .env.example
   ```

3. **Add any missing variables** from the new `.env.example` to your `.env` file

4. **Test your setup** to ensure everything works correctly

### For Production Environments

If you're running this in production:

1. **Backup your current `.env` file**:

   ```bash
   cp .env .env.backup
   ```

2. **Review the new `.env.example`** for any new variables

3. **Update your `.env` file** with any missing variables from the new template

4. **Follow the production checklist** in the new `.env.example` file

5. **Pay special attention to**:
   - New security variables
   - Updated Redis SSL configurations
   - Enhanced Celery settings
   - Additional rate limiting options

## Key Variables to Review

### New Variables (may need to be added to your .env)

- `PASSWORD_PEPPER` - Additional security for password hashing
- `CELERY_WORKER_CONCURRENCY` - Production worker optimization
- `CELERY_WORKER_MAX_MEMORY_PER_CHILD` - Memory management
- `CELERY_BROKER_POOL_LIMIT` - Connection pool optimization
- `CELERY_TASK_COMPRESSION` - Task compression for production
- `VALIDATE_TOKEN_IP` - Enhanced token security
- `TOKEN_BLACKLIST_ON_LOGOUT` - Session security
- `TOKEN_BLACKLIST_EXPIRY` - Token management

### Variables with Updated Comments

- All Redis configurations now include SSL guidance
- Celery configurations have development vs production examples
- Database settings include Supabase configuration options
- Email settings show both MailHog and production SMTP

## Environment-Specific Quick Reference

### Development Setup

```bash
# Copy the example file
cp .env.example .env

# Development is ready to go with defaults!
# No changes needed for basic development setup
```

### Production Setup

```bash
# Copy the example file
cp .env.example .env

# Edit .env and change these critical values:
# MODE=production
# DEBUG=false
# LOG_LEVEL=INFO
# USERS_OPEN_REGISTRATION=false
# Generate new SECRET_KEY, JWT_SECRET_KEY, etc.
# Configure production database
# Set up production Redis with SSL
# Configure production email SMTP
# Set production CORS origins
```

## Testing Your Migration

### 1. Development Testing

```bash
# Start the application
python -m uvicorn app.main:app --reload

# Check that all services start correctly:
# - Database connection
# - Redis connection
# - Email service (MailHog)
# - Celery worker
```

### 2. Production Testing

```bash
# Test database connection
python -c "from app.db.session import engine; print('DB connection OK')"

# Test Redis connection
python -c "import redis; r=redis.Redis(host='your-redis-host'); print(r.ping())"

# Test email configuration
python -c "from app.utils.email.email import send_test_email; print('Email config OK')"
```

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**

   - Error: `KeyError: 'VARIABLE_NAME'`
   - Solution: Add the missing variable to your `.env` file from the new template

2. **Redis Connection Issues**

   - Error: Redis connection failed
   - Solution: Check SSL settings and password configuration

3. **Database Connection Issues**

   - Error: Database connection failed
   - Solution: Verify database type and connection parameters

4. **Email Configuration Issues**
   - Error: Email sending failed
   - Solution: Check SMTP settings and credentials

### Getting Help

If you encounter issues during migration:

1. Check the troubleshooting section in the main README
2. Compare your `.env` file with the new `.env.example`
3. Ensure all required variables are present
4. Check the production checklist if deploying to production

## Rollback Plan

If you need to rollback to the old system:

1. Restore your backed-up `.env` file
2. The old `production.env.example` file is preserved in git history
3. You can restore it with: `git checkout HEAD~1 -- production.env.example`

## Benefits After Migration

- Single source of truth for all environment variables
- Better documentation and guidance
- Easier maintenance and updates
- Clear production deployment checklist
- Improved security configurations
- Better organization of related settings

## Support

For questions or issues with the migration:

- Check the main documentation
- Review the production checklist in `.env.example`
- Refer to the troubleshooting section
- Open an issue if you encounter problems
