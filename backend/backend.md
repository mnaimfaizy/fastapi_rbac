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

## 🧪 Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test categories
pytest test/test_api_*.py  # API tests
pytest test/test_crud_*.py # CRUD tests
pytest test/test_models_*.py # Model tests

# Run security tests
python test/test_csrf_implementation.py  # CSRF protection
python test/test_sanitization.py         # Input sanitization
```

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
