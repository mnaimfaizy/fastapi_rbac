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
├── public/                   # Static public assets
├── src/
│   ├── App.css               # Global application styles
│   ├── App.tsx               # Main application component with routing
│   ├── main.tsx              # Application entry point with providers
│   ├── index.css             # Global CSS styles and Tailwind directives
│   ├── vite-env.d.ts         # Vite environment type declarations
│   ├── assets/               # Static assets and images
│   ├── components/           # Reusable UI components
│   │   ├── auth/             # Authentication components
│   │   │   ├── LoginForm.tsx # Login form component
│   │   │   ├── SignupForm.tsx # Registration form component
│   │   │   └── ProtectedRoute.tsx # Route protection component
│   │   ├── common/           # Common reusable components
│   │   │   ├── AppWrapper.tsx # Application wrapper with providers
│   │   │   ├── LoadingScreen.tsx # Loading state component
│   │   │   ├── SplashScreen.tsx # Initial loading splash
│   │   │   ├── Meta.tsx      # HTML meta tag management
│   │   │   └── PageMeta.tsx  # Page-specific meta management
│   │   ├── dashboard/        # Dashboard-specific components
│   │   ├── layout/           # Layout components
│   │   │   ├── AuthLayout.tsx # Layout for authentication pages
│   │   │   ├── MainLayout.tsx # Main application layout
│   │   │   └── ProtectedRoute.tsx # Route-level protection
│   │   └── ui/               # ShadCN UI component library
│   │       ├── alert-dialog.tsx # Modal dialog components
│   │       ├── alert.tsx     # Alert/notification components
│   │       ├── avatar.tsx    # User avatar component
│   │       ├── badge.tsx     # Status badge component
│   │       ├── button.tsx    # Button component with variants
│   │       ├── card.tsx      # Card container component
│   │       ├── checkbox.tsx  # Checkbox form input
│   │       ├── command.tsx   # Command palette component
│   │       ├── dialog.tsx    # Modal dialog component
│   │       ├── dropdown-menu.tsx # Dropdown menu component
│   │       ├── form.tsx      # Form wrapper with validation
│   │       ├── input.tsx     # Text input component
│   │       ├── label.tsx     # Form label component
│   │       ├── pagination.tsx # Pagination component
│   │       ├── popover.tsx   # Popover/tooltip component
│   │       ├── select.tsx    # Select dropdown component
│   │       ├── separator.tsx # Visual separator component
│   │       ├── sheet.tsx     # Side sheet/drawer component
│   │       ├── skeleton.tsx  # Loading skeleton component
│   │       ├── sonner.tsx    # Toast notification component
│   │       ├── table.tsx     # Data table component
│   │       ├── textarea.tsx  # Multi-line text input
│   │       └── tooltip.tsx   # Tooltip component
│   ├── features/             # Feature-based modules (domain-driven design)
│   │   ├── auth/             # Authentication features
│   │   │   ├── components/   # Auth-specific components
│   │   │   ├── LoginPage.tsx # Login page component
│   │   │   ├── SignupPage.tsx # Registration page component
│   │   │   ├── PasswordResetPage.tsx # Password reset page
│   │   │   ├── PasswordResetRequestPage.tsx # Password reset request
│   │   │   ├── PasswordResetConfirmPage.tsx # Password reset confirmation
│   │   │   └── RegistrationSuccessPage.tsx # Registration success page
│   │   ├── dashboard/        # Dashboard features
│   │   ├── users/            # User management features
│   │   │   ├── user-table-columns.tsx # Data table column definitions
│   │   │   ├── UsersList.tsx # User list/table component
│   │   │   ├── UserDetailContent.tsx # User detail view
│   │   │   ├── UserEditForm.tsx # User editing form
│   │   │   └── UserEditPage.tsx # User edit page component
│   │   ├── roles/            # Role management features
│   │   │   ├── RoleList.tsx  # Role list component
│   │   │   ├── RoleDetail.tsx # Role detail view
│   │   │   ├── RoleForm.tsx  # Role creation/edit form
│   │   │   ├── RoleFormContent.tsx # Form content component
│   │   │   └── RolesContent.tsx # Main roles page content
│   │   ├── permissions/      # Permission management features
│   │   │   ├── PermissionsContent.tsx # Main permissions page
│   │   │   ├── PermissionsDataTable.tsx # Permissions data table
│   │   │   ├── PermissionDetail.tsx # Permission detail view
│   │   │   ├── PermissionForm.tsx # Permission form
│   │   │   └── PermissionFormContent.tsx # Form content component
│   │   ├── role-groups/      # Role group management features
│   │   └── permission-groups/ # Permission group management features
│   ├── hooks/                # Custom React hooks
│   │   ├── redux.ts          # Redux-specific hooks (useAppDispatch, useAppSelector)
│   │   ├── useAuth.ts        # Authentication state and functions
│   │   ├── usePermissions.ts # Permission checking utilities
│   │   ├── usePageMeta.ts    # Page metadata management
│   │   └── use-media-query.ts # Responsive design utilities
│   ├── lib/                  # Utility functions and shared code
│   │   ├── utils.ts          # General utility functions (cn, formatters, etc.)
│   │   └── tokenStorage.ts   # Secure token storage management
│   ├── models/               # TypeScript interfaces and types
│   │   ├── auth.ts           # Authentication types (Token, LoginCredentials, etc.)
│   │   ├── user.ts           # User interfaces and types
│   │   ├── role.ts           # Role-related interfaces
│   │   ├── roleGroup.ts      # Role group interfaces
│   │   ├── permission.ts     # Permission-related interfaces
│   │   ├── dashboard.ts      # Dashboard/analytics interfaces
│   │   ├── common.ts         # Common types and interfaces
│   │   └── pagination.ts     # Pagination-related types
│   ├── pages/                # Top-level page components
│   │   ├── NotFoundPage.tsx  # 404 error page
│   │   └── UnauthorizedPage.tsx # 403 unauthorized page
│   ├── services/             # API communication services
│   │   ├── api.ts            # Base Axios client with interceptors
│   │   ├── authTokenManager.ts # Token refresh and management
│   │   ├── auth.service.ts   # Authentication API calls
│   │   ├── user.service.ts   # User management API calls
│   │   ├── role.service.ts   # Role management API calls
│   │   ├── roleGroup.service.ts # Role group API calls
│   │   ├── permission.service.ts # Permission management API calls
│   │   └── dashboard.service.ts # Dashboard/analytics API calls
│   └── store/                # Redux store configuration
│       ├── index.ts          # Store setup with middleware
│       ├── hooks.ts          # Typed Redux hooks
│       └── slices/           # Redux Toolkit slices
│           ├── authSlice.ts  # Authentication state management
│           ├── userSlice.ts  # User management state
│           ├── roleSlice.ts  # Role management state
│           ├── roleGroupSlice.ts # Role group state
│           ├── permissionSlice.ts # Permission management state
│           ├── permissionGroupSlice.ts # Permission group state
│           └── dashboardSlice.ts # Dashboard/analytics state
├── components.json           # ShadCN UI configuration
├── eslint.config.js          # ESLint configuration
├── index.html                # HTML template
├── nginx.conf                # Nginx configuration for production
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── tsconfig.app.json         # App-specific TypeScript config
├── tsconfig.node.json        # Node-specific TypeScript config
├── vite.config.ts            # Vite build configuration
├── .env.example              # Environment variables template
├── .env.production           # Production environment config
├── .env.test                 # Test environment config
├── Dockerfile                # Development Docker configuration
├── Dockerfile.prod           # Production Docker configuration
├── docker-compose.dev.yml    # Development Docker Compose
├── docker-compose.test.yml   # Testing Docker Compose
└── docker-compose.prod.yml   # Production Docker Compose
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

   - Comprehensive user data interface with security properties
   - Properties: id, email, first_name, last_name, is_active, is_superuser, is_locked, locked_until
   - Security fields: needs_to_change_password, verified, number_of_failed_attempts, verification_code
   - Timestamps: created_at, updated_at, expiry_date, last_changed_password_date
   - Relationships: roles array and permissions array for access control
   - Used for user management features and displaying user information

