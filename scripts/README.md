# Scripts Directory

This directory contains utility scripts for development, testing, and deployment operations.

## 📁 Script Organization

### Development Scripts (`development/`)

Scripts for local development environment:

- `setup-dev-environment.ps1` - Complete development environment setup
- `code-quality/manage-code-quality.ps1` - Code formatting, linting, and import fixing
- `database/create-databases.sql` - Database creation scripts

### Docker Scripts (`docker/`)

Docker environment management:

#### Production Scripts

- `build-production-images.ps1` - Build production Docker images for all services
- `validate-production-images.ps1` - Validate production images functionality

#### Environment Management (`environments/`)

- `manage-environments.ps1` - Main environment manager (test, dev, prod)
- `build-images.ps1` - Build Docker images for all services
- `cleanup-environments.ps1` - Environment cleanup operations

#### Testing & Validation (`testing/`)

- `test-environment.ps1` - Comprehensive environment testing suite
- `connectivity-test.ps1` - Service connectivity testing

#### Troubleshooting (`troubleshooting/`)

- `diagnose-cors.ps1` - CORS configuration diagnostics
- `test-cors-setup.ps1` - CORS testing utilities

### Deployment Scripts (`deployment/production/`)

Production deployment and release scripts:

- `build-and-push.ps1` - Build and push images to registries
- `test-deployment.ps1` - Test production deployment
- `test-setup.ps1` - Production setup testing

### Maintenance Scripts (`maintenance/`)

System maintenance and cleanup:

- `cleanup-artifacts.ps1` - Clean build artifacts, cache, logs

## 🔗 Related Script Locations

### Backend Scripts (`backend/scripts/`)

Backend-specific scripts remain in the backend directory:

- Development and testing utilities
- Database management scripts
- Service-specific operations
- Backend build and deployment helpers

### Frontend Scripts

Frontend build and development scripts are managed through npm/package.json in `react-frontend/`

## 🖥️ Platform Support

Scripts are primarily provided as PowerShell (`.ps1`) files optimized for Windows development:

- **Windows users**: Use `.ps1` scripts with PowerShell
- **Cross-platform**: PowerShell Core works on Linux/macOS
- **CI/CD Integration**: Linux shell (`.sh`) versions available for key scripts
- **Backend-specific**: See `backend/scripts/` for backend service scripts
- **Docker**: Most operations use Docker containers for cross-platform compatibility

## 🔄 GitHub Actions Integration

The organized scripts are integrated with GitHub Actions workflows:

- **Docker Publish**: Uses `scripts/deployment/production/build-and-push.sh` for automated image builds
- **Code Quality**: Shell versions available for CI code quality checks
- **Consistency**: Same scripts work in both local development and CI environments

**Key CI Scripts:**

- `deployment/production/build-and-push.sh` - Linux version for Docker image publishing
- `development/code-quality/manage-code-quality.sh` - Linux version for code quality checks

## 🚀 Common Operations

### First-time Setup

```powershell
# Set up complete development environment
.\scripts\development\setup-dev-environment.ps1
```

### Test Environment Validation

```powershell
# Run comprehensive environment tests
.\scripts\docker\testing\test-environment.ps1

# Test specific connectivity
.\scripts\docker\testing\connectivity-test.ps1
```

### Code Quality Management

```powershell
# Format, lint, and fix imports for all code
.\scripts\development\code-quality\manage-code-quality.ps1

# Format only
.\scripts\development\code-quality\manage-code-quality.ps1 -Format

# Lint only
.\scripts\development\code-quality\manage-code-quality.ps1 -Lint
```

### Docker Environment Management

```powershell
# Manage Docker environments (build, start, stop, cleanup)
.\scripts\docker\environments\manage-environments.ps1

# Build all Docker images
.\scripts\docker\environments\build-images.ps1
```

### Production Docker Operations

```powershell
# Build production Docker images for all services
.\scripts\docker\build-production-images.ps1

# Build with no cache
.\scripts\docker\build-production-images.ps1 -NoCache

# Build and push to registry
.\scripts\docker\build-production-images.ps1 -Push -Registry "your-registry.com"

# Build with custom tag
.\scripts\docker\build-production-images.ps1 -Tag "v1.0.0"

# Validate production images
.\scripts\docker\validate-production-images.ps1

# Validate with verbose output
.\scripts\docker\validate-production-images.ps1 -Verbose

# Validate and keep containers running for inspection
.\scripts\docker\validate-production-images.ps1 -KeepRunning
```

### Production Deployment

```powershell
# Build and push to registries
.\scripts\deployment\production\build-and-push.ps1

# Test production deployment
.\scripts\deployment\production\test-deployment.ps1
```

### System Maintenance

```powershell
# Clean up artifacts, caches, and logs
.\scripts\maintenance\cleanup-artifacts.ps1
```

## 📋 Script Conventions

- All scripts include help documentation at the top
- Scripts validate prerequisites before running
- Error handling provides clear feedback
- Scripts are idempotent where possible
- Dangerous operations require confirmation

## 🔧 Adding New Scripts

When adding new scripts:

1. Place in the appropriate category folder
2. Provide both PowerShell and Bash versions if possible
3. Include help text and usage examples
4. Add error handling and validation
5. Update this README with the new script
