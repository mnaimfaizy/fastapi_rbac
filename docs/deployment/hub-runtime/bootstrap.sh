#!/usr/bin/env bash
# Hub runtime bootstrap (one-box Compose): secrets, pull, start, health.
# Usage: ./bootstrap.sh [--help] [command] [args…]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE_FILE="env.example"
COMPOSE_FILE="compose.yml"
HUB_ROLE="onebox"
HUB_SERVICES="caddy api worker beat db redis"
SCRIPT_NAME="$(basename "$0")"

# shellcheck source=_bootstrap_cli.sh
source "${ROOT_DIR}/_bootstrap_cli.sh"

gen_secret() {
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
    local escaped
    escaped="$(printf '%s' "$value" | sed -e 's/[&/\]/\\&/g')"
    sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
    echo "Generated ${key}"
  fi
}

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

prepare_env() {
  local db_user db_pass db_name domain

  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ ! -f "$EXAMPLE_FILE" ]]; then
      echo "Missing ${EXAMPLE_FILE}. Run this script from docs/deployment/hub-runtime/." >&2
      exit 1
    fi
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    echo "Created ${ENV_FILE} from ${EXAMPLE_FILE}"
  fi

  for key in SECRET_KEY JWT_SECRET_KEY JWT_REFRESH_SECRET_KEY JWT_RESET_SECRET_KEY JWT_VERIFICATION_SECRET_KEY ENCRYPT_KEY DATABASE_PASSWORD FIRST_SUPERUSER_PASSWORD; do
    set_kv_if_empty "$key" "$(gen_secret)"
  done

  db_user="$(grep -E '^DATABASE_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  db_pass="$(grep -E '^DATABASE_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  db_name="$(grep -E '^DATABASE_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  db_user="${db_user:-postgres}"
  db_name="${db_name:-fastapi_db}"

  domain="$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  domain="${domain:-rbac-api.mnfprofile.com}"

  if ! grep -qE "^TOKEN_ISSUER=" "$ENV_FILE"; then
    printf 'TOKEN_ISSUER=fastapi-rbac\n' >>"$ENV_FILE"
    echo "Added TOKEN_ISSUER"
  else
    set_kv_if_empty "TOKEN_ISSUER" "fastapi-rbac"
  fi
  if ! grep -qE "^TOKEN_AUDIENCE=" "$ENV_FILE"; then
    printf 'TOKEN_AUDIENCE=%s\n' "$domain" >>"$ENV_FILE"
    echo "Added TOKEN_AUDIENCE=${domain}"
  else
    set_kv_if_empty "TOKEN_AUDIENCE" "$domain"
  fi
  if ! grep -qE "^USER_CHANGED_PASSWORD_DATE=" "$ENV_FILE"; then
    printf 'USER_CHANGED_PASSWORD_DATE=2026-01-01\n' >>"$ENV_FILE"
    echo "Added USER_CHANGED_PASSWORD_DATE"
  else
    set_kv_if_empty "USER_CHANGED_PASSWORD_DATE" "2026-01-01"
  fi

  sync_kv "POSTGRES_USER" "$db_user"
  sync_kv "POSTGRES_PASSWORD" "$db_pass"
  sync_kv "POSTGRES_DB" "$db_name"
  # Broker URLs for private Redis (no auth); keep Celery on the Compose network
  sync_kv "CELERY_BROKER_URL" "redis://redis:6379/0"
  sync_kv "CELERY_RESULT_BACKEND" "redis://redis:6379/0"
  echo "Synced POSTGRES_* and Celery broker URLs in ${ENV_FILE}"

  if grep -qE "^SMTP_HOST=(smtp\.example\.com)?[[:space:]]*$" "$ENV_FILE" || grep -qE "^SMTP_HOST=$" "$ENV_FILE"; then
    echo "WARNING: Set SMTP_* in ${ENV_FILE} before relying on email flows." >&2
  fi
}

hub_bootstrap_main "$@"
