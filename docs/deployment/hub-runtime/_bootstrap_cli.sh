# Shared Hub runtime bootstrap CLI (sourced, not executed).
# Callers must set before hub_bootstrap_main:
#   ROOT_DIR, ENV_FILE, EXAMPLE_FILE, COMPOSE_FILE
#   HUB_ROLE (onebox|api|worker), HUB_SERVICES (space-separated)
#   SCRIPT_NAME (basename for usage)
#   prepare_env() — role-specific .env / validation
# shellcheck shell=bash

HUB_NO_PULL=0
HUB_NO_WAIT=0

dc() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

hub_usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} [global flags] <command> [args]

Hub runtime bootstrap (${HUB_ROLE}). Default command with no args: up

Commands:
  help, -h, --help          Show this help
  up [SERVICE…]             Prepare .env, pull (unless --no-pull), start stack
  down [SERVICE…]           Stop/remove stack (all → compose down; named → stop)
  restart [SERVICE…]        Restart all or named services
  pull [SERVICE…]           Pull images
  status, ps                Show compose status
  logs [-f] [-n N] [SVC…]   Show logs (--follow / --tail)
  health                    Wait for API health (onebox/api) or show worker ps
  env, prepare              Only ensure/fill .env (no containers)
  config                    Validate compose file (docker compose config)
  exec SERVICE CMD…         Run a command in a running service

Global flags:
  --env-file PATH           Env file (default: .env or \$ENV_FILE)
  --no-pull                 Skip image pull on up
  --no-wait                 Skip health wait on up / health
  -h, --help                Show this help

Services for this role: ${HUB_SERVICES}

Examples:
  ${SCRIPT_NAME}
  ${SCRIPT_NAME} up
  ${SCRIPT_NAME} up api
  ${SCRIPT_NAME} status
  ${SCRIPT_NAME} logs -f worker
  ${SCRIPT_NAME} health
  ${SCRIPT_NAME} restart worker
  ${SCRIPT_NAME} env
EOF
}

hub_require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required. See oracle-always-free-setup.md / split-managed-data.md." >&2
    exit 1
  fi
}

hub_is_valid_service() {
  local svc="$1"
  local s
  for s in ${HUB_SERVICES}; do
    if [[ "$s" == "$svc" ]]; then
      return 0
    fi
  done
  return 1
}

hub_validate_services() {
  local svc
  for svc in "$@"; do
    if ! hub_is_valid_service "$svc"; then
      echo "Unknown service '${svc}' for role ${HUB_ROLE}." >&2
      echo "Valid: ${HUB_SERVICES}" >&2
      exit 1
    fi
  done
}

hub_domain() {
  local domain
  domain="$(grep -E '^DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
  echo "${domain:-rbac-api.mnfprofile.com}"
}

hub_wait_api_health() {
  local domain
  domain="$(hub_domain)"
  echo "Waiting for API health..."
  local _
  for _ in $(seq 1 60); do
    if curl -fsS "https://${domain}/api/v1/health" >/dev/null 2>&1 || \
       dc exec -T api curl -fsS "http://localhost:8000/api/v1/health" >/dev/null 2>&1; then
      echo "API is up."
      echo "API: https://${domain}/api/v1/health"
      echo "OpenAPI: https://${domain}/docs"
      if [[ -f "$ENV_FILE" ]]; then
        echo "Superuser email is FIRST_SUPERUSER_EMAIL in ${ENV_FILE}"
      fi
      return 0
    fi
    sleep 5
  done
  echo "Timed out waiting for healthy API. Check: ${SCRIPT_NAME} logs" >&2
  return 1
}

