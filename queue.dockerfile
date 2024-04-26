FROM python:3.10.5-slim-buster

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
ENV POETRY_VERSION=1.8.2
ENV TZ="Australia/Sydney"

# install FreeTDS and dependencies
RUN apt-get update \
    && apt-get install curl -y \
    && apt-get install bash -y \
    && apt-get install vim -y \
    && apt-get install dos2unix -y \
    && apt-get install tzdata -y \
    && apt-get install cron -y \
    && apt-get install time -y \
    && apt-get install bc -y \
    && apt-get install --reinstall build-essential -y

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python3 && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

# Copy poetry.lock* in case it doesn't exist in the repo
COPY ./pyproject.toml ./poetry.lock* /app/

# Project initialization:
# hadolint ignore=SC2046
RUN echo "$FASTAPI_ENV" && poetry version
    # Install deps:
RUN poetry run pip install -U pip
RUN poetry install $(if [ "$FASTAPI_ENV" = 'production' ]; then echo '--no-dev'; fi) --no-interaction --no-ansi \
    # Cleaning poetry installation's cache for production:
    && if [ "$FASTAPI_ENV" = 'production' ]; then rm -rf "$POETRY_CACHE_DIR"; fi

# copy the openssl confiG to Docker Container
COPY ./.docker/openssl.cnf /etc/ssl/openssl.cnf

# copy source code
COPY ./ /app

# Fix line endings && execute permissions
RUN dos2unix *.sh app/*.*

RUN chmod +x worker-start.sh

ENV PYTHONPATH=/app

# Run the run script, it will check for an /app/prestart.sh script (e.g. for migrations)
# And then will start Uvicorn
CMD ["./worker-start.sh"]