# Multi-stage Dockerfile for FastAPI RBAC Backend
# Supports development, testing, and production environments

# Base stage with common dependencies
FROM python:3.10-slim-buster as base

WORKDIR /app

# https://docs.python.org/3/using/cmdline.html#envvar-PYTHONDONTWRITEBYTECODE
# Prevents Python from writing .pyc files to disk
ENV PYTHONDONTWRITEBYTECODE=1

# ensures that the python output is sent straight to terminal (e.g. your container log)
# without being first buffered and that you can see the output of your application (e.g. django logs)
# in real time. Equivalent to python -u: https://docs.python.org/3/using/cmdline.html#cmdoption-u
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    curl \
    bash \
    vim \
    dos2unix \
    tzdata \
    cron \
    time \
    bc \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY ./requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base as development

ENV ENVIRONMENT=development
ENV TESTING=0
ENV FASTAPI_ENV=development

# Copy openssl config to Docker Container
COPY ./.docker/openssl.cnf /etc/ssl/openssl.cnf

# Copy source code
COPY . .

# Fix line endings & execute permissions
RUN find /app -name '*.sh' -exec dos2unix {} \; && \
    find /app -name '*.sh' -exec chmod +x {} \;

# Ensure logs directory exists and is writable
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

EXPOSE 8000

# Use the development entrypoint script
CMD ["bash", "/app/scripts/docker/development-entrypoint.sh"]

# Testing stage
FROM base as testing

ENV ENVIRONMENT=testing
ENV TESTING=1
ENV FASTAPI_ENV=testing

# Install additional testing dependencies
RUN pip install --no-cache-dir pytest pytest-asyncio pytest-cov httpx

# Copy openssl config to Docker Container
COPY ./.docker/openssl.cnf /etc/ssl/openssl.cnf

# Copy source code
COPY . .

# Fix line endings & execute permissions
RUN find /app -name '*.sh' -exec dos2unix {} \; && \
    find /app -name '*.sh' -exec chmod +x {} \;

# Ensure logs directory exists and is writable
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

EXPOSE 8000

# Use the testing entrypoint script
CMD ["bash", "/app/scripts/docker/testing-entrypoint.sh"]

# Production stage
FROM base as production

ENV ENVIRONMENT=production
ENV TESTING=0
ENV FASTAPI_ENV=production

# Copy openssl config to Docker Container
COPY ./.docker/openssl.cnf /etc/ssl/openssl.cnf

# Copy source code (excluding development files)
COPY ./app ./app
COPY ./alembic ./alembic
COPY ./scripts ./scripts
COPY ./init-scripts ./init-scripts
COPY ./certs ./certs
COPY ./alembic.ini ./
COPY ./logging.ini ./
COPY ./pyproject.toml ./

# Fix line endings & execute permissions
RUN find /app -name '*.sh' -exec dos2unix {} \; && \
    find /app -name '*.sh' -exec chmod +x {} \;

# Ensure logs directory exists and is writable
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Use the production entrypoint script
CMD ["bash", "/app/scripts/docker/production-entrypoint.sh"]
