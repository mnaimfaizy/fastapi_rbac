#!/usr/bin/env bash
# Hub runtime SPLIT — Celery worker + Beat (same .env data plane as the API VM).
# Usage: ./bootstrap-worker.sh [--help] [command] [args…]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE_FILE="env.example"
COMPOSE_FILE="compose.worker.yml"
HUB_ROLE="worker"
HUB_SERVICES="worker beat"
SCRIPT_NAME="$(basename "$0")"

# Prefer scp/copy of the API VM .env so JWT/DB/Redis secrets match exactly.

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
