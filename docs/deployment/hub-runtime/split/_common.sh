# Shared helpers for Hub runtime split bootstraps (sourced, not executed).
# shellcheck shell=bash

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

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ ! -f "$EXAMPLE_FILE" ]]; then
      echo "Missing ${EXAMPLE_FILE}. Run from docs/deployment/hub-runtime/split/." >&2
      exit 1
    fi
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    echo "Created ${ENV_FILE} from ${EXAMPLE_FILE}"
  fi
}

fill_secrets_and_tokens() {
  local domain
  for key in SECRET_KEY JWT_SECRET_KEY JWT_REFRESH_SECRET_KEY JWT_RESET_SECRET_KEY JWT_VERIFICATION_SECRET_KEY ENCRYPT_KEY FIRST_SUPERUSER_PASSWORD; do
    set_kv_if_empty "$key" "$(gen_secret)"
  done

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
}

require_managed_data_env() {
  local db_host redis_host broker backend
  db_host="$(grep -E '^DATABASE_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  redis_host="$(grep -E '^REDIS_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  broker="$(grep -E '^CELERY_BROKER_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  backend="$(grep -E '^CELERY_RESULT_BACKEND=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"

  if [[ -z "$db_host" || "$db_host" == "db" ]]; then
    echo "Set DATABASE_HOST in ${ENV_FILE} to your managed Postgres host (not Compose 'db')." >&2
    exit 1
  fi
  if [[ -z "$redis_host" || "$redis_host" == "redis" ]]; then
    echo "Set REDIS_HOST in ${ENV_FILE} to your managed Redis host (not Compose 'redis')." >&2
    exit 1
  fi
  if [[ -z "$broker" || "$broker" == redis://redis:* || "$broker" == redis://redis/* ]]; then
    echo "Set CELERY_BROKER_URL in ${ENV_FILE} to your managed Redis URL (e.g. Upstash rediss://...)." >&2
    exit 1
  fi
  if [[ -z "$backend" || "$backend" == redis://redis:* || "$backend" == redis://redis/* ]]; then
    echo "Set CELERY_RESULT_BACKEND in ${ENV_FILE} to your managed Redis URL (e.g. Upstash rediss://...)." >&2
    exit 1
  fi
}

warn_smtp_if_placeholder() {
  if grep -qE "^SMTP_HOST=(smtp\.example\.com)?[[:space:]]*$" "$ENV_FILE" || grep -qE "^SMTP_HOST=$" "$ENV_FILE"; then
    echo "WARNING: Set SMTP_* in ${ENV_FILE} before relying on email flows." >&2
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required. See ../oracle-always-free-setup.md." >&2
    exit 1
  fi
}

require_host_ca_bundle() {
  local bundle
  bundle="$(grep -E '^HOST_CA_BUNDLE=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
  bundle="${bundle:-/etc/ssl/certs/ca-certificates.crt}"
  if [[ ! -f "$bundle" ]]; then
    echo "CA bundle not found at ${bundle}." >&2
    echo "Install with: sudo apt-get update && sudo apt-get install -y ca-certificates" >&2
    echo "Or set HOST_CA_BUNDLE in ${ENV_FILE} to a PEM bundle path." >&2
    exit 1
  fi
}
