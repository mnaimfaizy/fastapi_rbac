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
│   ├── versions/             # Migration files
│   ├── env.py                # Alembic environment configuration
│   └── script.py.mako        # Migration template
│── app/
│   ├── api/                  # API routes and dependencies
│   │   ├── deps.py           # Core dependency injection utilities
│   │   └── v1/               # API version 1 endpoints
│   │       ├── api.py        # API router registration
│   │       └── endpoints/    # Resource-specific endpoint implementations
│   │           ├── auth.py   # Authentication endpoints
│   │           ├── user.py   # User management endpoints
│   │           ├── role.py   # Role management endpoints
│   │           ├── permission.py # Permission management endpoints
│   │           ├── role_group.py # Role group management endpoints
│   │           ├── permission_group.py # Permission group management endpoints
│   │           ├── dashboard.py # Dashboard/analytics endpoints
│   │           └── health.py # Health check endpoints
│   ├── core/                 # Core application code
│   │   ├── config.py         # Configuration settings and environment variables
│   │   ├── security.py       # JWT token and password security utilities
│   │   ├── service_config.py # Service-specific configuration
│   │   └── celery_config.py  # Celery task queue configuration
│   ├── crud/                 # Database CRUD operations
│   │   ├── base_crud.py      # Base CRUD class with common operations
│   │   ├── user_crud.py      # User-specific CRUD implementations
│   │   ├── role_crud.py      # Role-specific CRUD implementations
│   │   ├── permission_crud.py # Permission-specific CRUD implementations
│   │   ├── role_group_crud.py # Role group CRUD implementations
│   │   ├── permission_group_crud.py # Permission group CRUD implementations
│   │   └── crud_dashboard.py # Dashboard analytics CRUD operations
│   ├── db/                   # Database utilities and session management
│   │   ├── session.py        # Database session management
│   │   └── init_db.py        # Database initialization with seed data
│   ├── deps/                 # Resource-specific dependencies
│   │   ├── user_deps.py      # User-specific dependency injections
│   │   ├── role_deps.py      # Role-specific dependency injections
│   │   ├── permission_deps.py # Permission-specific dependency injections
│   │   ├── role_group_deps.py # Role group dependency injections
│   │   └── permission_group_deps.py # Permission group dependency injections
│   ├── models/               # SQLModel database models
│   │   ├── base_uuid_model.py # Base model with UUID primary key
│   │   ├── user_model.py     # User model definition
│   │   ├── role_model.py     # Role model definition
│   │   ├── permission_model.py # Permission model definition
│   │   ├── role_group_model.py # Role group model definition
│   │   ├── permission_group_model.py # Permission group model definition
│   │   ├── user_role_model.py # User-Role mapping table
│   │   ├── role_permission_model.py # Role-Permission mapping table
│   │   ├── role_group_map_model.py # Role group mapping table
│   │   ├── password_history_model.py # Password history tracking
│   │   └── audit_log_model.py # Security audit logging
│   ├── schemas/              # Pydantic schemas for API data validation
│   │   ├── base_schema.py    # Base schema definitions
│   │   ├── common_schema.py  # Common schemas (TokenType, etc.)
│   │   ├── user_schema.py    # User-related schemas
│   │   ├── role_schema.py    # Role-related schemas
│   │   ├── permission_schema.py # Permission-related schemas
│   │   ├── role_group_schema.py # Role group schemas
│   │   ├── permission_group_schema.py # Permission group schemas
│   │   ├── dashboard_schema.py # Dashboard/analytics schemas
│   │   ├── token_schema.py   # Token-related schemas
│   │   └── response_schema.py # Standard response schemas
│   ├── utils/                # Utility functions
│   │   ├── exceptions/       # Custom exception classes
│   │   │   ├── common_exception.py # Common exceptions
│   │   │   └── user_exceptions.py # User-specific exceptions
│   │   ├── email/            # Email utilities
│   │   │   ├── email.py      # Core email functions
│   │   │   └── reset_password.py # Password reset email utilities
│   │   ├── background_tasks.py # Background task utilities
│   │   ├── token.py          # Token validation and management
│   │   ├── token_manager.py  # Advanced token management
│   │   ├── password_validation.py # Password validation utilities
│   │   ├── security_audit.py # Security audit utilities
│   │   ├── role_utils.py     # Role management utilities
│   │   ├── user_utils.py     # User management utilities
│   │   ├── string_utils.py   # String manipulation utilities
│   │   ├── partial.py        # Partial update utilities
│   │   ├── fastapi_globals.py # Global middleware utilities
│   │   └── uuid6.py          # UUID utilities
│   ├── celery_app.py         # Centralized Celery application instance
│   ├── worker.py             # Celery worker task definitions
│   ├── celery_beat_schedule.py # Scheduled task configuration
│   ├── scheduled_tasks.py    # Scheduled task implementations
│   ├── main.py               # FastAPI application entry point
│   ├── backend_pre_start.py  # Pre-startup initialization script
│   ├── initial_data.py       # Database initialization script
│   └── email-templates/      # Email template files
└── test/                     # Test suite
    ├── factories/            # Test data factories
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
   - Security properties: is_locked, locked_until, needs_to_change_password, verification_code, expiry_date
   - Links to roles through the `UserRole` mapping table
   - Tracks password history and account security information

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
   - Uses formatted naming convention (e.g., "user.create", "role.read")

