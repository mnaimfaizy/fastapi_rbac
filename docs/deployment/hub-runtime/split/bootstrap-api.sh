#!/usr/bin/env bash
# Hub runtime SPLIT — API + Caddy on the edge VM (Neon/Upstash via .env).
# Usage: ./bootstrap-api.sh [--help] [command] [args…]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE_FILE="env.example"
COMPOSE_FILE="compose.api.yml"
HUB_ROLE="api"
HUB_SERVICES="caddy api"
SCRIPT_NAME="$(basename "$0")"

# shellcheck source=_common.sh
source "${ROOT_DIR}/_common.sh"
# shellcheck source=../_bootstrap_cli.sh
source "${ROOT_DIR}/../_bootstrap_cli.sh"

prepare_env() {
  ensure_env_file
  fill_secrets_and_tokens
  require_managed_data_env
  warn_smtp_if_placeholder
  require_docker
  require_host_ca_bundle
}

hub_bootstrap_main "$@"
