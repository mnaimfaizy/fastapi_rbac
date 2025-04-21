# FastAPI RBAC Project Guide for AI Assistants

This document provides detailed instructions for AI assistants like GitHub Copilot to understand and work with this FastAPI RBAC (Role-Based Access Control) project. The project consists of a FastAPI backend with a React frontend, implementing a comprehensive authentication and authorization system.

## Project Overview

This is a user management microservice that handles authentication and authorization for other services. The project is structured with:

1. **Backend**: FastAPI-based REST API with SQLAlchemy/SQLModel for database operations
2. **Frontend**: React application with TypeScript, Redux, and modern UI components

## System Architecture

### Backend (FastAPI)

The backend implements a comprehensive RBAC system with these key components:

1. **Authentication System**:

   - JWT-based token authentication (access and refresh tokens)
   - Password hashing with bcrypt
   - Token management with Redis

2. **Database Models**:

   - User model with roles and permissions
   - Role and Permission models
   - Role Groups and Permission Groups
   - Mapping tables for relationships

3. **API Structure**:
   - RESTful endpoints organized by resource
   - Protected routes with role-based access control
   - Pagination support for list endpoints

### Frontend (React)

The frontend provides a modern UI for interacting with the backend API:

1. **Authentication**:

   - JWT token management (access token in memory, refresh token in storage)
   - Automatic token refresh mechanism
   - Protected routes requiring authentication

2. **Feature Modules**:
   - User management
   - Role and permission management
   - Dashboard and analytics

## Key Project Directories

### Backend Structure

```
backend/
│── alembic/                  # Database migration tools
│── app/
│   ├── api/                  # API routes and dependencies
│   │   ├── deps.py           # Dependency injection utilities
│   │   └── v1/               # API version 1 endpoints
│   │       └── endpoints/    # API endpoint implementations
│   ├── core/                 # Core application code
│   │   ├── config.py         # Configuration settings
│   │   └── security.py       # Security utilities
│   ├── crud/                 # CRUD operations
│   │   ├── base_crud.py      # Base CRUD class
│   │   └── [resource]_crud.py # Resource-specific CRUD operations
│   ├── db/                   # Database utilities
│   ├── deps/                 # Resource-specific dependencies
│   ├── models/               # SQLModel database models
│   ├── schemas/              # Pydantic schemas for API data validation
│   └── utils/                # Utility functions
└── tests/                    # Test suite
```

### Frontend Structure

```
react-frontend/
├── src/
│   ├── assets/               # Static assets
│   ├── components/           # Reusable UI components
│   │   ├── layout/           # Layout components
│   │   └── ui/               # ShadCN UI components
│   ├── features/             # Feature-based modules
│   │   ├── auth/             # Authentication features
│   │   ├── users/            # User management features
│   │   └── roles/            # Role management features
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utility functions
│   ├── models/               # TypeScript interfaces
│   ├── services/             # API communication services
│   └── store/                # Redux store configuration
```

## Core Data Models

### Backend Models

1. **User Model**: `app/models/user_model.py`

   - Stores user credentials and profile information
   - Links to roles through the `UserRole` mapping table

2. **Role Model**: `app/models/role_model.py`

   - Defines roles like "admin", "manager", "user"
   - Links to permissions through the `RolePermission` mapping table

3. **Permission Model**: `app/models/permission_model.py`

   - Defines granular actions users can perform
   - Can be grouped into permission groups

4. **Role Group Model**: `app/models/role_group_model.py`

   - Allows grouping roles for easier management

5. **Permission Group Model**: `app/models/permission_group_model.py`
   - Allows grouping permissions for easier management

### Frontend Types

1. **User**: Interface for user data
2. **Role**: Interface for role data
3. **Permission**: Interface for permission data
4. **Token**: Authentication token structure

## Authentication Flow

1. **Login Process**:

   - User submits credentials to `/api/v1/login`
   - Backend validates and returns access and refresh tokens
   - Frontend stores access token in memory (Redux state) and refresh token in localStorage

2. **Token Validation**:

   - Protected routes check for valid access tokens
   - Interceptors handle token insertion into requests

3. **Token Refresh**:
   - When access token expires, refresh token is used to get a new access token
   - Implemented in API interceptors (`react-frontend/src/services/api.ts`)

## Common Tasks and How to Implement Them

### Adding a New API Endpoint

1. Create appropriate schemas in `backend/app/schemas/`
2. Add CRUD operations in `backend/app/crud/`
3. Create an endpoint file in `backend/app/api/v1/endpoints/`
4. Register the router in `backend/app/api/v1/api.py`

### Adding a New Frontend Feature

1. Create TypeScript interfaces in `react-frontend/src/models/`
2. Add API service functions in `react-frontend/src/services/`
3. Create Redux slice in `react-frontend/src/store/slices/`
4. Create React components in `react-frontend/src/features/`
5. Add routes in the router configuration

### Adding Role-Based Access Control

1. Use the dependency injection pattern from `backend/app/api/deps.py`:

   ```python
   @router.get("/protected-endpoint")
   async def protected_function(
       current_user: User = Depends(deps.get_current_user(required_roles=["admin"]))
   ):
       # Only admin users can access this endpoint
       ...
   ```

2. On frontend, use conditional rendering based on user roles:
   ```typescript
   {
     user.roles.includes("admin") && <AdminComponent />;
   }
   ```

### Database Migrations

1. Create a new migration with Alembic:
   ```
   alembic revision --autogenerate -m "description"
   ```
2. Apply migrations:
   ```
   alembic upgrade head
   ```

## Environment Configuration

### Backend Environment

Key variables defined in `backend/backend.env`:

- `PROJECT_NAME`: Project name
- `DATABASE_*`: Database connection parameters
- `REDIS_*`: Redis connection parameters
- `FIRST_SUPERUSER_*`: Initial admin user credentials
- `JWT_*`: JWT token configuration
- `BACKEND_CORS_ORIGINS`: CORS configuration

### Frontend Environment

Key variables defined in `react-frontend/.env`:

- `VITE_API_BASE_URL`: URL for the FastAPI backend API
- `VITE_AUTH_TOKEN_NAME`: Name of the auth token for storage

## Development Workflow

### Backend Development

1. Activate virtual environment:

   - Windows: `.venv/Scripts/Activate.ps1`
   - Linux/MacOS: `.venv/bin/activate`

2. Install dependencies with Poetry:

   ```
   poetry install
   ```

3. Run the FastAPI server:
   ```
   uvicorn app.main:app --port 8000 --reload
   ```

### Frontend Development

1. Install dependencies:

   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

### Docker Deployment

Run the entire stack with Docker Compose:

```
docker-compose up -d
```

## Security Considerations

1. **Token Management**:

   - Access tokens are stored in memory (Redux state) to prevent XSS attacks
   - Refresh tokens are handled securely
   - Tokens are cleared on logout

2. **Password Security**:

   - Passwords are hashed using bcrypt
   - Password history is maintained to prevent reuse
   - Password reset functionality is available

3. **Role-Based Security**:
   - Endpoints are protected by role requirements
   - UI elements are conditionally rendered based on user roles
   - Permission checks are performed server-side

## When Making Changes

1. Follow the existing architecture and patterns
2. Update types/models in both backend and frontend when changing data structures
3. Add appropriate tests for new functionality
4. Update documentation for API changes
5. Consider security implications of changes
6. Resolve any error either syntax or logical errors, do not stop until all the errors are resolved.
7. Resolve linting issues and do not stop until it is resolved.

By following these guidelines, you'll be able to effectively understand and work with this FastAPI RBAC project.
