# Release Management Guide

This document describes the complete release process for the FastAPI RBAC project. This project is distributed as Docker images on Docker Hub, not as a Python package.

## Table of Contents

- [Overview](#overview)
- [Versioning Strategy](#versioning-strategy)
- [Release Types](#release-types)
- [Pre-Release Checklist](#pre-release-checklist)
- [Release Process](#release-process)
- [Automated Release Workflow](#automated-release-workflow)
- [Multi-Architecture Support](#multi-architecture-support)
- [Changelog Management](#changelog-management)
- [Rollback Procedures](#rollback-procedures)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

FastAPI RBAC uses a fully automated CI/CD pipeline for releases:

- **Versioning**: Semantic versioning (SemVer) with Git tags
- **Distribution**: Docker images published to Docker Hub
- **Automation**: GitHub Actions workflows for CI/CD
- **Architecture**: Multi-arch support (linux/amd64, linux/arm64)
- **Components**: Backend API, Frontend UI, Worker service

### Key Principles

1. **Automation First**: Minimize manual steps to reduce errors
2. **Multi-Architecture**: Support both AMD64 and ARM64 platforms
3. **Semantic Versioning**: Clear, predictable version numbering
4. **Traceability**: Every release linked to Git tags and commits
5. **Security**: Secure handling of credentials and secrets
6. **Rollback Ready**: Easy rollback to previous versions

## Versioning Strategy

We follow [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

### Version Format

- **Stable Releases**: `vMAJOR.MINOR.PATCH` (e.g., `v1.2.3`)
- **Pre-releases**: 
  - Alpha: `vMAJOR.MINOR.PATCH-alpha.N` (e.g., `v1.0.0-alpha.1`)
  - Beta: `vMAJOR.MINOR.PATCH-beta.N` (e.g., `v1.0.0-beta.2`)
  - Release Candidate: `vMAJOR.MINOR.PATCH-rc.N` (e.g., `v1.0.0-rc.1`)

### When to Bump Versions

- **MAJOR** (vX.0.0): Breaking changes, incompatible API changes
- **MINOR** (v0.X.0): New features, backward-compatible changes
- **PATCH** (v0.0.X): Bug fixes, backward-compatible fixes

### Version Examples

```bash
v1.0.0        # First stable release
v1.1.0        # Added new features
v1.1.1        # Bug fixes
v1.2.0-beta.1 # Beta release for v1.2.0
v2.0.0        # Major version with breaking changes
```

## Release Types

### 1. Patch Release (Bug Fixes)

**When**: Critical bug fixes, security patches, minor improvements

**Example**: `v1.2.3` → `v1.2.4`

**Process**:
```bash
# Create patch release
./scripts/deployment/release/create-release.sh -v v1.2.4
```

### 2. Minor Release (New Features)

**When**: New features, enhancements, backward-compatible changes

**Example**: `v1.2.4` → `v1.3.0`

**Process**:
```bash
# Create minor release
./scripts/deployment/release/create-release.sh -v v1.3.0
```

### 3. Major Release (Breaking Changes)

**When**: Breaking API changes, major architecture changes

**Example**: `v1.3.0` → `v2.0.0`

**Process**:
```bash
# Create major release with full validation
./scripts/deployment/release/create-release.sh -v v2.0.0
```

### 4. Pre-Release (Alpha, Beta, RC)

**When**: Testing new features before stable release

**Example**: `v1.3.0` → `v1.4.0-beta.1`

**Process**:
```bash
# Create beta release
./scripts/deployment/release/create-release.sh -v v1.4.0-beta.1
```

## Pre-Release Checklist

Before creating a release, ensure:

### Code Quality

- [ ] All CI/CD checks passing (backend-ci, frontend-ci)
- [ ] All tests passing locally and in CI
- [ ] Code review completed for all changes
- [ ] No critical bugs or security vulnerabilities
- [ ] Documentation updated for new features
- [ ] Database migrations tested (if applicable)

### Version and Documentation

- [ ] Version number decided and validated
- [ ] CHANGELOG.md updated with all changes
- [ ] Release notes prepared in docs/release-notes.md
- [ ] README.md updated if needed
- [ ] API documentation updated

### Dependencies and Security

- [ ] Dependencies updated and tested
- [ ] Security scan completed (no high/critical issues)
- [ ] Docker images tested in staging environment
- [ ] Database backups available

### Environment Preparation

- [ ] GitHub secrets configured (DOCKERHUB_USERNAME, DOCKERHUB_TOKEN)
- [ ] Docker Hub repositories accessible
- [ ] Main branch up-to-date with all changes
- [ ] No uncommitted changes in working directory

## Release Process

### Automated Release (Recommended)

Use the release automation script for a streamlined process:

```bash
# Navigate to release scripts directory
cd scripts/deployment/release

# Dry run to validate (recommended first step)
./create-release.sh -v v1.2.3 --dry-run

# Create release (generates changelog, updates docs, creates tag)
./create-release.sh -v v1.2.3

# Create release and build Docker images immediately
./create-release.sh -v v1.2.3 --build-docker
```

**Script Options**:
- `-v, --version`: Version to release (required)
- `-p, --previous-tag`: Previous tag for changelog generation (optional)
- `-s, --skip-notes`: Skip updating release notes
- `-b, --build-docker`: Build and push Docker images immediately
- `-r, --dry-run`: Simulate without making changes
- `-h, --help`: Show help message

### Manual Release Process

If you prefer manual control:

#### Step 1: Prepare the Release

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Verify working directory is clean
git status
```

#### Step 2: Update Release Notes

Edit `docs/release-notes.md`:

```markdown
### v1.2.3 (2024-12-21)

**New Features:**
- Feature 1 description
- Feature 2 description

**Bug Fixes:**
- Bug fix 1
- Bug fix 2

**Breaking Changes:**
- None

**Technical Details:**
- Implementation detail 1
- Implementation detail 2
```

#### Step 3: Commit Release Notes

```bash
git add docs/release-notes.md
git commit -m "docs: update release notes for v1.2.3"
git push origin main
```

#### Step 4: Create and Push Tag

```bash
# Create annotated tag
git tag -a v1.2.3 -m "Release v1.2.3"

# Push tag to trigger CI/CD
git push origin v1.2.3
```

#### Step 5: Monitor CI/CD

1. Go to [GitHub Actions](https://github.com/mnaimfaizy/fastapi_rbac/actions)
2. Watch the "Docker Publish" workflow
3. Verify all steps complete successfully

#### Step 6: Verify Docker Hub

1. Check [Docker Hub repositories](https://hub.docker.com/u/mnaimfaizy)
2. Verify images published with correct tags:
   - `mnaimfaizy/fastapi-rbac-backend:v1.2.3`
   - `mnaimfaizy/fastapi-rbac-frontend:v1.2.3`
   - `mnaimfaizy/fastapi-rbac-worker:v1.2.3`

#### Step 7: Create GitHub Release (Optional)

1. Go to [GitHub Releases](https://github.com/mnaimfaizy/fastapi_rbac/releases)
2. Click "Create a new release"
3. Select the tag (v1.2.3)
4. Copy content from release notes
5. Mark as pre-release if applicable
6. Publish release

## Automated Release Workflow

The release process is automated through GitHub Actions:

### Workflow Triggers

The `docker-publish.yml` workflow triggers on:

1. **Git Tag Push**: Any tag matching `v*` pattern
2. **Release Published**: When a GitHub release is published

### Workflow Steps

```yaml
1. Checkout repository
2. Set up Docker Buildx (for multi-arch builds)
3. Log in to Docker Hub
4. Create production environment file
5. Determine version tag
6. Build Docker images:
   - Backend (FastAPI app)
   - Frontend (React app) 
   - Worker (Celery worker)
7. Tag images with version
8. Push to Docker Hub
9. Update Docker Hub descriptions
```

### Multi-Architecture Builds

Images are built for multiple architectures:

- **linux/amd64**: Standard x86_64 architecture
- **linux/arm64**: ARM64 architecture (Apple Silicon, ARM servers)

This ensures compatibility across different platforms.

### Environment Variables

The workflow uses these environment variables:

- `IMAGE_TAG`: Version tag from Git tag or "latest"
- `DOCKERHUB_USERNAME`: Docker Hub username (from secrets)
- `DOCKERHUB_TOKEN`: Docker Hub access token (from secrets)

## Multi-Architecture Support

### Building Multi-Arch Images

The project uses Docker Buildx for multi-architecture support:

```bash
# Set up buildx builder
docker buildx create --use --name multiarch-builder

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t mnaimfaizy/fastapi-rbac-backend:v1.2.3 \
  --push \
  -f backend/Dockerfile.prod \
  backend/
```

### Testing Multi-Arch Images

```bash
# Test on AMD64
docker pull mnaimfaizy/fastapi-rbac-backend:v1.2.3
docker inspect mnaimfaizy/fastapi-rbac-backend:v1.2.3 | grep Architecture

# Test on ARM64 (if available)
docker pull --platform linux/arm64 mnaimfaizy/fastapi-rbac-backend:v1.2.3
```

### Platform-Specific Builds

If needed, build for specific platforms:

```bash
# AMD64 only
docker buildx build --platform linux/amd64 ...

# ARM64 only
docker buildx build --platform linux/arm64 ...
```

## Changelog Management

### Automated Changelog Generation

The release script generates changelogs from Git commit history:

```bash
# Generate changelog between tags
git log v1.2.2..HEAD --pretty=format:"- %s" > changelog.txt
```

### Conventional Commits

Use conventional commit format for better changelog generation:

```
feat: add user profile feature
fix: resolve authentication bug
docs: update API documentation
chore: update dependencies
test: add integration tests
refactor: improve code structure
perf: optimize database queries
```

### Categorizing Changes

Organize changes into categories:

- **New Features**: New functionality added
- **Bug Fixes**: Bugs and issues resolved
- **Breaking Changes**: Incompatible changes
- **Performance**: Performance improvements
- **Security**: Security enhancements
- **Documentation**: Documentation updates
- **Technical Details**: Implementation details

## Rollback Procedures

### Rolling Back a Release

If a release has issues, roll back to the previous version:

#### Step 1: Identify Previous Version

```bash
# List recent tags
git tag -l --sort=-v:refname | head -5

# Example output:
# v1.2.3  (broken)
# v1.2.2  (previous stable)
# v1.2.1
```

#### Step 2: Update Deployment

```bash
# Pull previous Docker images
docker pull mnaimfaizy/fastapi-rbac-backend:v1.2.2
docker pull mnaimfaizy/fastapi-rbac-frontend:v1.2.2
docker pull mnaimfaizy/fastapi-rbac-worker:v1.2.2

# Update docker-compose to use previous version
export IMAGE_TAG=v1.2.2
docker-compose -f docker-compose.prod.yml up -d
```

#### Step 3: Mark Release as Problematic

```bash
# Delete the problematic tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Or mark GitHub release as draft/pre-release
# (Do this through GitHub UI)
```

#### Step 4: Fix and Re-Release

```bash
# Fix issues
git commit -m "fix: resolve issue from v1.2.3"

# Create new patch version
./scripts/deployment/release/create-release.sh -v v1.2.4
```

### Hotfix Process

For critical bugs requiring immediate fix:

```bash
# Create hotfix branch from tag
git checkout -b hotfix/v1.2.4 v1.2.3

# Apply fix
git commit -m "fix: critical security vulnerability"

# Merge to main
git checkout main
git merge hotfix/v1.2.4

# Create hotfix release
./scripts/deployment/release/create-release.sh -v v1.2.4

# Clean up
git branch -d hotfix/v1.2.4
```

## Security Considerations

### Secrets Management

**Required Secrets** (configured in GitHub repository settings):

- `DOCKERHUB_USERNAME`: Docker Hub username
- `DOCKERHUB_TOKEN`: Docker Hub access token (not password!)

**Creating Docker Hub Token**:

1. Log in to Docker Hub
2. Go to Account Settings → Security
3. Click "New Access Token"
4. Name: "GitHub Actions RBAC"
5. Permissions: Read, Write, Delete
6. Copy token immediately (shown only once)

**Configuring GitHub Secrets**:

1. Go to repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`

### Security Best Practices

1. **Never commit secrets** to repository
2. **Use access tokens** instead of passwords
3. **Rotate tokens regularly** (every 90 days recommended)
4. **Limit token permissions** to minimum required
5. **Monitor token usage** in Docker Hub access logs
6. **Revoke compromised tokens** immediately
7. **Use environment-specific secrets** for different environments

### Image Security

- **Scan images** for vulnerabilities before release
- **Use minimal base images** (alpine, slim variants)
- **Run as non-root user** in containers
- **Keep dependencies updated** regularly
- **Sign images** for production (optional, advanced)

## Troubleshooting

### Common Issues and Solutions

#### Issue: Docker Build Fails

**Symptoms**: CI/CD workflow fails during Docker build step

**Solutions**:
```bash
# Check Dockerfile syntax
docker build -f backend/Dockerfile.prod backend/

# Verify all files exist
ls -la backend/

# Check build logs in GitHub Actions
```

#### Issue: Tag Already Exists

**Symptoms**: Error when pushing tag: "tag already exists"

**Solutions**:
```bash
# Delete local tag
git tag -d v1.2.3

# Delete remote tag
git push origin :refs/tags/v1.2.3

# Recreate tag
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

#### Issue: Docker Hub Push Fails

**Symptoms**: Images built but push to Docker Hub fails

**Solutions**:
1. Verify Docker Hub credentials in GitHub secrets
2. Check Docker Hub repository exists
3. Verify token has write permissions
4. Check Docker Hub service status

#### Issue: Multi-Arch Build Fails

**Symptoms**: Build fails for ARM64 platform

**Solutions**:
```bash
# Ensure buildx is set up
docker buildx create --use

# Install QEMU for cross-platform builds
docker run --privileged --rm tonistiigi/binfmt --install all

# Test build for specific platform
docker buildx build --platform linux/arm64 ...
```

#### Issue: CI/CD Workflow Not Triggering

**Symptoms**: Pushed tag but workflow doesn't run

**Solutions**:
1. Verify tag matches `v*` pattern
2. Check workflow file syntax (YAML)
3. Ensure workflow is enabled in repository settings
4. Check GitHub Actions permissions

### Getting Help

If you encounter issues not covered here:

1. **Check Logs**: Review GitHub Actions workflow logs
2. **Search Issues**: Look for similar issues in the repository
3. **Create Issue**: Open a new issue with:
   - Version attempting to release
   - Error messages and logs
   - Steps to reproduce
   - Environment details

## Best Practices Summary

### Before Every Release

✅ Run full test suite  
✅ Update documentation  
✅ Review and update changelog  
✅ Test in staging environment  
✅ Verify all CI checks pass  

### During Release

✅ Use automation scripts when possible  
✅ Test with dry-run first  
✅ Monitor CI/CD workflow  
✅ Verify images on Docker Hub  
✅ Test deployed images  

### After Release

✅ Announce release to team/users  
✅ Monitor for issues  
✅ Update production deployments  
✅ Archive release artifacts  
✅ Plan next release cycle  

## Quick Reference

### Common Commands

```bash
# Dry run release
./scripts/deployment/release/create-release.sh -v v1.2.3 --dry-run

# Create release
./scripts/deployment/release/create-release.sh -v v1.2.3

# Create release with Docker build
./scripts/deployment/release/create-release.sh -v v1.2.3 --build-docker

# Manual tag creation
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# List recent releases
git tag -l --sort=-v:refname | head -10

# Delete tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

### Important Links

- **GitHub Repository**: https://github.com/mnaimfaizy/fastapi_rbac
- **GitHub Actions**: https://github.com/mnaimfaizy/fastapi_rbac/actions
- **Docker Hub**: https://hub.docker.com/u/mnaimfaizy
- **Release Notes**: https://github.com/mnaimfaizy/fastapi_rbac/blob/main/docs/release-notes.md
- **Documentation**: https://fastapi-rbac.mnfprofile.com/

## Version History

See [Release Notes](docs/release-notes.md) for complete version history.
