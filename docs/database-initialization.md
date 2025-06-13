# Database Initialization Guide

This document explains how database initialization works in different environments and provides solutions for common scenarios.

## Overview

The FastAPI RBAC system uses a multi-step database initialization process:

1. **Database Connection Check** - Waits for database to be ready
2. **Pre-start Script** - Validates database connectivity and configuration
3. **Alembic Migrations** - Applies database schema changes
4. **Initial Data Setup** - Creates default users, roles, and permissions

## Environment-Specific Behavior

### Development Environment

**How it works:**

- Uses `development-entrypoint.sh` script
- Automatically runs migrations and initial data setup
- Starts uvicorn with hot-reload for development

**Command to start:**

```powershell
cd d:\Projects\fastapi_rbac\backend
docker-compose -f docker-compose.dev.yml up --build
```

**What happens automatically:**

1. Waits for PostgreSQL to be ready
2. Runs `backend_pre_start.py` to validate connections
3. Runs `alembic upgrade head` to apply migrations
4. Runs `initial_data.py` to create default data
5. Starts FastAPI with hot-reload

### Production Environment

**How it works:**

- Uses `production-entrypoint.sh` script
- Automatically runs migrations and initial data setup
- Starts gunicorn with multiple workers

**Command to start:**

```powershell
cd d:\Projects\fastapi_rbac\backend
docker-compose -f docker-compose.prod.yml up --build
```

**What happens automatically:**

1. Waits for PostgreSQL to be ready (with longer timeout)
2. Runs `backend_pre_start.py` to validate connections
3. Runs `alembic upgrade head` to apply migrations
4. Runs `initial_data.py` to create default data
5. Starts FastAPI with gunicorn for production

### Testing Environment

**How it works:**

- Uses standard `entrypoint.sh` script
- Automatically runs migrations and initial data setup
- Starts FastAPI for testing

**Command to start:**

```powershell
cd d:\Projects\fastapi_rbac
docker-compose -f docker-compose.dev.yml up --build
```

## Manual Database Operations

### If you need to run migrations manually:

```powershell
# Enter the running container
docker exec -it fastapi_rbac_dev bash

# Run migrations
alembic upgrade head

# Or run specific migration
alembic upgrade +1
```

### If you need to reset the database:

```powershell
# Stop containers
docker-compose -f docker-compose.dev.yml down

# Remove database volume
docker volume rm fastapi_rbac_postgres_dev_data

# Start fresh
docker-compose -f docker-compose.dev.yml up --build
```

### If you need to run initial data setup manually:

```powershell
# Enter the running container
docker exec -it fastapi_rbac_dev bash

# Run initial data script
python app/initial_data.py

# Or use the root-level script
python init_data.py
```

## Error Handling

### Database Connection Errors

**Error:** `Database connection error: could not connect to server`

**Solutions:**

1. Ensure PostgreSQL container is running
2. Check environment variables (DATABASE_HOST, DATABASE_PORT, etc.)
3. Verify network connectivity between containers
4. Check if database credentials are correct

**Debug commands:**

```powershell
# Check if database container is running
docker ps | grep postgres

# Check database logs
docker logs fastapi_rbac_db_dev

# Test database connection from app container
docker exec -it fastapi_rbac_dev bash
python app/backend_pre_start.py
```

### Migration Errors

**Error:** `alembic.util.exc.CommandError: Can't locate revision identified by`

**Solutions:**

1. Check if alembic_version table exists in database
2. Reset migrations if needed
3. Check for conflicting migration files

**Debug commands:**

```powershell
# Check migration status
docker exec -it fastapi_rbac_dev alembic current

# Check migration history
docker exec -it fastapi_rbac_dev alembic history

# Reset to base (CAREFUL - destroys data)
docker exec -it fastapi_rbac_dev alembic downgrade base
```

### Initial Data Errors

**Error:** `Could not create superuser` or `Permission group not found`

**Solutions:**

1. Check if database schema is properly created
2. Verify initial data configuration in `app/db/init_db.py`
3. Check for duplicate data constraints

**Debug commands:**

```powershell
# Run initial data script with debug output
docker exec -it fastapi_rbac_dev python app/initial_data.py

# Check database content
docker exec -it fastapi_rbac_db_dev psql -U postgres -d fastapi_db -c "SELECT * FROM User;"
```

## Container Restart Behavior

### Will the container fail if database is not ready?

**No** - The entrypoint scripts include robust waiting logic that:

- Continuously tries to connect to the database
- Waits with exponential backoff
- Only proceeds when database is confirmed ready
- Has a maximum retry limit (5 minutes in development, configurable)

### Will migrations run every time?

**Yes, but safely** - Alembic migrations are:

- Idempotent (safe to run multiple times)
- Only apply changes that haven't been applied yet
- Track applied migrations in the `alembic_version` table
- Skip already-applied migrations automatically

### Will initial data be duplicated?

**No** - The initial data setup:

- Checks if data already exists before creating
- Uses "get or create" patterns
- Skips creation if entities already exist
- Logs warnings for any issues but continues processing

## Best Practices

### For New Developers

1. **Use the provided Docker Compose files** - They handle all initialization automatically
2. **Don't run migrations manually** unless troubleshooting
3. **Use environment-specific configurations** (.env.development, .env.production)
4. **Check logs** if something seems wrong: `docker-compose logs fastapi_rbac_dev`

### For Production Deployment

1. **Use production Docker Compose** with proper environment variables
2. **Set up proper secrets management** for database credentials
3. **Configure health checks** to ensure containers are ready
4. **Set up monitoring** for database connectivity and application health
5. **Backup database** before major deployments

### For CI/CD Pipelines

1. **Use testing Docker Compose** for consistent test environments
2. **Run database in separate container** for isolation
3. **Use fresh database** for each test run
4. **Verify migrations** work correctly in pipeline
5. **Test initial data creation** as part of integration tests

## Troubleshooting Commands

```powershell
# Check all container status
docker-compose -f docker-compose.dev.yml ps

# View logs for specific service
docker-compose -f docker-compose.dev.yml logs fastapi_rbac_dev

# Enter container for debugging
docker exec -it fastapi_rbac_dev bash

# Check database connectivity
docker exec -it fastapi_rbac_dev python app/backend_pre_start.py

# Check migration status
docker exec -it fastapi_rbac_dev alembic current

# Check if initial data exists
docker exec -it fastapi_rbac_db_dev psql -U postgres -d fastapi_db -c "SELECT email FROM User WHERE is_superuser = true;"

# Restart single service
docker-compose -f docker-compose.dev.yml restart fastapi_rbac_dev

# Complete reset (destroys data)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up --build
```

## Summary

The database initialization is **fully automated** and **idempotent**. You should:

- ✅ **Use Docker Compose** for consistent environments
- ✅ **Let the system handle initialization** automatically
- ✅ **Check logs** if issues occur
- ❌ **Don't run manual migrations** unless troubleshooting
- ❌ **Don't worry about duplicate data** - the system handles it
- ❌ **Don't fear container restarts** - initialization is safe and smart
