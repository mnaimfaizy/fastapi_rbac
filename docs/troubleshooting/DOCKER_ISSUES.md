# Docker Issues & Solutions

This guide covers common Docker-related issues and their solutions for the FastAPI RBAC project.

## 🐳 Container Issues

### Containers Won't Start

**Symptoms:**

- `docker-compose up` fails
- Containers exit immediately
- Services show as "unhealthy"

**Solutions:**

1. **Check Docker Compose Configuration**

   ```powershell
   # Validate configuration syntax
   .\scripts\docker\validate-config.ps1 -Validate

   # Or manually:
   docker-compose -f docker-compose.prod-test.yml config
   ```

2. **Check Container Logs**

   ```powershell
   # Check specific service logs
   docker logs fastapi_rbac
   docker logs react_frontend
   docker logs postgres_db
   docker logs redis_db

   # Follow logs in real-time
   docker-compose logs -f
   ```

3. **Clean Up Old Containers**

   ```powershell
   # Remove all containers and volumes
   docker-compose down --volumes --remove-orphans

   # Remove unused images
   docker system prune -a
   ```

### Database Connection Issues

**Symptoms:**

- Backend can't connect to PostgreSQL
- "Connection refused" errors
- Database initialization failures

**Solutions:**

1. **Check Database Health**

   ```powershell
   # Verify PostgreSQL is running
   docker exec postgres_db pg_isready -U postgres

   # Check database logs
   docker logs postgres_db
   ```

2. **Verify Environment Variables**

   ```powershell
   # Check backend environment
   docker exec fastapi_rbac env | Select-String "DATABASE"
   ```

3. **Reset Database**

   ```powershell
   # Stop containers and remove database volume
   docker-compose down -v

   # Restart with fresh database
   docker-compose up -d
   ```

### Redis Connection Issues

**Symptoms:**

- "Redis connection failed" errors
- Token validation failures
- Celery worker issues

**Solutions:**

1. **Check Redis Health**

   ```powershell
   # Test Redis connection
   docker exec redis_db redis-cli ping

   # Check Redis logs
   docker logs redis_db
   ```

2. **Verify Redis Configuration**
   ```powershell
   # Check Redis environment variables
   docker exec fastapi_rbac env | Select-String "REDIS"
   ```

## 🔧 Build Issues

### Image Build Failures

**Symptoms:**

- `docker build` commands fail
- Missing dependencies
- Build context issues

**Solutions:**

1. **Clear Build Cache**

   ```powershell
   # Build without cache
   docker-compose build --no-cache

   # Or for specific service
   docker-compose build --no-cache fastapi_rbac
   ```

2. **Check Dockerfile Syntax**

   ```powershell
   # Lint Dockerfile (if you have hadolint installed)
   hadolint backend/Dockerfile.prod
   ```

3. **Verify Build Context**
   ```powershell
   # Ensure you're in the correct directory
   Get-Location
   # Should be in the root of fastapi_rbac project
   ```

### Dependency Installation Issues

**Symptoms:**

- Python packages fail to install
- Node modules installation errors
- Version conflicts

**Solutions:**

1. **Check Requirements Files**

   ```powershell
   # Verify Python requirements
   Get-Content backend/requirements.txt

   # Verify Node package.json
   Get-Content react-frontend/package.json
   ```

2. **Update Base Images**
   ```powershell
   # Pull latest base images
   docker pull python:3.10-slim
   docker pull node:18-alpine
   ```

## 🌐 Networking Issues

### Service Discovery Problems

**Symptoms:**

- Services can't communicate
- "Host not found" errors
- API calls timing out

**Solutions:**

1. **Check Docker Networks**

   ```powershell
   # List networks
   docker network ls

   # Inspect network configuration
   docker network inspect fastapi_rbac_default
   ```

2. **Verify Service Names**

   ```powershell
   # Services should use container names for communication
   # Backend: fastapi_rbac
   # Frontend: react_frontend
   # Database: postgres_db
   # Redis: redis_db
   ```

