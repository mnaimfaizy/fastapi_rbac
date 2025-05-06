# FastAPI RBAC Project Guide for AI Assistants

This document provides detailed instructions for AI assistants like GitHub Copilot to understand and work with this FastAPI RBAC (Role-Based Access Control) project. The project consists of a FastAPI backend with a React frontend, implementing a comprehensive authentication and authorization system.

## Project Overview

This is a user management microservice that handles authentication and authorization for other services. The project is structured with:

1. **Backend**: FastAPI-based REST API with SQLAlchemy/SQLModel for database operations, Redis for token management
2. **Frontend**: React application with TypeScript, Redux for state management, and ShadCN UI components

## System Architecture

### Backend (FastAPI)

The backend implements a comprehensive RBAC system with these key components:

1. **Authentication System**:

   - JWT-based token authentication with separate access and refresh tokens
   - Password hashing with bcrypt and password history management
   - Token blacklisting and management with Redis
   - Password reset functionality with email notifications

2. **Database Models**:

   - User model with relationships to roles
   - Role model with relationships to permissions
   - Permission model with grouping capabilities
   - Role Groups for hierarchical role management
   - Permission Groups for logical permission organization
   - Many-to-many mapping tables for relationships (UserRole, RolePermission, etc.)

3. **API Structure**:
   - RESTful endpoints organized by resource in the /api/v1 namespace
   - Protected routes with role-based access control using dependency injection
   - Standardized response formats for consistency
   - Pagination support for list endpoints
   - Comprehensive error handling with detailed error messages

### Frontend (React)

The frontend provides a modern UI for interacting with the backend API:

1. **Authentication**:

   - JWT token management (access token in Redux state, refresh token in localStorage)
   - Automatic token refresh mechanism via interceptors
   - Protected routes requiring authentication and specific roles
   - Login, signup, and password reset flows

2. **Feature Modules**:
   - User management with CRUD operations
   - Role and permission management interfaces
   - Dashboard for system overview and analytics
   - Profile management for user self-service

## Key Project Directories

### Backend Structure

```
backend/
│── alembic/                  # Database migration tools
│── app/
│   ├── api/                  # API routes and dependencies
│   │   ├── deps.py           # Core dependency injection utilities
│   │   └── v1/               # API version 1 endpoints
│   │       ├── api.py        # API router registration
│   │       └── endpoints/    # Resource-specific endpoint implementations
│   ├── core/                 # Core application code
│   │   ├── config.py         # Configuration settings and environment variables
│   │   ├── security.py       # JWT token and password security utilities
│   │   └── service_config.py # Service-specific configuration
│   ├── crud/                 # Database CRUD operations
│   │   ├── base_crud.py      # Base CRUD class with common operations
│   │   └── [resource]_crud.py # Resource-specific CRUD implementations
│   ├── db/                   # Database utilities and session management
│   ├── deps/                 # Resource-specific dependencies
│   │   ├── user_deps.py      # User-specific dependency injections
│   │   ├── role_deps.py      # Role-specific dependency injections
│   │   └── ...               # Other resource dependencies
│   ├── models/               # SQLModel database models
│   │   ├── base_uuid_model.py # Base model with UUID primary key
│   │   ├── user_model.py     # User model definition
│   │   ├── role_model.py     # Role model definition
│   │   ├── permission_model.py # Permission model definition
│   │   └── ...               # Other model definitions
│   ├── schemas/              # Pydantic schemas for API data validation
│   │   ├── user_schema.py    # User-related schemas
│   │   ├── role_schema.py    # Role-related schemas
│   │   ├── permission_schema.py # Permission-related schemas
│   │   └── response_schema.py # Standard response schemas
│   └── utils/                # Utility functions
│       ├── exceptions/       # Custom exception classes
│       └── token.py          # Token validation and management
└── tests/                    # Test suite
    ├── test_api_*.py         # API endpoint tests
    ├── test_crud_*.py        # CRUD operation tests
    └── test_models_*.py      # Database model tests
```

