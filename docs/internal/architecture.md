# System Architecture

This document provides a comprehensive overview of the FastAPI RBAC system architecture.

## High-Level Architecture

The FastAPI RBAC system follows a modern, layered architecture designed for scalability, maintainability, and security:

```
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│                   │      │                   │      │                   │
│  React Frontend   │◄────►│  FastAPI Backend  │◄────►│  PostgreSQL DB    │
│                   │      │                   │      │                   │
└───────────────────┘      └─────────┬─────────┘      └───────────────────┘
                                     │
                                     ▼
                           ┌───────────────────┐
                           │                   │
                           │  Redis Cache      │
                           │                   │
                           └───────────────────┘
```

## Backend Architecture

The backend follows a clean architecture pattern with distinct layers:

### API Layer

- **Controllers**: FastAPI route handlers in `app/api/v1/endpoints/`
- **Dependency Injection**: Authentication and permission middleware in `app/api/deps.py`
- **Validation**: Request/response validation using Pydantic schemas in `app/schemas/`

### Service Layer

- **CRUD Operations**: Database operations in `app/crud/`
- **Business Logic**: Implementation of business rules
- **Security**: JWT token handling, password hashing in `app/core/security.py`

### Data Layer

- **Models**: SQLModel-based data models in `app/models/`
- **Migrations**: Alembic migrations for database schema updates
- **Database**: PostgreSQL for persistent storage

### Infrastructure Layer

- **Configuration**: Environment-based configuration in `app/core/config.py`
- **Caching**: Redis for token storage and caching
- **Background Tasks**: Celery for asynchronous job processing

## Frontend Architecture

The React frontend follows a feature-based organization:

### Core Components

- **State Management**: Redux Toolkit for global state
- **API Communication**: Axios with interceptors for JWT handling
- **Routing**: React Router with protected routes
- **UI Components**: Custom components with ShadCN UI

### Feature Organization

- **Authentication**: Login, registration, password reset
- **User Management**: User listing, creation, updating
- **Role Management**: Role assignment and permission configuration
- **Dashboard**: Analytics and reporting

## Security Architecture

The system implements multiple layers of security:

### Authentication

- **JWT Tokens**: Short-lived access tokens with refresh token mechanism
- **Password Security**: Bcrypt hashing with salt
- **Token Storage**: Secure token handling with browser security best practices

### Authorization

- **Role-Based Access Control**: Granular permission management
- **API Security**: Endpoint protection with dependency injection
- **Data Security**: Row-level security controls

### Infrastructure Security

- **CORS Protection**: Configured origins for cross-origin requests
- **Rate Limiting**: Protection against brute force attacks
- **SSL/TLS**: Encrypted communication

## Data Model

The core data model centers around these key entities:

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│               │       │               │       │               │
│     User      │◄─────►│     Role      │◄─────►│  Permission   │
│               │       │               │       │               │
└───────────────┘       └───────────────┘       └───────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│               │       │               │       │               │
│Password History│      │  Role Group   │       │Permission Group│
│               │       │               │       │               │
└───────────────┘       └───────────────┘       └───────────────┘
```

## Deployment Architecture

The system supports multiple deployment patterns:

### Docker-based Deployment

- **Containerization**: Docker containers for all services
- **Orchestration**: Docker Compose for development and production
- **Scaling**: Horizontal scaling for API and worker containers

### CI/CD Pipeline

- **Continuous Integration**: Automated testing on pull requests
- **Continuous Deployment**: Automated deployment to staging/production
- **Environment Separation**: Development, testing, staging, and production environments

## Performance Considerations

- **Database Optimization**: Indexing, query optimization
- **Caching Strategy**: Redis for token and frequently accessed data
- **Async Processing**: Background tasks for email and long-running operations

## Monitoring and Observability

- **Logging**: Structured logging for application events
- **Metrics**: Performance and usage metrics
- **Error Tracking**: Comprehensive error handling and reporting
