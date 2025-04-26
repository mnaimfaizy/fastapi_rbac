#Requires -Version 5.1
# PowerShell equivalent for lint.sh

# Enable command tracing (equivalent to set -x)
Set-PSDebug -Trace 1
# Ensure script stops on errors
$ErrorActionPreference = 'Stop'

Write-Host "Running mypy..."
# Exclude the alembic directory as in the original script
mypy app --exclude=alembic

Write-Host "Checking code formatting with black..."
black app --check

Write-Host "Checking import sorting with isort..."
# Note: isort behavior might differ slightly, ensure configuration (e.g., in pyproject.toml) is consistent
isort app --check-only # Use --check-only to mimic linting behavior without changing files

Write-Host "Running flake8..."
flake8

Write-Host "Linting checks complete."
# Disable command tracing
Set-PSDebug -Trace 0
