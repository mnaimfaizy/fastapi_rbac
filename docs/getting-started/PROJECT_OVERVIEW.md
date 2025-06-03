# Project Overview

## System Architecture

The FastAPI RBAC project is designed as a modern, scalable user management microservice with a clear separation of concerns between backend API services and frontend user interface.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │◄──►│  FastAPI Backend │◄──►│    PostgreSQL   │
│   (Port 80/5173) │    │   (Port 8000)   │    │   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │      Redis      │
                       │   (Port 6379)   │
                       └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │  Celery Workers │
                       │ (Background Tasks)│
                       └─────────────────┘
```

### Technology Stack

#### Backend (FastAPI)

- **Framework**: FastAPI 0.104+ with Python 3.10+
- **Database**: PostgreSQL with SQLAlchemy/SQLModel ORM
- **Caching**: Redis for token management and caching
- **Authentication**: JWT tokens with bcrypt password hashing
- **Background Tasks**: Celery with Redis as message broker
- **API Documentation**: Automatic OpenAPI/Swagger generation
- **Testing**: Pytest with async support

#### Frontend (React)

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite for fast development and builds
- **State Management**: Redux Toolkit with RTK Query
- **UI Components**: ShadCN UI with Tailwind CSS
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors for token management
- **Testing**: Jest and React Testing Library

#### Infrastructure

- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for local development
- **Database Migrations**: Alembic for version-controlled schema changes
- **Environment Management**: Environment-specific configuration files
- **Logging**: Structured logging with rotation
- **Monitoring**: Health check endpoints and container health monitoring

## Core Domain Models

### User Management

```
User
├── id (UUID)
├── email (unique)
├── first_name, last_name
├── password_hash
├── is_active, is_superuser
├── created_at, updated_at
└── relationships:
    ├── roles (many-to-many via UserRole)
    └── password_history (one-to-many)
```

### Role-Based Access Control

```
Role
├── id (UUID)
├── name (unique)
├── description
├── role_group_id (foreign key)
└── relationships:
    ├── users (many-to-many via UserRole)
    ├── permissions (many-to-many via RolePermission)
    └── role_group (many-to-one)

Permission
├── id (UUID)
├── name (unique)
├── description
├── group_id (foreign key)
└── relationships:
    ├── roles (many-to-many via RolePermission)
    └── permission_group (many-to-one)

RoleGroup & PermissionGroup
├── Hierarchical organization
├── Simplified management
└── Logical grouping capabilities
```

## API Design Principles

### RESTful Design

- Resource-based URLs (`/api/v1/users`, `/api/v1/roles`)
- HTTP methods for operations (GET, POST, PUT, DELETE)
- Consistent response formats across all endpoints
- Proper HTTP status codes

### Authentication & Authorization

```python
# Protected endpoint example
@router.get("/admin-only")
async def admin_function(
    current_user: User = Depends(get_current_user(required_roles=[IRoleEnum.admin]))
):
    """Only admin users can access this endpoint"""
    pass
```

### Response Format

```json
{
  "data": { ... },           // Main response data
  "message": "Success",      // Human-readable message
  "meta": {                  // Metadata (pagination, etc.)
    "pagination": { ... }
  }
}
```

## Security Architecture

### Authentication Flow

1. **Login**: User submits credentials → JWT access/refresh tokens issued
2. **Request**: Access token included in Authorization header
3. **Validation**: Token signature, expiry, and blacklist checked
4. **Refresh**: Expired access tokens refreshed using refresh token
5. **Logout**: Tokens added to Redis blacklist

### Authorization Layers

1. **Route Protection**: Endpoint-level role requirements
2. **Resource Access**: User can only access their own data (unless admin)
3. **Operation Permissions**: Fine-grained permission checks
4. **Data Filtering**: Results filtered based on user permissions

### Security Features

- Password complexity requirements
- Account lockout after failed attempts
- Password history tracking
- Secure password reset flow
- Token blacklisting for logout
- CORS protection
- Rate limiting on sensitive endpoints

## Database Design

### Core Tables

- `users` - User accounts and profiles
- `roles` - System roles (admin, manager, user, etc.)
- `permissions` - Granular permissions (create_user, delete_post, etc.)
- `role_groups` - Hierarchical role organization
- `permission_groups` - Logical permission grouping

### Mapping Tables

- `user_role` - Many-to-many: Users ↔ Roles
- `role_permission` - Many-to-many: Roles ↔ Permissions
- `role_group_map` - Hierarchical role relationships

### Audit & Security Tables

- `password_history` - Track password changes
- `user_sessions` - Active user sessions (if needed)
- `audit_logs` - System activity logging (optional)

## Frontend Architecture

### Component Structure

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication forms
│   ├── layout/          # App layout components
│   └── ui/              # Base UI components (ShadCN)
├── features/            # Feature-based modules
│   ├── auth/            # Login, signup, password reset
│   ├── users/           # User management
│   ├── roles/           # Role management
│   └── permissions/     # Permission management
├── hooks/               # Custom React hooks
├── services/            # API communication
├── store/               # Redux state management
└── lib/                 # Utilities and helpers
```

### State Management

- **Redux Toolkit**: Global state for user auth, UI state
- **RTK Query**: API state management with caching
- **Local State**: Component-specific state with useState/useReducer
- **URL State**: Router state for navigation

### Authentication State

```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}
```

## Development Workflow

### Local Development

1. **Setup**: Environment variables, dependencies
2. **Database**: Migrations, seed data
3. **Development Server**: Hot reload for both frontend/backend
4. **Testing**: Unit tests, integration tests
5. **Code Quality**: Linting, formatting, type checking

### Docker Development

1. **Build**: Multi-stage Docker builds
2. **Compose**: Orchestrated services (app, db, redis)
3. **Volumes**: Code mounting for hot reload
4. **Networks**: Container communication
5. **Health Checks**: Service availability monitoring

### Production Deployment

1. **Build**: Optimized production builds
2. **Environment**: Production configuration
3. **Security**: Secrets management, HTTPS
4. **Monitoring**: Health checks, logging
5. **Scaling**: Load balancing, horizontal scaling

## Integration Points

### External Services

- **Email Service**: SMTP for notifications (optional)
- **File Storage**: S3-compatible storage (optional)
- **Monitoring**: Application performance monitoring (optional)
- **Logging**: Centralized log aggregation (optional)

### API Integrations

- **Other Microservices**: Authentication via JWT validation
- **Third-party APIs**: External service integrations
- **Webhooks**: Event-driven integrations (optional)

## Performance Considerations

### Backend Optimizations

- **Database**: Indexes on frequently queried fields
- **Caching**: Redis for session data and frequent queries
- **Connection Pooling**: Efficient database connections
- **Async Operations**: Non-blocking I/O operations
- **Background Tasks**: Celery for heavy operations

### Frontend Optimizations

- **Code Splitting**: Lazy loading of route components
- **Bundle Optimization**: Tree shaking, compression
- **API Caching**: RTK Query for intelligent caching
- **Image Optimization**: Compressed assets
- **Performance Monitoring**: Core Web Vitals tracking

This architecture provides a solid foundation for a scalable, maintainable user management system while maintaining flexibility for future enhancements and integrations.
