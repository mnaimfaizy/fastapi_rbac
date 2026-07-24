#!/bin/bash
# create-release.sh - FastAPI RBAC Release Automation Script
#
# Default: Release PR mode (branch release/vX.Y.Z, VERSION + notes, push, gh pr create).
# Emergency: --direct-tag tags from main (discouraged).
# Kept in parity with Create-Release.ps1 (Phase C1).
#
# Author: FastAPI RBAC Team
# Created: July 2, 2025

set -e

SKIP_NOTES=false
BUILD_DOCKER=false
DRY_RUN=false
DIRECT_TAG=false
YES=false
NOTES_FILE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../" && pwd)"
RELEASE_NOTES_PATH="$ROOT_DIR/docs/release-notes.md"
CHANGELOG_PATH="$ROOT_DIR/changelog.txt"
VERSION_FILE_PATH="$ROOT_DIR/VERSION"
DOCKER_BUILD_SCRIPT="$ROOT_DIR/scripts/deployment/production/build-and-push.sh"
REPO_ACTIONS_URL="https://github.com/mnaimfaizy/fastapi_rbac/actions"

cleanup() {
    if [ "$DRY_RUN" != true ] && [ -f "$CHANGELOG_PATH" ]; then
        echo -e "\nCleaning up changelog file after error..."
        rm -f "$CHANGELOG_PATH"
    fi
}
trap cleanup EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

function show_help {
    echo -e "${CYAN}\nFastAPI RBAC Release Automation Script"
    echo -e "======================================${NC}"
    echo -e "\nDefault mode opens a Release PR (release/vX.Y.Z). Use --direct-tag only for emergencies.\n"

    echo -e "${YELLOW}Parameters:${NC}"
    echo -e "${WHITE}  -v, --version VERSION     : Version to release (required)${NC}"
    echo -e "${WHITE}  -p, --previous-tag TAG    : Previous tag for changelog (default: latest)${NC}"
    echo -e "${WHITE}  -n, --notes-file PATH     : Release-notes section to insert${NC}"
    echo -e "${WHITE}  -s, --skip-notes          : Skip docs/release-notes.md (still updates VERSION in PR mode)${NC}"
    echo -e "${WHITE}      --direct-tag          : EMERGENCY — tag from main (skips Release PR)${NC}"
    echo -e "${WHITE}  -y, --yes                 : Non-interactive (fail closed on unsafe warnings)${NC}"
    echo -e "${WHITE}  -b, --build-docker        : Local image build (DirectTag only)${NC}"
    echo -e "${WHITE}  -r, --dry-run             : Simulate without mutating remotes/release files${NC}"
    echo -e "${WHITE}  -h, --help                : Show this help${NC}"

    echo -e "\n${YELLOW}Examples:${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0 --yes${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0 --notes-file ./notes-section.md --yes${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0 --dry-run${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0 --direct-tag --yes   # discouraged${NC}"

    echo -e "\n${YELLOW}Default process (Release PR):${NC}"
    echo -e "${WHITE}  1. Ensure main is clean and up to date${NC}"
    echo -e "${WHITE}  2. Create branch release/<version> (branch name is version SSOT)${NC}"
    echo -e "${WHITE}  3. Update VERSION + docs/release-notes.md and commit${NC}"
    echo -e "${WHITE}  4. Push branch and open PR with gh; print PR URL${NC}"
    echo -e "${WHITE}  5. After merge, CI creates the tag / GitHub Release (Phase C2+)${NC}"

    echo -e "\n${YELLOW}Dry-run notes:${NC}"
    echo -e "${WHITE}  • Skips git pull, file writes, commit, push, tag, and gh pr create${NC}"
    echo -e "${WHITE}  • Still writes temporary changelog.txt (left in place)${NC}"
    echo ""
}

function test_git_available {
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Git is not available. Please install Git and try again.${NC}"
        exit 1
    fi
}

function test_gh_available {
    if ! command -v gh &> /dev/null; then
        return 1
    fi
    return 0
}

