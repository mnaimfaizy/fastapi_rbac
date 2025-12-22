#!/bin/bash
# create-release.sh - FastAPI RBAC Release Automation Script
#
# This script automates the release process for the FastAPI RBAC project by:
# 1. Generating a changelog from Git history
# 2. Updating the release notes file
# 3. Creating and pushing a Git tag
# 4. Optionally building and pushing Docker images
#
# Author: FastAPI RBAC Team
# Created: July 2, 2025

set -e

# Default values
SKIP_NOTES=false
BUILD_DOCKER=false
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../" && pwd)"
RELEASE_NOTES_PATH="$ROOT_DIR/docs/release-notes.md"
CHANGELOG_PATH="$ROOT_DIR/changelog.txt"
DOCKER_BUILD_SCRIPT="$ROOT_DIR/scripts/deployment/production/build-and-push.sh"

# Add a trap to ensure we clean up the changelog file even on error
cleanup() {
    # Only clean up if not in dry run mode
    if [ "$DRY_RUN" != true ] && [ -f "$CHANGELOG_PATH" ]; then
        echo -e "\nCleaning up changelog file after error..."
        rm -f "$CHANGELOG_PATH"
    fi
}
trap cleanup EXIT

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

function show_help {
    echo -e "${CYAN}\n🚀 FastAPI RBAC Release Automation Script"
    echo -e "===========================================${NC}"
    echo -e "\nThis script automates the release process for the FastAPI RBAC project.\n"

    echo -e "${YELLOW}📋 Parameters:${NC}"
    echo -e "${WHITE}  -v, --version VERSION   : Version to release (e.g., v1.0.0, v0.1.0-beta.1)${NC}"
    echo -e "${WHITE}  -p, --previous-tag TAG  : Previous tag to generate changelog from (defaults to latest tag)${NC}"
    echo -e "${WHITE}  -s, --skip-notes        : Skip updating release notes (just create and push tag)${NC}"
    echo -e "${WHITE}  -b, --build-docker      : Build and push Docker images (opt-in)${NC}"
    echo -e "${WHITE}  -r, --dry-run           : Simulate the release process without making actual changes${NC}"
    echo -e "${WHITE}  -h, --help              : Show this help message${NC}"

    echo -e "\n${YELLOW}💡 Examples:${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0 -p v0.9.0${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0 --skip-notes${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0 --build-docker${NC}"
    echo -e "${WHITE}  ./create-release.sh -v v1.0.0 --dry-run${NC}"

    echo -e "\n${YELLOW}📝 Process:${NC}"
    echo -e "${WHITE}  1. Generate changelog from Git history${NC}"
    echo -e "${WHITE}  2. Update release notes file (docs/release-notes.md)${NC}"
    echo -e "${WHITE}  3. Create and push Git tag${NC}"
    echo -e "${WHITE}  4. Optionally build and push Docker images (with -b/--build-docker flag)${NC}"

    echo -e "\n${YELLOW}🔧 Requirements:${NC}"
    echo -e "${WHITE}  • Git installed and configured${NC}"
    echo -e "${WHITE}  • Access to the repository${NC}"
    echo -e "${WHITE}  • Docker installed and running (if using -b/--build-docker)${NC}"
    echo ""
}

function test_git_available {
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git is not available. Please install Git and try again.${NC}"
        exit 1
    fi
}

function get_latest_git_tag {
    if ! git describe --tags --abbrev=0 2>/dev/null; then
        echo -e "${YELLOW}No previous tags found. This appears to be the first release.${NC}"
        return 1
    fi
}

function confirm_main_branch {
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$current_branch" != "main" ]; then
        echo -e "${YELLOW}⚠️ WARNING: You are not on the 'main' branch. Current branch: $current_branch${NC}"
        read -p "Do you want to continue anyway? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled. Please switch to the main branch and try again.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Current branch is 'main'${NC}"
    fi

    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}⚠️ WARNING: You have uncommitted changes in your working directory.${NC}"
        read -p "Do you want to continue anyway? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled. Please commit or stash your changes and try again.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Working directory is clean${NC}"
    fi

    # Pull latest changes
    echo -e "${CYAN}Pulling latest changes from origin/main...${NC}"
    if ! git pull origin main; then
        echo -e "${RED}❌ Failed to pull latest changes. Please resolve any conflicts and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Successfully pulled latest changes${NC}"
}