2. **Role Interface**: `models/role.ts`

   - Interface for role data: id, name, description, permissions
   - Role group relationships for hierarchical management
   - Used for role management and access control

3. **Permission Interface**: `models/permission.ts`

   - Interface for permission data: id, name, description, group_id
   - Permission group relationships for logical organization
   - Used for permission management and role configuration

4. **Role Group Interface**: `models/roleGroup.ts`

   - Interface for hierarchical role organization
   - Properties: id, name, description, parent_id for nesting
   - Used for structured role management

5. **Auth Types**: `models/auth.ts`

   - **Token Interface**: access_token, token_type, refresh_token, user
   - **LoginCredentials**: email, password for authentication
   - **ErrorResponse**: message, code, detail for error handling
   - **AuthState**: Complete authentication state for Redux store
   - Defines structures for working with JWT tokens and auth flows

6. **Common Types**: `models/common.ts`

   - Shared interfaces and utility types across the application
   - Response wrappers and pagination interfaces

7. **Dashboard Types**: `models/dashboard.ts`

   - Analytics and dashboard-specific interfaces
   - Metrics, charts, and reporting data structures

8. **Pagination Types**: `models/pagination.ts`
   - Standard pagination interfaces for list views
   - Page, limit, total, and navigation metadata

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
   - Frontend calls `/api/v1/auth/logout` endpoint - Backend invalidates tokens in Redis
   - Frontend clears tokens from memory and localStorage

