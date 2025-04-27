#Requires -Version 5.1
# PowerShell equivalent for lint.sh

# Enable command tracing (equivalent to set -x)
Set-PSDebug -Trace 1
# Ensure script stops on errors
$ErrorActionPreference = 'Stop'

Write-Host "Running mypy..."
# Use current directory to pick up pyproject.toml config, exclude alembic
mypy . --exclude alembic

Write-Host "Checking code formatting with black..."
# Use current directory, rely on pyproject.toml for excludes
black . --check

Write-Host "Checking import sorting with isort..."
# Use current directory, skip alembic
isort . --check-only

Write-Host "Running flake8..."
# Exclude alembic
flake8 .

Write-Host "Linting checks complete."
# Disable command tracing
Set-PSDebug -Trace 0
