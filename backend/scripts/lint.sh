#!/usr/bin/env bash

set -x

mypy . --exclude alembic # Use current directory to pick up pyproject.toml config, exclude alembic
black . --check # Use current directory, rely on pyproject.toml for excludes
isort . --check-only # Use current directory, skip alembic
flake8 .