## Frontend Architecture and Patterns

The React frontend follows modern React patterns and best practices:

### Key Architecture Decisions

1. **Token Security Strategy**:

   - Access tokens stored in memory (Redux state) to prevent XSS attacks
   - Refresh tokens stored in localStorage with secure handling
   - Automatic token refresh via Axios interceptors

2. **State Management**:

   - Redux Toolkit for predictable state management
   - Feature-based slices (authSlice, userSlice, roleSlice, etc.)
   - Async thunks for API calls with proper error handling

3. **Component Architecture**:

   - Feature-driven organization in `src/features/`
   - Reusable UI components in `src/components/ui/` (ShadCN)
   - Layout components for consistent page structure

4. **Type Safety**:
   - TypeScript interfaces for all data models
   - Typed Redux hooks (useAppDispatch, useAppSelector)
   - Strong typing for API responses and service calls

### Core Frontend Patterns

1. **Authentication Hook Pattern**:

   ```typescript
   // useAuth.ts provides centralized auth logic
   const { user, isAuthenticated, hasPermission } = useAuth();
   ```

2. **Protected Route Pattern**:

   ```typescript
   <ProtectedRoute
     requiredRoles={["admin"]}
     requiredPermissions={["user.read"]}
   >
     <UserManagement />
   </ProtectedRoute>
   ```

3. **Permission Checking Pattern**:

   ```typescript
   const { hasPermission, hasAnyPermission } = usePermissions();

   {
     hasPermission("user.create") && <CreateUserButton />;
   }
   ```

4. **Service Layer Pattern**:

   ```typescript
   // Centralized API calls with error handling
   export const userService = {
     getAll: () => api.get("/api/v1/users"),
     create: (data) => api.post("/api/v1/users", data),
     // ... other CRUD operations
   };
   ```

5. **Redux Async Thunk Pattern**:
   ```typescript
   export const fetchUsers = createAsyncThunk(
     "users/fetchAll",
     async (_, { rejectWithValue }) => {
       try {
         return await userService.getAll();
       } catch (error) {
         return rejectWithValue(error.message);
       }
     }
   );
   ```

### Frontend Development Best Practices

### Component Architecture Patterns

1. **Feature-Based Organization**:

   ```
   src/features/
   ├── auth/
   │   ├── components/         # Feature-specific components
   │   ├── hooks/             # Feature-specific hooks
   │   ├── services/          # Feature-specific API calls
   │   └── types/             # Feature-specific TypeScript types
   ├── users/
   ├── roles/
   └── permissions/
   ```

2. **Component Naming Conventions**:

   - **Pages**: `LoginPage.tsx`, `UserListPage.tsx`
   - **Components**: `UserTable.tsx`, `RoleForm.tsx`
   - **Layout Components**: `MainLayout.tsx`, `AuthLayout.tsx`
   - **UI Components**: Use ShadCN naming (lowercase with hyphens)

3. **Component Structure Pattern**:

   ```typescript
   // UserListPage.tsx
   import React from "react";
   import { useAppSelector, useAppDispatch } from "../../hooks/redux";
   import { usePermissions } from "../../hooks/usePermissions";

   interface UserListPageProps {
     // Define props interface
   }

   export const UserListPage: React.FC<UserListPageProps> = (props) => {
     // Hooks first
     const dispatch = useAppDispatch();
     const { users, loading } = useAppSelector((state) => state.users);
     const { hasPermission } = usePermissions();

     // Effect hooks
     useEffect(() => {
       // Side effects
     }, []);

     // Event handlers
     const handleCreateUser = () => {
       // Handler logic
     };

     // Conditional rendering logic
     if (loading) return <LoadingSpinner />;

     return <div className="space-y-6">{/* Component JSX */}</div>;
   };
   ```

