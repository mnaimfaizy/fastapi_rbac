# Release Process

This document outlines the steps to create and publish a new release for the FastAPI RBAC project. Releases are versioned using Git tags, which automatically trigger a GitHub Actions workflow to build and push Docker images to Docker Hub.

## Prerequisites

1.  **Git:** Ensure Git is installed and configured on your local machine.
2.  **Docker Hub Account:** You need an account on Docker Hub where the images will be pushed.
3.  **GitHub Secrets:** The following secrets must be configured in the GitHub repository settings under "Secrets and variables" > "Actions":
    - `DOCKERHUB_USERNAME`: Your Docker Hub username.
    - `DOCKERHUB_TOKEN`: A Docker Hub access token with read/write permissions.

**Release history SSOT:** [`docs/release-notes.md`](../release-notes.md). There is no root `CHANGELOG.md`. Docker Hub repository descriptions are updated from `backend/README.dockerhub.md`, `react-frontend/README.dockerhub.md`, and `backend/README.worker.dockerhub.md` via `.github/workflows/docker-publish.yml` — not from release notes.

## Versioning Strategy

We use [Semantic Versioning](https://semver.org/) for our releases. Tags should follow these patterns:

- **Stable Releases:** `vX.Y.Z` (e.g., `v1.0.0`, `v1.2.3`, `v2.0.0`)
- **Pre-releases (e.g., Beta, Alpha, RC):** `vX.Y.Z-beta.N`, `vX.Y.Z-alpha.N`, `vX.Y.Z-rc.N` (e.g., `v0.1.0-beta.1`, `v1.0.0-rc.2`)

The GitHub Actions workflow is configured to trigger on any tag starting with `v`.

## Steps to Create a Release

1.  **Update Release Notes:**

    - Before creating a release, ensure the `docs/release-notes.md` file (release history SSOT) is updated with the new version information.
    - Add a new entry at the top of the version history section with:
      - Version number (e.g., `v1.0.0` or `v0.1.0-beta.1`)
      - Release date in YYYY-MM-DD format
      - Summary of changes categorized as "New Features", "Bug Fixes", and "Breaking Changes"
      - Optionally, include "Technical Details" with implementation notes
    - You can generate an ephemeral draft of changes from Git history with:
      ```powershell
      git log <previous_tag>..HEAD --pretty=format:"- %s" > changelog.txt
      ```
    - Review and edit the generated list (`changelog.txt` is gitignored), then add it to `docs/release-notes.md` under the appropriate categories.

2.  **Prepare Your Branch:**

    - Ensure your main working branch (e.g., `main`) contains all the code changes, bug fixes, and features intended for this release.
    - Pull the latest changes from the remote repository to ensure your local branch is up-to-date:
      ```powershell
      git checkout main  # Or your primary development branch
      git pull origin main
      ```

3.  **Create a Git Tag:**

    - Once your branch is ready and all changes are committed, create a new Git tag with the desired version number.
    - For a stable release:
      ```powershell
      git tag v1.0.0
      ```
    - For a pre-release (e.g., a beta):
      ```powershell
      git tag v0.1.0-beta.1
      ```
    - Replace `v1.0.0` or `v0.1.0-beta.1` with the actual version you are releasing.

4.  **Push the Git Tag to GitHub:**
    - Pushing the tag to the remote repository on GitHub will trigger the release workflow.
      ```powershell
      git push origin v1.0.0  # Replace with your tag name
      ```
    - To push all your local tags (if you've created multiple):
      ```powershell
      git push origin --tags
      ```

## What Happens Next (Automation)

1.  **GitHub Actions Workflow Triggered:** Docker Publish runs when a `v*` tag is pushed (human/local push), or via **workflow_dispatch** (Actions → Run workflow, or automatic dispatch from **Release Tag on Merge** after a Release PR). Tags created with `GITHUB_TOKEN` inside Actions do not start other workflows on push alone, which is why the Release Tag job dispatches Docker Publish explicitly.
2.  **Image Build & Tag:** The workflow checks out the tagged commit (including when started via workflow_dispatch). It then builds the Docker images for the backend, frontend, and worker services. The Docker images will be tagged with the same version as the Git tag (e.g., `yourusername/fastapi-rbac-backend:v1.0.0`).
3.  **Push to Docker Hub:** After a successful build, the tagged Docker images are pushed to your configured Docker Hub repository. The workflow also updates Hub repository descriptions from `backend/README.dockerhub.md`, `react-frontend/README.dockerhub.md`, and `backend/README.worker.dockerhub.md` (not from `docs/release-notes.md`).

## Verifying the Release

1.  **Check GitHub Actions:**

    - Navigate to the "Actions" tab in your GitHub repository.
    - You should see the "Docker Publish" workflow running or completed for the tag you pushed.
    - Verify that all steps in the workflow have passed successfully.

2.  **Check Docker Hub:**
    - Log in to your Docker Hub account.
    - Navigate to your repositories (e.g., `fastapi-rbac-backend`, `fastapi-rbac-frontend`, `fastapi-rbac-worker`).
    - You should see the new image tags corresponding to the Git tag you pushed (e.g., `v1.0.0`, `v0.1.0-beta.1`).

## Example: Releasing `v0.2.0`

### Using the Release Automation Script (Recommended)

We have automation scripts that simplify the release process by handling all the steps in one command:

1. **For PowerShell users:**

   ```powershell
   cd scripts\deployment\release
   .\Create-Release.ps1 -Version v0.2.0
   ```

2. **For Bash users:**
   ```bash
   cd scripts/deployment/release
   ./create-release.sh -v v0.2.0
   ```

These scripts will:

- Generate a changelog from Git history
- Update root `VERSION` (without the leading `v`) and `docs/release-notes.md`
- Commit those files with `docs: update release notes and version for <tag>`
- Create and push the Git tag (refuses if the tag already exists on remote; no force-push)
- Optionally build and push Docker images

You can use the `-DryRun` (PowerShell) or `--dry-run` (Bash) flag to simulate the release process without making any actual changes:

```powershell
.\Create-Release.ps1 -Version v0.2.0 -DryRun
```

```bash
./create-release.sh -v v0.2.0 --dry-run
```

Dry-run behavior (both scripts):

- Skips `git pull origin main` (non-mutating simulation)
- Does not write `VERSION` or `docs/release-notes.md`, commit, tag, or push
- Still generates temporary `changelog.txt` and leaves it in place (same as a successful dry-run cleanup message: “Would clean up”)
- Still prompts for interactive confirmations when warnings apply

For more options, run the scripts with the `-Help` or `--help` flag.

### Manual Release Process

If you prefer to release manually, follow these steps:

1.  Ensure `main` branch is ready.
    ```powershell
    git checkout main
    git pull origin main
    # (Make sure all commits for v0.2.0 are on main)
    ```
2.  Create the tag:
    ```powershell
    git tag v0.2.0
    ```
3.  Push the tag:
    ```powershell
    git push origin v0.2.0
    ```
4.  Monitor GitHub Actions and verify images on Docker Hub.

By following these steps, you can consistently create and publish new versions of the application.