function get_latest_git_tag {
    if ! git describe --tags --abbrev=0 2>/dev/null; then
        echo -e "${YELLOW}No previous tags found. This appears to be the first release.${NC}" >&2
        return 1
    fi
}

# confirm_continue "prompt" [allow_yes_continue]
# allow_yes_continue=1 means -y continues; otherwise -y fails closed
function confirm_continue {
    local prompt="$1"
    local allow_yes_continue="${2:-0}"

    if [ "$YES" = true ]; then
        if [ "$allow_yes_continue" = "1" ]; then
            echo -e "${YELLOW}Continuing (--yes): $prompt${NC}"
            return 0
        fi
        echo -e "${RED}Non-interactive (--yes): refusing to continue without confirmation.${NC}"
        echo -e "${YELLOW}  $prompt${NC}"
        exit 1
    fi

    local confirmation
    read -p "$prompt (y/n): " confirmation
    if [ "$confirmation" = "y" ]; then
        return 0
    fi
    return 1
}

function assert_main_clean {
    local pull_main="${1:-1}"
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)

    if [ "$current_branch" != "main" ]; then
        echo -e "${YELLOW}WARNING: You are not on the 'main' branch. Current branch: $current_branch${NC}"
        if [ "$YES" = true ]; then
            echo -e "${RED}Non-interactive (--yes): must start from main.${NC}"
            exit 1
        fi
        if ! confirm_continue "Do you want to continue anyway?"; then
            echo -e "${RED}Operation cancelled. Please switch to the main branch and try again.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}Current branch is 'main'${NC}"
    fi

    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}WARNING: You have uncommitted changes in your working directory.${NC}"
        if [ "$YES" = true ]; then
            echo -e "${RED}Non-interactive (--yes): working tree must be clean.${NC}"
            exit 1
        fi
        if ! confirm_continue "Do you want to continue anyway?"; then
            echo -e "${RED}Operation cancelled. Please commit or stash your changes and try again.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}Working directory is clean${NC}"
    fi

    if [ "$pull_main" != "1" ]; then
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] Skipping git pull origin main${NC}"
        return 0
    fi

    echo -e "${CYAN}Pulling latest changes from origin/main...${NC}"
    if ! git pull origin main; then
        echo -e "${RED}Failed to pull latest changes. Please resolve any conflicts and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Successfully pulled latest changes${NC}"
}

function generate_changelog {
    local previous_tag="$1"

    echo -e "${CYAN}Generating changelog from Git history...${NC}" >&2

    if [ -f "$CHANGELOG_PATH" ]; then
        rm -f "$CHANGELOG_PATH"
        echo -e "${CYAN}Removed existing changelog file${NC}" >&2
    fi

    if [ -z "$previous_tag" ]; then
        git log --pretty=format:"- %s" > "$CHANGELOG_PATH"
    else
        git log "${previous_tag}..HEAD" --pretty=format:"- %s" > "$CHANGELOG_PATH"
    fi

    local changelog
    changelog=$(cat "$CHANGELOG_PATH")
    if [ -z "$changelog" ]; then
        echo -e "${YELLOW}WARNING: No commits found between $previous_tag and HEAD.${NC}" >&2
        if ! confirm_continue "Do you want to continue anyway?" 1; then
            echo -e "${RED}Operation cancelled.${NC}" >&2
            exit 1
        fi
    else
        echo -e "${GREEN}Changelog generated successfully${NC}" >&2
        echo -e "${CYAN}\nRaw Changelog:${NC}" >&2
        echo -e "${WHITE}$changelog${NC}" >&2
    fi

    printf '%s' "$changelog"
}

