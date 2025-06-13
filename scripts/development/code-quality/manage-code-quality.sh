#!/bin/bash
# Code Quality Management Script for Linux/CI environments
# This script provides formatting, linting, and import fixing functionality

set -e  # Exit on any error

# Default values
ACTION="all"
TARGET="all"
CHECK=false
SHOW_DETAILS=false

# Function to display colored output
print_color() {
    local message="$1"
    local color="$2"

    case $color in
        "green") echo -e "\033[32m$message\033[0m" ;;
        "yellow") echo -e "\033[33m$message\033[0m" ;;
        "red") echo -e "\033[31m$message\033[0m" ;;
        "blue") echo -e "\033[34m$message\033[0m" ;;
        "cyan") echo -e "\033[36m$message\033[0m" ;;
        *) echo "$message" ;;
    esac
}

# Function to show help
show_help() {
    print_color "\n🛠️  Code Quality Management Script" "cyan"
    print_color "========================================" "cyan"
    print_color "\nThis script provides comprehensive code quality management for the FastAPI RBAC project." "white"

    print_color "\n📋 Parameters:" "yellow"
    print_color "  -a, --action       : Action to perform (format, lint, fix-imports, all)" "white"
    print_color "  -t, --target       : Target to process (backend, frontend, all)" "white"
    print_color "  -c, --check        : Check format without making changes" "white"
    print_color "  -v, --verbose      : Show detailed output" "white"
    print_color "  -h, --help         : Show this help message" "white"

    print_color "\n💡 Examples:" "yellow"
    print_color "  ./manage-code-quality.sh                                    # Format, lint, and fix imports for all code" "white"
    print_color "  ./manage-code-quality.sh --action format                    # Format all code" "white"
    print_color "  ./manage-code-quality.sh --action lint --target backend     # Lint only backend code" "white"
    print_color "  ./manage-code-quality.sh --action format --check           # Check formatting without changes" "white"
    print_color "  ./manage-code-quality.sh --action fix-imports --target frontend # Fix only frontend imports" "white"

    print_color "\n🎯 Actions:" "yellow"
    print_color "  format      : Format code (Black for Python, Prettier for TypeScript)" "white"
    print_color "  lint        : Lint code (Flake8 for Python, ESLint for TypeScript)" "white"
    print_color "  fix-imports : Fix and sort imports (isort for Python, organize imports for TS)" "white"
    print_color "  all         : Run all actions (format, lint, fix-imports)" "white"

    print_color "\n🎯 Targets:" "yellow"
    print_color "  backend     : Process only backend Python code" "white"
    print_color "  frontend    : Process only frontend TypeScript/React code" "white"
    print_color "  all         : Process both backend and frontend code" "white"

    print_color "\n🔧 Requirements:" "yellow"
    print_color "  Backend: Python, black, isort, flake8" "white"
    print_color "  Frontend: Node.js, npm, prettier, eslint" "white"
    print_color ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -c|--check)
            CHECK=true
            shift
            ;;
        -v|--verbose)
            SHOW_DETAILS=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_color "Unknown option: $1" "red"
            show_help
            exit 1
            ;;
    esac
done

# Validate action parameter
case $ACTION in
    format|lint|fix-imports|all) ;;
    *)
        print_color "Invalid action: $ACTION" "red"
        print_color "Valid actions: format, lint, fix-imports, all" "red"
        exit 1
        ;;
esac

# Validate target parameter
case $TARGET in
    backend|frontend|all) ;;
    *)
        print_color "Invalid target: $TARGET" "red"
        print_color "Valid targets: backend, frontend, all" "red"
        exit 1
        ;;
esac

# Function to format backend code
format_backend() {
    print_color "🎨 Formatting Backend Code..." "cyan"

    cd "$(dirname "$0")/../../../backend" || exit 1

    if [ "$CHECK" = true ]; then
        print_color "Checking code format (no changes will be made)..." "yellow"
        python -m black --check .
        python -m isort --check-only .
    else
        print_color "Formatting Python code with Black..." "blue"
        python -m black .

        print_color "Sorting imports with isort..." "blue"
        python -m isort .
    fi

    print_color "✅ Backend formatting completed" "green"
    cd - > /dev/null
}

# Function to lint backend code
lint_backend() {
    print_color "🔍 Linting Backend Code..." "cyan"

    cd "$(dirname "$0")/../../../backend" || exit 1

    print_color "Running Flake8 linting..." "blue"
    # Create temporary flake8 config
    cat > .flake8 << EOF
[flake8]
max-line-length = 110
extend-ignore = E203
EOF

    # Run flake8 with error checking first
    flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics

    # Run full flake8
    flake8 . --count --exit-zero --statistics

    # Cleanup
    rm -f .flake8

    print_color "✅ Backend linting completed" "green"
    cd - > /dev/null
}

# Function to fix backend imports
fix_backend_imports() {
    print_color "📦 Fixing Backend Imports..." "cyan"

    cd "$(dirname "$0")/../../../backend" || exit 1

    print_color "Sorting imports with isort..." "blue"
    python -m isort .

    print_color "✅ Backend import fixing completed" "green"
    cd - > /dev/null
}

# Function to format frontend code
format_frontend() {
    print_color "🎨 Formatting Frontend Code..." "cyan"

    cd "$(dirname "$0")/../../../react-frontend" || exit 1

    if [ "$CHECK" = true ]; then
        print_color "Checking code format (no changes will be made)..." "yellow"
        npm run format -- --check
    else
        print_color "Formatting TypeScript/React code with Prettier..." "blue"
        npm run format
    fi

    print_color "✅ Frontend formatting completed" "green"
    cd - > /dev/null
}

# Function to lint frontend code
lint_frontend() {
    print_color "🔍 Linting Frontend Code..." "cyan"

    cd "$(dirname "$0")/../../../react-frontend" || exit 1

    print_color "Running ESLint..." "blue"
    npm run lint

    print_color "✅ Frontend linting completed" "green"
    cd - > /dev/null
}

# Function to fix frontend imports
fix_frontend_imports() {
    print_color "📦 Fixing Frontend Imports..." "cyan"

    cd "$(dirname "$0")/../../../react-frontend" || exit 1

    print_color "Organizing imports..." "blue"
    npm run lint:fix

    print_color "✅ Frontend import fixing completed" "green"
    cd - > /dev/null
}

# Main execution
print_color "🛠️  FastAPI RBAC Code Quality Manager" "blue"
print_color "====================================" "blue"
print_color "Action: $ACTION" "white"
print_color "Target: $TARGET" "white"
print_color "Check Mode: $CHECK" "white"
print_color ""

case $ACTION in
    format)
        if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
            format_backend
        fi
        if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "all" ]; then
            format_frontend
        fi
        ;;
    lint)
        if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
            lint_backend
        fi
        if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "all" ]; then
            lint_frontend
        fi
        ;;
    fix-imports)
        if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
            fix_backend_imports
        fi
        if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "all" ]; then
            fix_frontend_imports
        fi
        ;;
    all)
        if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
            fix_backend_imports
            format_backend
            lint_backend
        fi
        if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "all" ]; then
            fix_frontend_imports
            format_frontend
            lint_frontend
        fi
        ;;
esac

print_color "\n🎉 Code quality operations completed successfully!" "green"
