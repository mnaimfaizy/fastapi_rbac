# Backend API

The backend API is developed using the FastAPI framework with comprehensive security features and enterprise-grade protection.

## 🔒 Security Features

- **CSRF Protection**: Complete protection against Cross-Site Request Forgery attacks using `fastapi-csrf-protect`
- **Input Sanitization**: XSS prevention with comprehensive HTML cleaning using `bleach`
- **Rate Limiting**: DoS attack prevention using `slowapi` on all critical endpoints
- **Security Headers**: Strict Content Security Policy and comprehensive browser protections
- **JWT Authentication**: Secure token-based authentication with refresh tokens and blacklisting
- **Password Security**: Advanced password validation, history tracking, and account locking

## 🧪 Testing Infrastructure

- **90+ comprehensive test files** covering all functionality
- **Factory pattern** for clean test data generation
- **Multiple database support** (SQLite for development, PostgreSQL for testing/production)
- **Async testing** with pytest-asyncio
- **Security testing** including CSRF and sanitization validation

## Development Process:

---

### Requirements:

Below softwares are required to start:

- Python > 3.x
- Uvicorn `ASGI Server for running the application`

### Installation:

You should create a virtual environment by running this command `python -m venv ./backend/.venv`.

Once, you have created the virtual environment you can activate it using this:

#### Windows Activation:

`. .venv/Scripts/Activate.ps1` This is for PowerShell on Windows platforms.

#### Linux Activation:

`. .venv/bin/activate` This is for Linux/MacOs.

#### Installing dependencies using pip:

After activating the virtual environment, install the dependencies using pip:

```bash
pip install -r requirements.txt
```

### Development Environment Setup

The backend supports two database configurations:

1. **Local Development**: Uses SQLite database for faster development
2. **Docker/Testing Environment**: Uses PostgreSQL database for testing and production-like environments

#### Environment Files

The backend uses different environment files depending on the runtime mode:

- `.env.development`: For local development with SQLite
- `.env.test`: For testing environment with PostgreSQL
- `.env.production`: For production environment with PostgreSQL

You can create these files from the provided `.env.example` template.

### Starting Application

For local development with SQLite:

```bash
# Set the environment mode to development to use SQLite
$env:MODE="development"  # On Linux/Mac: export MODE=development

# Start the application
uvicorn app.main:app --port 8000 --reload
```

For Docker-based development with PostgreSQL:

```bash
# Start the services using Docker Compose
docker-compose up -d
```

Once the server is running navigate to `http://localhost:8000` and check the service is running. FastAPI also has a documentation system which can be accessed via `http://localhost:8000/docs`

## 🔒 Security Endpoints

The backend includes several security-focused endpoints:

- **CSRF Token**: `GET /api/v1/auth/csrf-token` - Get CSRF protection token
- **Rate Limited Auth**: All authentication endpoints have rate limiting protection
- **Input Sanitization**: All form inputs are automatically sanitized for XSS prevention

## 🧪 Running Tests (Unified Test Runner)

All backend test running is now managed through a single script: `test_runner.py`.

- **Run all tests:**
  ```bash
  python test_runner.py all
  ```
- **Run unit tests only:**
  ```bash
  python test_runner.py unit
  ```
- **Run integration tests only:**
  ```bash
  python test_runner.py integration
  ```
- **Run a specific test file:**
  ```bash
  python test_runner.py specific --path test/unit/test_crud_user.py
  ```
- **Run the comprehensive demo suite:**
  ```bash
  python test_runner.py demo
  ```
- **Other options:** See `python test_runner.py --help` for more.

> **Note:** All previous test scripts (`run_tests.py`, `run_comprehensive_tests.py`, `test_all_units.py`, `run_final_tests.py`) have been removed. Use only `test_runner.py` for all test operations.

- For full details on test/factory/fixture usage, see [`test/README.md`](test/README.md).

## SQLModel Async Idioms and Test Conventions

- All async DB queries in the backend and tests must use SQLModel’s `.exec()` idiom with `AsyncSession`:
  ```python
  result = await db.exec(select(User).where(User.email == email))
  users = result.all()
  ```
- Do NOT use `.execute()` for SQLModel queries in async code.
- Integration tests should use only API-driven flows for user actions (no direct DB manipulation).
- See `backend/test/README.md` for full details on test/factory/fixture usage and best practices.

## Docker Compose Structure

The project uses a modular Docker Compose structure:

1. **Root `docker-compose.dev.yml`**: Development environment with shared services (PostgreSQL, Redis, Mailhog)
2. **Root `docker-compose.test.yml`**: Testing environment for integration tests
3. **Root `docker-compose.prod-test.yml`**: Production testing environment
4. **`backend/docker-compose.dev.yml`**: Backend development services
5. **`backend/docker-compose.test.yml`**: Backend testing services
6. **`backend/docker-compose.prod.yml`**: Backend production services

To run only the backend services:

```bash
cd backend
docker-compose up -d
```

To run the entire stack:

```bash
# From project root
docker-compose up -d
```

# Environment Variable Migration & Consolidation (2025 Update)

The project now uses a single consolidated `.env.example` file for all environments (development, testing, production). The old `production.env.example` has been removed. All environment variables—development and production—are documented in `.env.example` with clear comments and a production checklist.

**Migration Steps:**

- Copy `.env.example` to `.env` for your environment:
  - Development: `cp .env.example .env`
  - Production: `cp .env.example .env` and edit all production-specific values (see checklist in the file)
- Compare your existing `.env` with the new `.env.example` and add any missing variables.
- Pay special attention to new security, Redis SSL, Celery, and rate limiting variables.
- For a full migration guide, see [`docs/internal/backend/MIGRATION_GUIDE.md`](../docs/internal/backend/MIGRATION_GUIDE.md).

**Key New/Updated Variables:**

- `PASSWORD_PEPPER` (password hashing security)
- `CELERY_WORKER_CONCURRENCY`, `CELERY_WORKER_MAX_MEMORY_PER_CHILD`, `CELERY_BROKER_POOL_LIMIT`, `CELERY_TASK_COMPRESSION` (Celery production tuning)
- `VALIDATE_TOKEN_IP`, `TOKEN_BLACKLIST_ON_LOGOUT`, `TOKEN_BLACKLIST_EXPIRY` (token/session security)
- Updated Redis SSL and email settings

**Quick Reference:**

- For development, defaults in `.env.example` are ready to use.
- For production, you must:
  - Set `MODE=production`, `DEBUG=false`, `LOG_LEVEL=INFO`, `USERS_OPEN_REGISTRATION=false`
  - Generate new secrets (`SECRET_KEY`, `JWT_SECRET_KEY`, etc.)
  - Configure production database, Redis (with SSL), email SMTP, and CORS origins

**Troubleshooting:**

- If you see `KeyError: 'VARIABLE_NAME'`, add the missing variable from `.env.example`.
- For Redis, database, or email issues, check connection and SSL settings as described in the migration guide.

**Rollback:**

- Restore your previous `.env` from backup if needed.
- The old `production.env.example` is available in git history if you need to reference it.

For more details, see the full migration guide and troubleshooting steps in [`docs/internal/backend/MIGRATION_GUIDE.md`](../docs/internal/backend/MIGRATION_GUIDE.md).
