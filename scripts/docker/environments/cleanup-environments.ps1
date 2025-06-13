#!/usr/bin/env pwsh
# Test Environment Cleanup Script for FastAPI RBAC
# This script completely cleans up the test environment including containers, images, volumes, and networks

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("test", "dev", "prod-test", "all")]
    [string]$Environment = "test",

    [switch]$IncludeVolumes,
    [switch]$IncludeImages,
    [switch]$IncludeNetworks,
    [switch]$Force,
    [switch]$DryRun,
    [switch]$ShowDetails,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Color functions for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    if ($Color -eq "Green") { Write-Host $Message -ForegroundColor Green }
    elseif ($Color -eq "Yellow") { Write-Host $Message -ForegroundColor Yellow }
    elseif ($Color -eq "Red") { Write-Host $Message -ForegroundColor Red }
    elseif ($Color -eq "Blue") { Write-Host $Message -ForegroundColor Blue }
    else { Write-Host $Message }
}

function Show-Help {
    Write-ColorOutput "`n🧹 Environment Cleanup Script" "Cyan"
    Write-ColorOutput "==============================" "Cyan"
    Write-ColorOutput "`nThis script provides comprehensive cleanup for FastAPI RBAC Docker environments.`n" "White"
      Write-ColorOutput "📋 Parameters:" "Yellow"
    Write-ColorOutput "  -Environment     : Target environment to clean (test, dev, prod-test, all)" "White"
    Write-ColorOutput "  -IncludeVolumes  : Also remove Docker volumes (data will be lost!)" "White"
    Write-ColorOutput "  -IncludeImages   : Also remove Docker images" "White"
    Write-ColorOutput "  -IncludeNetworks : Also remove Docker networks" "White"
    Write-ColorOutput "  -Force           : Skip confirmation prompts AND clean everything" "White"
    Write-ColorOutput "  -DryRun          : Show what would be cleaned without making changes" "White"
    Write-ColorOutput "  -ShowDetails     : Show detailed output during operations" "White"
    Write-ColorOutput "  -Help            : Show this help message" "White"
      Write-ColorOutput "`n💡 Examples:" "Yellow"
    Write-ColorOutput "  .\cleanup-environments.ps1                              # Clean test containers only" "White"
    Write-ColorOutput "  .\cleanup-environments.ps1 -Environment dev             # Clean dev environment" "White"
    Write-ColorOutput "  .\cleanup-environments.ps1 -IncludeImages -IncludeVolumes # Full cleanup" "White"
    Write-ColorOutput "  .\cleanup-environments.ps1 -Force                       # Clean everything with no prompts" "White"
    Write-ColorOutput "  .\cleanup-environments.ps1 -Environment all -Force      # Clean all environments completely" "White"
    Write-ColorOutput "  .\cleanup-environments.ps1 -DryRun                      # Preview cleanup actions" "White"

    Write-ColorOutput "`n🌐 Environments:" "Yellow"
    Write-ColorOutput "  test       : Testing environment (default)" "White"
    Write-ColorOutput "  dev        : Development environment" "White"
    Write-ColorOutput "  prod-test  : Production testing environment" "White"
    Write-ColorOutput "  all        : All environments" "White"
      Write-ColorOutput "`n⚠️  Warning:" "Red"
    Write-ColorOutput "  • Using -IncludeVolumes or -Force will permanently delete database data!" "White"
    Write-ColorOutput "  • Using -IncludeImages or -Force will require rebuilding images next time" "White"
    Write-ColorOutput "  • Using -Force cleans EVERYTHING (containers, images, volumes, networks)" "White"
    Write-ColorOutput "  • Use -DryRun first to preview what will be cleaned" "White"

    Write-ColorOutput "`n🎯 Cleanup Components:" "Yellow"
    Write-ColorOutput "  Always Cleaned   : Containers (stopped and removed)" "White"
    Write-ColorOutput "  Optional         : Images, Volumes, Networks" "White"
    Write-ColorOutput "  Never Cleaned    : Source code, configuration files" "White"
    Write-ColorOutput "`n"
}

