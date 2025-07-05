# Environment Management Scripts

This directory contains scripts for managing, building, and cleaning up Docker environments for the FastAPI RBAC project.

## cleanup-environments.ps1

A comprehensive PowerShell script to clean up Docker resources for test, dev, and prod-test environments, or to perform a full Docker system prune.

### Usage

```powershell
# Clean test environment containers only (default)
./cleanup-environments.ps1

# Clean dev environment
./cleanup-environments.ps1 -Environment dev

# Full cleanup (containers, images, volumes)
./cleanup-environments.ps1 -IncludeImages -IncludeVolumes

# Clean everything with no prompts
./cleanup-environments.ps1 -Force

# Clean all environments completely
./cleanup-environments.ps1 -Environment all -Force

# Preview cleanup actions (dry run)
./cleanup-environments.ps1 -DryRun

# Perform a full Docker system prune (CAUTION: removes ALL Docker containers, images, volumes, networks, and build cache on this system)
./cleanup-environments.ps1 -GlobalPrune
```

### Parameters

- `-Environment` : Target environment to clean (`test`, `dev`, `prod-test`, `all`). Default: `test`.
- `-IncludeVolumes` : Also remove Docker volumes (data will be lost!).
- `-IncludeImages` : Also remove Docker images (will require rebuilding images).
- `-IncludeNetworks` : Also remove Docker networks.
- `-Force` : Skip confirmation prompts AND clean everything (containers, images, volumes, networks).
- `-DryRun` : Show what would be cleaned without making changes.
- `-ShowDetails` : Show detailed output during operations.
- `-Help` : Show help message.
- `-GlobalPrune` : Perform a full Docker system prune (all containers, images, volumes, networks, and build cache on this system; not limited to FastAPI RBAC resources).

### Warnings

- Using `-IncludeVolumes` or `-Force` will permanently delete database data!
- Using `-IncludeImages` or `-Force` will require rebuilding images next time.
- Using `-Force` cleans EVERYTHING (containers, images, volumes, networks) for the selected environment(s).
- Using `-GlobalPrune` will remove **ALL** Docker containers, images, volumes, networks, and build cache on this system (not limited to FastAPI RBAC resources).
- Use `-DryRun` first to preview what will be cleaned.

### Examples

```powershell
# Clean test containers only
./cleanup-environments.ps1

# Clean dev environment
./cleanup-environments.ps1 -Environment dev

# Full cleanup (containers, images, volumes)
./cleanup-environments.ps1 -IncludeImages -IncludeVolumes

# Clean everything with no prompts
./cleanup-environments.ps1 -Force

# Clean all environments completely
./cleanup-environments.ps1 -Environment all -Force

# Preview cleanup actions
./cleanup-environments.ps1 -DryRun

# Full Docker system prune (CAUTION!)
./cleanup-environments.ps1 -GlobalPrune
```

### See Also

- `manage-environments.ps1` - Main environment manager (start/stop/status)
- `build-images.ps1` - Build Docker images for all services
