#!/bin/bash

set -e

# Create the fastapi_rbac_test_db and celery_schedule_jobs_test databases if they don't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE fastapi_rbac_test_db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fastapi_rbac_test_db')\gexec
    GRANT ALL PRIVILEGES ON DATABASE fastapi_rbac_test_db TO $POSTGRES_USER;
    SELECT 'CREATE DATABASE celery_schedule_jobs_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'celery_schedule_jobs_test')\gexec
    GRANT ALL PRIVILEGES ON DATABASE celery_schedule_jobs_test TO $POSTGRES_USER;
EOSQL
