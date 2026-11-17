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

# Signing and encryption keys. Production refuses to start unless all five are
# set, 32+ characters and distinct. Run this once per key:
#   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
SECRET_KEY=
JWT_REFRESH_SECRET_KEY=
JWT_RESET_SECRET_KEY=
JWT_VERIFICATION_SECRET_KEY=
ENCRYPT_KEY=

# Token lifetimes
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=144000  # 100 days

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

In production (`MODE=production`) this creates the superuser
(`FIRST_SUPERUSER_EMAIL` with `FIRST_SUPERUSER_PASSWORD`) and the default
roles and permissions. It does not create the `manager@example.com` and
`user@example.com` demo accounts: development and testing seed those for local
sign-in, production does not. Create real accounts for your managers and users,
or use the [QA Accounts](../reference/qa-accounts.md) seeder on a local
database for fixture users.

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

The backend ignores `X-Forwarded-For` and `X-Real-IP` unless the peer that sent
them is a configured proxy (ADR 0011 decision 8, #203), so nginx setting them is
only half the job: set `TRUSTED_PROXIES` in `.env.production` to the proxy's
address or the network it reaches the backend from.

```env
# nginx on the same host, proxying to a published port
TRUSTED_PROXIES=["127.0.0.1","::1"]

# nginx in its own container on the compose bridge network
TRUSTED_PROXIES=["172.16.0.0/12"]
```

Until it is set, every request is attributed to the proxy: HTTP rate limiting
becomes one global bucket shared by every client, security events record the
proxy's address, and origin-network detection (`VALIDATE_TOKEN_IP`) has nothing
to compare. A wildcard is rejected at startup — trusting every peer would let any
client forge its own rate-limit bucket, origin network and audit-log identity in
a single request.

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

### Upgrading from v0.4.0-beta or earlier: retire the demo accounts

Releases up to v0.4.0-beta seeded two demo accounts in every mode, production
included: `manager@example.com` (Manager role) and `user@example.com` (User
role), both signing in with the `FIRST_SUPERUSER_PASSWORD` the database was
first seeded with. Later releases no longer seed them in production, but start-up
never changes users that already exist, so a database created by an earlier
release still holds them until you retire them.

Run this once, after the upgrade, in the API container:

```bash
# docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml exec backend python -m app.db.retire_demo_accounts
# Hub runtime (docs/deployment/hub-runtime)
./bootstrap.sh exec api python -m app.db.retire_demo_accounts
```

The command:

- runs only when `MODE=production`, and refuses otherwise, because development
  and tests sign in as these accounts;
- deactivates each demo account that exists, ends its sessions and revokes any
  pending verification or password-reset link;
- deletes nothing, so the accounts' audit history stays, and never touches a
  superuser;
- prints one line per address (`deactivated`, `already inactive`, `not present`
  or `skipped, it is a superuser`) and no password. Running it again changes
  nothing.

If you use either address as a real account, move that person to their own
account first. An administrator can later re-enable a deactivated account from
the user management screens, but give it a new password when you do.

### Monitoring

Set up monitoring using Prometheus and Grafana or a similar solution to track:

- Server resource usage
- API response times
- Error rates
- Database performance

## Troubleshooting

For common production issues, see the [Troubleshooting Guide](../troubleshooting/common-issues.md).
