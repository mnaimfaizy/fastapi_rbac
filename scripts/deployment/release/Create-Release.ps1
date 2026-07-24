# Create-Release.ps1 - FastAPI RBAC Release Automation Script
#
# Default: Release PR mode (branch release/vX.Y.Z, VERSION + notes, push, gh pr create).
# Emergency: -DirectTag tags from main (discouraged).
# Kept in parity with create-release.sh (Phase C1).
#
# Author: FastAPI RBAC Team
# Created: July 2, 2025

param(
    [Parameter(Mandatory=$false)]
    [string]$Version,

    [Parameter(Mandatory=$false)]
    [string]$PreviousTag,

    [Parameter(Mandatory=$false)]
    [string]$NotesFile,

    [Parameter(Mandatory=$false)]
    [switch]$SkipNotes,

    [Parameter(Mandatory=$false)]
    [switch]$BuildDocker,

    [Parameter(Mandatory=$false)]
    [switch]$DirectTag,

    [Parameter(Mandatory=$false)]
    [switch]$Yes,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun,

    [Parameter(Mandatory=$false)]
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$RootDir = (Get-Item (Split-Path -Parent $PSCommandPath)).Parent.Parent.Parent.FullName
$ReleaseNotesPath = Join-Path -Path $RootDir -ChildPath "docs\release-notes.md"
$ChangelogPath = Join-Path -Path $RootDir -ChildPath "changelog.txt"
$VersionFilePath = Join-Path -Path $RootDir -ChildPath "VERSION"
$DockerBuildScript = Join-Path -Path $RootDir -ChildPath "scripts\deployment\production\build-and-push.ps1"
$RepoActionsUrl = "https://github.com/mnaimfaizy/fastapi_rbac/actions"

trap {
    if (-not $DryRun -and (Test-Path -Path $ChangelogPath)) {
        Write-Host "Cleaning up changelog file after error..." -ForegroundColor Yellow
        Remove-Item -Path $ChangelogPath -Force -ErrorAction SilentlyContinue
    }
    throw $_
}

function Show-Help {
    Write-Host "`nFastAPI RBAC Release Automation Script" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "`nDefault mode opens a Release PR (release/vX.Y.Z). Use -DirectTag only for emergencies.`n" -ForegroundColor White

    Write-Host "Parameters:" -ForegroundColor Yellow
    Write-Host "  -Version        : Version to release (e.g., v1.0.0, v0.1.0-beta.1) [required]" -ForegroundColor White
    Write-Host "  -PreviousTag    : Previous tag for changelog (defaults to latest tag)" -ForegroundColor White
    Write-Host "  -NotesFile      : Path to a release-notes section to insert (full ### entry or body)" -ForegroundColor White
    Write-Host "  -SkipNotes      : Skip updating docs/release-notes.md (still updates VERSION in PR mode)" -ForegroundColor White
    Write-Host "  -DirectTag      : EMERGENCY — commit on main and push tag (skips Release PR)" -ForegroundColor White
    Write-Host '  -Yes            : Non-interactive (no prompts; fail closed on unsafe warnings)' -ForegroundColor White
    Write-Host '  -BuildDocker    : Build/push images locally (DirectTag only; opt-in)' -ForegroundColor White
    Write-Host "  -DryRun         : Simulate without mutating git remotes or release files" -ForegroundColor White
    Write-Host "  -Help           : Show this help" -ForegroundColor White

    Write-Host "`nExamples:" -ForegroundColor Yellow
    Write-Host "  .\Create-Release.ps1 -Version v1.0.0 -Yes" -ForegroundColor White
    Write-Host "  .\Create-Release.ps1 -Version v1.0.0 -NotesFile .\notes-section.md -Yes" -ForegroundColor White
    Write-Host "  .\Create-Release.ps1 -Version v1.0.0 -DryRun" -ForegroundColor White
    Write-Host "  .\Create-Release.ps1 -Version v1.0.0 -DirectTag -Yes   # discouraged" -ForegroundColor White

    Write-Host "`nDefault process (Release PR):" -ForegroundColor Yellow
    Write-Host "  1. Ensure main is clean and up to date" -ForegroundColor White
    Write-Host "  2. Create branch release/<version> (branch name is version SSOT)" -ForegroundColor White
    Write-Host "  3. Update VERSION + docs/release-notes.md and commit" -ForegroundColor White
    Write-Host "  4. Push branch and open PR with gh; print PR URL" -ForegroundColor White
    Write-Host "  5. After merge, CI creates the tag / GitHub Release (Phase C2+)" -ForegroundColor White

    Write-Host "`nDry-run notes:" -ForegroundColor Yellow
    Write-Host "  • Skips git pull, file writes, commit, push, tag, and gh pr create" -ForegroundColor White
    Write-Host "  • Still writes temporary changelog.txt (left in place)" -ForegroundColor White

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

function Test-GhAvailable {
    try {
        $null = gh --version
        return $true
    }
    catch {
        return $false
    }
}

function Get-LatestGitTag {
    try {
        $tag = git describe --tags --abbrev=0 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($tag)) {
            Write-Host "No previous tags found. This appears to be the first release." -ForegroundColor Yellow
            return $null
        }
        return $tag.Trim()
    }
    catch {
        Write-Host "No previous tags found. This appears to be the first release." -ForegroundColor Yellow
        return $null
    }
}

function Confirm-Continue {
    param (
        [string]$Prompt,
        [switch]$AllowYesContinue
    )
    if ($Yes) {
        if ($AllowYesContinue) {
            Write-Host "Continuing (-Yes): $Prompt" -ForegroundColor Yellow
            return $true
        }
        Write-Host "Non-interactive (-Yes): refusing to continue without confirmation." -ForegroundColor Red
        Write-Host "  $Prompt" -ForegroundColor Yellow
        exit 1
    }
    $confirmation = Read-Host "$Prompt (y/n)"
    return ($confirmation -eq "y")
}

function Assert-MainClean {
    param (
        [switch]$PullMain
    )

    $currentBranch = git rev-parse --abbrev-ref HEAD
    if ($currentBranch -ne "main") {
        Write-Host "WARNING: You are not on the 'main' branch. Current branch: $currentBranch" -ForegroundColor Yellow
        if ($Yes) {
            Write-Host "Non-interactive (-Yes): must start from main." -ForegroundColor Red
            exit 1
        }
        if (-not (Confirm-Continue -Prompt "Do you want to continue anyway?")) {
            Write-Host "Operation cancelled. Please switch to the main branch and try again." -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "Current branch is 'main'" -ForegroundColor Green
    }

    $status = git status --porcelain
    if ($status) {
        Write-Host "WARNING: You have uncommitted changes in your working directory." -ForegroundColor Yellow
        if ($Yes) {
            Write-Host "Non-interactive (-Yes): working tree must be clean." -ForegroundColor Red
            exit 1
        }
        if (-not (Confirm-Continue -Prompt "Do you want to continue anyway?")) {
            Write-Host "Operation cancelled. Please commit or stash your changes and try again." -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "Working directory is clean" -ForegroundColor Green
    }

    if (-not $PullMain) {
        return
    }

    if ($DryRun) {
        Write-Host "[DRY RUN] Skipping git pull origin main" -ForegroundColor Cyan
        return
    }

    Write-Host "Pulling latest changes from origin/main..." -ForegroundColor Cyan
    git pull origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to pull latest changes. Please resolve any conflicts and try again." -ForegroundColor Red
        exit 1
    }
    Write-Host "Successfully pulled latest changes" -ForegroundColor Green
}

function New-Changelog {
    param (
        [string]$previousTag,
        [string]$currentTag
    )

    Write-Host "Generating changelog from Git history..." -ForegroundColor Cyan

    if (Test-Path -Path $ChangelogPath) {
        Remove-Item -Path $ChangelogPath -Force
        Write-Host "Removed existing changelog file" -ForegroundColor Cyan
    }

    if ([string]::IsNullOrEmpty($previousTag)) {
        git log --pretty=format:"- %s" > $ChangelogPath
    }
    else {
        git log "$previousTag..HEAD" --pretty=format:"- %s" > $ChangelogPath
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to generate changelog." -ForegroundColor Red
        exit 1
    }

    $changelog = Get-Content -Path $ChangelogPath -Raw
    if ([string]::IsNullOrWhiteSpace($changelog)) {
        Write-Host "WARNING: No commits found between $previousTag and HEAD." -ForegroundColor Yellow
        if (-not (Confirm-Continue -Prompt "Do you want to continue anyway?" -AllowYesContinue)) {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "Changelog generated successfully" -ForegroundColor Green
        Write-Host "`nRaw Changelog:" -ForegroundColor Cyan
        Write-Host $changelog -ForegroundColor White
    }

    return $changelog
}

function Get-ReleaseNotesEntry {
    param (
        [string]$version,
        [string]$changelog
    )

    $today = Get-Date -Format "yyyy-MM-dd"

    if (-not [string]::IsNullOrWhiteSpace($NotesFile)) {
        if (-not (Test-Path -Path $NotesFile)) {
            Write-Host "Notes file not found: $NotesFile" -ForegroundColor Red
            exit 1
        }
        $notesContent = (Get-Content -Path $NotesFile -Raw).TrimEnd()
        if ($notesContent -match "(?m)^###\s+") {
            return "`n$notesContent`n"
        }
        return @"

### $version ($today)

$notesContent

"@
    }

    return @"

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
}

function Update-VersionAndNotes {
    param (
        [string]$version,
        [string]$changelog,
        [switch]$CommitChanges
    )

    Write-Host "`nUpdating release notes and VERSION file..." -ForegroundColor Cyan

    $versionWithoutV = $version -replace '^v', ''
    if ($DryRun) {
        Write-Host "[DRY RUN] Would update VERSION file to: $versionWithoutV" -ForegroundColor Cyan
    }
    else {
        # VERSION file: single line, no extra blank line from Set-Content quirks on some hosts
        [System.IO.File]::WriteAllText($VersionFilePath, "$versionWithoutV`n")
        Write-Host "Updated VERSION file to: $versionWithoutV" -ForegroundColor Green
    }

    if ($SkipNotes) {
        Write-Host "Skipping docs/release-notes.md update (-SkipNotes)." -ForegroundColor Yellow
        if ($CommitChanges -and -not $DryRun) {
            Write-Host "`nCommitting VERSION file..." -ForegroundColor Cyan
            git add $VersionFilePath
            git commit -m "chore(release): prepare $version"
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Failed to commit VERSION." -ForegroundColor Red
                exit 1
            }
            Write-Host "VERSION committed successfully" -ForegroundColor Green
        }
        elseif ($CommitChanges -and $DryRun) {
            Write-Host "[DRY RUN] Would commit VERSION for $version" -ForegroundColor Cyan
        }
        return
    }

    if (-not (Test-Path -Path $ReleaseNotesPath)) {
        Write-Host "Release notes file not found at: $ReleaseNotesPath" -ForegroundColor Red
        exit 1
    }

    $releaseNotes = Get-Content -Path $ReleaseNotesPath -Raw
    if ($releaseNotes -match "### $([regex]::Escape($version)) ") {
        Write-Host "WARNING: Version $version already exists in release notes." -ForegroundColor Yellow
        if (-not (Confirm-Continue -Prompt "Do you want to continue anyway?" -AllowYesContinue)) {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
    }

    $newEntry = Get-ReleaseNotesEntry -version $version -changelog $changelog

    $versionHistoryIndex = $releaseNotes.IndexOf("## Version History")
    if ($versionHistoryIndex -eq -1) {
        Write-Host "Could not find '## Version History' section in release notes." -ForegroundColor Red
        exit 1
    }

    $insertPosition = $releaseNotes.IndexOf("`n", $versionHistoryIndex) + 1
    if ($insertPosition -le 0) {
        Write-Host "Could not determine where to insert new release entry." -ForegroundColor Red
        exit 1
    }

    $updatedReleaseNotes = $releaseNotes.Substring(0, $insertPosition) + $newEntry + $releaseNotes.Substring($insertPosition)

    if ($DryRun) {
        Write-Host "[DRY RUN] Would update release notes with new version $version" -ForegroundColor Cyan
        Write-Host "[DRY RUN] Would commit the updated release notes and VERSION file" -ForegroundColor Cyan
        Write-Host "`nPreview of release notes entry:" -ForegroundColor Yellow
        Write-Host "=================================" -ForegroundColor Yellow
        Write-Host $newEntry -ForegroundColor White
        Write-Host "=================================`n" -ForegroundColor Yellow
        return
    }

    $backupPath = "$ReleaseNotesPath.bak"
    Copy-Item -Path $ReleaseNotesPath -Destination $backupPath -Force
    [System.IO.File]::WriteAllText($ReleaseNotesPath, $updatedReleaseNotes)
    Write-Host "Updated release notes with new version $version" -ForegroundColor Green

    if (-not $Yes -and [string]::IsNullOrWhiteSpace($NotesFile)) {
        Write-Host "`nIMPORTANT: Please review and edit the release notes before continuing." -ForegroundColor Yellow
        Write-Host "Stub sections may need categorization; or pass -NotesFile / -Yes for agents." -ForegroundColor Yellow
        if (-not (Confirm-Continue -Prompt "Have you reviewed and edited the release notes?")) {
            Write-Host "Please edit the release notes at: $ReleaseNotesPath" -ForegroundColor Cyan
            Write-Host "Then re-run with -SkipNotes (and -DirectTag if tagging) or provide -NotesFile -Yes." -ForegroundColor Cyan
            exit 0
        }
    }

    if (Test-Path -Path $backupPath) {
        Remove-Item -Path $backupPath -Force
    }

    if ($CommitChanges) {
        Write-Host "`nCommitting the updated release notes and VERSION file..." -ForegroundColor Cyan
        git add $ReleaseNotesPath $VersionFilePath
        git commit -m "chore(release): prepare $version"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "WARNING: Failed to commit the updated files." -ForegroundColor Yellow
            if (-not (Confirm-Continue -Prompt "Do you want to continue anyway?")) {
                Write-Host "Operation cancelled." -ForegroundColor Red
                exit 1
            }
        }
        else {
            Write-Host "Release notes and VERSION file committed successfully" -ForegroundColor Green
        }
    }
}

function New-GitTag {
    param (
        [string]$version
    )

    Write-Host "`nCreating Git tag: $version..." -ForegroundColor Cyan

    if ($DryRun) {
        Write-Host "[DRY RUN] Would create Git tag: $version" -ForegroundColor Cyan
        Write-Host "[DRY RUN] Would push Git tag to remote" -ForegroundColor Cyan
        return
    }

    $existingTags = git tag -l $version
    if ($existingTags -contains $version) {
        Write-Host "WARNING: Tag $version already exists locally." -ForegroundColor Yellow

        $remoteTag = git ls-remote --tags origin "refs/tags/$version" 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($remoteTag)) {
            Write-Host "Tag $version already exists on remote. Refusing to retag." -ForegroundColor Red
            Write-Host "This script does not force-push tags. Delete the remote tag explicitly if you intend to replace it, then re-run." -ForegroundColor Yellow
            exit 1
        }

        if (-not (Confirm-Continue -Prompt "Do you want to replace the local tag and push it?")) {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }

        git tag -d $version
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to delete existing local tag." -ForegroundColor Red
            exit 1
        }
    }
    else {
        $remoteTag = git ls-remote --tags origin "refs/tags/$version" 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($remoteTag)) {
            Write-Host "Tag $version already exists on remote. Refusing to retag." -ForegroundColor Red
            Write-Host "This script does not force-push tags. Delete the remote tag explicitly if you intend to replace it, then re-run." -ForegroundColor Yellow
            exit 1
        }
    }

    git tag -a $version -m "Release $version"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create Git tag." -ForegroundColor Red
        exit 1
    }
    Write-Host "Git tag created successfully" -ForegroundColor Green

    Write-Host "`nPushing Git tag to remote..." -ForegroundColor Cyan
    git push origin $version
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to push Git tag to remote." -ForegroundColor Red
        exit 1
    }
    Write-Host "Git tag pushed successfully" -ForegroundColor Green
}