3. **Test Inter-Service Communication**

   ```powershell
   # Test from frontend to backend
   docker exec react_frontend curl http://fastapi_rbac:8000/api/v1/health

   # Test from backend to database
   docker exec fastapi_rbac pg_isready -h postgres_db -U postgres
   ```

### Port Binding Issues

**Symptoms:**

- "Port already in use" errors
- Can't access services from host
- Port conflicts

**Solutions:**

1. **Check Port Usage**

   ```powershell
   # Check what's using ports
   netstat -ano | Select-String ":8000"
   netstat -ano | Select-String ":80"
   netstat -ano | Select-String ":5432"
   ```

2. **Change Port Mappings**
   ```yaml
   # In docker-compose.yml, change port mappings
   services:
     fastapi_rbac:
       ports:
         - "8001:8000" # Use different host port
   ```

## 📊 Performance Issues

### Slow Container Startup

**Symptoms:**

- Containers take long time to start
- Health checks timing out
- Slow response times

**Solutions:**

1. **Increase Health Check Timeouts**

   ```yaml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
     interval: 30s
     timeout: 10s
     retries: 5
     start_period: 60s # Increase this
   ```

2. **Optimize Docker Images**

   ```dockerfile
   # Use multi-stage builds
   # Minimize layers
   # Use .dockerignore files
   ```

3. **Allocate More Resources**
   ```powershell
   # In Docker Desktop, increase:
   # - Memory limit
   # - CPU cores
   # - Disk space
   ```

### High Memory Usage

**Symptoms:**

- Containers consuming excessive memory
- System becomes slow
- Out of memory errors

**Solutions:**

1. **Monitor Resource Usage**

   ```powershell
   # Check container resource usage
   docker stats

   # Check specific container
   docker stats fastapi_rbac
   ```

2. **Set Memory Limits**
   ```yaml
   services:
     fastapi_rbac:
       deploy:
         resources:
           limits:
             memory: 512M
   ```

## 🔍 Debugging Tools

### Useful Docker Commands

```powershell
# Container inspection
docker inspect fastapi_rbac

# Execute commands in container
docker exec -it fastapi_rbac bash

# Copy files from container
docker cp fastapi_rbac:/app/logs/app.log ./logs/

# Check container processes
docker exec fastapi_rbac ps aux

# Monitor container resources
docker stats --no-stream

# View container filesystem changes
docker diff fastapi_rbac
```

### Environment Debugging

```powershell
# Check all environment variables in container
docker exec fastapi_rbac env

# Check specific variables
docker exec fastapi_rbac printenv DATABASE_URL

# Verify file permissions
docker exec fastapi_rbac ls -la /app/

# Check mounted volumes
docker exec fastapi_rbac df -h
```

## 🚨 Emergency Procedures

### Complete Reset

If everything is broken and you need to start fresh:

```powershell
# WARNING: This will delete all data!

# Stop all containers
docker-compose down --volumes --remove-orphans

# Remove all images
docker rmi $(docker images -q fastapi_rbac*)

# Clean up system
docker system prune -a --volumes

# Rebuild everything
docker-compose build --no-cache
docker-compose up -d
```

### Backup and Restore

```powershell
# Backup database
docker exec postgres_db pg_dump -U postgres fastapi_rbac_db > backup.sql

# Restore database
docker exec -i postgres_db psql -U postgres fastapi_rbac_db < backup.sql

# Backup volumes
docker run --rm -v fastapi_rbac_postgres_data:/data -v ${PWD}:/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

## 📞 Getting Help

1. **Check container logs first**: `docker logs <container_name>`
2. **Verify configuration**: Use validation scripts in `scripts/docker/`
3. **Test connectivity**: Use diagnostic scripts
4. **Reset if needed**: Follow emergency procedures
5. **Ask for help**: Provide logs and error messages when reporting issues

Remember: Most Docker issues are related to configuration, networking, or resource constraints. Start with the basics and work your way up!
