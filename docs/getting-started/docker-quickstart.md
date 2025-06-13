# FastAPI RBAC Docker Environment Quick Start Guide

This guide helps you quickly get started with the different Docker environments for the FastAPI RBAC project.

## Prerequisites

- Docker Desktop installed and running
- PowerShell (Windows) or Bash (Linux/macOS)
- Git repository cloned

## Quick Commands

### Using the Management Script (Recommended)

#### Windows (PowerShell)

```powershell
# Start development environment
.\scripts\docker\manage-environments.ps1 -Environment dev -Action up -Detached

# Start testing environment
.\scripts\docker\manage-environments.ps1 -Environment test -Action up -Detached

# Start production testing environment
.\scripts\docker\manage-environments.ps1 -Environment prod-test -Action up -Detached

# View status of any environment
.\scripts\docker\manage-environments.ps1 -Environment dev -Action status

# View logs
.\scripts\docker\manage-environments.ps1 -Environment dev -Action logs

# Stop environment
.\scripts\docker\manage-environments.ps1 -Environment dev -Action down

# Clean up environment (removes containers, volumes, images)
.\scripts\docker\manage-environments.ps1 -Environment dev -Action clean
```

#### Linux/macOS (Bash)

```bash
# Start development environment
./scripts/docker/manage-environments.sh dev up -d

# Start testing environment
./scripts/docker/manage-environments.sh test up -d

# Start production testing environment
./scripts/docker/manage-environments.sh prod-test up -d

# View status of any environment
./scripts/docker/manage-environments.sh dev status

# View logs
./scripts/docker/manage-environments.sh dev logs

# Stop environment
./scripts/docker/manage-environments.sh dev down

# Clean up environment
./scripts/docker/manage-environments.sh dev clean
```

### Manual Docker Compose Commands

#### Development Environment

```bash
# Create network
docker network create fastapi_rbac_dev_network

# Start services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

#### Testing Environment

```bash
# Create network
docker network create fastapi_rbac_test_network

# Start services
docker-compose -f docker-compose.dev.yml up -d

# Stop services
docker-compose -f docker-compose.dev.yml down
```

#### Production Testing Environment

```bash
# Start services
docker-compose -f docker-compose.prod-test.yml up -d

# Stop services
docker-compose -f docker-compose.prod-test.yml down
```

## Environment Access URLs

### Development Environment

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **PgAdmin**: http://localhost:8080 (admin@example.com / admin)
- **MailHog Web UI**: http://localhost:8025
- **Flower (Celery)**: http://localhost:5555
- **PostgreSQL**: localhost:5433

### Testing Environment

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8002
- **API Documentation**: http://localhost:8002/docs
- **MailHog Web UI**: http://localhost:8027
- **Flower (Celery)**: http://localhost:5556
- **PostgreSQL**: localhost:5435

### Production Testing Environment

- **Frontend**: http://localhost:81
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs
- **PgAdmin**: http://localhost:8081 (admin@example.com / admin)
- **MailHog Web UI**: http://localhost:8026
- **PostgreSQL**: localhost:5434

## Common Tasks

### First Time Setup

1. Clone the repository
2. Navigate to the project root
3. Create the development network:
   ```bash
   docker network create fastapi_rbac_dev_network
   ```
4. Start the development environment:
   ```powershell
   .\scripts\docker\manage-environments.ps1 -Environment dev -Action up -Build -Detached
   ```

### Switching Between Environments

```powershell
# Stop current environment
.\scripts\docker\manage-environments.ps1 -Environment dev -Action down

# Start different environment
.\scripts\docker\manage-environments.ps1 -Environment test -Action up -Detached
```

### Database Operations

```powershell
# Access PostgreSQL in development
docker exec -it fastapi_rbac_db_dev psql -U postgres -d fastapi_dev_db

# Access PostgreSQL in testing
docker exec -it fastapi_rbac_db_test psql -U postgres -d fastapi_test_db

# Run migrations in development
docker exec -it fastapi_rbac_dev alembic upgrade head

# Run migrations in testing
docker exec -it fastapi_rbac_test alembic upgrade head
```

### Viewing Logs

```powershell
# All services in development
.\scripts\docker\manage-environments.ps1 -Environment dev -Action logs

# Specific service
docker logs fastapi_rbac_dev -f

# Backend only
docker-compose -f docker-compose.dev.yml logs fastapi_rbac_dev -f
```

### Development Workflow

1. Start development environment:
   ```powershell
   .\scripts\docker\manage-environments.ps1 -Environment dev -Action up -Detached
   ```
2. Make code changes (hot-reload enabled)
3. Test your changes at http://localhost:3000
4. View API docs at http://localhost:8000/docs
5. Check emails at http://localhost:8025 (MailHog)
6. Monitor tasks at http://localhost:5555 (Flower)

### Testing Workflow

1. Start testing environment:
   ```powershell
   .\scripts\docker\manage-environments.ps1 -Environment test -Action up -Detached
   ```
2. Run tests:
   ```bash
   docker exec -it fastapi_rbac_test pytest
   ```
3. Check test results and coverage

### Production Testing Workflow

1. Start production testing environment:
   ```powershell
   .\scripts\docker\manage-environments.ps1 -Environment prod-test -Action up -Detached
   ```
2. Test production-like configuration
3. Verify security settings
4. Performance testing

## Troubleshooting

### Port Conflicts

Check which ports are in use:

```powershell
netstat -an | findstr :8000
```

Stop conflicting services or use different ports.

### Network Issues

List Docker networks:

```bash
docker network ls
```

Recreate network if needed:

```bash
docker network rm fastapi_rbac_dev_network
docker network create fastapi_rbac_dev_network
```

### Volume Issues

List volumes:

```bash
docker volume ls | findstr fastapi_rbac
```

Remove specific volumes:

```bash
docker volume rm fastapi_rbac_db_dev_data
```

### Container Issues

Check container status:

```bash
docker ps -a
```

View container logs:

```bash
docker logs <container-name>
```

### Environment Variable Issues

Check environment variables in container:

```bash
docker exec -it fastapi_rbac_dev env | grep DATABASE
```

### Clean Start

If you encounter issues, clean everything and start fresh:

```powershell
# Clean development environment
.\scripts\docker\manage-environments.ps1 -Environment dev -Action clean

# Clean all Docker resources (CAUTION: This affects all Docker containers/volumes)
docker system prune -a --volumes
```

## Performance Tips

1. **Use BuildKit** for faster builds:

   ```bash
   $env:DOCKER_BUILDKIT = "1"
   ```

2. **Allocate more resources** to Docker Desktop:

   - Go to Settings > Resources
   - Increase CPU and Memory allocation

3. **Use volumes for dependencies**:
   - Node modules and Python packages are cached in volumes
   - Faster subsequent builds

## Security Notes

- Development environment uses relaxed security settings
- Production testing environment uses production-like security
- Never use development credentials in production
- Regularly update dependencies and base images

## Next Steps

1. Read the full [Environment Separation Guide](../docs/deployment/docker-environment-separation.md)
2. Check out the [Development Guide](../docs/development/)
3. Review the [API Documentation](../docs/reference/)

For issues or questions, check the [Troubleshooting Guide](../docs/troubleshooting/) or create an issue on GitHub.