### Frontend Structure

```
react-frontend/
├── src/
│   ├── assets/               # Static assets and images
│   ├── components/           # Reusable UI components
│   │   ├── auth/             # Authentication components
│   │   ├── layout/           # Layout components (navbar, sidebar, etc.)
│   │   └── ui/               # ShadCN UI components
│   ├── features/             # Feature-based modules
│   │   ├── auth/             # Authentication features (login, signup, etc.)
│   │   ├── users/            # User management features
│   │   ├── roles/            # Role management features
│   │   ├── permissions/      # Permission management features
│   │   ├── role-groups/      # Role group management features
│   │   └── permission-groups/ # Permission group management features
│   ├── hooks/                # Custom React hooks
│   │   ├── useAuth.ts        # Authentication hooks
│   │   └── ...               # Other custom hooks
│   ├── lib/                  # Utility functions and shared code
│   │   ├── utils.ts          # General utility functions
│   │   └── validation.ts     # Form validation utilities
│   ├── models/               # TypeScript interfaces and types
│   │   ├── auth.ts           # Authentication-related types
│   │   ├── user.ts           # User-related interfaces
│   │   ├── role.ts           # Role-related interfaces
│   │   └── permission.ts     # Permission-related interfaces
│   ├── services/             # API communication services
│   │   ├── api.ts            # Base API client with interceptors
│   │   ├── auth.service.ts   # Authentication API services
│   │   ├── user.service.ts   # User API services
│   │   └── ...               # Other API services
│   └── store/                # Redux store configuration
│       ├── index.ts          # Store setup and configuration
│       ├── middleware.ts     # Redux middleware (e.g., for API calls)
│       └── slices/           # Redux slices for state management
│           ├── authSlice.ts  # Authentication state management
│           ├── userSlice.ts  # User state management
│           └── ...           # Other state slices
```

## Core Data Models

### Backend Models

1. **User Model**: `app/models/user_model.py`

   - Stores user credentials and profile information
   - Properties: id, email, first_name, last_name, password (hashed), is_active, is_superuser
   - Links to roles through the `UserRole` mapping table
   - Tracks password history and account security information
   - Properties for verification_code, expiry_date, and other security features

2. **Role Model**: `app/models/role_model.py`

   - Defines roles like "admin", "manager", "user"
   - Properties: id, name, description, role_group_id
   - Links to permissions through the `RolePermission` mapping table
   - Implements SQLAlchemy event listeners to maintain consistency with RoleGroups

3. **Permission Model**: `app/models/permission_model.py`

   - Defines granular actions users can perform
   - Properties: id, name, description, group_id
   - Required to belong to a PermissionGroup
   - Can be assigned to multiple roles

4. **Role Group Model**: `app/models/role_group_model.py`

   - Allows hierarchical grouping of roles for easier management
   - Properties: id, name, description, parent_id (for hierarchical structure)
   - Links to roles through the `RoleGroupMap` mapping table

5. **Permission Group Model**: `app/models/permission_group_model.py`
   - Allows logical grouping of permissions for easier management
   - Properties: id, name, description, created_by_id
   - Contains permissions with a one-to-many relationship

### Frontend Interfaces

1. **User Interface**: `models/user.ts`
   - Interface for user data: id, email, firstName, lastName, isActive, roles
   - Used for user management features and displaying user information

2. **Role Interface**: `models/role.ts`
   - Interface for role data: id, name, description, permissions
   - Used for role management and access control

3. **Permission Interface**: `models/permission.ts`
   - Interface for permission data: id, name, description, groupId
   - Used for permission management and role configuration

4. **Auth Types**: `models/auth.ts`
   - Interfaces for authentication: LoginRequest, AuthResponse, TokenPayload
   - Defines structures for working with JWT tokens

## Authentication Flow