function build_release_notes_entry {
    local version="$1"
    local changelog="$2"
    local today
    today=$(date +%Y-%m-%d)

    if [ -n "$NOTES_FILE" ]; then
        if [ ! -f "$NOTES_FILE" ]; then
            echo -e "${RED}Notes file not found: $NOTES_FILE${NC}" >&2
            exit 1
        fi
        local notes_content
        notes_content=$(cat "$NOTES_FILE")
        if echo "$notes_content" | grep -qE '^###[[:space:]]'; then
            printf '\n%s\n' "$notes_content"
            return 0
        fi
        printf '\n### %s (%s)\n\n%s\n' "$version" "$today" "$notes_content"
        return 0
    fi

    cat <<EOF

### $version ($today)

**New Features:**

- [Add features here]

**Bug Fixes:**

- [Add bug fixes here]

**Breaking Changes:**

- None

**Technical Details:**

$changelog

EOF
}

function update_version_and_notes {
    local version="$1"
    local changelog="$2"
    local commit_changes="$3"
    local version_without_v="${version#v}"

    echo -e "\n${CYAN}Updating release notes and VERSION file...${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] Would update VERSION file to: $version_without_v${NC}"
    else
        printf '%s\n' "$version_without_v" > "$VERSION_FILE_PATH"
        echo -e "${GREEN}Updated VERSION file to: $version_without_v${NC}"
    fi

    if [ "$SKIP_NOTES" = true ]; then
        echo -e "${YELLOW}Skipping docs/release-notes.md update (--skip-notes).${NC}"
        if [ "$commit_changes" = true ] && [ "$DRY_RUN" != true ]; then
            echo -e "\n${CYAN}Committing VERSION file...${NC}"
            git add "$VERSION_FILE_PATH"
            if ! git commit -m "chore(release): prepare $version"; then
                echo -e "${RED}Failed to commit VERSION.${NC}"
                exit 1
            fi
            echo -e "${GREEN}VERSION committed successfully${NC}"
        elif [ "$commit_changes" = true ] && [ "$DRY_RUN" = true ]; then
            echo -e "${CYAN}[DRY RUN] Would commit VERSION for $version${NC}"
        fi
        return 0
    fi

    if [ ! -f "$RELEASE_NOTES_PATH" ]; then
        echo -e "${RED}Release notes file not found at: $RELEASE_NOTES_PATH${NC}"
        exit 1
    fi

    if grep -q "### $version " "$RELEASE_NOTES_PATH"; then
        echo -e "${YELLOW}WARNING: Version $version already exists in release notes.${NC}"
        if ! confirm_continue "Do you want to continue anyway?" 1; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
    fi

    local new_entry
    new_entry=$(build_release_notes_entry "$version" "$changelog")

    local version_history_line
    version_history_line=$(grep -n "^## Version History" "$RELEASE_NOTES_PATH" | cut -d: -f1)
    if [ -z "$version_history_line" ]; then
        echo -e "${RED}Could not find '## Version History' section in release notes.${NC}"
        exit 1
    fi

    local tmp_file
    tmp_file=$(mktemp)
    awk -v line="$version_history_line" -v entry="$new_entry" '
        NR == line {print $0; print entry; next}
        {print}
    ' "$RELEASE_NOTES_PATH" > "$tmp_file"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] Would update release notes with new version $version${NC}"
        echo -e "${CYAN}[DRY RUN] Would commit the updated release notes and VERSION file${NC}"
        echo -e "\n${YELLOW}Preview of release notes entry:${NC}"
        echo -e "=================================${NC}"
        echo "$new_entry"
        echo -e "=================================${NC}"
        rm -f "$tmp_file"
        return 0
    fi

    cp "$RELEASE_NOTES_PATH" "${RELEASE_NOTES_PATH}.bak"
    mv "$tmp_file" "$RELEASE_NOTES_PATH"
    echo -e "${GREEN}Updated release notes with new version $version${NC}"

    if [ "$YES" != true ] && [ -z "$NOTES_FILE" ]; then
        echo -e "\n${YELLOW}IMPORTANT: Please review and edit the release notes before continuing.${NC}"
        echo -e "${YELLOW}Stub sections may need categorization; or pass --notes-file / --yes for agents.${NC}"
        if ! confirm_continue "Have you reviewed and edited the release notes?"; then
            echo -e "${CYAN}Please edit the release notes at: $RELEASE_NOTES_PATH${NC}"
            echo -e "${CYAN}Then re-run with --skip-notes or provide --notes-file --yes.${NC}"
            exit 0
        fi
    fi

    rm -f "${RELEASE_NOTES_PATH}.bak"

    if [ "$commit_changes" = true ]; then
        echo -e "\n${CYAN}Committing the updated release notes and VERSION file...${NC}"
        git add "$RELEASE_NOTES_PATH" "$VERSION_FILE_PATH"
        if ! git commit -m "chore(release): prepare $version"; then
            echo -e "${YELLOW}WARNING: Failed to commit the updated files.${NC}"
            if ! confirm_continue "Do you want to continue anyway?"; then
                echo -e "${RED}Operation cancelled.${NC}"
                exit 1
            fi
        else
            echo -e "${GREEN}Release notes and VERSION file committed successfully${NC}"
        fi
    fi
}

