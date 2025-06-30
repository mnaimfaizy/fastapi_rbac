# Common Issues

This page lists common issues that developers might encounter when working with the FastAPI RBAC project and their solutions.

## Installation Issues

### Package Conflicts

**Issue:** Dependencies conflict between the FastAPI RBAC backend and other Python packages.

**Solution:** Use a dedicated virtual environment for the backend project. You can create one using:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### MkDocs Installation

**Issue:** MkDocs conflicts with project dependencies.

**Solution:** Install MkDocs at the user level, outside any project virtual environments:

```bash
pip install --user mkdocs mkdocs-material
```

## Authentication Issues

### JWT Token Expiration

**Issue:** Authentication fails with "Token has expired" errors.

**Solution:** Refresh your access token using the refresh token or log in again if the refresh token has also expired.

### Password Requirements

**Issue:** Unable to set or change passwords due to validation errors.

**Solution:** Ensure passwords meet the following requirements:

- At least 8 characters long
- Contains at least one uppercase letter
- Contains at least one lowercase letter
- Contains at least one number
- Contains at least one special character

## Database Issues

### Migration Errors

**Issue:** Database migration fails with integrity or constraint errors.

**Solution:**

1. Ensure your database is in a clean state before running migrations
2. Check for conflicting migrations
3. If needed, drop and recreate the database:
   ```bash
   # For development environments only
   cd backend
   alembic downgrade base
   alembic upgrade head
   ```

## Docker Issues

### Docker Compose Conflicts

**Issue:** Docker Compose services fail to start due to port conflicts.

**Solution:** Check if the required ports (8000 for backend, 5173 for frontend, 5432 for PostgreSQL) are already in use by other applications. Modify the port mappings in `docker-compose.yml` if needed.

### Volume Mounting Issues

**Issue:** Code changes are not reflected in Docker containers.

**Solution:** Ensure volume mappings are correctly configured in your Docker Compose files. For the backend:

```yaml
volumes:
  - ./backend:/app
```

## Local Development Issues

### Hot Reload Not Working

**Issue:** Changes to code are not automatically reflected in the running application.

**Solution:**

- For the backend, ensure you're running with the `--reload` flag: `uvicorn app.main:app --reload`
- For the frontend, check that the development server is properly configured in `vite.config.ts`

### Database Connection Issues

**Issue:** Unable to connect to the database with "Connection refused" errors.

**Solution:** Ensure PostgreSQL is running and properly configured. Check connection details in `.env` files:

```
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=app
```
