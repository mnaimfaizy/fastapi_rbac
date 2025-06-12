# Docker Environment Separation Guide

This document explains the complete separation between local development and production testing environments for the FastAPI RBAC project.

## Environment Overview

The project now supports three distinct environments, each with complete isolation:

1. **Development Environment** (`dev`) - For local development with hot-reload
2. **Testing Environment** (`test`) - For integration testing and CI/CD
3. **Production Testing Environment** (`prod-test`) - For production-like testing

## Docker Image Naming Convention

### Backend Images
- **Development**: `fastapi_rbac:dev`, `fastapi_rbac_worker:dev`
- **Testing**: `fastapi_rbac:test`, `fastapi_rbac_worker:test`
- **Production**: `fastapi_rbac:prod`, `fastapi_rbac_worker:prod`
- **Production Testing**: `fastapi_rbac:prod-test`, `fastapi_rbac_worker:prod-test`

### Frontend Images
- **Development**: `react_frontend:dev`
- **Testing**: `react_frontend:test`
- **Production**: `react_frontend:prod`
- **Production Testing**: `react_frontend:prod-test`

## Container Naming Convention

### Development Environment
- `fastapi_rbac_dev`
- `fastapi_rbac_worker_dev`
- `fastapi_rbac_beat_dev`
- `fastapi_rbac_flower_dev`
- `fastapi_rbac_db_dev`
- `fastapi_rbac_redis_dev`
- `fastapi_rbac_pgadmin_dev`
- `mailhog_dev`
- `react_frontend_dev`

### Testing Environment
- `fastapi_rbac_test`
- `fastapi_rbac_worker_test`
- `fastapi_rbac_beat_test`
- `fastapi_rbac_flower_test`
- `fastapi_rbac_db_test`
- `fastapi_rbac_redis_test`
- `mailhog_test`
- `react_frontend_test`

### Production Environment
- `fastapi_rbac_prod`
- `fastapi_rbac_worker_prod`
- `fastapi_rbac_beat_prod`
- `fastapi_rbac_db_prod`
- `fastapi_rbac_redis_prod`
- `fastapi_rbac_pgadmin_prod`
- `react_frontend_prod`

### Production Testing Environment
- `fastapi_rbac_prod_test`
- `fastapi_rbac_worker_prod_test`
- `fastapi_rbac_beat_prod_test`
- `fastapi_rbac_db_prod_test`
- `fastapi_rbac_redis_prod_test`
- `fastapi_rbac_pgadmin_prod_test`
- `mailhog_prod_test`
- `react_frontend_prod_test`

## Port Separation

### Development Environment
- Backend API: `8000`
- Frontend: `3000` (Vite dev server on `5173`)
- PostgreSQL: `5433`
- Redis: `6379`
- PgAdmin: `8080`
- MailHog SMTP: `1025`, Web UI: `8025`
- Flower: `5555`

### Testing Environment
- Backend API: `8002`
- Frontend: `3001`
- PostgreSQL: `5435`
- Redis: `6381`
- MailHog SMTP: `1027`, Web UI: `8027`
- Flower: `5556`

### Production Testing Environment
- Backend API: `8001`
- Frontend: `81`
- PostgreSQL: `5434`
- Redis: `6380`
- PgAdmin: `8081`
- MailHog SMTP: `1026`, Web UI: `8026`

### Production Environment
- Backend API: `8000`
- Frontend: `80`
- PostgreSQL: `5432`
- Redis: `6379`
- PgAdmin: `5050`

## Network Separation

- **Development**: `fastapi_rbac_dev_network`
- **Testing**: `fastapi_rbac_test_network`
- **Production Testing**: `fastapi_rbac_prod_test_network`
- **Production**: `fastapi_rbac_network`

## Volume Separation

### Development Environment
- `fastapi_rbac_db_dev_data`
- `fastapi_rbac_redis_dev_data`
- `fastapi_rbac_pgadmin_dev_data`
- `fastapi_rbac_celery_beat_dev_schedule`

### Testing Environment
- `fastapi_rbac_db_test_data`
- `fastapi_rbac_redis_test_data`
- `fastapi_rbac_celery_beat_test_schedule`

### Production Testing Environment
- `fastapi_rbac_db_prod_test_data`
- `fastapi_rbac_redis_prod_test_data`
- `fastapi_rbac_pgadmin_prod_test_data`
- `fastapi_rbac_celery_beat_prod_test_data`

### Production Environment
- `fastapi_rbac_postgres_prod_data`
- `fastapi_rbac_redis_prod_data`
- `fastapi_rbac_pgadmin_prod_data`
- `fastapi_rbac_celery_beat_prod_data`

## Environment Files

### Backend Environment Files
- `.env.development` - Development configuration
- `.env.test` - Testing configuration
- `.env.production` - Production configuration
- `.env.example` - Template for environment variables

### Frontend Environment Files
- `.env.development` - Development configuration
- `.env.test` - Testing configuration
- `.env.production` - Production configuration
- `.env.example` - Template for environment variables

## Running Each Environment

### Development Environment
```bash
# Create development network
docker network create fastapi_rbac_dev_network

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Testing Environment
```bash
# Create testing network
docker network create fastapi_rbac_test_network

# Start testing environment
docker-compose -f docker-compose.yml up -d

# Run tests
docker-compose -f docker-compose.yml exec fastapi_rbac_test pytest
```

### Production Testing Environment
```bash
# Start production testing environment
docker-compose -f docker-compose.prod-test.yml up -d

# View logs
docker-compose -f docker-compose.prod-test.yml logs -f
```

### Production Environment
```bash
# Start production environment (individual service compose files)
docker-compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml up -d
```

## Key Configuration Differences

### Development Environment
- Hot-reload enabled
- Debug mode on
- Longer token expiration times
- More permissive CORS
- Detailed logging
- MailHog for email testing
- Single worker for debugging
- SQLite option available (configurable)

### Testing Environment
- Similar to development but with testing-specific settings
- Shorter timeouts for faster tests
- Test database isolation
- CI/CD optimized configurations

### Production Testing Environment
- Production-like settings
- Security configurations enabled
- Redis with TLS
- Multi-worker setup
- Production database settings
- Error tracking enabled

### Production Environment
- Maximum security settings
- Optimized performance configurations
- TLS encryption for Redis
- Production-grade logging
- Health checks enabled
- Resource limits applied

## Environment Variable Synchronization

All environment files are synchronized with:
- Backend configuration (`app/core/config.py`)
- Docker service names and ports
- Database connection strings
- Redis URLs
- CORS origins
- API base URLs

## Best Practices

1. **Never mix environments** - Each environment should be completely isolated
2. **Use different databases** - Each environment has its own database instance
3. **Separate networks** - No cross-environment network communication
4. **Different ports** - Avoid port conflicts when running multiple environments
5. **Environment-specific secrets** - Use different keys and passwords for each environment
6. **Proper cleanup** - Stop environments when not in use to save resources

## Troubleshooting

### Port Conflicts
If ports are already in use, check which environment is running:
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

### Network Issues
Ensure networks are created before starting services:
```bash
docker network ls | grep fastapi_rbac
```

### Volume Persistence
Check volume status:
```bash
docker volume ls | grep fastapi_rbac
```

### Environment Variable Issues
Verify environment file loading:
```bash
docker-compose -f <compose-file> config
```

This setup ensures complete separation between development and production testing environments, preventing any conflicts or data leakage between environments.
