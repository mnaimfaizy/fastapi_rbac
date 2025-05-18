# FastAPI RBAC Celery Worker

This Docker image contains the Celery worker service for the FastAPI RBAC (Role-Based Access Control) project. It handles background tasks such as sending emails, processing long-running operations, and executing scheduled tasks.

**Project Source Code:** [https://github.com/mnaimfaizy/fastapi_rbac](https://github.com/mnaimfaizy/fastapi_rbac)

## Features

- Executes tasks defined in the FastAPI application (e.g., email sending).
- Integrates with Celery Beat for scheduled tasks (if configured).
- Uses Redis as the message broker and backend (can be configured for RabbitMQ etc., but Redis is the default in this project).

## Available Tags

- `latest`: The latest build from the `main` branch.
- `vX.Y.Z` (e.g., `v1.0.0`): Stable release versions.
- `vX.Y.Z-beta.N` (e.g., `v0.1.0-beta.1`): Pre-release versions.

Refer to the [GitHub repository tags](https://github.com/mnaimfaizy/fastapi_rbac/tags) for a full list of available version tags.

## How to Use This Image

### Prerequisites

- A running PostgreSQL database (shared with the backend service).
- A running Redis instance (used as the Celery broker and backend).
- The FastAPI RBAC Backend service should ideally be running or its database schema initialized, as workers might interact with the database models.

### Running the Container

```bash
# Example:
docker run -d \
  --name rbac_worker \
  # Ensure the worker can connect to the same database and Redis instance as the backend
  -e DATABASE_USER=your_db_user \
  -e DATABASE_PASSWORD=your_db_password \
  -e DATABASE_HOST=your_db_host \
  -e DATABASE_PORT=5432 \
  -e DATABASE_NAME=your_db_name \
  -e REDIS_HOST=your_redis_host \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD=your_redis_password \
  -e CELERY_BROKER_URL=redis://your_redis_host:6379/0 \ # Or use REDIS_HOST, REDIS_PORT, REDIS_PASSWORD to construct this
  -e CELERY_RESULT_BACKEND=redis://your_redis_host:6379/0 \
  # Add other necessary environment variables as per backend/production.env.example
  # (especially those related to email if your tasks send emails)
  mnaimfaizy/fastapi-rbac-worker:latest # Or a specific version tag like :v1.0.0
```

### Environment Variables

The Celery worker shares many environment variables with the backend service, especially for database and Redis connections, and any application settings that tasks might need. Refer to `backend/production.env.example` in the [source repository](https://github.com/mnaimfaizy/fastapi_rbac/blob/main/backend/production.env.example).

**Key variables for the worker:**

- **Database Connection:**
  - `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`
- **Redis Connection (for Celery Broker & Backend):**
  - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
  - `CELERY_BROKER_URL` (e.g., `redis://localhost:6379/0`) - Can often be constructed from `REDIS_HOST`, etc.
  - `CELERY_RESULT_BACKEND` (e.g., `redis://localhost:6379/0`)
- **Email (if tasks send emails):**
  - `EMAILS_ENABLED`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS`
  - `EMAILS_FROM_EMAIL`, `EMAILS_FROM_NAME`
- **Other application settings** that your tasks might depend on.

### Exposed Ports

The Celery worker itself does not typically expose ports for direct external access. If you run Flower (a Celery monitoring tool), it would expose its own port (e.g., 5555), but the base worker image does not.

## Further Documentation

For more detailed information on the project setup, background tasks, and architecture, please refer to the main [README.md](https://github.com/mnaimfaizy/fastapi_rbac/blob/main/README.md) and other documentation in the source code repository.
