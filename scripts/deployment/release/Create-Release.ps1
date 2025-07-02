# Create-Release.ps1 - FastAPI RBAC Release Automation Script
#
# This script automates the release process for the FastAPI RBAC project by:
# 1. Generating a changelog from Git history
# 2. Updating the release notes file
# 3. Creating and pushing a Git tag
# 4. Optionally building and pushing Docker images
#
# Author: FastAPI RBAC Team
# Created: July 2, 2025

param(
    [Parameter(Mandatory=$false)]
    [string]$Version,

    [Parameter(Mandatory=$false)]
    [string]$PreviousTag,

    [Parameter(Mandatory=$false)]
    [switch]$SkipNotes,

    [Parameter(Mandatory=$false)]
    [switch]$SkipDockerBuild,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun,

    [Parameter(Mandatory=$false)]
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$RootDir = (Get-Item (Split-Path -Parent $PSCommandPath)).Parent.Parent.FullName
$ReleaseNotesPath = Join-Path -Path $RootDir -ChildPath "docs\release-notes.md"
$ChangelogPath = Join-Path -Path $RootDir -ChildPath "changelog.txt"
$DockerBuildScript = Join-Path -Path $RootDir -ChildPath "scripts\deployment\production\build-and-push.ps1"

function Show-Help {
    Write-Host "`n🚀 FastAPI RBAC Release Automation Script" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "`nThis script automates the release process for the FastAPI RBAC project.`n" -ForegroundColor White

    Write-Host "📋 Parameters:" -ForegroundColor Yellow
    Write-Host "  -Version        : Version to release (e.g., v1.0.0, v0.1.0-beta.1)" -ForegroundColor White
    Write-Host "  -PreviousTag    : Previous tag to generate changelog from (defaults to latest tag)" -ForegroundColor White
    Write-Host "  -SkipNotes      : Skip updating release notes (just create and push tag)" -ForegroundColor White
    Write-Host "  -SkipDockerBuild: Skip building and pushing Docker images" -ForegroundColor White
    Write-Host "  -DryRun         : Simulate the release process without making actual changes" -ForegroundColor White
    Write-Host "  -Help           : Show this help message" -ForegroundColor White

    Write-Host "`n💡 Examples:" -ForegroundColor Yellow
    Write-Host "  .\Create-Release.ps1 -Version v1.0.0" -ForegroundColor White
    Write-Host "  .\Create-Release.ps1 -Version v1.0.0 -PreviousTag v0.9.0" -ForegroundColor White
    Write-Host "  .\Create-Release.ps1 -Version v1.0.0 -SkipNotes" -ForegroundColor White
    Write-Host "  .\Create-Release.ps1 -Version v1.0.0 -DryRun" -ForegroundColor White

    Write-Host "`n📝 Process:" -ForegroundColor Yellow
    Write-Host "  1. Generate changelog from Git history" -ForegroundColor White
    Write-Host "  2. Update release notes file (docs/release-notes.md)" -ForegroundColor White
    Write-Host "  3. Create and push Git tag" -ForegroundColor White
    Write-Host "  4. Optionally build and push Docker images" -ForegroundColor White

    Write-Host "`n🔧 Requirements:" -ForegroundColor Yellow
    Write-Host "  • Git installed and configured" -ForegroundColor White
    Write-Host "  • Access to the repository" -ForegroundColor White
    Write-Host "  • Docker installed and logged in (if building images)" -ForegroundColor White

    Write-Host ""
}

function Test-GitAvailable {
    try {
        $null = git --version
        return $true
    }
    catch {
        return $false
    }
}

function Get-LatestGitTag {
    try {
        $tag = git describe --tags --abbrev=0
        return $tag
    }
    catch {
        Write-Host "No previous tags found. This appears to be the first release." -ForegroundColor Yellow
        return $null
    }
}

function Confirm-MainBranch {
    $currentBranch = git rev-parse --abbrev-ref HEAD
    if ($currentBranch -ne "main") {
        Write-Host "⚠️ WARNING: You are not on the 'main' branch. Current branch: $currentBranch" -ForegroundColor Yellow
        $confirmation = Read-Host "Do you want to continue anyway? (y/n)"
        if ($confirmation -ne "y") {
            Write-Host "Operation cancelled. Please switch to the main branch and try again." -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "✅ Current branch is 'main'" -ForegroundColor Green
    }

    # Check for uncommitted changes
    $status = git status --porcelain
    if ($status) {
        Write-Host "⚠️ WARNING: You have uncommitted changes in your working directory." -ForegroundColor Yellow
        $confirmation = Read-Host "Do you want to continue anyway? (y/n)"
        if ($confirmation -ne "y") {
            Write-Host "Operation cancelled. Please commit or stash your changes and try again." -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "✅ Working directory is clean" -ForegroundColor Green
    }

    # Pull latest changes
    Write-Host "Pulling latest changes from origin/main..." -ForegroundColor Cyan
    git pull origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to pull latest changes. Please resolve any conflicts and try again." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Successfully pulled latest changes" -ForegroundColor Green
}

function New-Changelog {
    param (
        [string]$previousTag,
        [string]$currentTag
    )

    Write-Host "Generating changelog from Git history..." -ForegroundColor Cyan

    if ([string]::IsNullOrEmpty($previousTag)) {
        # If this is the first release, get all commits
        git log --pretty=format:"- %s" > $ChangelogPath
    }
    else {
        # Get commits between tags
        git log "$previousTag..HEAD" --pretty=format:"- %s" > $ChangelogPath
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to generate changelog." -ForegroundColor Red
        exit 1
    }

    # Read the changelog
    $changelog = Get-Content -Path $ChangelogPath -Raw
    if ([string]::IsNullOrWhiteSpace($changelog)) {
        Write-Host "⚠️ WARNING: No commits found between $previousTag and HEAD." -ForegroundColor Yellow
        $confirmation = Read-Host "Do you want to continue anyway? (y/n)"
        if ($confirmation -ne "y") {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "✅ Changelog generated successfully" -ForegroundColor Green
        Write-Host "`nRaw Changelog:" -ForegroundColor Cyan
        Write-Host $changelog -ForegroundColor White
    }

    return $changelog
}

function Update-ReleaseNotes {
    param (
        [string]$version,
        [string]$changelog
    )

    Write-Host "`nUpdating release notes..." -ForegroundColor Cyan

    # Check if release notes file exists
    if (-not (Test-Path -Path $ReleaseNotesPath)) {
        Write-Host "❌ Release notes file not found at: $ReleaseNotesPath" -ForegroundColor Red
        exit 1
    }

    # Read the release notes file
    $releaseNotes = Get-Content -Path $ReleaseNotesPath -Raw

    # Check if version already exists in release notes
    if ($releaseNotes -match "### $version ") {
        Write-Host "⚠️ WARNING: Version $version already exists in release notes." -ForegroundColor Yellow
        $confirmation = Read-Host "Do you want to continue anyway? (y/n)"
        if ($confirmation -ne "y") {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
    }

    # Prepare new release notes entry
    $today = Get-Date -Format "yyyy-MM-dd"
    $newEntry = @"

### $version ($today)

**New Features:**

- [Add features here]

**Bug Fixes:**

- [Add bug fixes here]

**Breaking Changes:**

- None

**Technical Details:**

$changelog

"@

    # Find the position to insert the new entry (after "## Version History" section)
    $versionHistoryIndex = $releaseNotes.IndexOf("## Version History")
    if ($versionHistoryIndex -eq -1) {
        Write-Host "❌ Could not find '## Version History' section in release notes." -ForegroundColor Red
        exit 1
    }

    # Find the end of the "## Version History" line
    $insertPosition = $releaseNotes.IndexOf("`n", $versionHistoryIndex) + 1
    if ($insertPosition -le 0) {
        Write-Host "❌ Could not determine where to insert new release entry." -ForegroundColor Red
        exit 1
    }

    # Insert the new entry
    $updatedReleaseNotes = $releaseNotes.Substring(0, $insertPosition) + $newEntry + $releaseNotes.Substring($insertPosition)

    if ($DryRun) {
        Write-Host "🔍 [DRY RUN] Would create backup of release notes at: $backupPath" -ForegroundColor Cyan
        Write-Host "🔍 [DRY RUN] Would update release notes with new version $version" -ForegroundColor Cyan
        Write-Host "`nPreview of release notes changes:" -ForegroundColor Yellow
        Write-Host "=================================" -ForegroundColor Yellow
        Write-Host $newEntry -ForegroundColor White
        Write-Host "=================================`n" -ForegroundColor Yellow
        return
    }

    # Create backup of current release notes
    $backupPath = "$ReleaseNotesPath.bak"
    Copy-Item -Path $ReleaseNotesPath -Destination $backupPath -Force
    Write-Host "✅ Created backup of release notes at: $backupPath" -ForegroundColor Green

    # Write updated release notes to file
    Set-Content -Path $ReleaseNotesPath -Value $updatedReleaseNotes
    Write-Host "✅ Updated release notes with new version $version" -ForegroundColor Green
    Write-Host "`n⚠️ IMPORTANT: Please review and edit the release notes manually before continuing." -ForegroundColor Yellow
    Write-Host "The generated changelog has been added to the 'Technical Details' section." -ForegroundColor Yellow
    Write-Host "You should categorize the changes into 'New Features', 'Bug Fixes', and 'Breaking Changes'." -ForegroundColor Yellow

    $confirmation = Read-Host "Have you reviewed and edited the release notes? (y/n)"
    if ($confirmation -ne "y") {
        Write-Host "Please edit the release notes at: $ReleaseNotesPath" -ForegroundColor Cyan
        Write-Host "Then run this script again with the -SkipNotes flag to continue." -ForegroundColor Cyan
        exit 0
    }
}

function New-GitTag {
    param (
        [string]$version
    )

    Write-Host "`nCreating Git tag: $version..." -ForegroundColor Cyan

    if ($DryRun) {
        Write-Host "🔍 [DRY RUN] Would create Git tag: $version" -ForegroundColor Cyan
        Write-Host "🔍 [DRY RUN] Would push Git tag to remote" -ForegroundColor Cyan
        return
    }

    # Check if tag already exists
    $existingTags = git tag -l $version
    if ($existingTags -contains $version) {
        Write-Host "⚠️ WARNING: Tag $version already exists." -ForegroundColor Yellow
        $confirmation = Read-Host "Do you want to force update the existing tag? (y/n)"
        if ($confirmation -ne "y") {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }

        # Delete existing tag
        git tag -d $version
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to delete existing tag." -ForegroundColor Red
            exit 1
        }

        # If tag was already pushed, we need to force push
        $tagExistsRemote = $false
        try {
            git ls-remote --tags origin $version | Out-Null
            $tagExistsRemote = $LASTEXITCODE -eq 0
        }
        catch {
            # Ignore errors
        }

        if ($tagExistsRemote) {
            Write-Host "⚠️ WARNING: Tag $version exists on remote. It will be force updated." -ForegroundColor Yellow
        }
    }

    # Create the tag
    git tag -a $version -m "Release $version"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create Git tag." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Git tag created successfully" -ForegroundColor Green

    # Push the tag
    Write-Host "`nPushing Git tag to remote..." -ForegroundColor Cyan
    git push origin $version
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to push Git tag to remote." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Git tag pushed successfully" -ForegroundColor Green
}

function Build-DockerImages {
    param (
        [string]$version
    )

    Write-Host "`nBuilding and pushing Docker images..." -ForegroundColor Cyan

    if ($DryRun) {
        Write-Host "🔍 [DRY RUN] Would build and push Docker images with tag: $version" -ForegroundColor Cyan
        Write-Host "🔍 [DRY RUN] Would execute: $DockerBuildScript -Tag $version" -ForegroundColor Cyan
        return
    }

    # Check if build script exists
    if (-not (Test-Path -Path $DockerBuildScript)) {
        Write-Host "❌ Docker build script not found at: $DockerBuildScript" -ForegroundColor Red
        $confirmation = Read-Host "Do you want to continue without building Docker images? (y/n)"
        if ($confirmation -ne "y") {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
        return
    }

    # Run the build script
    Write-Host "Running Docker build script with tag: $version" -ForegroundColor Cyan
    & $DockerBuildScript -Tag $version
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker build script failed." -ForegroundColor Red
        $confirmation = Read-Host "Do you want to continue anyway? (y/n)"
        if ($confirmation -ne "y") {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "✅ Docker images built and pushed successfully" -ForegroundColor Green
    }
}

# Main execution flow
if ($Help) {
    Show-Help
    exit 0
}

if ([string]::IsNullOrEmpty($Version)) {
    Write-Host "❌ Version parameter is required. Use -Version to specify the version to release." -ForegroundColor Red
    Show-Help
    exit 1
}

# Validate version format
if (-not ($Version -match '^v\d+\.\d+\.\d+(-[a-zA-Z0-9\.]+)?$')) {
    Write-Host "❌ Invalid version format. Version should be in the format 'vX.Y.Z' or 'vX.Y.Z-suffix'" -ForegroundColor Red
    Write-Host "Examples: v1.0.0, v0.1.0-beta.1, v2.0.0-rc.3" -ForegroundColor Cyan
    exit 1
}

# Check if Git is available
if (-not (Test-GitAvailable)) {
    Write-Host "❌ Git is not available. Please install Git and try again." -ForegroundColor Red
    exit 1
}

# Get previous tag if not specified
if ([string]::IsNullOrEmpty($PreviousTag)) {
    $PreviousTag = Get-LatestGitTag
}

# Start the release process
if ($DryRun) {
    Write-Host "`n� [DRY RUN] Starting release process simulation for version: $Version" -ForegroundColor Cyan
    Write-Host "🔍 No actual changes will be made to files or repositories." -ForegroundColor Cyan
} else {
    Write-Host "`n�🚀 Starting release process for version: $Version" -ForegroundColor Green
}

# Confirm and prepare main branch
Confirm-MainBranch

# Generate changelog
$changelog = New-Changelog -previousTag $PreviousTag -currentTag $Version

# Update release notes
if (-not $SkipNotes) {
    Update-ReleaseNotes -version $Version -changelog $changelog
}
else {
    Write-Host "`n⚠️ Skipping release notes update as requested." -ForegroundColor Yellow
}

# Create and push Git tag
New-GitTag -version $Version

# Build and push Docker images
if (-not $SkipDockerBuild) {
    Build-DockerImages -version $Version
}
else {
    Write-Host "`n⚠️ Skipping Docker build as requested." -ForegroundColor Yellow
}

# Clean up temporary files
if (Test-Path -Path $ChangelogPath) {
    if ($DryRun) {
        Write-Host "🔍 [DRY RUN] Would clean up temporary files" -ForegroundColor Cyan
    } else {
        Remove-Item -Path $ChangelogPath -Force
    }
}

if ($DryRun) {
    Write-Host "`n✅ Dry run completed successfully for version: $Version" -ForegroundColor Green
    Write-Host "No actual changes were made. Run without -DryRun to execute the release process." -ForegroundColor Cyan
} else {
    Write-Host "`n✅ Release process completed successfully for version: $Version" -ForegroundColor Green
    Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Monitor GitHub Actions workflow at: https://github.com/yourusername/fastapi_rbac/actions" -ForegroundColor White
    Write-Host "  2. Verify Docker images on Docker Hub" -ForegroundColor White
    Write-Host "  3. Notify team members about the new release" -ForegroundColor White
}
Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Monitor GitHub Actions workflow at: https://github.com/yourusername/fastapi_rbac/actions" -ForegroundColor White
Write-Host "  2. Verify Docker images on Docker Hub" -ForegroundColor White
Write-Host "  3. Notify team members about the new release" -ForegroundColor White
Write-Host "`nThank you for using the FastAPI RBAC Release Automation Script! 🎉" -ForegroundColor Cyan