function Get-EnvironmentContainers {
    param([string]$Environment)

    switch ($Environment) {
        "test" {
            return @(
                "fastapi_rbac_test",
                "fastapi_rbac_worker_test",
                "fastapi_rbac_beat_test",
                "fastapi_rbac_flower_test",
                "fastapi_rbac_db_test",
                "fastapi_rbac_redis_test",
                "fastapi_rbac_pgadmin_test",
                "fastapi_rbac_mailhog_test",
                "react_frontend_test"
            )
        }
        "dev" {
            return @(
                "fastapi_rbac_dev",
                "fastapi_rbac_worker_dev",
                "fastapi_rbac_beat_dev",
                "fastapi_rbac_flower_dev",
                "fastapi_rbac_db_dev",
                "fastapi_rbac_redis_dev",
                "fastapi_rbac_pgadmin_dev",
                "fastapi_rbac_mailhog_dev",
                "react_frontend_dev"
            )
        }
        "prod-test" {
            return @(
                "fastapi_rbac_prod_test",
                "fastapi_rbac_worker_prod_test",
                "fastapi_rbac_beat_prod_test",
                "fastapi_rbac_flower_prod_test",
                "fastapi_rbac_db_prod_test",
                "fastapi_rbac_redis_prod_test",
                "fastapi_rbac_pgadmin_prod_test",
                "fastapi_rbac_mailhog_prod_test",
                "react_frontend_prod_test"
            )
        }
        default {
            return @()
        }
    }
}

function Get-EnvironmentImages {
    param([string]$Environment)

    switch ($Environment) {
        "test" {
            return @(
                "fastapi_rbac:test",
                "fastapi_rbac_worker:test",
                "react_frontend:test"
            )
        }
        "dev" {
            return @(
                "fastapi_rbac:dev",
                "fastapi_rbac_worker:dev",
                "react_frontend:dev"
            )
        }
        "prod-test" {
            return @(
                "fastapi_rbac:prod-test",
                "fastapi_rbac_worker:prod-test",
                "react_frontend:prod-test"
            )
        }
        default {
            return @()
        }
    }
}

function Get-EnvironmentVolumes {
    param([string]$Environment)

    switch ($Environment) {
        "test" {
            return @(
                "fastapi_rbac_fastapi_rbac_db_test_data",
                "fastapi_rbac_fastapi_rbac_pgadmin_test_data"
            )
        }
        "dev" {
            return @(
                "fastapi_rbac_fastapi_rbac_db_dev_data",
                "fastapi_rbac_fastapi_rbac_pgadmin_dev_data"
            )
        }
        "prod-test" {
            return @(
                "fastapi_rbac_fastapi_rbac_db_prod_test_data",
                "fastapi_rbac_fastapi_rbac_pgadmin_prod_test_data"
            )
        }
        default {
            return @()
        }
    }
}

function Get-EnvironmentNetworks {
    param([string]$Environment)

    switch ($Environment) {
        "test" {
            return @("fastapi_rbac_test_network")
        }
        "dev" {
            return @("fastapi_rbac_dev_network")
        }
        "prod-test" {
            return @("fastapi_rbac_prod_test_network")
        }
        default {
            return @()
        }
    }
}

function Stop-EnvironmentContainers {
    param([string]$Environment)

    Write-ColorOutput "Stopping $Environment environment containers..." "Blue"

    if ($DryRun) {
        Write-ColorOutput "Would stop containers for $Environment environment" "Yellow"
        return
    }

    try {
        switch ($Environment) {
            "test" { docker-compose -f docker-compose.test.yml down 2>$null }
            "dev" { docker-compose -f docker-compose.dev.yml down 2>$null }
            "prod-test" { docker-compose -f docker-compose.prod-test.yml down 2>$null }
        }
        Write-ColorOutput "✅ $Environment containers stopped" "Green"
    } catch {
        Write-ColorOutput "⚠️  No running $Environment containers found" "Yellow"
    }
}

function Remove-EnvironmentContainers {
    param([string]$Environment)

    Write-ColorOutput "Removing $Environment containers..." "Blue"

    $containers = Get-EnvironmentContainers -Environment $Environment

    foreach ($container in $containers) {
        $exists = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $container }
        if ($exists) {
            if ($DryRun) {
                Write-ColorOutput "Would remove container: $container" "Yellow"            } else {
                if ($ShowDetails) { Write-ColorOutput "Removing container: $container" "Yellow" }
                docker rm -f $container 2>$null
            }
        } elseif ($ShowDetails) {
            Write-ColorOutput "Container not found: $container" "Gray"
        }
    }

    if (-not $DryRun) {
        Write-ColorOutput "✅ $Environment containers removed" "Green"
    }
}