4. **Role Group Model**: `app/models/role_group_model.py`

   - Allows hierarchical grouping of roles for easier management
   - Properties: id, name, description, parent_id (for hierarchical structure)
   - Links to roles through the `RoleGroupMap` mapping table

5. **Permission Group Model**: `app/models/permission_group_model.py`

   - Allows logical grouping of permissions for easier management
   - Properties: id, name, description, created_by_id
   - Contains permissions with a one-to-many relationship

6. **Password History Model**: `app/models/password_history_model.py`

   - Tracks password changes for compliance and security
   - Properties: id, user_id, password_hash, salt, created_at, created_by_ip
   - Prevents password reuse and provides audit trail

7. **Audit Log Model**: `app/models/audit_log_model.py`

   - Stores security audit logs and system activity
   - Properties: id, actor_id, action, resource_type, resource_id, details, timestamp
   - Used for compliance and security monitoring

8. **Mapping Tables**:
   - `UserRole`: Many-to-many mapping between users and roles
   - `RolePermission`: Many-to-many mapping between roles and permissions
   - `RoleGroupMap`: Hierarchical mapping for role groups

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

## Background Tasks and Celery Integration

The backend supports both FastAPI BackgroundTasks for simple operations and Celery for complex, distributed, and scheduled tasks:

### Background Task System

1. **FastAPI BackgroundTasks**: Used for simple, quick tasks during development
2. **Celery Workers**: Used for production workloads, long-running tasks, and scheduled operations
3. **Task Queues**: Multiple queues for different task types:
   - `emails`: Email sending tasks
   - `maintenance`: System maintenance tasks
   - `logging`: Security audit logging
   - `user_management`: User-related background operations
   - `periodic_tasks`: Scheduled recurring tasks
   - `default`: General purpose tasks

### Available Background Tasks

1. **Email Tasks** (`app/worker.py`):

   - `send_email_task`: Send emails with templates
   - Password reset emails, verification emails, etc.

2. **Token Management**:

   - `cleanup_tokens_task`: Clean up expired tokens from Redis
   - Automatic token cleanup during logout and security events

3. **Security Tasks**:

   - `log_security_event_task`: Audit logging for security events
   - `process_account_lockout_task`: Handle account lockouts

4. **Scheduled Tasks** (`app/celery_beat_schedule.py`):
   - Daily token cleanup
   - Weekly security log cleanup
   - Hourly account unlock checks
   - System health monitoring

### Celery Configuration

- **Centralized Config**: `app/celery_app.py` and `app/core/celery_config.py`
- **Service Configuration**: `app/core/service_config.py` for environment-specific settings
- **Worker Scripts**: `scripts/worker-start.sh/ps1` for starting workers
- **Beat Scheduler**: `scripts/beat-start.sh/ps1` for scheduled tasks

## Database Initialization and Seed Data

The system includes comprehensive database initialization with seed data:

### Initial Data Setup (`app/db/init_db.py`)

1. **Default Permission Groups**:

   - User, Role, Permission, Role Group, Permission Group, Self, Content

2. **Default Permissions**:

   - CRUD operations for each resource type
   - Self-management permissions for user profiles
   - Content management permissions

3. **Default Role Groups**:

   - Administrative, Management, StandardUser

4. **Default Roles**:

   - Admin: Full system access
   - Manager: User and content management
   - User: Self-management and basic content access

5. **Default Users**:
   - Admin user (superuser)
   - Manager user (management role)
   - Standard user (basic access)

### Permission Naming Convention

Permissions use a structured naming format: `{group_name}.{action_name}`

- Examples: `user.create`, `role.read`, `self.update_profile`
- Managed by `app/utils/string_utils.py` format_permission_name function

