#!/bin/bash
set -e

# Create the fastapi_db and celery_schedule_jobs_dev databases if they don't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE fastapi_db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fastapi_db')\gexec
    GRANT ALL PRIVILEGES ON DATABASE fastapi_db TO $POSTGRES_USER;

    SELECT 'CREATE DATABASE celery_schedule_jobs_dev'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'celery_schedule_jobs_dev')\gexec
    GRANT ALL PRIVILEGES ON DATABASE celery_schedule_jobs_dev TO $POSTGRES_USER;
EOSQL
