# Docker Scripts

This directory contains Docker-related scripts for building, testing, and managing containerized environments.

## 📁 Directory Structure

```
docker/
├── build-production-images.ps1       # Build production Docker images
├── validate-production-images.ps1    # Validate production image functionality
├── environments/                     # Environment management scripts
│   ├── build-images.ps1             # Build test/dev images
│   ├── manage-environments.ps1      # Environment lifecycle management
│   └── cleanup-environments.ps1     # Environment cleanup
├── testing/                         # Testing and validation scripts
│   ├── test-environment.ps1         # Comprehensive environment testing
│   └── connectivity-test.ps1        # Service connectivity testing
└── troubleshooting/                 # Debugging and diagnostics
    ├── diagnose-cors.ps1            # CORS configuration diagnostics
    └── test-cors-setup.ps1          # CORS testing utilities
```

## 🏗️ Production Image Management

### Building Production Images

The `build-production-images.ps1` script builds optimized production Docker images for all services:

**Basic Usage:**

```powershell
# Build all production images
.\build-production-images.ps1

# Build with no cache (clean build)
.\build-production-images.ps1 -NoCache

# Build and clean up existing images first
.\build-production-images.ps1 -CleanFirst

# Verbose output for debugging
.\build-production-images.ps1 -Verbose
```

**Advanced Usage:**

```powershell
# Build with custom tag
.\build-production-images.ps1 -Tag "v1.2.0"

# Build and push to registry
.\build-production-images.ps1 -Push -Registry "your-registry.com"

# Combined options
.\build-production-images.ps1 -NoCache -CleanFirst -Tag "latest" -Push -Registry "docker.io/yourorg"
```

**Built Images:**

- `fastapi_rbac:prod` (608MB) - Backend API service
- `fastapi_rbac_worker:prod` (590MB) - Celery worker service
- `react_frontend:prod` (58MB) - React frontend service

**Auto-Generated Tags:**

- `:prod` - Main production tag
- `:prod-test` - For production testing environment
- `:custom-tag` - When using `-Tag` parameter

### Validating Production Images

The `validate-production-images.ps1` script ensures production images work correctly:

**Basic Validation:**

```powershell
# Validate all production images
.\validate-production-images.ps1

# Detailed validation output
.\validate-production-images.ps1 -Verbose

# Keep test containers running for inspection
.\validate-production-images.ps1 -KeepRunning
```

**Validation Tests:**

- ✅ Image existence check
- ✅ Container startup test
- ✅ Basic functionality validation
- ✅ Environment variable handling
- ✅ Port exposure verification

**Expected Results:**

```
🔍 Production Images Validation
===============================

🔍 Checking if production images exist...
✅ Image exists: fastapi_rbac:prod
✅ Image exists: fastapi_rbac_worker:prod
✅ Image exists: react_frontend:prod

🧪 Testing production images...
✅ Backend API: Container starts and runs Python code
✅ Celery Worker: Container starts and runs worker processes
✅ React Frontend: Container starts and serves static files

🎉 All production images validated successfully!
```

## 🔧 Environment Management

### Environment Scripts (`environments/`)

**manage-environments.ps1** - Complete environment lifecycle management:

```powershell
# Build and start test environment
.\environments\manage-environments.ps1 -Environment test -Action up

# Stop and clean development environment
.\environments\manage-environments.ps1 -Environment dev -Action down

# Check environment status
.\environments\manage-environments.ps1 -Environment test -Action status
```

**build-images.ps1** - Build development/test images:

```powershell
# Build all test images
.\environments\build-images.ps1

# Build with no cache
.\environments\build-images.ps1 -NoCache

# Clean before building
.\environments\build-images.ps1 -CleanFirst
```

## 🧪 Testing Scripts (`testing/`)

**test-environment.ps1** - Comprehensive testing suite:

```powershell
# Full environment test
.\testing\test-environment.ps1

# Test specific environment
.\testing\test-environment.ps1 -Environment test

# Quick connectivity test only
.\testing\test-environment.ps1 -QuickTest
```

**connectivity-test.ps1** - Service connectivity validation:

```powershell
# Test all service connectivity
.\testing\connectivity-test.ps1

# Test specific services
.\testing\connectivity-test.ps1 -Services @("fastapi", "redis")
```

## 🔍 Troubleshooting Scripts (`troubleshooting/`)

**diagnose-cors.ps1** - CORS configuration diagnostics:

```powershell
# Diagnose CORS issues
.\troubleshooting\diagnose-cors.ps1

# Test specific origin
.\troubleshooting\diagnose-cors.ps1 -Origin "http://localhost:3000"
```

## 📊 Image Size Optimization

The production images are optimized for size and security:

| Image                      | Size  | Optimization                          |
| -------------------------- | ----- | ------------------------------------- |
| `react_frontend:prod`      | 58MB  | Multi-stage build, Nginx Alpine       |
| `fastapi_rbac_worker:prod` | 590MB | Python slim, minimal dependencies     |
| `fastapi_rbac:prod`        | 608MB | Python slim, production packages only |

**Total Production Footprint:** ~1.25GB

## 🔒 Security Features

Production images include:

- Multi-stage builds (no dev tools in final image)
- Non-root user execution
- Minimal base images (Alpine/Slim)
- No secrets in image layers
- Health check implementations
- Proper signal handling

## 🚀 CI/CD Integration

These scripts integrate with GitHub Actions and other CI/CD systems:

```yaml
# Example GitHub Actions usage
- name: Build Production Images
  run: |
    .\scripts\docker\build-production-images.ps1 -Tag ${{ github.sha }}

- name: Validate Images
  run: |
    .\scripts\docker\validate-production-images.ps1 -Verbose

- name: Push to Registry
  run: |
    .\scripts\docker\build-production-images.ps1 -Push -Registry "ghcr.io/${{ github.repository }}"
```

## ⚠️ Prerequisites

Before using these scripts, ensure:

1. **Docker Desktop** is installed and running
2. **PowerShell 5.1+** or **PowerShell Core 7+**
3. **Git** for repository operations
4. **Network access** for base image pulls
5. **Sufficient disk space** (~5GB for all images and layers)

## 🔗 Related Documentation

- [Docker Build Summary](../../DOCKER_BUILD_SUMMARY.md) - Complete build results
- [Main Scripts README](../README.md) - All script categories
- [Backend Docker README](../../backend/README.dockerhub.md) - Backend-specific Docker info
- [Frontend Docker README](../../react-frontend/README.dockerhub.md) - Frontend-specific Docker info

## 🆘 Troubleshooting

### Common Issues

**Build Failures:**

```powershell
# Clean Docker system and retry
docker system prune -f
.\build-production-images.ps1 -CleanFirst -NoCache
```

**Network Conflicts:**

```powershell
# Remove conflicting networks
docker network prune -f
```

**Permission Issues:**

```powershell
# Check PowerShell execution policy
Get-ExecutionPolicy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Image Size Issues:**

```powershell
# Clean up intermediate images
docker image prune -f
```

### Getting Help

Each script includes built-in help:

```powershell
Get-Help .\build-production-images.ps1 -Full
Get-Help .\validate-production-images.ps1 -Examples
```