function Build-DockerImages {
    param (
        [string]$version
    )

    Write-Host "`nChecking Docker availability..." -ForegroundColor Cyan

    try {
        $null = docker --version
    }
    catch {
        Write-Host "Docker is not installed or not in PATH. Cannot build Docker images." -ForegroundColor Red
        if (-not (Confirm-Continue -Prompt "Do you want to continue without building Docker images?" -AllowYesContinue)) {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
        return
    }

    try {
        $null = docker info
        if ($LASTEXITCODE -ne 0) {
            throw "Docker info command failed"
        }
    }
    catch {
        Write-Host "Docker engine is not running. Cannot build Docker images." -ForegroundColor Red
        if (-not (Confirm-Continue -Prompt "Do you want to continue without building Docker images?" -AllowYesContinue)) {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
        return
    }

    Write-Host "`nBuilding and pushing Docker images..." -ForegroundColor Cyan

    if ($DryRun) {
        Write-Host "[DRY RUN] Would build and push Docker images with tag: $version" -ForegroundColor Cyan
        Write-Host "[DRY RUN] Would execute: $DockerBuildScript -Tag $version" -ForegroundColor Cyan
        return
    }

    if (-not (Test-Path -Path $DockerBuildScript)) {
        Write-Host "Docker build script not found at: $DockerBuildScript" -ForegroundColor Red
        if (-not (Confirm-Continue -Prompt "Do you want to continue without building Docker images?" -AllowYesContinue)) {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
        return
    }

    Write-Host "Running Docker build script with tag: $version" -ForegroundColor Cyan
    & $DockerBuildScript -Tag $version
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker build script failed." -ForegroundColor Red
        if (-not (Confirm-Continue -Prompt "Do you want to continue anyway?")) {
            Write-Host "Operation cancelled." -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "Docker images built and pushed successfully" -ForegroundColor Green
    }
}

function Invoke-ReleasePrMode {
    param (
        [string]$version,
        [string]$changelog
    )

    $releaseBranch = "release/$version"
    Write-Host "`nRelease PR mode (default). Branch SSOT: $releaseBranch" -ForegroundColor Cyan

    if ($BuildDocker) {
        Write-Host "WARNING: -BuildDocker is ignored in Release PR mode (images publish after tag on merge)." -ForegroundColor Yellow
    }

    if ($DryRun) {
        Write-Host "[DRY RUN] Would create branch: $releaseBranch" -ForegroundColor Cyan
        Update-VersionAndNotes -version $version -changelog $changelog -CommitChanges
        Write-Host "[DRY RUN] Would push $releaseBranch and run: gh pr create --base main --head $releaseBranch" -ForegroundColor Cyan
        Write-Host "[DRY RUN] Would print the PR URL" -ForegroundColor Cyan
        return
    }

    # Refuse early if remote tag already exists
    $remoteTag = git ls-remote --tags origin "refs/tags/$version" 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($remoteTag)) {
        Write-Host "Tag $version already exists on remote. Refusing to open a Release PR for it." -ForegroundColor Red
        Write-Host "This script does not force-push tags." -ForegroundColor Yellow
        exit 1
    }

    $existingBranch = git branch --list $releaseBranch
    if ($existingBranch) {
        Write-Host "Local branch $releaseBranch already exists." -ForegroundColor Red
        exit 1
    }

    $remoteBranch = git ls-remote --heads origin $releaseBranch 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($remoteBranch)) {
        Write-Host "Remote branch $releaseBranch already exists." -ForegroundColor Red
        exit 1
    }

    if (-not (Test-GhAvailable)) {
        Write-Host "GitHub CLI (gh) is required for Release PR mode. Install gh or use -DirectTag (discouraged)." -ForegroundColor Red
        exit 1
    }

    Write-Host "Creating branch $releaseBranch..." -ForegroundColor Cyan
    git checkout -b $releaseBranch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create branch $releaseBranch." -ForegroundColor Red
        exit 1
    }

    Update-VersionAndNotes -version $version -changelog $changelog -CommitChanges

    Write-Host "`nPushing branch $releaseBranch..." -ForegroundColor Cyan
    git push -u origin $releaseBranch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to push branch $releaseBranch." -ForegroundColor Red
        exit 1
    }

    $prBody = @"
