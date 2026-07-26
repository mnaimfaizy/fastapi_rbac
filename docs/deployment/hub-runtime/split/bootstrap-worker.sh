#!/usr/bin/env bash
# Hub runtime SPLIT — Celery worker + Beat (same .env data plane as the API VM).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE_FILE="env.example"
COMPOSE_FILE="compose.worker.yml"

# shellcheck source=_common.sh
source "${ROOT_DIR}/_common.sh"

ensure_env_file
fill_secrets_and_tokens
require_managed_data_env
warn_smtp_if_placeholder
require_docker

# Prefer scp/copy of the API VM .env so JWT/DB/Redis secrets match exactly.

echo "Pulling worker images (IMAGE_TAG from ${ENV_FILE})..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull

echo "Starting Hub runtime worker edge (worker + beat)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

echo "Worker stack status:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "Worker + Beat are up (or starting)."
echo "Stop this OCI instance when you finish testing to save Always Free idle risk and Upstash commands."
echo "Logs: docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} logs -f worker beat"
