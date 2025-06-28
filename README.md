# FastAPI RBAC - User Management Microservice

A comprehensive Role-Based Access Control (RBAC) system with FastAPI backend and React frontend, designed to handle Authentication and Authorization for other services.

## 🚀 Quick Start

### New to the project?

**Start here:** [`docs/getting-started/GETTING_STARTED.md`](docs/getting-started/GETTING_STARTED.md)

### Want to run immediately?

```powershell
git clone <repository-url>
cd fastapi_rbac
docker-compose up -d

# Access at:
# Frontend: http://localhost:80
# Backend API: http://localhost:8000/docs
```

## 📚 Documentation

All documentation has been organized for easy navigation:

- **📖 [Getting Started](docs/getting-started/)** - New developer onboarding
- **💻 [Development](docs/development/)** - Development setup and workflows
- **🚀 [Deployment](docs/deployment/)** - Production deployment guides
- **🔧 [Troubleshooting](docs/troubleshooting/)** - Problem-solving guides
- **📋 [Reference](docs/reference/)** - Technical reference materials

## 🛠️ Scripts & Utilities

Utility scripts are organized by purpose in the [`scripts/`](scripts/) directory:

- **Development**: [`scripts/dev/`](scripts/dev/) - Local development helpers
- **Docker**: [`scripts/docker/`](scripts/docker/) - Container operations & production builds
- **Deployment**: [`scripts/deployment/`](scripts/deployment/) - Release and deployment
- **Database**: [`scripts/database/`](scripts/database/) - Database management

## ✨ Key Features

### 🔒 **Enterprise Security**

- **🔐 JWT Authentication**: Secure token-based auth with refresh tokens
- **🛡️ CSRF Protection**: Complete protection against Cross-Site Request Forgery
- **🧽 Input Sanitization**: XSS prevention with comprehensive HTML cleaning
- **⚡ Rate Limiting**: DoS attack prevention on all critical endpoints
- **🔒 Security Headers**: Strict Content Security Policy and browser protections

### 👥 **Access Control & Management**

- **👥 Role-Based Access Control**: Flexible permission system with role hierarchies
- **🎯 User Management**: Complete CRUD operations with admin oversight
- **🏢 Organization Management**: Role groups and permission groups for enterprise use

### 🧪 **Quality & Testing**

- **🧪 Comprehensive Testing**: 90+ backend tests + 354 frontend tests across 16 files
- **All async DB queries in backend and tests use SQLModel’s `.exec()` idiom with `AsyncSession` (not `.execute()`).**
- **See [`backend/test/README.md`](backend/test/README.md) for full test/factory/fixture/optimization details.**
- **⚡ Frontend Testing**: Complete coverage with Vitest, React Testing Library
- **🔍 API Testing**: Comprehensive service layer testing with mocking

### 🚀 **Infrastructure & Integration**

- **📧 Email Integration**: Notifications and password reset functionality
- **⚡ Background Tasks**: Celery integration for async operations
- **🐳 Docker Ready**: Full containerization with production configs
- **📊 API Documentation**: Auto-generated OpenAPI/Swagger docs

## 🏗️ Project Structure

```
fastapi_rbac/
├── 📁 backend/              # FastAPI application
│   ├── app/                 # Main application code
│   ├── alembic/            # Database migrations
│   └── tests/              # Backend tests
├── 📁 react-frontend/       # React TypeScript app
│   ├── src/                # Frontend source code
│   └── public/             # Static assets
├── 📁 docs/                # 📚 Organized documentation
│   ├── getting-started/    # New developer guides
│   ├── development/        # Development workflows
│   ├── deployment/         # Production guides
│   ├── troubleshooting/    # Problem solving
│   └── reference/          # Technical references
├── 📁 scripts/             # 🛠️ Utility scripts
│   ├── dev/               # Development helpers
│   ├── docker/            # Container operations
│   ├── deployment/        # Release scripts
│   └── database/          # DB management
├── 📄 docker-compose.dev.yml      # Development environment
├── 📄 docker-compose.test.yml     # Testing environment
└── 📄 docker-compose.prod-test.yml # Production testing environment
```

## 🎯 Development Workflow

### 1. First Time Setup

```powershell
# Follow the comprehensive setup guide
# This covers IDE setup, dependencies, and configuration
.\docs\development\DEVELOPER_SETUP.md
```

### 2. Daily Development

```powershell
# Start development environment
docker-compose up -d

# Run backend tests
.\scripts\dev\run-tests.ps1

# Run frontend tests
cd react-frontend
npm test

# Access services:
# - Frontend: http://localhost:80
# - Backend: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

### 3. Before Deployment

```powershell
# Validate production setup
.\scripts\docker\validate-config.ps1 -Validate