### State Management Best Practices

1. **Redux Store Structure**:

   ```typescript
   // Slice structure pattern
   interface UserState {
     items: User[];
     selectedUser: User | null;
     loading: boolean;
     error: string | null;
     pagination: PaginationState;
   }

   // Async thunk pattern
   export const fetchUsers = createAsyncThunk(
     "users/fetchAll",
     async (params: FetchUsersParams, { rejectWithValue }) => {
       try {
         return await userService.getAll(params);
       } catch (error) {
         return rejectWithValue(handleApiError(error));
       }
     }
   );
   ```

2. **Service Layer Pattern**:

   ```typescript
   // services/user.service.ts
   class UserService {
     private baseUrl = "/api/v1/users";

     async getAll(params?: GetUsersParams): Promise<PaginatedResponse<User>> {
       const response = await api.get(this.baseUrl, { params });
       return response.data;
     }

     async create(userData: CreateUserDto): Promise<User> {
       const response = await api.post(this.baseUrl, userData);
       return response.data.data;
     }

     // Other CRUD operations...
   }

   export const userService = new UserService();
   ```

### TypeScript Best Practices

1. **Interface Definitions**:

   ```typescript
   // models/user.ts
   export interface User {
     id: string;
     email: string;
     first_name: string;
     last_name: string;
     is_active: boolean;
     roles: Role[];
     permissions: Permission[];
     created_at: string;
     updated_at: string;
   }

   // Use DTOs for API operations
   export interface CreateUserDto {
     email: string;
     first_name: string;
     last_name: string;
     password: string;
     role_ids?: string[];
   }

   export interface UpdateUserDto
     extends Partial<Omit<CreateUserDto, "password">> {
     id: string;
   }
   ```

2. **Generic Types for API Responses**:

   ```typescript
   // models/common.ts
   export interface ApiResponse<T> {
     data: T;
     message?: string;
     success: boolean;
   }

   export interface PaginatedResponse<T> extends ApiResponse<T[]> {
     pagination: {
       page: number;
       limit: number;
       total: number;
       pages: number;
     };
   }
   ```

### Error Handling Patterns

1. **API Error Handling**:

   ```typescript
   // utils/errorHandler.ts
   export const handleApiError = (error: any): string => {
     if (error.response?.data?.message) {
       return error.response.data.message;
     }
     if (error.message) {
       return error.message;
     }
     return "An unexpected error occurred";
   };

   // In components
   const handleSubmit = async (data: CreateUserDto) => {
     try {
       await dispatch(createUser(data)).unwrap();
       toast.success("User created successfully");
       navigate("/users");
     } catch (error) {
       toast.error(error as string);
     }
   };
   ```

2. **Form Validation with React Hook Form and Zod**:

   ```typescript
   import { zodResolver } from "@hookform/resolvers/zod";
   import * as z from "zod";

   const userSchema = z.object({
     email: z.string().email("Invalid email address"),
     first_name: z.string().min(1, "First name is required"),
     last_name: z.string().min(1, "Last name is required"),
     password: z.string().min(8, "Password must be at least 8 characters"),
   });

   type UserFormData = z.infer<typeof userSchema>;

   const UserForm: React.FC = () => {
     const {
       register,
       handleSubmit,
       formState: { errors },
     } = useForm<UserFormData>({
       resolver: zodResolver(userSchema),
     });

     const onSubmit = (data: UserFormData) => {
       // Handle form submission
     };

     return (
       <form onSubmit={handleSubmit(onSubmit)}>
         {/* Form fields with error handling */}
       </form>
     );
   };
   ```

### Performance Optimization

1. **Code Splitting with Lazy Loading**:

   ```typescript
   // App.tsx
   const UserManagement = lazy(() => import("./features/users/UserManagement"));
   const RoleManagement = lazy(() => import("./features/roles/RoleManagement"));

   // In routes
   <Route
     path="/users"
     element={
       <Suspense fallback={<LoadingSpinner />}>
         <ProtectedRoute requiredRoles={["admin"]}>
           <UserManagement />
         </ProtectedRoute>
       </Suspense>
     }
   />;
   ```