function generate_changelog {
    local previous_tag="$1"
    local current_tag="$2"

    echo -e "${CYAN}Generating changelog from Git history...${NC}"

    # Clean up any existing changelog file
    if [ -f "$CHANGELOG_PATH" ]; then
        rm -f "$CHANGELOG_PATH"
        echo -e "${CYAN}Removed existing changelog file${NC}"
    fi

    if [ -z "$previous_tag" ]; then
        # If this is the first release, get all commits
        git log --pretty=format:"- %s" > "$CHANGELOG_PATH"
    else
        # Get commits between tags
        git log "${previous_tag}..HEAD" --pretty=format:"- %s" > "$CHANGELOG_PATH"
    fi

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to generate changelog.${NC}"
        exit 1
    fi

    # Read the changelog
    local changelog
    changelog=$(cat "$CHANGELOG_PATH")
    if [ -z "$changelog" ]; then
        echo -e "${YELLOW}⚠️ WARNING: No commits found between $previous_tag and HEAD.${NC}"
        read -p "Do you want to continue anyway? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Changelog generated successfully${NC}"
        echo -e "${CYAN}\nRaw Changelog:${NC}"
        echo -e "${WHITE}$changelog${NC}"
    fi

    echo "$changelog"
}

function update_release_notes {
    local version="$1"
    local changelog="$2"

    echo -e "\n${CYAN}Updating release notes and VERSION file...${NC}"

    # Update VERSION file
    local version_without_v="${version#v}"  # Remove 'v' prefix if present
    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}🔍 [DRY RUN] Would update VERSION file to: $version_without_v${NC}"
    else
        echo "$version_without_v" > "$ROOT_DIR/VERSION"
        echo -e "${GREEN}✅ Updated VERSION file to: $version_without_v${NC}"
    fi

    # Check if release notes file exists
    if [ ! -f "$RELEASE_NOTES_PATH" ]; then
        echo -e "${RED}❌ Release notes file not found at: $RELEASE_NOTES_PATH${NC}"
        exit 1
    fi

    # Check if version already exists in release notes
    if grep -q "### $version " "$RELEASE_NOTES_PATH"; then
        echo -e "${YELLOW}⚠️ WARNING: Version $version already exists in release notes.${NC}"
        read -p "Do you want to continue anyway? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
    fi

    # Prepare new release notes entry
    local today
    today=$(date +%Y-%m-%d)
    local new_entry="
### $version ($today)

**New Features:**

- [Add features here]

**Bug Fixes:**

- [Add bug fixes here]

**Breaking Changes:**

- None

**Technical Details:**

