#!/usr/bin/env bash
# Fast gates, run inside the sandbox after the agent finishes.
# Keep in step with verify_commands in .github/workflows/agent-kit-pipeline.yml.
set -euo pipefail

export MODE=testing PYTHONPATH=.
export DATABASE_HOST=localhost DATABASE_PORT=5432 DATABASE_NAME=test
export REDIS_HOST="${REDIS_HOST:-redis}" REDIS_PORT=6379
export BACKEND_CORS_ORIGINS='["http://localhost:8000", "http://localhost:5173"]'
export PROJECT_NAME="FastAPI RBAC Test" TOKEN_ISSUER=test_issuer TOKEN_AUDIENCE=test_audience
export USER_CHANGED_PASSWORD_DATE=2023-01-01T00:00:00

cd backend
black --check --config pyproject.toml .
isort --check-only --settings-path pyproject.toml .
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics --max-line-length=110 --extend-ignore=E203
mypy --config-file pyproject.toml app
pytest test/unit/ -q -p no:cacheprovider

cd ../react-frontend
npm ci --offline --legacy-peer-deps --no-audit --no-fund
npm run lint
# Not `npm run format -- --check`: the format script is `prettier --write .`,
# so that form rewrites files first and can never fail.
npm run format:check
npm run build