2. **Memoization for Performance**:

   ```typescript
   // Use React.memo for expensive components
   export const UserTable = React.memo<UserTableProps>(
     ({ users, onEdit, onDelete }) => {
       // Component implementation
     }
   );

   // Use useMemo for expensive calculations
   const filteredUsers = useMemo(() => {
     return users.filter((user) =>
       user.email.toLowerCase().includes(searchTerm.toLowerCase())
     );
   }, [users, searchTerm]);

   // Use useCallback for event handlers
   const handleUserEdit = useCallback(
     (userId: string) => {
       navigate(`/users/${userId}/edit`);
     },
     [navigate]
   );
   ```

### Testing Strategies

1. **Component Testing Pattern**:

   ```typescript
   // __tests__/UserList.test.tsx
   import { render, screen } from "@testing-library/react";
   import { Provider } from "react-redux";
   import { configureStore } from "@reduxjs/toolkit";
   import { UserList } from "../UserList";

   const mockStore = configureStore({
     reducer: {
       users: userSlice.reducer,
       auth: authSlice.reducer,
     },
     preloadedState: {
       users: { items: mockUsers, loading: false, error: null },
       auth: { user: mockUser, isAuthenticated: true },
     },
   });

   test("renders user list correctly", () => {
     render(
       <Provider store={mockStore}>
         <UserList />
       </Provider>
     );

     expect(screen.getByText("Users")).toBeInTheDocument();
     expect(screen.getByRole("table")).toBeInTheDocument();
   });
   ```

2. **Custom Hook Testing**:

   ```typescript
   // __tests__/useAuth.test.ts
   import { renderHook } from "@testing-library/react";
   import { Provider } from "react-redux";
   import { useAuth } from "../hooks/useAuth";

   test("useAuth returns authenticated state", () => {
     const wrapper = ({ children }) => (
       <Provider store={mockStore}>{children}</Provider>
     );

     const { result } = renderHook(() => useAuth(), { wrapper });

     expect(result.current.isAuthenticated).toBe(true);
     expect(result.current.user).toEqual(mockUser);
   });
   ```

### Accessibility Best Practices

1. **Semantic HTML and ARIA**:

   ```typescript
   // Use semantic HTML elements
   <main role="main">
     <section aria-labelledby="users-heading">
       <h1 id="users-heading">User Management</h1>
       <table role="table" aria-label="Users list">
         <thead>
           <tr role="row">
             <th role="columnheader">Name</th>
             <th role="columnheader">Email</th>
             <th role="columnheader">Actions</th>
           </tr>
         </thead>
       </table>
     </section>
   </main>
   ```

2. **Keyboard Navigation**:

   ```typescript
   // Implement keyboard navigation for interactive elements
   const handleKeyDown = (event: KeyboardEvent, action: () => void) => {
     if (event.key === "Enter" || event.key === " ") {
       event.preventDefault();
       action();
     }
   };

   // Use in components
   <div
     role="button"
     tabIndex={0}
     onKeyDown={(e) => handleKeyDown(e, handleClick)}
     onClick={handleClick}
   >
     Interactive Element
   </div>;
   ```

### Security Best Practices

1. **Input Sanitization**:

   ```typescript
   // Use DOMPurify for HTML content
   import DOMPurify from "dompurify";

   const SafeHtmlContent: React.FC<{ content: string }> = ({ content }) => {
     const sanitizedContent = DOMPurify.sanitize(content);
     return <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
   };
   ```

2. **Secure Token Storage**:

   ```typescript
   // lib/tokenStorage.ts
   class TokenStorage {
     private static readonly ACCESS_TOKEN_KEY = "auth_token";
     private static readonly REFRESH_TOKEN_KEY = "refresh_token";

     static setTokens(accessToken: string, refreshToken: string) {
       // Access token in memory only (Redux state)
       // Refresh token in localStorage with encryption if needed
       localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
     }

     static clearTokens() {
       localStorage.removeItem(this.REFRESH_TOKEN_KEY);
       // Clear from Redux state
     }
   }
   ```

## SQLModel Async Idioms and Test/Factory Conventions (2025 Update)

- **All async DB queries in backend and tests must use SQLModel’s `.exec()` idiom with `AsyncSession`:**
  ```python
  result = await db.exec(select(User).where(User.email == email))
  users = result.all()
  ```
- **Do NOT use `.execute()` for SQLModel queries in async code.**
- **Integration tests must use API-driven flows for user actions (no direct DB manipulation).**
- **Use available test fixtures and factories for all test data creation and service mocking.**
- **See `backend/test/README.md` for full details and examples.**

