#!/usr/bin/env bash
# Maintenance and Cleanup Script (Shell version)
# Cleans Python, Node, mypy, pytest, and coverage caches for FastAPI RBAC project

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

color_echo() {
  local color="$1"; shift
  case $color in
    red) tput setaf 1;; green) tput setaf 2;; yellow) tput setaf 3;; blue) tput setaf 4;; cyan) tput setaf 6;; *) tput sgr0;; esac
  echo "$@"
  tput sgr0
}

remove_dir() {
  local path="$1"; local desc="$2"
  if [ -e "$path" ]; then
    rm -rf "$path"
    color_echo green "✅ Removed: $desc ($path)"
  fi
}

color_echo cyan "🗂️  Cleaning Cache Files..."

# Python cache
color_echo blue "Cleaning Python cache..."
find "$PROJECT_ROOT/backend" -type d -name "__pycache__" -exec rm -rf {} +
find "$PROJECT_ROOT/backend" -type f -name "*.pyc" -delete

# Node.js cache
color_echo blue "Cleaning Node.js cache..."
remove_dir "$PROJECT_ROOT/react-frontend/node_modules/.cache" "Node.js cache"
remove_dir "$PROJECT_ROOT/react-frontend/.vite" "Vite cache"

# mypy cache
remove_dir "$PROJECT_ROOT/backend/.mypy_cache" "MyPy cache"

# pytest cache
remove_dir "$PROJECT_ROOT/backend/.pytest_cache" "Pytest cache"

# Coverage cache
remove_dir "$PROJECT_ROOT/backend/.coverage" "Coverage cache"
remove_dir "$PROJECT_ROOT/react-frontend/coverage" "Frontend coverage"

color_echo green "✅ Cache cleanup completed"
