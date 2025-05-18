# FastAPI RBAC Frontend

This Docker image contains the React frontend for the FastAPI RBAC (Role-Based Access Control) project. It provides the user interface for interacting with the backend API. The production build is served using Nginx.

**Project Source Code:** [https://github.com/mnaimfaizy/fastapi_rbac](https://github.com/mnaimfaizy/fastapi_rbac)

## Features

- User login, registration, and password reset.
- Dashboard for authenticated users.
- Interfaces for managing users, roles, and permissions (depending on user's role).
- Profile management.
- Built with React, TypeScript, Redux, and ShadCN UI components.

## Available Tags

- `latest`: The latest build from the `main` branch.
- `vX.Y.Z` (e.g., `v1.0.0`): Stable release versions.
- `vX.Y.Z-beta.N` (e.g., `v0.1.0-beta.1`): Pre-release versions.

Refer to the [GitHub repository tags](https://github.com/mnaimfaizy/fastapi_rbac/tags) for a full list of available version tags.

## How to Use This Image

### Prerequisites

- The FastAPI RBAC Backend service must be running and accessible to the frontend.

### Running the Container

The frontend needs to know the URL of the backend API. This is typically configured at runtime or build time. The provided Dockerfile for production (`react-frontend/Dockerfile.prod`) bakes in the API URL during the build process using an Nginx configuration.

**To run with a backend accessible at `http://localhost:8000` (default if backend is on same Docker network):**

```bash
# Example:
docker run -d \
  --name rbac_frontend \
  -p 5173:80 \ # Maps host port 5173 to container port 80 (Nginx default)
  # The VITE_API_BASE_URL is usually set during the build stage for the Nginx config.
  # If you need to override Nginx config for a different API URL at runtime,
  # you might need a more complex setup or a custom entrypoint script.
  mnaimfaizy/fastapi-rbac-frontend:latest # Or a specific version tag like :v1.0.0
```

### Environment Variables (Build-time for Nginx)

The primary configuration for the frontend is the backend API URL.

- `VITE_API_BASE_URL`: This environment variable is used during the `docker build` process (see `react-frontend/Dockerfile.prod`) to configure the Nginx reverse proxy and ensure the frontend application knows where to send API requests.
  - When building the image, this variable is typically passed as a build argument. The GitHub Actions workflow handles this by using the default value in the `.env` or by allowing overrides.
  - The default in `react-frontend/.env.example` is usually `http://localhost:8000/api/v1`.

If you are running the backend on a different host or port, you would need to rebuild the image with the correct `VITE_API_BASE_URL` build argument, or use a more dynamic Nginx configuration.

### Exposed Ports

- **80:** The Nginx server inside the container listens on port 80 by default.

## Further Documentation

For more detailed information on the project setup, features, and architecture, please refer to the main [README.md](https://github.com/mnaimfaizy/fastapi_rbac/blob/main/README.md) and other documentation in the source code repository.
