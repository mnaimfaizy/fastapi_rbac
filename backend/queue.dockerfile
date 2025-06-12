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

# Copy scripts first but don't copy the rest of the app yet
COPY scripts/worker-start.sh scripts/beat-start.sh scripts/flower-start.sh /app/

# Fix line endings for all shell scripts
# Use dos2unix with -f to force conversion and overwrite original files
RUN dos2unix -f /app/worker-start.sh /app/beat-start.sh /app/flower-start.sh \
    && chmod +x /app/worker-start.sh /app/beat-start.sh /app/flower-start.sh

# Copy openssl config
COPY ./.docker/openssl.cnf /etc/ssl/openssl.cnf

# Copy the rest of the application code
COPY . /app/

# Fix line endings for all shell scripts again after copying all files
RUN find /app -name "*.sh" -type f -exec dos2unix -f {} \; \
    && find /app -name "*.sh" -type f -exec chmod +x {} \; \
    && find /app -name "*.py" -type f -exec dos2unix -f {} \;

# Create a symlink to ensure the pre_start script is found without \r character
RUN ln -sf /app/app/backend_pre_start.py /app/backend_pre_start.py

# Update the worker, beat, and flower start scripts to use the correct path
RUN sed -i 's|/app/app/backend_pre_start.py|/app/backend_pre_start.py|g' /app/worker-start.sh \
    && sed -i 's|/app/app/backend_pre_start.py|/app/backend_pre_start.py|g' /app/beat-start.sh \
    && sed -i 's|/app/app/backend_pre_start.py|/app/backend_pre_start.py|g' /app/flower-start.sh

# Remove any existing celerybeat-schedule directory that might conflict with the DB file
RUN rm -rf /app/celerybeat-schedule

ENV PYTHONPATH=/app

# Default command can be overridden by docker-compose
CMD ["/bin/bash", "/app/worker-start.sh"]