### Database Initialization Scripts

1. **Runtime Initialization**: `app/initial_data.py` - Run during application startup
2. **Manual Initialization**: `init_data.py` - Standalone script for manual setup
3. **Docker Initialization**: `init-scripts/` - Database setup for containerized deployments

## Critical Implementation Patterns - DO NOT MODIFY

### Core Security Architecture

**DO NOT modify these core security components without explicit permission:**

1. **Password Security** (`app/core/security.py`):

   - Password hashing using bcrypt with salt and pepper
   - Token generation and validation logic
   - Password history tracking system
   - Account lockout mechanisms

2. **Authentication Flow** (`app/api/deps.py`):

   - JWT token validation dependency
   - Role-based access control decorators
   - Current user extraction from tokens
   - Redis token blacklist checking

3. **Database Session Management** (`app/db/session.py`):

   - Async database session creation
   - Connection pooling configuration
   - Transaction handling patterns

4. **Core Models Relationships** (all files in `app/models/`):
   - Many-to-many relationship tables (UserRole, RolePermission, etc.)
   - UUID primary key inheritance from BaseUUIDModel
   - SQLAlchemy event listeners in role models

### Core Configuration - HANDLE WITH EXTREME CARE

**These files contain critical system configuration:**

1. **Main Application** (`app/main.py`):

   - FastAPI application instance creation
   - Middleware registration order
   - CORS configuration
   - Global exception handlers
   - Application lifespan events

2. **Celery Configuration** (`app/celery_app.py`, `app/core/celery_config.py`):

   - Centralized Celery application instance
   - Task queue definitions and routing
   - Redis broker configuration
   - Task execution settings

3. **Database Initialization** (`app/db/init_db.py`):
   - Initial data seeding logic
   - Superuser creation process
   - Permission and role hierarchy setup
   - Default system configurations

### Required Patterns for New Code

When adding new features, ALWAYS follow these patterns:

1. **API Endpoint Pattern**:

   ```python
   @router.get("", response_model=IGetResponseBase[IResourceRead])
   async def get_resources(
       current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
       db_session: AsyncSession = Depends(deps.get_db_session),
   ):
       # Implementation
       resources = await crud.resource.get_multi(db_session=db_session)
       return create_response(data=resources)
   ```

2. **CRUD Pattern** (inherit from `CRUDBase`):

   ```python
   class CRUDResource(CRUDBase[Resource, IResourceCreate, IResourceUpdate]):
       # Custom methods only
       pass

   resource = CRUDResource(Resource)
   ```

3. **Schema Pattern** (use consistent naming):

   ```python
   class IResourceBase(BaseModel):
       # Common fields

   class IResourceCreate(IResourceBase):
       # Creation-specific fields

   class IResourceUpdate(IResourceBase):
       # Update-specific fields (use @optional decorator)

   class IResourceRead(IResourceBase):
       id: UUID
       # Read-only fields
   ```

4. **Model Pattern** (inherit from `BaseUUIDModel`):

   ```python
   class ResourceBase(SQLModel):
       # Field definitions
     class Resource(BaseUUIDModel, ResourceBase, table=True):
       __tablename__ = "Resource"
       # Relationships and constraints
   ```

5. **Dependency Pattern** (for resource validation):

   ```python
   # app/deps/resource_deps.py
   from app.utils.exceptions.common_exception import IdNotFoundException

   async def valid_resource_id(
       resource_id: UUID = Path(..., description="The ID of the resource")
   ) -> Resource:
       """Validate that a resource exists and return it."""
       resource = await crud.resource.get(id=resource_id)
       if not resource:
           raise IdNotFoundException(Resource, id=resource_id)
       return resource
   ```

### Security Requirements - NEVER BYPASS

1. **Role-Based Access Control**:

   - ALWAYS use `deps.get_current_user(required_roles=[...])` for protected endpoints
   - NEVER bypass role checking for sensitive operations
   - Use appropriate role enums from `IRoleEnum`

2. **Input Validation**:

   - ALWAYS validate input using Pydantic schemas
   - NEVER trust user input without validation
   - Use appropriate field validators for sensitive data

3. **Database Operations**:

   - ALWAYS use async database sessions
   - NEVER execute raw SQL without parameterization
   - Use CRUD classes for all database operations

4. **Error Handling**:

   - ALWAYS use standard response schemas (`create_response`, `create_error_response`)
   - NEVER expose internal system details in error messages
   - Log security-relevant events using audit logging