---

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

## Frontend Troubleshooting Guide

### Common Development Issues

1. **CORS Errors**:

   ```
   Error: Access to XMLHttpRequest at 'http://localhost:8000/api/v1/auth/login'
   from origin 'http://localhost:5173' has been blocked by CORS policy
   ```

   **Solutions:**

   - Ensure backend `BACKEND_CORS_ORIGINS` includes frontend URL
   - Check that backend is running and accessible
   - Verify API base URL in frontend environment variables
   - Use browser dev tools to check preflight OPTIONS requests

2. **Token Refresh Issues**:

   ```
   Error: Request failed with status code 401
   TypeError: Cannot read properties of null (reading 'access_token')
   ```

   **Solutions:**

   - Check that refresh token is stored correctly in localStorage
   - Verify token expiration times are configured properly
   - Ensure Axios interceptors are properly handling 401 responses
   - Clear browser storage and re-login if tokens are corrupted

3. **Environment Variable Issues**:

   ```
   Error: process is not defined
   TypeError: Cannot read properties of undefined (reading 'VITE_API_BASE_URL')
   ```

   **Solutions:**

   - Ensure all environment variables are prefixed with `VITE_`
   - Check that `.env` file exists and is properly formatted
   - Verify environment variables are loaded in `vite.config.ts`
   - Restart development server after changing environment variables

4. **TypeScript Type Errors**:

   ```
   TS2339: Property 'roles' does not exist on type 'User'
   TS2322: Type 'string' is not assignable to type 'number'
   ```

   **Solutions:**

   - Ensure backend Pydantic schemas match frontend TypeScript interfaces
   - Update interface definitions when backend models change
   - Use proper type assertions and guards for API responses
   - Run `npm run build` to catch type errors early

5. **Redux State Issues**:

   ```
   Error: Cannot read properties of undefined (reading 'user')
   Redux state is not persisting between page refreshes
   ```

   **Solutions:**

   - Check that Redux store is properly configured with middleware
   - Ensure components are wrapped with Redux Provider
   - Verify initial state is properly set in slices
   - Use Redux DevTools to debug state changes

### Performance Issues

1. **Slow Initial Load**:

   - Implement code splitting with React.lazy()
   - Use React.memo for expensive components
   - Optimize bundle size with proper tree shaking
   - Implement proper loading states and skeleton screens

2. **Memory Leaks**:

   - Clean up event listeners and subscriptions in useEffect cleanup
   - Cancel pending API requests on component unmount
   - Use AbortController for cancellable requests
   - Avoid storing large objects in Redux unnecessarily

3. **Bundle Size Issues**:
   - Analyze bundle with `npm run build -- --analyze`
   - Use dynamic imports for large libraries
   - Implement proper code splitting strategies
   - Remove unused dependencies and code

### API Integration Issues

1. **Authentication Flow Problems**:

   ```typescript
   // Debug authentication state
   const debugAuth = () => {
     console.log("Auth State:", {
       isAuthenticated: !!user,
       hasAccessToken: !!accessToken,
       hasRefreshToken: !!localStorage.getItem("refresh_token"),
       userRoles: user?.roles?.map((r) => r.name),
       tokenExpiry: accessToken ? "Check JWT payload" : "No token",
     });
   };
   ```

2. **Permission Checking Issues**:

   ```typescript
   // Debug permission system
   const debugPermissions = () => {
     console.log("User Permissions:", {
       userRoles: user?.roles?.map((r) => r.name),
       userPermissions: user?.permissions?.map((p) => p.name),
       hasAdminRole: hasRole("admin"),
       hasUserCreatePermission: hasPermission("user.create"),
     });
   };
   ```

3. **API Request Debugging**:

   ```typescript
   // Add request/response logging
   api.interceptors.request.use((request) => {
     console.log("API Request:", {
       method: request.method,
       url: request.url,
       headers: request.headers,
       data: request.data,
     });
     return request;
   });

   api.interceptors.response.use(
     (response) => {
       console.log("API Response:", {
         status: response.status,
         data: response.data,
         headers: response.headers,
       });
       return response;
     },
     (error) => {
       console.error("API Error:", {
         status: error.response?.status,
         message: error.response?.data?.message,
         url: error.config?.url,
       });
       return Promise.reject(error);
     }
   );
   ```

### Build and Deployment Issues

