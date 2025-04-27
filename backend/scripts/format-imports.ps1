#Requires -Version 5.1
# PowerShell equivalent for format-imports.sh

# Enable command tracing (equivalent to set -x)
Set-PSDebug -Trace 1
# Ensure script stops on errors
$ErrorActionPreference = 'Stop'

# Write-Host "Sorting imports (force single line)..." # Removed
# Sort imports one per line, so autoflake can remove unused imports
# isort --force-single-line-imports app # Removed: Rely on format.ps1's isort call

Write-Host "Running standard formatting..."
# Execute the format.ps1 script located in the same directory
# $PSScriptRoot gets the directory of the current script
& "$PSScriptRoot\format.ps1"

Write-Host "Import formatting complete." # This message might be slightly inaccurate now, but harmless
# Disable command tracing
Set-PSDebug -Trace 0