## Summary
- Prepare release **$version** (branch ``$releaseBranch`` is version SSOT).
- Updates ``VERSION`` and ``docs/release-notes.md``.

## After merge
- Tagging / GitHub Release should be created by CI (release-tag-on-merge).
- Docker Hub images publish from the ``v*`` tag via Docker Publish.

## Test plan
- [ ] Release notes look correct
- [ ] VERSION matches branch (without leading ``v``)
- [ ] CI green before merge
"@

    Write-Host "`nCreating pull request..." -ForegroundColor Cyan
    $prUrl = gh pr create --base main --head $releaseBranch --title "chore(release): $version" --body $prBody
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create pull request." -ForegroundColor Red
        exit 1
    }

    Write-Host "`nRelease PR created:" -ForegroundColor Green
    Write-Host $prUrl -ForegroundColor White
    Write-Host "`nMerge the PR to cut the release. Monitor: $RepoActionsUrl" -ForegroundColor Yellow
}

function Invoke-DirectTagMode {
    param (
        [string]$version,
        [string]$changelog
    )

    Write-Host "`nWARNING: -DirectTag is an emergency path (tags from main, no Release PR)." -ForegroundColor Yellow

    Update-VersionAndNotes -version $version -changelog $changelog -CommitChanges

    if ($DryRun) {
        Write-Host "[DRY RUN] Would push main after notes/VERSION commit" -ForegroundColor Cyan
    }
    else {
        Write-Host "`nPushing main (release notes / VERSION commit)..." -ForegroundColor Cyan
        git push origin main
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to push main. Tag will not be created until main is pushed." -ForegroundColor Red
            exit 1
        }
    }

    New-GitTag -version $version

    if ($BuildDocker) {
        Build-DockerImages -version $version
    }
    else {
        Write-Host "`nSkipping Docker build (use -BuildDocker with -DirectTag to build images locally)." -ForegroundColor Yellow
    }

    if ($DryRun) {
        Write-Host "`nDry run completed for direct-tag path: $version" -ForegroundColor Green
    }
    else {
        Write-Host "`nDirect-tag release completed for: $version" -ForegroundColor Green
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Monitor GitHub Actions: $RepoActionsUrl" -ForegroundColor White
        Write-Host "  2. Verify Docker images on Docker Hub" -ForegroundColor White
    }
}