1. **Login Process**:

   - User submits email and password to `/api/v1/auth/login`
   - Backend validates credentials and returns access and refresh tokens
   - Frontend stores access token in memory (Redux state) and refresh token in localStorage
   - User is redirected to the dashboard or original requested page

2. **Token Validation**:

   - Protected routes check for valid access tokens via auth guards
   - Backend validates token signatures, expiry, and checks against Redis blacklist
   - API interceptors automatically add tokens to outgoing requests

3. **Token Refresh**:
   - When access token expires (detected via 401 responses), refresh token is used 
   - Axios interceptor catches 401 errors and attempts token refresh
   - If refresh succeeds, the original request is retried with the new token
   - If refresh fails, user is logged out and redirected to login

4. **Logout Process**:
   - Frontend calls `/api/v1/auth/logout` endpoint
   - Backend invalidates tokens in Redis
   - Frontend clears tokens from memory and localStorage

## Common Tasks and How to Implement Them

### Adding a New API Endpoint

1. Create appropriate schemas in `backend/app/schemas/`:
   ```python
   # backend/app/schemas/new_resource_schema.py
   from pydantic import BaseModel
   from uuid import UUID
   
   class INewResourceBase(BaseModel):
       name: str
       description: str | None = None
   
   class INewResourceCreate(INewResourceBase):
       pass
   
   class INewResourceUpdate(INewResourceBase):
       name: str | None = None
       
   class INewResourceRead(INewResourceBase):
       id: UUID
       
       class Config:
           orm_mode = True
   ```

2. Add CRUD operations in `backend/app/crud/`:
   ```python
   # backend/app/crud/new_resource_crud.py
   from app.crud.base_crud import CRUDBase
   from app.models.new_resource_model import NewResource
   from app.schemas.new_resource_schema import INewResourceCreate, INewResourceUpdate

   class CRUDNewResource(CRUDBase[NewResource, INewResourceCreate, INewResourceUpdate]):
       # Add custom CRUD methods specific to this resource
       pass

   new_resource = CRUDNewResource(NewResource)
   ```

3. Create a model in `backend/app/models/`:
   ```python
   # backend/app/models/new_resource_model.py
   from sqlmodel import Field, SQLModel, String
   from app.models.base_uuid_model import BaseUUIDModel
   
   class NewResourceBase(SQLModel):
       name: str = Field(index=True)
       description: str | None = None
   
   class NewResource(BaseUUIDModel, NewResourceBase, table=True):
       # Add relationships and additional fields here
       pass
   ```

4. Create an endpoint file in `backend/app/api/v1/endpoints/`:
   ```python
   # backend/app/api/v1/endpoints/new_resource.py
   from fastapi import APIRouter, Depends
   from uuid import UUID
   
   from app import crud
   from app.api import deps
   from app.models.user_model import User
   from app.schemas.new_resource_schema import INewResourceCreate, INewResourceRead, INewResourceUpdate
   from app.schemas.response_schema import IGetResponseBase, create_response
   from app.schemas.role_schema import IRoleEnum
   
   router = APIRouter()
   
   @router.get("", response_model=IGetResponseBase[INewResourceRead])
   async def get_new_resources(
       current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
   ):
       """Get all new resources. Requires admin role."""
       resources = await crud.new_resource.get_multi()
       return create_response(data=resources)
       
   # Add other CRUD endpoints...
   ```

5. Register the router in `backend/app/api/v1/api.py`:
   ```python
   from app.api.v1.endpoints import new_resource
   
   api_router.include_router(new_resource.router, prefix="/new-resource", tags=["new_resource"])
   ```

### Adding a New Frontend Feature

1. Create TypeScript interfaces in `react-frontend/src/models/`:
   ```typescript
   // react-frontend/src/models/newResource.ts
   export interface NewResource {
     id: string;
     name: string;
     description: string | null;
   }
   
   export interface CreateNewResourceDto {
     name: string;
     description?: string;
   }
   
   export interface UpdateNewResourceDto {
     name?: string;
     description?: string;
   }
   ```