# Test production configuration locally
.\scripts\docker\test-production.ps1
```

## 🔧 Common Operations

| Task                     | Command                                           | Documentation                                              |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------------------- |
| **Start development**    | `docker-compose up -d`                            | [Getting Started](docs/getting-started/GETTING_STARTED.md) |
| **Run backend tests**    | `.\scripts\dev\run-tests.ps1`                     | [Testing Guide](docs/development/TESTING.md)               |
| **Run frontend tests**   | `cd react-frontend && npm test`                   | [Frontend Testing](react-frontend/README.md#testing)       |
| **Security validation**  | `python backend/test/test_csrf_implementation.py` | [Security Features](#-enterprise-security)                 |
| **Deploy to production** | `.\scripts\deployment\push-to-dockerhub.ps1`      | [Deployment](docs/deployment/PRODUCTION_SETUP.md)          |
| **Troubleshoot CORS**    | `.\scripts\docker\diagnose-cors.ps1`              | [CORS Guide](docs/troubleshooting/CORS_TROUBLESHOOTING.md) |
| **Database migration**   | `.\scripts\database\migrate-db.ps1`               | [DB Reference](docs/reference/DATABASE_SCHEMA.md)          |

## 🧪 Integration Testing Environments

This project supports both Docker Compose-based and local integration testing for the backend.

- **Docker Compose-based testing** (recommended for CI and team consistency):

  - Uses `backend/.env.test` for environment variables.
  - Database and Redis hostnames:
    - `DATABASE_HOST=fastapi_rbac_db_test`
    - `REDIS_HOST=fastapi_rbac_redis_test`
    - `REDIS_URL=redis://fastapi_rbac_redis_test:6379/0`
  - Run with:
    ```powershell
    docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
    ```

- **Local testing** (if you want to run tests outside Docker):
  - Uses `backend/.env.test.local` for environment variables.
  - Database and Redis hostnames:
    - `DATABASE_HOST=localhost`
    - `REDIS_HOST=localhost`
    - `REDIS_URL=redis://localhost:6379/0`
  - Make sure Postgres and Redis are running locally.
  - Run tests with:
    ```powershell
    pytest backend/test/integration/
    ```

**See comments in `backend/.env.example` for more details.**

## Running Tests with test_runner.py

All backend test running is now managed through a single script: `backend/test_runner.py`.

- **Run all tests:**
  ```powershell
  python backend/test_runner.py all
  ```
- **Run unit tests only:**
  ```powershell
  python backend/test_runner.py unit
  ```
- **Run integration tests only:**
  ```powershell
  python backend/test_runner.py integration
  ```
- **Run a specific test file:**
  ```powershell
  python backend/test_runner.py specific --path backend/test/unit/test_crud_user.py
  ```
- **Run the comprehensive demo suite:**
  ```powershell
  python backend/test_runner.py demo
  ```
- **Other options:** See `python backend/test_runner.py --help` for more.

> **Note:** All previous test scripts (`run_tests.py`, `run_comprehensive_tests.py`, `test_all_units.py`, `run_final_tests.py`) have been removed. Use only `test_runner.py` for all test operations.

- For full details on test/factory/fixture usage, see [`backend/test/README.md`](backend/test/README.md).

---

## 🆘 Need Help?

1. **🔍 Check documentation**: Start with [Getting Started](docs/getting-started/GETTING_STARTED.md)
2. **🔧 Browse troubleshooting**: See [troubleshooting guides](docs/troubleshooting/)
3. **💬 Ask the team**: Create an issue with detailed information
4. **📖 Read the code**: Well-documented with inline comments

## 🤝 Contributing

1. Read the [Development Setup](docs/development/DEVELOPER_SETUP.md)
2. Follow the [Coding Standards](docs/development/CODING_STANDARDS.md)
3. Write tests for new features
4. Update documentation as needed

---

**Ready to get started?** 👉 [Click here to begin!](docs/getting-started/GETTING_STARTED.md)

# Run the backend service

uvicorn app.main:app --port 8001 --reload

````

### Frontend

```bash
# Navigate to frontend directory
cd react-frontend

# Install dependencies
npm install

# Run the development server
npm run dev
````

## Docker-based Development

Run the entire stack:

```bash
# From project root
docker-compose up -d
```

Run only specific components:

```bash
# Just the backend
cd backend
docker-compose up -d

# Just the frontend
cd react-frontend
docker-compose up -d
```

## Documentation

- [Backend Documentation](backend/backend.md)
- [Frontend Documentation](react-frontend/README.md)
- [API Documentation](http://localhost:8001/docs) (when backend is running)

## License

This project is licensed under the terms of the MIT license.