$changelog
"

    # Find the position to insert the new entry (after "## Version History" section)
    local version_history_line
    version_history_line=$(grep -n "^## Version History" "$RELEASE_NOTES_PATH" | cut -d: -f1)
    if [ -z "$version_history_line" ]; then
        echo -e "${RED}❌ Could not find '## Version History' section in release notes.${NC}"
        exit 1
    fi

    # Create temporary file for updated release notes
    local tmp_file
    tmp_file=$(mktemp)

    # Insert the new entry after the "## Version History" line
    awk -v line="$version_history_line" -v entry="$new_entry" '
        NR == line {print $0; print entry; next}
        {print}
    ' "$RELEASE_NOTES_PATH" > "$tmp_file"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}🔍 [DRY RUN] Would create backup of release notes at: ${RELEASE_NOTES_PATH}.bak${NC}"
        echo -e "${CYAN}🔍 [DRY RUN] Would update release notes with new version $version${NC}"
        echo -e "${CYAN}🔍 [DRY RUN] Would commit the updated release notes${NC}"
        echo -e "\n${YELLOW}Preview of release notes changes:${NC}"
        echo -e "=================================${NC}"
        cat "$tmp_file" | grep -A 20 "$version" | head -n 20
        echo -e "...\n=================================${NC}"
        rm -f "$tmp_file"
        return
    fi

    # Create backup of current release notes
    cp "$RELEASE_NOTES_PATH" "${RELEASE_NOTES_PATH}.bak"
    echo -e "${GREEN}✅ Created backup of release notes at: ${RELEASE_NOTES_PATH}.bak${NC}"

    # Replace original file with updated content
    mv "$tmp_file" "$RELEASE_NOTES_PATH"
    echo -e "${GREEN}✅ Updated release notes with new version $version${NC}"

    echo -e "\n${YELLOW}⚠️ IMPORTANT: Please review and edit the release notes manually before continuing.${NC}"
    echo -e "${YELLOW}The generated changelog has been added to the 'Technical Details' section.${NC}"
    echo -e "${YELLOW}You should categorize the changes into 'New Features', 'Bug Fixes', and 'Breaking Changes'.${NC}"

    read -p "Have you reviewed and edited the release notes? (y/n): " confirmation
    if [ "$confirmation" != "y" ]; then
        echo -e "${CYAN}Please edit the release notes at: $RELEASE_NOTES_PATH${NC}"
        echo -e "${CYAN}Then run this script again with the --skip-notes flag to continue.${NC}"
        exit 0
    else
        # Clean up backup file after confirmation
        if [ -f "${RELEASE_NOTES_PATH}.bak" ]; then
            rm -f "${RELEASE_NOTES_PATH}.bak"
            echo -e "${GREEN}✅ Removed backup file after confirmation${NC}"
        fi

        # Commit the updated release notes and VERSION file
        echo -e "\n${CYAN}Committing the updated release notes and VERSION file...${NC}"
        git add "$RELEASE_NOTES_PATH" "$ROOT_DIR/VERSION"
        if ! git commit -m "docs: update release notes and version for $version"; then
            echo -e "${YELLOW}⚠️ WARNING: Failed to commit the updated files.${NC}"
            read -p "Do you want to continue anyway? (y/n): " confirmation
            if [ "$confirmation" != "y" ]; then
                echo -e "${RED}Operation cancelled.${NC}"
                exit 1
            fi
        else
            echo -e "${GREEN}✅ Release notes and VERSION file committed successfully${NC}"
        fi
    fi
}

function create_git_tag {
    local version="$1"

    echo -e "\n${CYAN}Creating Git tag: $version...${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}🔍 [DRY RUN] Would create Git tag: $version${NC}"
        echo -e "${CYAN}🔍 [DRY RUN] Would push Git tag to remote${NC}"
        return
    fi

    # Check if tag already exists
    if git tag -l "$version" | grep -q "$version"; then
        echo -e "${YELLOW}⚠️ WARNING: Tag $version already exists.${NC}"
        read -p "Do you want to force update the existing tag? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi

        # Delete existing tag
        if ! git tag -d "$version"; then
            echo -e "${RED}❌ Failed to delete existing tag.${NC}"
            exit 1
        fi

        # If tag was already pushed, we need to force push
        if git ls-remote --tags origin "$version" &>/dev/null; then
            echo -e "${YELLOW}⚠️ WARNING: Tag $version exists on remote. It will be force updated.${NC}"
        fi
    fi

    # Create the tag
    if ! git tag -a "$version" -m "Release $version"; then
        echo -e "${RED}❌ Failed to create Git tag.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Git tag created successfully${NC}"

    # Push the tag
    echo -e "\n${CYAN}Pushing Git tag to remote...${NC}"
    if ! git push origin "$version"; then
        echo -e "${RED}❌ Failed to push Git tag to remote.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Git tag pushed successfully${NC}"
}

