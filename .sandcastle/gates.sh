#!/usr/bin/env bash
# Fast gates, run inside the sandbox after the agent finishes.
# Keep in step with verify_commands in .github/workflows/agent-kit-pipeline.yml.
# Each step prints a "==> gate:" line, so a failure's tail names the gate.
set -euo pipefail

export MODE=testing PYTHONPATH=.
export DATABASE_HOST=localhost DATABASE_PORT=5432 DATABASE_NAME=test
export REDIS_HOST="${REDIS_HOST:-redis}" REDIS_PORT=6379
export BACKEND_CORS_ORIGINS='["http://localhost:8000", "http://localhost:5173"]'
export PROJECT_NAME="FastAPI RBAC Test" TOKEN_ISSUER=test_issuer TOKEN_AUDIENCE=test_audience
export USER_CHANGED_PASSWORD_DATE=2023-01-01T00:00:00

gate() { echo "==> gate: $1"; }

cd backend
gate black;  black --check --config pyproject.toml .
gate isort;  isort --check-only --settings-path pyproject.toml .
gate flake8; flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics --max-line-length=110 --extend-ignore=E203
gate mypy;   mypy --config-file pyproject.toml app
gate pytest; pytest test/unit/ -q -p no:cacheprovider

cd ../react-frontend
gate "npm ci"; npm ci --offline --legacy-peer-deps --no-audit --no-fund
gate eslint;   npm run lint
# Prettier directly, not an npm script: `format` is `prettier --write .`, so
# `npm run format -- --check` rewrites files and can never fail, and the
# `format:check` script does not exist on branches cut before it was added.
gate prettier; npx prettier --check .
gate build;    npm run build
echo "==> gate: all passed"
