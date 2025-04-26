#!/usr/bin/env bash

set -x

mypy app --exclude=alembic
black app --check
isort app --check-only
flake8