1. **Vite Build Errors**:

   ```
   Error: Build failed with errors
   RollupError: Cannot resolve module
   ```

   **Solutions:**

   - Check that all imports use correct file paths
   - Verify that all dependencies are installed
   - Ensure TypeScript configuration is correct
   - Clear node_modules and reinstall if needed

2. **Docker Build Issues**:

   ```
   Error: COPY failed: no source files were specified
   npm ERR! peer dep missing
   ```

   **Solutions:**

   - Check Dockerfile paths are correct
   - Ensure .dockerignore doesn't exclude necessary files
   - Verify multi-stage build configuration
   - Use proper base images for Node.js version compatibility

3. **Nginx Configuration Issues**:

   ```
   404 Not Found on page refresh
   CORS errors in production
   ```

   **Solutions:**

   - Configure proper fallback routing for SPA
   - Set up correct CORS headers in nginx.conf
   - Ensure proper proxy configuration for API calls
   - Check that static files are served correctly

### Development Tools and IDE Issues

1. **ESLint Configuration**:

   ```
   Error: Failed to load config "@typescript-eslint/recommended"
   Parsing error: Cannot read file 'tsconfig.json'
   ```

   **Solutions:**

   - Ensure ESLint configuration extends correct presets
   - Check that TypeScript configuration files exist
   - Install all required ESLint plugins and parsers
   - Restart VS Code after configuration changes

2. **VS Code IntelliSense Issues**:

   - Reload VS Code window (Ctrl+Shift+P > "Reload Window")
   - Check that TypeScript language service is running
   - Verify workspace settings and extensions are correct
   - Ensure proper TypeScript project references

3. **Hot Reload Not Working**:
   - Check that Vite dev server is running on correct port
   - Verify file watching is not blocked by antivirus software
   - Ensure proper network configuration in development
   - Clear browser cache and restart development server

### Testing Issues

1. **Jest/Vitest Configuration**:

   ```
   Error: Cannot find module '@testing-library/react'
   SyntaxError: Cannot use import statement outside a module
   ```

   **Solutions:**

   - Install all required testing dependencies
   - Configure proper module resolution for ES modules
   - Set up test environment configuration correctly
   - Use appropriate transform configuration for TypeScript

2. **Component Testing Errors**:

   ```typescript
   // __tests__/UserList.test.tsx
   import { render, screen } from "@testing-library/react";
   import { Provider } from "react-redux";
   import { configureStore } from "@reduxjs/toolkit";
   import { UserList } from "../UserList";

   const mockStore = configureStore({
     reducer: {
       users: userSlice.reducer,
       auth: authSlice.reducer,
     },
     preloadedState: {
       users: { items: mockUsers, loading: false, error: null },
       auth: { user: mockUser, isAuthenticated: true },
     },
   });

   test("renders user list correctly", () => {
     render(
       <Provider store={mockStore}>
         <UserList />
       </Provider>
     );

     expect(screen.getByText("Users")).toBeInTheDocument();
     expect(screen.getByRole("table")).toBeInTheDocument();
   });
   ```

3. **Custom Hook Testing**:

   ```typescript
   // __tests__/useAuth.test.ts
   import { renderHook } from "@testing-library/react";
   import { Provider } from "react-redux";
   import { useAuth } from "../hooks/useAuth";

   test("useAuth returns authenticated state", () => {
     const wrapper = ({ children }) => (
       <Provider store={mockStore}>{children}</Provider>
     );

     const { result } = renderHook(() => useAuth(), { wrapper });

     expect(result.current.isAuthenticated).toBe(true);
     expect(result.current.user).toEqual(mockUser);
   });
   ```

## Backend Testing: Unified Test Runner

- All backend test running must use `backend/test_runner.py`.
- **Run all tests:**
  ```bash
  python backend/test_runner.py all
  ```
- **Run unit tests only:**
  ```bash
  python backend/test_runner.py unit
  ```
- **Run integration tests only:**
  ```bash
  python backend/test_runner.py integration
  ```
- **Run a specific test file:**
  ```bash
  python backend/test_runner.py specific --path backend/test/unit/test_crud_user.py
  ```
- **Run the comprehensive demo suite:**
  ```bash
  python backend/test_runner.py demo
  ```
- **Other options:** See `python backend/test_runner.py --help` for more.

> **Note:** All previous test scripts (`run_tests.py`, `run_comprehensive_tests.py`, `test_all_units.py`, `run_final_tests.py`) have been removed. Use only `test_runner.py` for all test operations.

