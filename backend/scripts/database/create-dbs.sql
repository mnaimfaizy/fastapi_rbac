-- Database initialization script for development environment
-- This script creates the required databases for the FastAPI RBAC system

-- Create main application database
CREATE DATABASE fastapi_dev_db;

-- Create Celery schedule jobs database
CREATE DATABASE celery_schedule_jobs_dev;

-- Grant permissions to postgres user (already the owner in development)
GRANT ALL PRIVILEGES ON DATABASE fastapi_dev_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE celery_schedule_jobs_dev TO postgres;

-- Display created databases
\l