function Remove-EnvironmentImages {
    param([string]$Environment)

    if (-not $IncludeImages -and -not $Force) {
        return
    }

    Write-ColorOutput "Removing $Environment images..." "Blue"

    $images = Get-EnvironmentImages -Environment $Environment

    foreach ($image in $images) {
        $exists = docker images --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -eq $image }
        if ($exists) {
            if ($DryRun) {
                Write-ColorOutput "Would remove image: $image" "Yellow"            } else {
                if ($ShowDetails) { Write-ColorOutput "Removing image: $image" "Yellow" }
                docker image rm $image -f 2>$null
            }
        } elseif ($ShowDetails) {
            Write-ColorOutput "Image not found: $image" "Gray"
        }
    }

    if (-not $DryRun) {
        Write-ColorOutput "✅ $Environment images removed" "Green"
    }
}

function Remove-EnvironmentVolumes {
    param([string]$Environment)

    if (-not $IncludeVolumes -and -not $Force) {
        return
    }

    Write-ColorOutput "Removing $Environment volumes..." "Blue"

    $volumes = Get-EnvironmentVolumes -Environment $Environment

    foreach ($volume in $volumes) {
        $exists = docker volume ls --format "{{.Name}}" | Where-Object { $_ -eq $volume }
        if ($exists) {
            if ($DryRun) {
                Write-ColorOutput "Would remove volume: $volume" "Yellow"            } else {
                if ($ShowDetails) { Write-ColorOutput "Removing volume: $volume" "Yellow" }
                docker volume rm $volume -f 2>$null
            }
        } elseif ($ShowDetails) {
            Write-ColorOutput "Volume not found: $volume" "Gray"
        }
    }

    if (-not $DryRun) {
        Write-ColorOutput "✅ $Environment volumes removed" "Green"
    }
}

function Remove-EnvironmentNetworks {
    param([string]$Environment)

    if (-not $IncludeNetworks -and -not $Force) {
        return
    }

    Write-ColorOutput "Removing $Environment networks..." "Blue"

    $networks = Get-EnvironmentNetworks -Environment $Environment

    foreach ($network in $networks) {
        $exists = docker network ls --format "{{.Name}}" | Where-Object { $_ -eq $network }
        if ($exists) {
            if ($DryRun) {
                Write-ColorOutput "Would remove network: $network" "Yellow"            } else {
                if ($ShowDetails) { Write-ColorOutput "Removing network: $network" "Yellow" }
                docker network rm $network 2>$null
            }
        } elseif ($ShowDetails) {
            Write-ColorOutput "Network not found: $network" "Gray"
        }
    }

    if (-not $DryRun) {
        Write-ColorOutput "✅ $Environment networks removed" "Green"
    }
}

function Show-CleanupSummary {
    param([string[]]$Environments)

    Write-ColorOutput "" "White"
    Write-ColorOutput "=== Cleanup Summary ===" "Blue"

    foreach ($env in $Environments) {
        Write-ColorOutput "`n$env Environment:" "Yellow"

        # Check remaining containers
        $containerPattern = switch ($env) {
            "test" { "*_test" }
            "dev" { "*_dev" }
            "prod-test" { "*_prod_test" }
            default { "*_$env" }
        }

        $remainingContainers = docker ps -a --format "{{.Names}}" | Where-Object { $_ -like $containerPattern }
        if ($remainingContainers) {
            Write-ColorOutput "  ⚠️  Remaining containers:" "Yellow"
            foreach ($container in $remainingContainers) {
                Write-ColorOutput "    - $container" "Yellow"
            }
        } else {
            Write-ColorOutput "  ✅ No containers remaining" "Green"
        }

        # Check remaining images
        $imagePattern = switch ($env) {
            "test" { "*:test" }
            "dev" { "*:dev" }
            "prod-test" { "*:prod-test" }
            default { "*:$env" }
        }

        $remainingImages = docker images --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -like $imagePattern }
        if ($remainingImages) {
            Write-ColorOutput "  ⚠️  Remaining images:" "Yellow"
            foreach ($image in $remainingImages) {
                Write-ColorOutput "    - $image" "Yellow"
            }
        } else {
            Write-ColorOutput "  ✅ No images remaining" "Green"
        }

        # Check remaining volumes
        $volumePattern = switch ($env) {
            "test" { "*test*" }
            "dev" { "*dev*" }
            "prod-test" { "*prod_test*" }
            default { "*$env*" }
        }

        $remainingVolumes = docker volume ls --format "{{.Name}}" | Where-Object { $_ -like $volumePattern }
        if ($remainingVolumes) {
            Write-ColorOutput "  ⚠️  Remaining volumes:" "Yellow"
            foreach ($volume in $remainingVolumes) {
                Write-ColorOutput "    - $volume" "Yellow"
            }
        } else {
            Write-ColorOutput "  ✅ No volumes remaining" "Green"
        }

        # Check remaining networks
        $networkPattern = switch ($env) {
            "test" { "*test*" }
            "dev" { "*dev*" }
            "prod-test" { "*prod_test*" }
            default { "*$env*" }
        }

        $remainingNetworks = docker network ls --format "{{.Name}}" | Where-Object { $_ -like $networkPattern }
        if ($remainingNetworks) {
            Write-ColorOutput "  ⚠️  Remaining networks:" "Yellow"
            foreach ($network in $remainingNetworks) {
                Write-ColorOutput "    - $network" "Yellow"
            }
        } else {
            Write-ColorOutput "  ✅ No networks remaining" "Green"
        }
    }
}

