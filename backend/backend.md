# Backend API

The backend API is developed using the FastAPI framework.

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
export MODE=development  # On Windows: $env:MODE="development"

# Start the application
uvicorn app.main:app --port 8001 --reload
```

For Docker-based development with PostgreSQL:

```bash
# Start the services using Docker Compose
docker-compose up -d
```

Once the server is running navigate to `http://localhost:8001` and check the service is running. FastAPI also has a documentation system which can be accessed via `http://localhost:8001/docs`

## Docker Compose Structure

The project uses a modular Docker Compose structure:

1. **Root `docker-compose.yml`**: Contains shared services (PostgreSQL, Redis, Mailhog)
2. **`backend/docker-compose.yml`**: Contains backend-specific services
3. **`react-frontend/docker-compose.yml`**: Contains frontend-specific services

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
