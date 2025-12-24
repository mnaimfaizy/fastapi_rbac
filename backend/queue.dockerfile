FROM python:3.10-slim-buster

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=dev
ENV TESTING=0
ENV FASTAPI_ENV=development
ENV TZ=UTC

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
        libpq-dev \
        gcc \
        python3-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create working directories first
RUN mkdir -p /app/logs

# Copy requirements file
COPY requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "celery[redis]>=5.3.1" \
    && pip install --no-cache-dir flower \
    && pip install --no-cache-dir psycopg2-binary

# Copy queue scripts first (better Docker layer caching)
COPY scripts/docker/start-worker.sh scripts/docker/start-beat.sh scripts/docker/start-flower.sh /app/scripts/docker/

# Fix line endings for copied scripts
RUN dos2unix -f /app/scripts/docker/start-worker.sh /app/scripts/docker/start-beat.sh /app/scripts/docker/start-flower.sh \
    && chmod +x /app/scripts/docker/start-worker.sh /app/scripts/docker/start-beat.sh /app/scripts/docker/start-flower.sh

# Copy openssl config
COPY ./.docker/openssl.cnf /etc/ssl/openssl.cnf

# Copy the rest of the application code
COPY . /app/

# Fix line endings for all shell scripts again after copying all files
RUN find /app -name "*.sh" -type f -exec dos2unix -f {} \; \
    && find /app -name "*.sh" -type f -exec chmod +x {} \; \
    && find /app -name "*.py" -type f -exec dos2unix -f {} \;

# Remove any existing celerybeat-schedule directory that might conflict with the DB file
RUN rm -rf /app/celerybeat-schedule

ENV PYTHONPATH=/app

# Default command can be overridden by docker-compose
CMD ["/bin/bash", "/app/scripts/docker/start-worker.sh"]