function Clear-ChangelogArtifact {
    if (Test-Path -Path $ChangelogPath) {
        if ($DryRun) {
            Write-Host "[DRY RUN] Would clean up temporary files (changelog.txt left in place)" -ForegroundColor Cyan
        }
        else {
            Remove-Item -Path $ChangelogPath -Force
            Write-Host "Removed temporary changelog file" -ForegroundColor Green
        }
    }
}

# --- main ---
if ($Help) {
    Show-Help
    exit 0
}

if ([string]::IsNullOrEmpty($Version)) {
    Write-Host "Version parameter is required. Use -Version to specify the version to release." -ForegroundColor Red
    Show-Help
    exit 1
}

if (-not ($Version -match '^v\d+\.\d+\.\d+(-[a-zA-Z0-9\.]+)?$')) {
    Write-Host "Invalid version format. Use 'vX.Y.Z' or 'vX.Y.Z-suffix'." -ForegroundColor Red
    Write-Host "Examples: v1.0.0, v0.1.0-beta.1, v2.0.0-rc.3" -ForegroundColor Cyan
    exit 1
}

if (-not (Test-GitAvailable)) {
    Write-Host "Git is not available. Please install Git and try again." -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($PreviousTag)) {
    $PreviousTag = Get-LatestGitTag
}

Push-Location $RootDir
try {
    if ($DryRun) {
        Write-Host "`n[DRY RUN] Starting release simulation for version: $Version" -ForegroundColor Cyan
        if ($DirectTag) {
            Write-Host "[DRY RUN] Mode: DirectTag (emergency)" -ForegroundColor Cyan
        }
        else {
            Write-Host "[DRY RUN] Mode: Release PR (default)" -ForegroundColor Cyan
        }
    }
    else {
        Write-Host "`nStarting release process for version: $Version" -ForegroundColor Green
        if ($DirectTag) {
            Write-Host "Mode: DirectTag (emergency)" -ForegroundColor Yellow
        }
        else {
            Write-Host "Mode: Release PR (default)" -ForegroundColor Green
        }
    }

    Assert-MainClean -PullMain
    $changelog = New-Changelog -previousTag $PreviousTag -currentTag $Version

    if ($DirectTag) {
        Invoke-DirectTagMode -version $Version -changelog $changelog
    }
    else {
        Invoke-ReleasePrMode -version $Version -changelog $changelog
    }

    Clear-ChangelogArtifact
    Write-Host "`nThank you for using the FastAPI RBAC Release Automation Script!" -ForegroundColor Cyan
}
finally {
    Pop-Location
}