2. Add API service functions in `react-frontend/src/services/`:
   ```typescript
   // react-frontend/src/services/newResource.service.ts
   import { api } from './api';
   import { CreateNewResourceDto, NewResource, UpdateNewResourceDto } from '../models/newResource';
   
   const BASE_URL = '/api/v1/new-resource';
   
   export const newResourceService = {
     getAll: async (): Promise<NewResource[]> => {
       const response = await api.get(BASE_URL);
       return response.data.data;
     },
     
     getById: async (id: string): Promise<NewResource> => {
       const response = await api.get(`${BASE_URL}/${id}`);
       return response.data.data;
     },
     
     create: async (data: CreateNewResourceDto): Promise<NewResource> => {
       const response = await api.post(BASE_URL, data);
       return response.data.data;
     },
     
     update: async (id: string, data: UpdateNewResourceDto): Promise<NewResource> => {
       const response = await api.put(`${BASE_URL}/${id}`, data);
       return response.data.data;
     },
     
     delete: async (id: string): Promise<void> => {
       await api.delete(`${BASE_URL}/${id}`);
     }
   };
   ```

3. Create Redux slice in `react-frontend/src/store/slices/`:
   ```typescript
   // react-frontend/src/store/slices/newResourceSlice.ts
   import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
   import { newResourceService } from '../../services/newResource.service';
   import { NewResource, CreateNewResourceDto, UpdateNewResourceDto } from '../../models/newResource';
   
   interface NewResourceState {
     items: NewResource[];
     selectedItem: NewResource | null;
     loading: boolean;
     error: string | null;
   }
   
   const initialState: NewResourceState = {
     items: [],
     selectedItem: null,
     loading: false,
     error: null,
   };
   
   export const fetchNewResources = createAsyncThunk(
     'newResource/fetchAll',
     async () => {
       return await newResourceService.getAll();
     }
   );
   
   // Add other async thunks for CRUD operations
   
   const newResourceSlice = createSlice({
     name: 'newResource',
     initialState,
     reducers: {
       setSelectedResource: (state, action: PayloadAction<NewResource | null>) => {
         state.selectedItem = action.payload;
       },
     },
     extraReducers: (builder) => {
       builder
         .addCase(fetchNewResources.pending, (state) => {
           state.loading = true;
           state.error = null;
         })
         .addCase(fetchNewResources.fulfilled, (state, action) => {
           state.loading = false;
           state.items = action.payload;
         })
         .addCase(fetchNewResources.rejected, (state, action) => {
           state.loading = false;
           state.error = action.error.message || 'Failed to fetch resources';
         });
         
       // Handle other async actions
     },
   });
   
   export const { setSelectedResource } = newResourceSlice.actions;
   export default newResourceSlice.reducer;
   ```

4. Create React components in `react-frontend/src/features/`:
   ```typescript
   // react-frontend/src/features/new-resource/NewResourceList.tsx
   import React, { useEffect } from 'react';
   import { useAppDispatch, useAppSelector } from '../../hooks/reduxHooks';
   import { fetchNewResources } from '../../store/slices/newResourceSlice';
   
   export const NewResourceList: React.FC = () => {
     const dispatch = useAppDispatch();
     const { items, loading, error } = useAppSelector((state) => state.newResource);
     
     useEffect(() => {
       dispatch(fetchNewResources());
     }, [dispatch]);
     
     if (loading) return <div>Loading...</div>;
     if (error) return <div>Error: {error}</div>;
     
     return (
       <div>
         <h1>New Resources</h1>
         <ul>
           {items.map((item) => (
             <li key={item.id}>{item.name}</li>
           ))}
         </ul>
       </div>
     );
   };
   ```

