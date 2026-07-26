#!/usr/bin/env bash
# Hub runtime SPLIT — API + Caddy on the edge VM (Neon/Upstash via .env).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE_FILE="env.example"
COMPOSE_FILE="compose.api.yml"

# shellcheck source=_common.sh
source "${ROOT_DIR}/_common.sh"

ensure_env_file
fill_secrets_and_tokens
require_managed_data_env
warn_smtp_if_placeholder
require_docker

echo "Pulling API edge images (IMAGE_TAG from ${ENV_FILE})..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull

echo "Starting Hub runtime API edge (caddy + api)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
DOMAIN="${DOMAIN:-rbac-api.mnfprofile.com}"

echo "Waiting for API health..."
for _ in $(seq 1 60); do
  if curl -fsS "https://${DOMAIN}/api/v1/health" >/dev/null 2>&1 || \
     docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T api curl -fsS "http://localhost:8000/api/v1/health" >/dev/null 2>&1; then
    echo "API edge is up."
    echo "API: https://${DOMAIN}/api/v1/health"
    echo "OpenAPI: https://${DOMAIN}/docs"
    echo "Superuser email is FIRST_SUPERUSER_EMAIL in ${ENV_FILE}"
    echo "Start the worker VM separately: ./bootstrap-worker.sh"
    exit 0
  fi
  sleep 5
done

echo "Timed out waiting for healthy API. Check: docker compose -f ${COMPOSE_FILE} logs" >&2
exit 1
