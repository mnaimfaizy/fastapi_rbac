# Production Deployment Guide

This guide provides instructions for deploying the FastAPI RBAC project to a production environment.

## Prerequisites

- Docker and Docker Compose installed on the target server
- Git access to the repository
- SSL certificates for secure connections
- Domain name configuration

## Deployment Steps

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/fastapi-rbac.git
cd fastapi-rbac
```

### 2. Configure Environment Variables

Create a `.env.prod` file based on the provided template:

```bash
cp backend/production.env.example backend/.env.prod
```

Edit the file to set the appropriate values for your production environment:

```
# Database configuration
POSTGRES_SERVER=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=app

# JWT settings
SECRET_KEY=<your-secret-key>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS settings
BACKEND_CORS_ORIGINS=["https://yourdomain.com"]

# Server settings
SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# Redis settings
REDIS_HOST=redis
REDIS_PORT=6379
```

### 3. Build and Start Services

Use the production Docker Compose file to build and start the services:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Initialize the Database

Run database migrations and initial data setup:

```bash
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
docker-compose -f docker-compose.prod.yml exec backend python app/initial_data.py
```

### 5. Configure Nginx Reverse Proxy

Set up an Nginx reverse proxy to handle SSL termination and routing:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6. Verify Deployment

- Check that all services are running: `docker-compose -f docker-compose.prod.yml ps`
- Verify API access: `curl https://yourdomain.com/api/v1/health`
- Access the frontend through your domain

## Maintenance

### Backups

Set up regular database backups:

```bash
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres app > backup_$(date +%Y%m%d).sql
```

### Updates

To update the application:

```bash
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Monitoring

Set up monitoring using Prometheus and Grafana or a similar solution to track:

- Server resource usage
- API response times
- Error rates
- Database performance

## Troubleshooting

For common production issues, see the [Troubleshooting Guide](../troubleshooting/common-issues.md).
