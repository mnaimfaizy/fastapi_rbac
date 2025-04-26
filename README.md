# Python FastAPI User Management Service

This is the user management micro service which will manage the Authentication and Authorization for all other services.

## Project Overview

This project implements a comprehensive Role-Based Access Control (RBAC) system with:

- **FastAPI Backend**: Modern, high-performance API with async support
- **React Frontend**: TypeScript-based UI with modern component architecture
- **Flexible Database Options**: SQLite for local development, PostgreSQL for testing/production
- **Docker Support**: Containerized deployment with modular compose files

## Key Features

- JWT-based authentication with refresh tokens
- Role-based access control system
- Comprehensive user management
- Permission and role management
- Email notifications with templates
- Background task processing with Celery
- Redis-based caching and task queue

## Development Environment Setup

The project now supports two distinct development workflows:

1. **Local Development**: Uses SQLite database for faster development cycles
2. **Docker-based Testing**: Uses PostgreSQL for testing and production-like environments

### Environment Files Structure

Each component (backend, frontend) has dedicated environment files for different contexts:

- `.env.development`: Local development settings (SQLite for backend)
- `.env.test`: Testing environment settings (PostgreSQL)
- `.env.production`: Production environment settings

These files are derived from the `.env.example` templates in each directory.

### Docker Compose Structure

The project uses a modular Docker Compose approach:

1. **Root `docker-compose.yml`**: Contains shared services (PostgreSQL, Redis, Mailhog)
2. **`backend/docker-compose.yml`**: Contains backend-specific services
3. **`react-frontend/docker-compose.yml`**: Contains frontend-specific services

This structure allows for selective service deployment using Docker Compose's include feature.

## Local Development Quickstart

### Backend (with SQLite)

```bash
# Navigate to backend directory
cd backend

# Set development mode (uses SQLite)
export MODE=development  # On Windows: $env:MODE="development"

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows: .venv\Scripts\Activate.ps1
# Linux/Mac: . .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the backend service
uvicorn app.main:app --port 8001 --reload
```

### Frontend

```bash
# Navigate to frontend directory
cd react-frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

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