- For full details on test/factory/fixture usage, see [`backend/test/README.md`](../backend/test/README.md).

## Linting, Formatting, Type Checking, and Import Consistency: Agent Step-by-Step Guide

Whenever you (the Agent) make any code change or add a feature, you must:

### 1. Identify the Affected Directory

- If the change is in the backend (Python/FastAPI), use the `backend/` directory.
- If the change is in the frontend (React/TypeScript), use the `react-frontend/` directory.

### 2. For Backend (Python/FastAPI)

**a. Linting, Formatting, and Type Checking Tools:**

- `mypy` for static type checking.
- `black` for code formatting.
- `isort` for import sorting.
- `flake8` for linting.

**b. Step-by-Step:**

1. Run mypy for type checking:
   ```
   cd backend
   mypy . --exclude alembic
   ```
2. Format code with Black:
   ```
   black .
   ```
3. Sort imports with isort:
   ```
   isort .
   ```
4. Check for linting issues with flake8:
   ```
   flake8 .
   ```
5. If any tool reports issues, fix them and repeat the check.

### 3. For Frontend (React/TypeScript)

**a. Linting and Formatting Tools:**

- `prettier` for code formatting.
- `eslint` for linting and import order (configured via plugins).

**b. Step-by-Step:**

1. Format code with Prettier:
   ```
   cd react-frontend
   npx prettier --write .
   ```
2. Check and fix linting/import issues with ESLint:
   ```
   npx eslint . --fix
   ```
3. If ESLint reports issues that cannot be auto-fixed, address them manually and repeat the check.

### 4. General Instructions

- Always use the configuration files present in each directory (e.g., `pyproject.toml`, `.flake8`, `.isort.cfg` for backend; `.eslintrc`, `.prettierrc` for frontend).
- Do not consider a change complete until all formatting, linting, type checking, and import checks pass with no errors or warnings.
- If you add new files, ensure they are included in the linting/formatting/type checking process.
- If you are unsure which tool to use, check the scripts in `backend/` and `react-frontend/` `package.json` or documentation.

### 5. Example Workflow

**For a backend change:**

1. Make your code change.
2. Run `mypy . --exclude alembic` in `backend/`.
3. Run `black .` and `isort .` in `backend/`.
4. Run `flake8 .` and fix any issues.
5. Only then, consider the backend change complete.

**For a frontend change:**

1. Make your code change.
2. Run `npx prettier --write .` in `react-frontend/`.
3. Run `npx eslint . --fix` and fix any remaining issues.
4. Only then, consider the frontend change complete.

## Dependency and Environment Management (Backend & Frontend)

- **Dependency Installation:**

  - Always check `requirements.txt` in the backend and `package.json` in the `react-frontend` for any dependency to install and their version.
  - If a dependency is not available in these files, you may install it, but always prefer the version specified in the project files.

- **Environment Variables:**

  - For backend test runs, always load environment variables from `.env.test.local` (if present) using `python-dotenv`.
  - Ensure that environment variables are loaded before running any tests or scripts that depend on them.

- **Test Runner Best Practices:**

  - The backend test runner (`test_runner.py`) is responsible for running all, unit, integration, and specific tests.
  - The test runner should:
    - Use `sys.executable` instead of the literal `python` string for subprocess calls to ensure the correct Python environment is used.
    - Load `.env.test.local` at the start of the script for local/unit/integration test runs.

- **General Best Practices:**
  - Always activate the correct Python virtual environment before running backend scripts.
  - For Docker Compose integration tests, ensure the correct `env_file` or `environment` section is set in the compose file.
  - If you add new dependencies, update `requirements.txt` (backend) or `package.json` (frontend) accordingly.
  - If you add new environment variables, document them in the appropriate `.env` file and ensure they are loaded where needed.

## Agent Command Execution Best Practices

- **Always check the present working directory before running any shell or terminal command.**
- **Only change directories (e.g., `cd backend`) if you are not already in the target directory.**
- **If already in the correct directory, run the command directly (e.g., `flake8 .`).**
- **If not in the correct directory, use `cd <target_dir> && <command>` (for bash/sh) or `cd <target_dir>; <command>` (for PowerShell).**
- **This prevents errors from attempting to change to a directory you are already in, and ensures all commands are run in the correct context.**
- **When generating commands for the user or for automation, always follow this pattern.**