5. Add routes in the router configuration:
   ```typescript
   // Update the appropriate router file to include the new routes
   import { NewResourceList } from '../features/new-resource/NewResourceList';
   import { NewResourceDetail } from '../features/new-resource/NewResourceDetail';
   
   // Inside your routes configuration:
   {
     path: 'new-resources',
     element: <ProtectedRoute requiredRoles={['admin']}><NewResourceList /></ProtectedRoute>,
   },
   {
     path: 'new-resources/:id',
     element: <ProtectedRoute requiredRoles={['admin']}><NewResourceDetail /></ProtectedRoute>,
   }
   ```

### Adding Role-Based Access Control

1. Use the dependency injection pattern from `backend/app/api/deps.py`:

   ```python
   @router.get("/protected-endpoint")
   async def protected_function(
       current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
   ):
       """
       This endpoint is protected and only accessible by admin users.
       
       Required roles:
       - admin
       """
       # Only admin users can access this endpoint
       return {"message": "You have access to admin functionality"}
   ```

2. On frontend, use the ProtectedRoute component with role requirements:
   ```typescript
   // Example of a protected route component
   import { Navigate } from 'react-router-dom';
   import { useAppSelector } from '../store/hooks';
   
   interface ProtectedRouteProps {
     requiredRoles?: string[];
     children: React.ReactNode;
   }
   
   export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
     requiredRoles = [], 
     children 
   }) => {
     const { isAuthenticated, user } = useAppSelector(state => state.auth);
     
     // Not authenticated at all
     if (!isAuthenticated) {
       return <Navigate to="/login" replace />;
     }
     
     // Check for required roles if specified
     if (requiredRoles.length > 0) {
       const userRoles = user?.roles?.map(role => role.name) || [];
       const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
       
       if (!hasRequiredRole) {
         return <Navigate to="/unauthorized" replace />;
       }
     }
     
     return <>{children}</>;
   };
   ```

3. For conditional rendering based on user roles:
   ```tsx
   const { user } = useAppSelector(state => state.auth);
   const userRoles = user?.roles?.map(role => role.name) || [];
   
   return (
     <div>
       <h1>Dashboard</h1>
       
       {userRoles.includes('admin') && (
         <div className="admin-panel">
           <h2>Admin Controls</h2>
           {/* Admin-only content */}
         </div>
       )}
       
       {userRoles.includes('manager') && (
         <div className="manager-panel">
           <h2>Manager Controls</h2>
           {/* Manager-only content */}
         </div>
       )}
     </div>
   );
   ```

### Database Migrations

1. Create a new model in the appropriate file, then create a new migration with Alembic:
   ```bash
   cd backend
   alembic revision --autogenerate -m "Add new resource table"
   ```

2. Review the generated migration in `backend/alembic/versions/` to ensure it captures all intended changes

3. Apply migrations to the database:
   ```bash
   alembic upgrade head
   ```

4. For deployment scenarios, include migration commands in your CI/CD pipeline or container startup scripts

## Environment Configuration

### Backend Environment

Key variables defined in `backend/backend.env`:

- `PROJECT_NAME`: Name of the project (e.g., "FastAPI RBAC")
- `API_VERSION`: API version number for documentation
- `API_V1_STR`: API v1 prefix ("/api/v1")
- `SECRET_KEY`: Secret key for JWT token signing
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Lifespan of access tokens
- `REFRESH_TOKEN_EXPIRE_DAYS`: Lifespan of refresh tokens
- `BACKEND_CORS_ORIGINS`: CORS configuration for allowed origins
- `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`: PostgreSQL connection parameters
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Redis connection parameters
- `EMAILS_ENABLED`, `SMTP_*`: Email sending configuration
- `FIRST_SUPERUSER_EMAIL`, `FIRST_SUPERUSER_PASSWORD`: Initial admin user credentials
- `MODE`: Application mode (development, testing, production)

### Frontend Environment

Key variables defined in `react-frontend/.env`:

- `VITE_API_BASE_URL`: URL for the FastAPI backend API
- `VITE_AUTH_ACCESS_TOKEN_NAME`: Name of the auth access token for storage
- `VITE_AUTH_REFRESH_TOKEN_NAME`: Name of the auth refresh token for storage
- `VITE_APP_NAME`: Application name for display in UI