5. **Background Tasks**:
   - Use `app/utils/background_tasks.py` for task management
   - Support both FastAPI BackgroundTasks and Celery
   - NEVER execute blocking operations in request handlers

### File Organization Rules

1. **New API Endpoints**: Place in `app/api/v1/endpoints/[resource].py`
2. **New Models**: Place in `app/models/[resource]_model.py`
3. **New Schemas**: Place in `app/schemas/[resource]_schema.py`
4. **New CRUD**: Place in `app/crud/[resource]_crud.py`
5. **New Dependencies**: Place in `app/deps/[resource]_deps.py`
6. **New Utilities**: Place in appropriate subdirectory under `app/utils/`

### Important Utility Functions and Patterns

**Security Audit Logging** (`app/utils/security_audit.py`):

```python
from app.utils.security_audit import create_audit_log

# Log security events for compliance
await create_audit_log(
    db_session=db_session,
    actor_id=current_user.id,
    action="user.login",
    resource_type="user",
    resource_id=str(user.id),
    details={"ip_address": request.client.host}
)
```

**Background Task Management** (`app/utils/background_tasks.py`):

```python
from app.utils.background_tasks import add_task_to_queue

# Queue background tasks properly
await add_task_to_queue(
    "send_email_task",
    queue_name="emails",
    email_data={"to": user.email, "template": "welcome"}
)
```

**String Utilities** (`app/utils/string_utils.py`):

```python
from app.utils.string_utils import format_permission_name

# Format permission names consistently
permission_name = format_permission_name("user", "create")  # Returns "user.create"
```

**Token Management** (`app/utils/token_manager.py`):

```python
from app.utils.token_manager import invalidate_user_tokens

# Invalidate all tokens for security events
await invalidate_user_tokens(user_id=user.id, reason="password_change")
```

### Testing Requirements

When adding new features, ALWAYS include:

1. **API Tests**: Test all endpoints in `test/test_api_[resource].py`
2. **CRUD Tests**: Test database operations in `test/test_crud_[resource].py`
3. **Model Tests**: Test relationships in `test/test_models_[resource].py`
4. **Security Tests**: Test authorization and validation
5. **Factory Classes**: Create test data factories in `test/factories/`

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
   import { api } from "./api";
   import {
     CreateNewResourceDto,
     NewResource,
     UpdateNewResourceDto,
   } from "../models/newResource";

   const BASE_URL = "/api/v1/new-resource";

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

     update: async (
       id: string,
       data: UpdateNewResourceDto
     ): Promise<NewResource> => {
       const response = await api.put(`${BASE_URL}/${id}`, data);
       return response.data.data;
     },

     delete: async (id: string): Promise<void> => {
       await api.delete(`${BASE_URL}/${id}`);
     },
   };
   ```

3. Create Redux slice in `react-frontend/src/store/slices/`:

   ```typescript
   // react-frontend/src/store/slices/newResourceSlice.ts
   import {
     createSlice,
     createAsyncThunk,
     PayloadAction,
   } from "@reduxjs/toolkit";
   import { newResourceService } from "../../services/newResource.service";
   import {
     NewResource,
     CreateNewResourceDto,
     UpdateNewResourceDto,
   } from "../../models/newResource";

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
     "newResource/fetchAll",
     async () => {
       return await newResourceService.getAll();
     }
   );

   // Add other async thunks for CRUD operations

   const newResourceSlice = createSlice({
     name: "newResource",
     initialState,
     reducers: {
       setSelectedResource: (
         state,
         action: PayloadAction<NewResource | null>
       ) => {
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
           state.error = action.error.message || "Failed to fetch resources";
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
   import React, { useEffect } from "react";
   import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
   import { fetchNewResources } from "../../store/slices/newResourceSlice";

   export const NewResourceList: React.FC = () => {
     const dispatch = useAppDispatch();
     const { items, loading, error } = useAppSelector(
       (state) => state.newResource
     );

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
   import { Navigate } from "react-router-dom";
   import { useAppSelector } from "../store/hooks";

   interface ProtectedRouteProps {
     requiredRoles?: string[];
     children: React.ReactNode;
   }

   export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
     requiredRoles = [],
     children,
   }) => {
     const { isAuthenticated, user } = useAppSelector((state) => state.auth);

     // Not authenticated at all
     if (!isAuthenticated) {
       return <Navigate to="/login" replace />;
     }

     // Check for required roles if specified
     if (requiredRoles.length > 0) {
       const userRoles = user?.roles?.map((role) => role.name) || [];
       const hasRequiredRole = requiredRoles.some((role) =>
         userRoles.includes(role)
       );

       if (!hasRequiredRole) {
         return <Navigate to="/unauthorized" replace />;
       }
     }

     return <>{children}</>;
   };
   ```

3. For conditional rendering based on user roles:

   ```tsx
   const { user } = useAppSelector((state) => state.auth);
   const userRoles = user?.roles?.map((role) => role.name) || [];

   return (
     <div>
       <h1>Dashboard</h1>

       {userRoles.includes("admin") && (
         <div className="admin-panel">
           <h2>Admin Controls</h2>
           {/* Admin-only content */}
         </div>
       )}

       {userRoles.includes("manager") && (
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

#### Celery-Specific Environment Variables

- `CELERY_BROKER_URL`: Redis URL for Celery message broker
- `CELERY_RESULT_BACKEND`: Redis URL for storing task results
- `CELERY_TASK_ALWAYS_EAGER`: Execute tasks synchronously in development/testing
- `CELERY_CONCURRENCY`: Number of concurrent worker processes
- `DATABASE_CELERY_NAME`: Database name for Celery beat scheduler

#### Email Configuration

- `EMAILS_ENABLED`: Enable/disable email sending
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: SMTP server configuration
- `EMAILS_FROM_EMAIL`, `EMAILS_FROM_NAME`: Default sender information

### Frontend Environment

Key variables defined in `react-frontend/.env`:

- `VITE_API_BASE_URL`: URL for the FastAPI backend API
- `VITE_AUTH_ACCESS_TOKEN_NAME`: Name of the auth access token for storage
- `VITE_AUTH_REFRESH_TOKEN_NAME`: Name of the auth refresh token for storage
- `VITE_APP_NAME`: Application name for display in UI

## Development and Deployment Scripts

The project includes comprehensive script collections for development, testing, and deployment operations:

### Backend Scripts (`backend/scripts/`)

**Core Development Scripts:**

- `run.ps1/sh`: Start the FastAPI development server
- `lint.ps1/sh`: Run code linting with ruff and mypy
- `format.ps1/sh`: Format code with ruff formatter
- `format-imports.ps1/sh`: Format and sort imports with isort
- `development-setup.ps1/sh`: Set up development environment
- `development-entrypoint.ps1/sh`: Development container entrypoint

**Celery Task Management:**

- `worker-start.ps1/sh`: Start Celery workers for background tasks
- `beat-start.ps1/sh`: Start Celery beat scheduler for periodic tasks
- `flower-start.ps1/sh`: Start Flower monitoring dashboard for Celery

**Production Scripts:**

- `entrypoint.ps1/sh`: Production container entrypoint
- Database initialization and migration scripts

### Project-Level Scripts (`scripts/`)

**Development Scripts (`scripts/dev/`):**

- `setup-dev-env.ps1`: Complete development environment setup
- `run-tests.ps1`: Execute comprehensive test suites
- `clean-dev.ps1`: Clean development artifacts and caches

**Docker Scripts (`scripts/docker/`):**

- `build-images.ps1`: Build Docker images for all services
- `test-production.ps1`: Test production Docker configuration locally
- `validate-config.ps1`: Validate Docker Compose configurations
- `diagnose-cors.ps1`: Diagnose CORS issues in containerized environments

**Database Scripts (`scripts/database/`):**

- Database backup and restore utilities
- Migration and seeding scripts for different environments
- Data validation and cleanup tools

**Deployment Scripts (`scripts/deployment/`):**

- Production deployment automation
- Health check and monitoring setup
- Environment-specific configuration management

### Usage Guidelines for AI Agents

**When suggesting script usage:**

1. **Cross-platform compatibility**: Always mention both `.ps1` (PowerShell) and `.sh` (Bash) versions
2. **Environment context**: Consider whether the user is in development, testing, or production
3. **Prerequisites**: Check that required services (Redis, PostgreSQL) are running
4. **Virtual environment**: Ensure virtual environment is activated for Python scripts

**Common script workflows:**

```powershell
# Development setup (Windows)
.\scripts\dev\setup-dev-env.ps1
cd backend
.\scripts\development-setup.ps1
.\scripts\run.ps1

# Start background services
.\scripts\worker-start.ps1    # In separate terminal
.\scripts\beat-start.ps1      # In separate terminal
.\scripts\flower-start.ps1    # Optional: monitoring

# Code quality
.\scripts\lint.ps1
.\scripts\format.ps1
.\scripts\format-imports.ps1
```

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
