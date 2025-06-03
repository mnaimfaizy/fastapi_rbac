# Scripts Directory

This directory contains utility scripts for development, testing, and deployment operations.

## 📁 Script Organization

### Development Scripts (`dev/`)
Scripts for local development and testing:
- `setup-dev-env.ps1` - Initial development environment setup
- `run-tests.ps1` - Run test suites
- `clean-dev.ps1` - Clean development artifacts

### Docker Scripts (`docker/`)
Docker-related operations:
- `build-images.ps1` - Build Docker images for all services
- `test-production.ps1` - Test production Docker setup locally
- `validate-config.ps1` - Validate Docker configuration
- `diagnose-cors.ps1` - Diagnose CORS issues in containers

### Deployment Scripts (`deployment/`)
Production deployment and release scripts:
- `push-to-dockerhub.ps1` - Build and push images to Docker Hub
- `deploy-production.ps1` - Deploy to production environment
- `backup-database.ps1` - Create database backups

### Database Scripts (`database/`)
Database management scripts:
- `create-dbs.sql` - Initial database creation
- `migrate-db.ps1` - Run database migrations
- `seed-data.ps1` - Load initial/test data

## 🖥️ Platform Support

Most scripts are provided in both PowerShell (`.ps1`) and Bash (`.sh`) versions:
- **Windows users**: Use `.ps1` scripts with PowerShell
- **Linux/macOS users**: Use `.sh` scripts with Bash

## 🚀 Common Operations

### First-time Setup
```powershell
# Windows
.\scripts\dev\setup-dev-env.ps1

# Linux/macOS
./scripts/dev/setup-dev-env.sh
```

### Test Production Setup Locally
```powershell
# Windows
.\scripts\docker\test-production.ps1

# Linux/macOS
./scripts/docker/test-production.sh
```

### Deploy New Release
```powershell
# Windows
.\scripts\deployment\push-to-dockerhub.ps1 v1.2.0

# Linux/macOS
./scripts/deployment/push-to-dockerhub.sh v1.2.0
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
