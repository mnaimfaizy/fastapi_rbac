FROM python:3.10-slim-buster

WORKDIR /app

# https://docs.python.org/3/using/cmdline.html#envvar-PYTHONDONTWRITEBYTECODE
# Prevents Python from writing .pyc files to disk
ENV PYTHONDONTWRITEBYTECODE 1

# ensures that the python output is sent straight to terminal (e.g. your container log)
# without being first buffered and that you can see the output of your application (e.g. django logs)
# in real time. Equivalent to python -u: https://docs.python.org/3/using/cmdline.html#cmdoption-u
ENV PYTHONUNBUFFERED 1
ENV ENVIRONMENT dev
ENV TESTING 0
ENV FASTAPI_ENV='development'

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

# Copy openssl config to Docker Container
COPY ./.docker/openssl.cnf /etc/ssl/openssl.cnf

# Copy source code
COPY . .

ENV PYTHONPATH=/app

# Fix line endings & execute permissions
# Ensure dos2unix runs and handle potential errors
RUN apt-get update && apt-get install -y dos2unix && \
    find /app -name '*.sh' -exec dos2unix {} \; && \
    find /app -name '*.sh' -exec chmod +x {} \;

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

EXPOSE 8000

# Use the new consolidated entrypoint script
CMD ["bash", "/app/entrypoint.sh"]