function build_docker_images {
    local version="$1"

    echo -e "\n${CYAN}Checking Docker availability...${NC}"

    # Check if Docker is installed
    if ! command -v docker &>/dev/null; then
        echo -e "${RED}❌ Docker is not installed or not in PATH. Cannot build Docker images.${NC}"
        read -p "Do you want to continue without building Docker images? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
        return
    fi

    # Check if Docker is running
    if ! docker info &>/dev/null; then
        echo -e "${RED}❌ Docker engine is not running. Cannot build Docker images.${NC}"
        read -p "Do you want to continue without building Docker images? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
        return
    fi

    echo -e "\n${CYAN}Building and pushing Docker images...${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}🔍 [DRY RUN] Would build and push Docker images with tag: $version${NC}"
        echo -e "${CYAN}🔍 [DRY RUN] Would execute: $DOCKER_BUILD_SCRIPT $version${NC}"
        return
    fi

    # Check if build script exists
    if [ ! -f "$DOCKER_BUILD_SCRIPT" ]; then
        echo -e "${RED}❌ Docker build script not found at: $DOCKER_BUILD_SCRIPT${NC}"
        read -p "Do you want to continue without building Docker images? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
        return
    fi

    # Make sure the script is executable
    chmod +x "$DOCKER_BUILD_SCRIPT"

    # Run the build script
    echo -e "${CYAN}Running Docker build script with tag: $version${NC}"
    if ! "$DOCKER_BUILD_SCRIPT" "$version"; then
        echo -e "${RED}❌ Docker build script failed.${NC}"
        read -p "Do you want to continue anyway? (y/n): " confirmation
        if [ "$confirmation" != "y" ]; then
            echo -e "${RED}Operation cancelled.${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Docker images built and pushed successfully${NC}"
    fi
}

# Process command line arguments
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
        -s|--skip-notes)
            SKIP_NOTES=true
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
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Check required parameters
if [ -z "$VERSION" ]; then
    echo -e "${RED}❌ Version parameter is required. Use -v or --version to specify the version to release.${NC}"
    show_help
    exit 1
fi

# Validate version format
if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9\.]+)?$ ]]; then
    echo -e "${RED}❌ Invalid version format. Version should be in the format 'vX.Y.Z' or 'vX.Y.Z-suffix'${NC}"
    echo -e "${CYAN}Examples: v1.0.0, v0.1.0-beta.1, v2.0.0-rc.3${NC}"
    exit 1
fi

# Check if Git is available
test_git_available

# Get previous tag if not specified
if [ -z "$PREVIOUS_TAG" ]; then
    PREVIOUS_TAG=$(get_latest_git_tag) || PREVIOUS_TAG=""
fi

# Start the release process
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${CYAN}🔍 [DRY RUN] Starting release process simulation for version: $VERSION${NC}"
    echo -e "${CYAN}🔍 No actual changes will be made to files or repositories.${NC}"
else
    echo -e "\n${GREEN}🚀 Starting release process for version: $VERSION${NC}"
fi

# Confirm and prepare main branch
confirm_main_branch

# Generate changelog
CHANGELOG=$(generate_changelog "$PREVIOUS_TAG" "$VERSION")

# Update release notes
if [ "$SKIP_NOTES" = false ]; then
    update_release_notes "$VERSION" "$CHANGELOG"
else
    echo -e "\n${YELLOW}⚠️ Skipping release notes update as requested.${NC}"
fi

# Create and push Git tag
create_git_tag "$VERSION"

# Build and push Docker images (only if --build-docker is specified)
if [ "$BUILD_DOCKER" = true ]; then
    build_docker_images "$VERSION"
else
    echo -e "\n${YELLOW}⚠️ Skipping Docker build (use -b/--build-docker flag to build images).${NC}"
fi

# Clean up temporary files
if [ -f "$CHANGELOG_PATH" ]; then
    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}🔍 [DRY RUN] Would clean up temporary files${NC}"
    else
        rm -f "$CHANGELOG_PATH"
        echo -e "${GREEN}✅ Removed temporary changelog file${NC}"
    fi
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "\n${GREEN}✅ Dry run completed successfully for version: $VERSION${NC}"
    echo -e "${CYAN}No actual changes were made. Run without --dry-run to execute the release process.${NC}"
else
    echo -e "\n${GREEN}✅ Release process completed successfully for version: $VERSION${NC}"
    echo -e "\n${YELLOW}📋 Next steps:${NC}"
    echo -e "${WHITE}  1. Monitor GitHub Actions workflow at: https://github.com/yourusername/fastapi_rbac/actions${NC}"
    echo -e "${WHITE}  2. Verify Docker images on Docker Hub${NC}"
    echo -e "${WHITE}  3. Notify team members about the new release${NC}"
fi

echo -e "\n${CYAN}Thank you for using the FastAPI RBAC Release Automation Script! 🎉${NC}"
