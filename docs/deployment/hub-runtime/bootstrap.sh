#!/usr/bin/env bash
# Hub runtime bootstrap: ensure .env secrets, then pull and start the package.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE_FILE="env.example"

gen_secret() {
  # URL-safe for Redis/Celery URLs and env files
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    python3 -c "import secrets; print(secrets.token_hex(32))"
  fi
}

set_kv_if_empty() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=$" "$ENV_FILE" || grep -qE "^${key}=[[:space:]]*$" "$ENV_FILE"; then
    # Escape & for sed
    local escaped
    escaped="$(printf '%s' "$value" | sed -e 's/[&/\]/\\&/g')"
    sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    echo "Generated ${key}"
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ ! -f "$EXAMPLE_FILE" ]]; then
    echo "Missing ${EXAMPLE_FILE}. Run this script from docs/deployment/hub-runtime/." >&2
    exit 1
  fi
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Created ${ENV_FILE} from ${EXAMPLE_FILE}"
fi

# Fill empty secret fields (DB password is mirrored to POSTGRES_* for the db service)
for key in SECRET_KEY JWT_SECRET_KEY JWT_REFRESH_SECRET_KEY JWT_RESET_SECRET_KEY JWT_VERIFICATION_SECRET_KEY ENCRYPT_KEY DATABASE_PASSWORD FIRST_SUPERUSER_PASSWORD; do
  set_kv_if_empty "$key" "$(gen_secret)"
done

# Mirror app DB settings into Postgres container env (compose uses env_file only)
db_user="$(grep -E '^DATABASE_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
db_pass="$(grep -E '^DATABASE_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
db_name="$(grep -E '^DATABASE_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
db_user="${db_user:-postgres}"
db_name="${db_name:-fastapi_db}"

sync_kv() {
  local key="$1"
  local value="$2"
  local escaped
  escaped="$(printf '%s' "$value" | sed -e 's/[&/\]/\\&/g')"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
  rm -f "${ENV_FILE}.bak"
}

sync_kv "POSTGRES_USER" "$db_user"
sync_kv "POSTGRES_PASSWORD" "$db_pass"
sync_kv "POSTGRES_DB" "$db_name"
# Broker URLs for private Redis (no auth); keep Celery on the Compose network
sync_kv "CELERY_BROKER_URL" "redis://redis:6379/0"
sync_kv "CELERY_RESULT_BACKEND" "redis://redis:6379/0"
echo "Synced POSTGRES_* and Celery broker URLs in ${ENV_FILE}"

# SMTP must be provided for full-flow validation
if grep -qE "^SMTP_HOST=(smtp\.example\.com)?[[:space:]]*$" "$ENV_FILE" || grep -qE "^SMTP_HOST=$" "$ENV_FILE"; then
  echo "WARNING: Set SMTP_* in ${ENV_FILE} before relying on email flows." >&2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. See oracle-always-free-setup.md." >&2
  exit 1
fi

echo "Pulling images (IMAGE_TAG from ${ENV_FILE})..."
docker compose --env-file "$ENV_FILE" -f compose.yml pull

echo "Starting Hub runtime..."
docker compose --env-file "$ENV_FILE" -f compose.yml up -d

echo "Waiting for API health..."
DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
DOMAIN="${DOMAIN:-rbac-api.mnfprofile.com}"

for i in $(seq 1 60); do
  if curl -fsS "https://${DOMAIN}/api/v1/health" >/dev/null 2>&1 || \
     docker compose --env-file "$ENV_FILE" -f compose.yml exec -T api curl -fsS "http://localhost:8000/api/v1/health" >/dev/null 2>&1; then
    echo "Hub runtime is up."
    echo "API: https://${DOMAIN}/api/v1/health"
    echo "OpenAPI: https://${DOMAIN}/docs"
    echo "Superuser email is FIRST_SUPERUSER_EMAIL in ${ENV_FILE}"
    exit 0
  fi
  sleep 5
done

echo "Timed out waiting for healthy API. Check: docker compose -f compose.yml logs" >&2
exit 1
