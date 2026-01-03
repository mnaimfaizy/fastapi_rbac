# Redis SSL/TLS Setup for Production

This document provides comprehensive guidance on configuring and managing Redis SSL/TLS connections for the FastAPI RBAC application in production environments.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Certificate Generation](#certificate-generation)
4. [Configuration](#configuration)
5. [Docker Deployment](#docker-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Security Best Practices](#security-best-practices)
8. [Migration Guide](#migration-guide)

## Overview

The FastAPI RBAC application uses Redis for:
- Session management and token storage
- Caching via FastAPI-Cache
- Rate limiting via FastAPI-Limiter
- Celery message broker and result backend

In production, all Redis connections **must** use SSL/TLS to ensure:
- Encryption of data in transit
- Authentication of the Redis server
- Protection against man-in-the-middle attacks

## Architecture

### Connection Management

The application uses a centralized Redis connection management system through `RedisConnectionFactory`:

**Key Features:**
- Connection pooling with configurable size
- SSL/TLS with certificate validation
- Retry logic with exponential backoff
- Health checks and monitoring
- Automatic environment-based configuration

### SSL/TLS Components

1. **Certificate Authority (CA)**: Self-signed CA for signing Redis certificates
2. **Redis Server Certificate**: Signed by the CA, includes SANs for all hostnames
3. **SSL Context**: Configured with:
   - TLS 1.2+ only
   - Strong cipher suites
   - Hostname verification
   - Certificate validation

## Certificate Generation

### Prerequisites

- OpenSSL installed
- Bash shell (Linux/macOS) or PowerShell (Windows)
- Write access to `backend/certs/` directory

### Generate Certificates

**Linux/macOS:**
```bash
cd backend/certs
./generate-certs.sh
```

**Windows (PowerShell):**
```powershell
cd backend\certs
.\generate-certs.ps1
```

### Generated Files

After running the script, you'll have:

```
backend/certs/
├── ca.crt          # CA certificate (public)
├── ca.key          # CA private key (keep secure!)
├── redis.crt       # Redis server certificate (public)
├── redis.key       # Redis server private key (keep secure!)
└── redis_cert.cnf  # Certificate configuration
```

### Certificate Configuration

The `redis_cert.cnf` file configures Subject Alternative Names (SANs):

```ini
[alt_names]
DNS.1 = fastapi_rbac_redis_prod    # Production container name
DNS.2 = fastapi_rbac_redis          # Generic container name
DNS.3 = localhost                   # For local testing
```

**Important:** If you use different hostnames, update the SANs in `redis_cert.cnf` before generating certificates.

## Configuration

### Environment Variables

Set these in your `.env.production` file:

```bash
# Redis Configuration
REDIS_HOST=fastapi_rbac_redis_prod
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password_here
REDIS_SSL=true

# Certificate Path (optional, defaults to /app/certs)
REDIS_CERT_PATH=/app/certs

# SSL Hostname Verification (optional, defaults to true in production)
REDIS_SSL_CHECK_HOSTNAME=true
```

### Application Mode

The application automatically configures SSL based on the `MODE` environment variable:

- **development**: No SSL, plain Redis connections
- **testing**: SSL optional (controlled by `REDIS_SSL` env var)
- **production**: SSL required with certificate validation

### Connection Parameters

The `RedisConnectionFactory` automatically configures:

```python
# Production SSL settings
{
    "ssl": True,
    "ssl_context": ssl_context,  # With CA validation
    "socket_connect_timeout": 5,
    "socket_timeout": 5,
    "socket_keepalive": True,
    "health_check_interval": 30,
    "retry": Retry(ExponentialBackoff(base=0.1, cap=2.0), retries=3),
    "max_connections": 50,
}
```

## Docker Deployment

### Docker Compose Configuration

The `docker-compose.prod.yml` configures Redis with SSL:

```yaml
fastapi_rbac_redis_prod:
  image: redis:7.2.5-alpine
  command: >
    redis-server
    --tls-port 6379
    --port 0
    --tls-cert-file /certs/redis.crt
    --tls-key-file /certs/redis.key
    --tls-ca-cert-file /certs/ca.crt
    --tls-auth-clients optional
    --requirepass ${REDIS_PASSWORD}
    --appendonly yes
  volumes:
    - ./certs:/certs:ro
    - ./redis-data:/data
```

## Troubleshooting

### Connection Refused

**Symptom:** Application can't connect to Redis

**Checks:**
1. Verify Redis is running: `docker ps | grep redis`
2. Check Redis logs: `docker logs fastapi_rbac_redis_prod`
3. Verify port is correct: `6379`

### SSL Certificate Errors

**Symptom:** `ssl.SSLError: [SSL: CERTIFICATE_VERIFY_FAILED]`

**Checks:**
1. Verify CA certificate exists: `ls backend/certs/ca.crt`
2. Check certificate expiry: `openssl x509 -in backend/certs/redis.crt -noout -dates`
3. Verify SANs: `openssl x509 -in backend/certs/redis.crt -noout -text | grep DNS`

**Solution:**
```bash
cd backend/certs
./generate-certs.sh
docker-compose -f docker-compose.prod.yml restart
```

### Hostname Verification Failed

**Symptom:** `ssl.CertificateError: hostname 'X' doesn't match 'Y'`

**Solution:**
1. Add hostname to `redis_cert.cnf` under `[alt_names]`
2. Regenerate certificate
3. Restart containers

## Security Best Practices

### 1. Certificate Security

- **Never commit private keys** to version control
- Store certificates in secure secrets management
- Use Docker secrets for certificate distribution
- Rotate certificates every 90 days

### 2. Password Management

- Use strong, randomly generated passwords (32+ characters)
- Store passwords in environment variables or secrets manager
- Rotate Redis password periodically

### 3. Network Security

- Use Docker networks to isolate Redis
- Don't expose Redis port to host in production
- Consider using mutual TLS (mTLS)

### 4. Monitoring

- Enable Redis slow log
- Monitor connection metrics
- Set up alerts for authentication failures
- Track certificate expiration dates

## Migration Guide

### From Non-SSL to SSL

#### Step 1: Generate Certificates

```bash
cd backend/certs
./generate-certs.sh
```

#### Step 2: Update Environment

```bash
# .env.production
REDIS_SSL=true
REDIS_PASSWORD=your_secure_password
```

#### Step 3: Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d
```

#### Step 4: Verify

```bash
# Test Redis connection
docker exec fastapi_rbac_redis_prod redis-cli \
  --tls --cacert /certs/ca.crt -a $REDIS_PASSWORD ping

# Test application health
curl http://localhost:8000/api/v1/health
```

## Testing SSL Connection

### Manual Testing

```bash
docker exec fastapi_rbac_redis_prod redis-cli \
  --tls \
  --cacert /certs/ca.crt \
  -a $REDIS_PASSWORD \
  ping
```

### Python Testing

```python
import asyncio
from app.utils.redis_connection import RedisConnectionFactory

async def test_redis():
    client = await RedisConnectionFactory.get_client()
    result = await client.ping()
    print(f"Redis ping: {result}")
    await RedisConnectionFactory.close_pool()

asyncio.run(test_redis())
```

## Additional Resources

- [Redis TLS Documentation](https://redis.io/docs/interact/connection-ssl/)
- [redis-py SSL Support](https://redis-py.readthedocs.io/en/stable/examples/ssl_connection_examples.html)
- [Celery Redis SSL](https://docs.celeryq.dev/en/stable/userguide/configuration.html#broker-use-ssl)