cmd_up() {
  local services=("$@")
  prepare_env
  hub_require_docker
  if [[ "${HUB_NO_PULL}" -eq 0 ]]; then
    echo "Pulling images (IMAGE_TAG from ${ENV_FILE})..."
    if [[ ${#services[@]} -gt 0 ]]; then
      dc pull "${services[@]}"
    else
      dc pull
    fi
  else
    echo "Skipping pull (--no-pull)."
  fi

  echo "Starting Hub runtime (${HUB_ROLE})..."
  if [[ ${#services[@]} -gt 0 ]]; then
    dc up -d "${services[@]}"
  else
    dc up -d
  fi

  if [[ "${HUB_ROLE}" == "worker" ]]; then
    echo "Worker stack status:"
    dc ps
    echo "Worker + Beat are up (or starting)."
    echo "Stop this OCI instance when you finish testing to save Always Free idle risk and Upstash commands."
    echo "Logs: ${SCRIPT_NAME} logs -f worker beat"
    return 0
  fi

  # Health wait when API (or full stack) is in scope
  local need_wait=0
  if [[ ${#services[@]} -eq 0 ]]; then
    need_wait=1
  else
    local s
    for s in "${services[@]}"; do
      if [[ "$s" == "api" || "$s" == "caddy" ]]; then
        need_wait=1
        break
      fi
    done
  fi

  if [[ "${HUB_NO_WAIT}" -eq 1 ]]; then
    echo "Skipping health wait (--no-wait)."
    dc ps
    return 0
  fi

  if [[ "${need_wait}" -eq 1 ]]; then
    hub_wait_api_health || exit 1
    if [[ "${HUB_ROLE}" == "api" ]]; then
      echo "Start the worker VM separately: ./bootstrap-worker.sh"
    fi
  else
    dc ps
  fi
}

cmd_down() {
  local services=("$@")
  hub_require_docker
  if [[ ${#services[@]} -eq 0 ]]; then
    echo "Stopping and removing Hub runtime (${HUB_ROLE})..."
    dc down
  else
    echo "Stopping: ${services[*]}"
    dc stop "${services[@]}"
  fi
}

cmd_restart() {
  local services=("$@")
  hub_require_docker
  if [[ ${#services[@]} -eq 0 ]]; then
    dc restart
  else
    dc restart "${services[@]}"
  fi
}

cmd_pull() {
  local services=("$@")
  prepare_env
  hub_require_docker
  if [[ ${#services[@]} -gt 0 ]]; then
    dc pull "${services[@]}"
  else
    dc pull
  fi
}

cmd_status() {
  hub_require_docker
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing ${ENV_FILE}. Run: ${SCRIPT_NAME} env" >&2
    exit 1
  fi
  dc ps
}

cmd_logs() {
  hub_require_docker
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing ${ENV_FILE}. Run: ${SCRIPT_NAME} env" >&2
    exit 1
  fi
  local follow=0
  local tail_n=""
  local services=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -f | --follow)
        follow=1
        shift
        ;;
      -n | --tail)
        if [[ $# -lt 2 ]]; then
          echo "--tail requires a number" >&2
          exit 1
        fi
        tail_n="$2"
        shift 2
        ;;
      --tail=*)
        tail_n="${1#--tail=}"
        shift
        ;;
      -*)
        echo "Unknown logs flag: $1" >&2
        exit 1
        ;;
      *)
        services+=("$1")
        shift
        ;;
    esac
  done
  if [[ ${#services[@]} -gt 0 ]]; then
    hub_validate_services "${services[@]}"
  fi
  local args=()
  if [[ "${follow}" -eq 1 ]]; then
    args+=(-f)
  fi
  if [[ -n "${tail_n}" ]]; then
    args+=(--tail "${tail_n}")
  fi
  if [[ ${#services[@]} -gt 0 ]]; then
    dc logs "${args[@]}" "${services[@]}"
  else
    dc logs "${args[@]}"
  fi
}

cmd_health() {
  hub_require_docker
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing ${ENV_FILE}. Run: ${SCRIPT_NAME} env" >&2
    exit 1
  fi
  if [[ "${HUB_ROLE}" == "worker" ]]; then
    echo "Worker role has no HTTP health endpoint. Stack status:"
    dc ps
    echo "Tip: ${SCRIPT_NAME} logs -f worker"
    return 0
  fi
  if [[ "${HUB_NO_WAIT}" -eq 1 ]]; then
    local domain
    domain="$(hub_domain)"
    if curl -fsS "https://${domain}/api/v1/health" >/dev/null 2>&1 || \
       dc exec -T api curl -fsS "http://localhost:8000/api/v1/health" >/dev/null 2>&1; then
      echo "API health OK: https://${domain}/api/v1/health"
      return 0
    fi
    echo "API health check failed." >&2
    exit 1
  fi
  hub_wait_api_health || exit 1
}

cmd_env() {
  prepare_env
  echo "Env ready: ${ENV_FILE}"
}

cmd_config() {
  prepare_env
  hub_require_docker
  dc config
}

cmd_exec() {
  hub_require_docker
  if [[ $# -lt 2 ]]; then
    echo "Usage: ${SCRIPT_NAME} exec SERVICE CMD…" >&2
    exit 1
  fi
  local svc="$1"
  shift
  hub_validate_services "$svc"
  dc exec -T "$svc" "$@"
}

hub_bootstrap_main() {
  local cmd=""
  local positional=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h | --help)
        hub_usage
        return 0
        ;;
      help)
        if [[ -z "$cmd" ]]; then
          hub_usage
          return 0
        fi
        positional+=("$1")
        shift
        ;;
      --env-file)
        if [[ $# -lt 2 ]]; then
          echo "--env-file requires a path" >&2
          exit 1
        fi
        ENV_FILE="$2"
        shift 2
        ;;
      --env-file=*)
        ENV_FILE="${1#--env-file=}"
        shift
        ;;
      --no-pull)
        HUB_NO_PULL=1
        shift
        ;;
      --no-wait)
        HUB_NO_WAIT=1
        shift
        ;;
      up | down | restart | pull | status | ps | logs | health | env | prepare | config | exec)
        if [[ -n "$cmd" ]]; then
          positional+=("$1")
          shift
        else
          cmd="$1"
          shift
        fi
        ;;
      -*)
        # Subcommand-specific flags (e.g. logs -f) once a command is known
        if [[ -n "$cmd" ]]; then
          positional+=("$1")
          shift
        else
          echo "Unknown flag: $1 (try --help)" >&2
          exit 1
        fi
        ;;
      *)
        if [[ -z "$cmd" ]]; then
          # Bare service name without command → treat as up SERVICE
          cmd="up"
          positional+=("$1")
          shift
        else
          positional+=("$1")
          shift
        fi
        ;;
    esac
  done

  if [[ -z "$cmd" ]]; then
    cmd="up"
  fi

  # Normalize aliases
  case "$cmd" in
    ps) cmd="status" ;;
    prepare) cmd="env" ;;
  esac

  # Validate service args for commands that take services (not logs/exec — handled inside)
  case "$cmd" in
    up | down | restart | pull)
      if [[ ${#positional[@]} -gt 0 ]]; then
        hub_validate_services "${positional[@]}"
      fi
      ;;
  esac

  case "$cmd" in
    up) cmd_up "${positional[@]}" ;;
    down) cmd_down "${positional[@]}" ;;
    restart) cmd_restart "${positional[@]}" ;;
    pull) cmd_pull "${positional[@]}" ;;
    status) cmd_status ;;
    logs) cmd_logs "${positional[@]}" ;;
    health) cmd_health ;;
    env) cmd_env ;;
    config) cmd_config ;;
    exec) cmd_exec "${positional[@]}" ;;
    *)
      echo "Unknown command: ${cmd}" >&2
      hub_usage >&2
      exit 1
      ;;
  esac
}
