# FastAPI RBAC Backend

This Docker image contains the backend service for the FastAPI RBAC (Role-Based Access Control) project. It provides the core API functionalities, user management, authentication, and authorization.

**Project Source Code:** [https://github.com/mnaimfaizy/fastapi_rbac](https://github.com/mnaimfaizy/fastapi_rbac)

## Features

- JWT-based authentication (access and refresh tokens)
- Role-Based Access Control (RBAC)
- User and Role management APIs
- Password hashing and history
- Token blacklisting with Redis
- SQLAlchemy/SQLModel for database operations

## Available Tags

- `latest`: The latest build from the `main` branch.
- `vX.Y.Z` (e.g., `v1.0.0`): Stable release versions.
- `vX.Y.Z-beta.N` (e.g., `v0.1.0-beta.1`): Pre-release versions.

Refer to the [GitHub repository tags](https://github.com/mnaimfaizy/fastapi_rbac/tags) for a full list of available version tags.

## How to Use This Image

### Prerequisites

- A running PostgreSQL database (version 12+ recommended).
- A running Redis instance (version 5+ recommended).

### Running the Container

```bash
# Example:
docker run -d \
  --name rbac_backend \
  -p 8000:8000 \
  -e DATABASE_USER=your_db_user \
  -e DATABASE_PASSWORD=your_db_password \
  -e DATABASE_HOST=your_db_host \
  -e DATABASE_PORT=5432 \
  -e DATABASE_NAME=your_db_name \
  -e REDIS_HOST=your_redis_host \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD=your_redis_password \
  -e SECRET_KEY=a_very_strong_and_unique_secret_key \
  -e ACCESS_TOKEN_EXPIRE_MINUTES=30 \
  -e REFRESH_TOKEN_EXPIRE_DAYS=7 \
  -e FIRST_SUPERUSER_EMAIL=admin@example.com \
  -e FIRST_SUPERUSER_PASSWORD=changethispassword \
  # Add other necessary environment variables as per backend/.env.example
  mnaimfaizy/fastapi-rbac-backend:latest # Or a specific version tag like :v1.0.0
```

### Environment Variables

This image is configured using environment variables. For a comprehensive list and their default values (if any), please refer to the `backend/.env.example` file in the [source repository](https://github.com/mnaimfaizy/fastapi_rbac/blob/main/backend/.env.example). The file contains both development and production configurations with clear guidance for each environment.

**Key variables include:**

- **Database Connection:**
  - `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`
- **Redis Connection:**
  - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **Security & JWT:**
  - `SECRET_KEY`: **Critical for security.** A strong, unique key for signing JWTs.
  - `ACCESS_TOKEN_EXPIRE_MINUTES`
  - `REFRESH_TOKEN_EXPIRE_DAYS`
- **Initial Superuser:**
  - `FIRST_SUPERUSER_EMAIL`
  - `FIRST_SUPERUSER_PASSWORD`
- **API Configuration:**
  - `API_V1_STR` (default: `/api/v1`)
  - `PROJECT_NAME` (default: `FastAPI RBAC`)
- **Email (for password resets, etc.):**
  - `EMAILS_ENABLED` (set to `True` to enable)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS`
  - `EMAILS_FROM_EMAIL`, `EMAILS_FROM_NAME`
- **CORS:**
  - `BACKEND_CORS_ORIGINS`: Comma-separated list of allowed origins (e.g., `http://localhost:5173,https://yourdomain.com`).

### Exposed Ports

- **8000:** The default port on which the FastAPI application listens within the container.

### Volumes (Optional)

- **Database Migrations:** This image will attempt to run Alembic migrations on startup if `RUN_MIGRATIONS` is set to `true` (default).
- **Logs:** If your application is configured to write logs to a file within the container (e.g., `/app/logs`), you can mount a volume to persist them:
  ```bash
  # Example:
  docker run -d \
    # ... other options ...
    -v my_backend_logs:/app/logs \
    mnaimfaizy/fastapi-rbac-backend:latest
  ```
  (Note: The current application primarily logs to console, which is standard for containerized applications.)

## Further Documentation

For more detailed information on the project setup, API endpoints, and architecture, please refer to the main [README.md](https://github.com/mnaimfaizy/fastapi_rbac/blob/main/README.md) and other documentation in the source code repository.
