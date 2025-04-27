#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent $scriptPath

Write-Host "Fixing import sorting with isort..."
& isort "$rootPath\app"

Write-Host "Done! All import sorting issues have been fixed."