function create_git_tag {
    local version="$1"

    echo -e "\n${CYAN}Creating Git tag: $version...${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] Would create Git tag: $version${NC}"
        echo -e "${CYAN}[DRY RUN] Would push Git tag to remote${NC}"
        return 0
    fi

    if git ls-remote --tags origin "refs/tags/$version" | grep -q "$version"; then
        echo -e "${RED}Tag $version already exists on remote. Refusing to retag.${NC}"
        echo -e "${YELLOW}This script does not force-push tags. Delete the remote tag explicitly if you intend to replace it, then re-run.${NC}"
        exit 1
    fi

    if git tag -l "$version" | grep -q "$version"; then
        echo -e "${YELLOW}WARNING: Tag $version already exists locally.${NC}"
        if ! confirm_continue "Do you want to replace the local tag and push it?"; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
        if ! git tag -d "$version"; then
            echo -e "${RED}Failed to delete existing local tag.${NC}"
            exit 1
        fi
    fi

    if ! git tag -a "$version" -m "Release $version"; then
        echo -e "${RED}Failed to create Git tag.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Git tag created successfully${NC}"

    echo -e "\n${CYAN}Pushing Git tag to remote...${NC}"
    if ! git push origin "$version"; then
        echo -e "${RED}Failed to push Git tag to remote.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Git tag pushed successfully${NC}"
}

function build_docker_images {
    local version="$1"

    echo -e "\n${CYAN}Checking Docker availability...${NC}"

    if ! command -v docker &>/dev/null; then
        echo -e "${RED}Docker is not installed or not in PATH. Cannot build Docker images.${NC}"
        if ! confirm_continue "Do you want to continue without building Docker images?" 1; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
        return 0
    fi

    if ! docker info &>/dev/null; then
        echo -e "${RED}Docker engine is not running. Cannot build Docker images.${NC}"
        if ! confirm_continue "Do you want to continue without building Docker images?" 1; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
        return 0
    fi

    echo -e "\n${CYAN}Building and pushing Docker images...${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] Would build and push Docker images with tag: $version${NC}"
        echo -e "${CYAN}[DRY RUN] Would execute: $DOCKER_BUILD_SCRIPT $version${NC}"
        return 0
    fi

    if [ ! -f "$DOCKER_BUILD_SCRIPT" ]; then
        echo -e "${RED}Docker build script not found at: $DOCKER_BUILD_SCRIPT${NC}"
        if ! confirm_continue "Do you want to continue without building Docker images?" 1; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
        return 0
    fi

    chmod +x "$DOCKER_BUILD_SCRIPT"
    echo -e "${CYAN}Running Docker build script with tag: $version${NC}"
    if ! "$DOCKER_BUILD_SCRIPT" "$version"; then
        echo -e "${RED}Docker build script failed.${NC}"
        if ! confirm_continue "Do you want to continue anyway?"; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}Docker images built and pushed successfully${NC}"
    fi
}