## Development Workflow

### Backend Development

1. Activate virtual environment:
   - Windows: `.venv\Scripts\Activate.ps1`
   - Linux/MacOS: `. .venv/bin/activate`

2. Install dependencies with Poetry:
   ```bash
   poetry install
   ```

3. Set up environment variables:
   - Copy `backend.env.example` to `backend.env` and configure variables
   - Update any database or service connection details as needed

4. Run database migrations:
   ```bash
   alembic upgrade head
   ```

5. Run the development server:
   ```bash
   uvicorn app.main:fastapi_app --reload --port 8000
   ```

6. Access API documentation at http://localhost:8000/docs

### Frontend Development

1. Install dependencies:
   ```bash
   cd react-frontend
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env` and configure variables
   - Update the API URL to point to your backend server

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Access the application at http://localhost:5173

### Docker Deployment

Run the entire stack with Docker Compose:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- Redis for token and cache management
- Backend FastAPI application
- Frontend React application
- Celery worker for background tasks (if configured)
- Celery beat for scheduled tasks (if configured)

## Security Considerations

1. **Token Management**:
   - Access tokens are short-lived (typically 15-30 minutes)
   - Refresh tokens are longer-lived (typically 7-30 days)
   - Access tokens are stored in memory (Redux state) to prevent XSS attacks
   - Refresh tokens are stored in localStorage with appropriate security measures
   - All tokens are validated server-side before processing requests
   - Tokens are tracked in Redis for invalidation during logout or security events

2. **Password Security**:
   - Passwords are hashed using bcrypt with appropriate cost factors
   - Password history is maintained to prevent reuse
   - Account lockout after multiple failed attempts
   - Password complexity requirements enforced
   - Password reset functionality with secure tokens

3. **Role-Based Security**:
   - Endpoints are protected by role requirements
   - UI elements are conditionally rendered based on user roles
   - Permission checks are performed server-side
   - Token payload includes minimal user information

4. **General Security**:
   - CORS protection for API endpoints
   - Rate limiting for sensitive endpoints (login, password reset)
   - HTTPS enforced in production
   - Content Security Policy headers
   - Proper error handling to prevent information leakage

## When Making Changes

1. **Follow the existing architecture and patterns:**
   - Place new models in the appropriate files under `backend/app/models/`
   - Add new CRUD operations in `backend/app/crud/`
   - Create endpoints in `backend/app/api/v1/endpoints/`
   - Organize frontend features in `react-frontend/src/features/`

2. **Update types/models in both backend and frontend:**
   - Ensure Pydantic schemas in backend match TypeScript interfaces in frontend
   - Keep validation rules consistent between backend and frontend
   - Add proper documentation in comments for complex data structures

3. **Add appropriate tests:**
   - API endpoint tests in `backend/tests/test_api_*.py`
   - CRUD operation tests in `backend/tests/test_crud_*.py`
   - Model tests in `backend/tests/test_models_*.py`
   - Component tests for React components

4. **Update documentation:**
   - Add docstrings to Python functions
   - Update API documentation with proper descriptions
   - Document required roles for protected endpoints
   - Add TypeScript interface documentation

5. **Consider security implications:**
   - Ensure proper role checks for new endpoints
   - Validate input data thoroughly
   - Handle sensitive data appropriately
   - Consider rate limiting for public endpoints

6. **Error handling and validation:**
   - Use the standard response format for all API responses
   - Implement proper validation for all input data
   - Return appropriate HTTP status codes
   - Provide helpful error messages while avoiding information leakage

7. **Code quality:**
   - Follow PEP 8 and project-specific style guides for Python code
   - Follow ESLint and TypeScript best practices for frontend code
   - Use meaningful variable and function names
   - Keep functions focused and small
   - Add comments for complex logic

By following these guidelines, you'll be able to effectively understand and work with this FastAPI RBAC project while maintaining its security, performance, and code quality standards.
