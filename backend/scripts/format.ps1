#Requires -Version 5.1
# PowerShell equivalent for format.sh

# Enable command tracing (equivalent to set -x)
Set-PSDebug -Trace 1
# Ensure script stops on errors
$ErrorActionPreference = 'Stop'

Write-Host "Running autoflake..."
# Use Invoke-Expression if command arguments need variable expansion or complex parsing, otherwise direct call is fine.
autoflake --remove-all-unused-imports --recursive --remove-unused-variables --in-place app --exclude=__init__.py

Write-Host "Formatting code with black..."
black app

Write-Host "Sorting imports with isort..."
# Assuming isort configuration is in pyproject.toml or setup.cfg
isort .

Write-Host "Formatting complete."
# Disable command tracing
Set-PSDebug -Trace 0
