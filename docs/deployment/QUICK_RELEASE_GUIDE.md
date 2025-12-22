# Quick Release Guide

This is a quick reference for common release scenarios. For comprehensive documentation, see [RELEASE.md](../RELEASE.md).

## 🚀 Quick Start

### First-Time Setup

1. **Ensure GitHub secrets are configured:**
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

2. **Verify you have the latest main branch:**
   ```bash
   git checkout main
   git pull origin main
   ```

3. **Test the release script (dry-run):**
   ```bash
   ./scripts/deployment/release/create-release.sh -v v1.0.0 --dry-run
   ```

## 📋 Common Release Scenarios

### Scenario 1: Patch Release (Bug Fixes)

**When:** Fix critical bugs, security patches

**Example:** `v1.2.3` → `v1.2.4`

```bash
# Quick release
cd scripts/deployment/release
./create-release.sh -v v1.2.4

# Or with immediate Docker build
./create-release.sh -v v1.2.4 --build-docker
```

### Scenario 2: Minor Release (New Features)

**When:** Add new features, backward-compatible changes

**Example:** `v1.2.4` → `v1.3.0`

```bash
# Test first with dry-run
./create-release.sh -v v1.3.0 --dry-run

# Then create release
./create-release.sh -v v1.3.0
```

### Scenario 3: Major Release (Breaking Changes)

**When:** Breaking API changes, major architecture changes

**Example:** `v1.3.0` → `v2.0.0`

```bash
# Always test major releases first
./create-release.sh -v v2.0.0 --dry-run

# Review carefully, then release
./create-release.sh -v v2.0.0
```

### Scenario 4: Pre-Release (Beta/RC)

**When:** Testing new features before stable release

**Example:** `v1.3.0` → `v1.4.0-beta.1`

```bash
# Beta release
./create-release.sh -v v1.4.0-beta.1

# Release candidate
./create-release.sh -v v1.4.0-rc.1
```

### Scenario 5: Hotfix for Production

**When:** Critical bug in production needs immediate fix

```bash
# 1. Create hotfix branch from production tag
git checkout -b hotfix/v1.2.4 v1.2.3

# 2. Apply fix and commit
git commit -m "fix: critical security vulnerability"

# 3. Merge to main
git checkout main
git merge hotfix/v1.2.4
git push origin main

# 4. Release hotfix
cd scripts/deployment/release
./create-release.sh -v v1.2.4

# 5. Clean up
git branch -d hotfix/v1.2.4
```

### Scenario 6: Manual Workflow Trigger

**When:** Need to rebuild/republish existing version

1. Go to GitHub Actions → Docker Publish workflow
2. Click "Run workflow"
3. Select branch (usually main)
4. Enter version tag (e.g., `v1.2.3`)
5. Click "Run workflow"

## 🔍 Verification Checklist

After creating a release, verify:

- [ ] GitHub Actions workflow completes successfully
- [ ] All three Docker images published to Docker Hub:
  - `mnaimfaizy/fastapi-rbac-backend:vX.Y.Z`
  - `mnaimfaizy/fastapi-rbac-frontend:vX.Y.Z`
  - `mnaimfaizy/fastapi-rbac-worker:vX.Y.Z`
- [ ] Images support both architectures (linux/amd64, linux/arm64)
- [ ] VERSION file updated to `X.Y.Z` (without 'v')
- [ ] Release notes updated in `docs/release-notes.md`
- [ ] Git tag created and pushed

## 🐛 Quick Troubleshooting

### Problem: "Tag already exists"

**Solution:**
```bash
# Delete local tag
git tag -d v1.2.3

# Delete remote tag
git push origin :refs/tags/v1.2.3

# Recreate and push
./create-release.sh -v v1.2.3
```

### Problem: "Docker build fails in CI"

**Solutions:**
1. Check GitHub Actions logs for specific error
2. Verify Dockerfile syntax locally:
   ```bash
   docker build -f backend/Dockerfile.prod backend/
   ```
3. Check Docker Hub credentials in GitHub secrets
4. Verify all required files exist in context

### Problem: "Multi-arch build fails for ARM64"

**Solutions:**
1. Check if base images support ARM64
2. Verify dependencies available for ARM64
3. Review GitHub Actions logs for platform-specific errors
4. Test locally with:
   ```bash
   docker buildx build --platform linux/arm64 ...
   ```

### Problem: "Release script fails to commit"

**Solutions:**
1. Check for uncommitted changes:
   ```bash
   git status
   ```
2. Ensure you're on main branch:
   ```bash
   git checkout main
   ```
3. Pull latest changes:
   ```bash
   git pull origin main
   ```
4. Check file permissions on VERSION and docs/release-notes.md

## 🔄 Rollback Quick Guide

If a release has critical issues:

```bash
# 1. Identify previous stable version
git tag -l --sort=-v:refname | head -5

# 2. Pull previous images
docker pull mnaimfaizy/fastapi-rbac-backend:v1.2.2
docker pull mnaimfaizy/fastapi-rbac-frontend:v1.2.2
docker pull mnaimfaizy/fastapi-rbac-worker:v1.2.2

# 3. Update deployment to use previous version
export IMAGE_TAG=v1.2.2
docker-compose -f docker-compose.prod.yml up -d

# 4. Delete problematic tag (optional)
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

## 📊 Version Bump Quick Reference

| Change Type | Current | New Version | Bump |
|-------------|---------|-------------|------|
| Bug fix | v1.2.3 | v1.2.4 | Patch |
| New feature | v1.2.4 | v1.3.0 | Minor |
| Breaking change | v1.3.0 | v2.0.0 | Major |
| Beta release | v1.3.0 | v1.4.0-beta.1 | Pre-release |
| RC release | v1.4.0-beta.2 | v1.4.0-rc.1 | Pre-release |
| GA from RC | v1.4.0-rc.1 | v1.4.0 | Stable |

## 🎯 Best Practices

### Before Every Release

1. ✅ All tests passing
2. ✅ Code review completed
3. ✅ Documentation updated
4. ✅ Staging environment tested
5. ✅ Release notes prepared

### During Release

1. ✅ Use dry-run first for major versions
2. ✅ Monitor GitHub Actions workflow
3. ✅ Verify Docker Hub images
4. ✅ Test images in staging

### After Release

1. ✅ Announce to team
2. ✅ Monitor production metrics
3. ✅ Update deployment environments
4. ✅ Archive release artifacts

## 📞 Getting Help

- **Documentation**: [RELEASE.md](../RELEASE.md)
- **Process Changes**: [RELEASE_IMPROVEMENTS.md](docs/deployment/RELEASE_IMPROVEMENTS.md)
- **Original Process**: [RELEASE_PROCESS.md](docs/deployment/RELEASE_PROCESS.md)
- **Issues**: [GitHub Issues](https://github.com/mnaimfaizy/fastapi_rbac/issues)

## 🔗 Quick Links

- **GitHub Actions**: https://github.com/mnaimfaizy/fastapi_rbac/actions
- **Docker Hub**: https://hub.docker.com/u/mnaimfaizy
- **Release Notes**: https://github.com/mnaimfaizy/fastapi_rbac/blob/main/docs/release-notes.md
- **Repository**: https://github.com/mnaimfaizy/fastapi_rbac
