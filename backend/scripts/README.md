# Backend Scripts

This folder contains operational scripts used by Docker Compose and for local developer convenience.

## Structure

- `docker/`

  - Scripts executed inside containers (Dockerfiles / Docker Compose).
  - These are the canonical entrypoints used by `backend/docker-compose.*.yml`.

- `local/`
  - Convenience scripts intended to be run on a developer machine (PowerShell + shell).
  - These may rely on your local Python environment and tooling.

## Docker scripts

- `docker/entrypoint-dev.sh`: Development API container entrypoint.
- `docker/entrypoint-test.sh`: Test runner container entrypoint.
- `docker/entrypoint-prod.sh`: Production API container entrypoint.
- `docker/start-worker.sh`: Celery worker start.
- `docker/start-beat.sh`: Celery beat start.
- `docker/start-flower.sh`: Flower start.

## Local scripts

- `local/start-api.(sh|ps1)`: Start the API locally.
- `local/start-worker.(sh|ps1)`: Start Celery worker locally.
- `local/start-beat.(sh|ps1)`: Start Celery beat locally.
- `local/start-flower.(sh|ps1)`: Start Flower locally.
- `local/format.(sh|ps1)`: Run formatting (black/isort/etc.).
- `local/format-imports.(sh|ps1)`: Runs `local/format.*` (import-related formatting is handled there).
- `local/lint.(sh|ps1)`: Run lint checks.
- `local/setup-dev.(sh|ps1)`: Developer setup helpers.

## Notes

- If you change script names/locations, update the references in `backend/docker-compose.*.yml` and Dockerfiles.