function Invoke-EnvironmentCleanup {
    param([string]$Environment)

    Write-ColorOutput "`n🧹 Cleaning $Environment Environment..." "Cyan"
    Write-ColorOutput "====================================" "Cyan"

    # Execute cleanup steps for the environment
    Stop-EnvironmentContainers -Environment $Environment
    Remove-EnvironmentContainers -Environment $Environment
    Remove-EnvironmentImages -Environment $Environment
    Remove-EnvironmentVolumes -Environment $Environment
    Remove-EnvironmentNetworks -Environment $Environment

    if (-not $DryRun) {
        Write-ColorOutput "✅ $Environment environment cleanup completed!" "Green"
    }
}

# Main cleanup process
# Check for help request
if ($Help) {
    Show-Help
    exit 0
}

Write-ColorOutput "=== FastAPI RBAC Environment Cleanup ===" "Blue"
Write-ColorOutput "Environment: $Environment" "Green"
Write-ColorOutput "Dry Run: $DryRun" "White"
Write-ColorOutput ""

# Determine environments to clean
$environmentsToClean = @()
if ($Environment -eq "all") {
    $environmentsToClean = @("test", "dev", "prod-test")
    Write-ColorOutput "🌐 Cleaning ALL environments: test, dev, prod-test" "Yellow"
} else {
    $environmentsToClean = @($Environment)
    Write-ColorOutput "🌐 Cleaning environment: $Environment" "Yellow"
}

# Show what will be cleaned
if (-not $Force -and -not $DryRun) {
    Write-ColorOutput "`nCleanup options:" "Blue"
    Write-ColorOutput "  - Containers: Always cleaned" "Green"
    Write-ColorOutput "  - Images: $($IncludeImages ? 'YES' : 'NO')" $($IncludeImages ? "Green" : "Yellow")
    Write-ColorOutput "  - Volumes: $($IncludeVolumes ? 'YES' : 'NO')" $($IncludeVolumes ? "Green" : "Yellow")
    Write-ColorOutput "  - Networks: $($IncludeNetworks ? 'YES' : 'NO')" $($IncludeNetworks ? "Green" : "Yellow")
    Write-ColorOutput "" "White"

    if ($IncludeVolumes) {
        Write-ColorOutput "⚠️  WARNING: Including volumes will permanently delete database data!" "Red"
    }
    if ($IncludeImages) {
        Write-ColorOutput "⚠️  WARNING: Including images will require rebuilding next time!" "Yellow"
    }
    Write-ColorOutput "" "White"

    $confirm = Read-Host "Continue with cleanup? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-ColorOutput "Cleanup cancelled." "Yellow"
        exit 0
    }
    Write-ColorOutput "" "White"
}

if ($DryRun) {
    Write-ColorOutput "🔍 DRY RUN MODE - No changes will be made" "Yellow"
    Write-ColorOutput "" "White"
}

# Execute cleanup for each environment
foreach ($env in $environmentsToClean) {
    Invoke-EnvironmentCleanup -Environment $env
}

Write-ColorOutput "" "White"
if ($DryRun) {
    Write-ColorOutput "🔍 Dry run completed - no changes were made" "Blue"
} else {
    Write-ColorOutput "🎉 Environment cleanup completed!" "Green"
}

# Show summary
Show-CleanupSummary -Environments $environmentsToClean

# Show rebuild instructions
Write-ColorOutput "" "White"
Write-ColorOutput "To rebuild the environment(s), run:" "Blue"
if ($Environment -eq "all") {
    Write-ColorOutput "  .\scripts\docker\environments\build-images.ps1" "Yellow"
    Write-ColorOutput "  .\scripts\docker\environments\manage-environments.ps1 -Environment <env> -Action up -Build -Detached" "Yellow"
} else {
    Write-ColorOutput "  .\scripts\docker\environments\build-images.ps1" "Yellow"
    Write-ColorOutput "  .\scripts\docker\environments\manage-environments.ps1 -Environment $Environment -Action up -Build -Detached" "Yellow"
}