function invoke_release_pr_mode {
    local version="$1"
    local changelog="$2"
    local release_branch="release/$version"

    echo -e "\n${CYAN}Release PR mode (default). Branch SSOT: $release_branch${NC}"

    if [ "$BUILD_DOCKER" = true ]; then
        echo -e "${YELLOW}WARNING: --build-docker is ignored in Release PR mode (images publish after tag on merge).${NC}"
    fi

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] Would create branch: $release_branch${NC}"
        update_version_and_notes "$version" "$changelog" true
        echo -e "${CYAN}[DRY RUN] Would push $release_branch and run: gh pr create --base main --head $release_branch${NC}"
        echo -e "${CYAN}[DRY RUN] Would print the PR URL${NC}"
        return 0
    fi

    if git ls-remote --tags origin "refs/tags/$version" | grep -q "$version"; then
        echo -e "${RED}Tag $version already exists on remote. Refusing to open a Release PR for it.${NC}"
        echo -e "${YELLOW}This script does not force-push tags.${NC}"
        exit 1
    fi

    if git show-ref --verify --quiet "refs/heads/$release_branch"; then
        echo -e "${RED}Local branch $release_branch already exists.${NC}"
        exit 1
    fi

    if git ls-remote --heads origin "$release_branch" | grep -q "$release_branch"; then
        echo -e "${RED}Remote branch $release_branch already exists.${NC}"
        exit 1
    fi

    if ! test_gh_available; then
        echo -e "${RED}GitHub CLI (gh) is required for Release PR mode. Install gh or use --direct-tag (discouraged).${NC}"
        exit 1
    fi

    echo -e "${CYAN}Creating branch $release_branch...${NC}"
    if ! git checkout -b "$release_branch"; then
        echo -e "${RED}Failed to create branch $release_branch.${NC}"
        exit 1
    fi

    update_version_and_notes "$version" "$changelog" true

    echo -e "\n${CYAN}Pushing branch $release_branch...${NC}"
    if ! git push -u origin "$release_branch"; then
        echo -e "${RED}Failed to push branch $release_branch.${NC}"
        exit 1
    fi

    local pr_body
    pr_body=$(cat <<EOF
## Summary
- Prepare release **$version** (branch \`$release_branch\` is version SSOT).
- Updates \`VERSION\` and \`docs/release-notes.md\`.

## After merge
- Tagging / GitHub Release should be created by CI (release-tag-on-merge).
- Docker Hub images publish from the \`v*\` tag via Docker Publish.

## Test plan
- [ ] Release notes look correct
- [ ] VERSION matches branch (without leading \`v\`)
- [ ] CI green before merge
EOF
)

    echo -e "\n${CYAN}Creating pull request...${NC}"
    local pr_url
    if ! pr_url=$(gh pr create --base main --head "$release_branch" --title "chore(release): $version" --body "$pr_body"); then
        echo -e "${RED}Failed to create pull request.${NC}"
        exit 1
    fi

    echo -e "\n${GREEN}Release PR created:${NC}"
    echo -e "${WHITE}$pr_url${NC}"
    echo -e "\n${YELLOW}Merge the PR to cut the release. Monitor: $REPO_ACTIONS_URL${NC}"
}

function invoke_direct_tag_mode {
    local version="$1"
    local changelog="$2"

    echo -e "\n${YELLOW}WARNING: --direct-tag is an emergency path (tags from main, no Release PR).${NC}"

    update_version_and_notes "$version" "$changelog" true

    if [ "$DRY_RUN" != true ] && [ "$SKIP_NOTES" != true ]; then
        echo -e "\n${CYAN}Pushing main (release notes / VERSION commit)...${NC}"
        if ! git push origin main; then
            echo -e "${RED}Failed to push main. Tag will not be created until main is pushed.${NC}"
            exit 1
        fi
    elif [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] Would push main after notes/VERSION commit${NC}"
    fi

    # When SkipNotes but VERSION was committed, still need push
    if [ "$DRY_RUN" != true ] && [ "$SKIP_NOTES" = true ]; then
        echo -e "\n${CYAN}Pushing main (VERSION commit)...${NC}"
        if ! git push origin main; then
            echo -e "${RED}Failed to push main.${NC}"
            exit 1
        fi
    fi

    create_git_tag "$version"

    if [ "$BUILD_DOCKER" = true ]; then
        build_docker_images "$version"
    else
        echo -e "\n${YELLOW}Skipping Docker build (use -b/--build-docker with --direct-tag to build images locally).${NC}"
    fi

    if [ "$DRY_RUN" = true ]; then
        echo -e "\n${GREEN}Dry run completed for direct-tag path: $version${NC}"
    else
        echo -e "\n${GREEN}Direct-tag release completed for: $version${NC}"
        echo -e "${YELLOW}Next steps:${NC}"
        echo -e "${WHITE}  1. Monitor GitHub Actions: $REPO_ACTIONS_URL${NC}"
        echo -e "${WHITE}  2. Verify Docker images on Docker Hub${NC}"
    fi
}

function clear_changelog_artifact {
    if [ -f "$CHANGELOG_PATH" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "${CYAN}[DRY RUN] Would clean up temporary files (changelog.txt left in place)${NC}"
        else
            rm -f "$CHANGELOG_PATH"
            echo -e "${GREEN}Removed temporary changelog file${NC}"
        fi
    fi
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -p|--previous-tag)
            PREVIOUS_TAG="$2"
            shift 2
            ;;
        -n|--notes-file)
            NOTES_FILE="$2"
            shift 2
            ;;
        -s|--skip-notes)
            SKIP_NOTES=true
            shift
            ;;
        --direct-tag)
            DIRECT_TAG=true
            shift
            ;;
        -y|--yes)
            YES=true
            shift
            ;;
        -b|--build-docker)
            BUILD_DOCKER=true
            shift
            ;;
        -r|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

if [ -z "$VERSION" ]; then
    echo -e "${RED}Version parameter is required. Use -v or --version.${NC}"
    show_help
    exit 1
fi

if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9\.]+)?$ ]]; then
    echo -e "${RED}Invalid version format. Use 'vX.Y.Z' or 'vX.Y.Z-suffix'.${NC}"
    echo -e "${CYAN}Examples: v1.0.0, v0.1.0-beta.1, v2.0.0-rc.3${NC}"
    exit 1
fi

test_git_available

if [ -z "$PREVIOUS_TAG" ]; then
    PREVIOUS_TAG=$(get_latest_git_tag) || PREVIOUS_TAG=""
fi

cd "$ROOT_DIR"

if [ "$DRY_RUN" = true ]; then
    echo -e "\n${CYAN}[DRY RUN] Starting release simulation for version: $VERSION${NC}"
    if [ "$DIRECT_TAG" = true ]; then
        echo -e "${CYAN}[DRY RUN] Mode: DirectTag (emergency)${NC}"
    else
        echo -e "${CYAN}[DRY RUN] Mode: Release PR (default)${NC}"
    fi
else
    echo -e "\n${GREEN}Starting release process for version: $VERSION${NC}"
    if [ "$DIRECT_TAG" = true ]; then
        echo -e "${YELLOW}Mode: DirectTag (emergency)${NC}"
    else
        echo -e "${GREEN}Mode: Release PR (default)${NC}"
    fi
fi

assert_main_clean 1
CHANGELOG=$(generate_changelog "$PREVIOUS_TAG")

if [ "$DIRECT_TAG" = true ]; then
    invoke_direct_tag_mode "$VERSION" "$CHANGELOG"
else
    invoke_release_pr_mode "$VERSION" "$CHANGELOG"
fi

clear_changelog_artifact
# Disable EXIT cleanup of changelog after successful non-dry path already cleared it
trap - EXIT

echo -e "\n${CYAN}Thank you for using the FastAPI RBAC Release Automation Script!${NC}"
