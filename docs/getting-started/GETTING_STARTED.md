# Getting Started with FastAPI RBAC

Welcome to the FastAPI RBAC project! This guide will help you get up and running quickly, whether you're a new developer joining the team or an experienced developer exploring the project.

## 🎯 What is FastAPI RBAC?

This is a comprehensive user management microservice that handles Authentication and Authorization for other services. It features:

- **FastAPI Backend**: Modern, high-performance API with async support
- **React Frontend**: TypeScript-based UI with modern component architecture
- **Role-Based Access Control (RBAC)**: Flexible permission system with roles and groups
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Docker Support**: Containerized deployment with production-ready configuration

## 🚀 Quick Start Options

Choose your path based on what you want to do:

### 🏃‍♂️ I want to run the app immediately

```powershell
# Clone and run with Docker (fastest way)
git clone <repository-url>
cd fastapi_rbac
docker-compose up -d

# Access the app at:
# Frontend: http://localhost:80
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### 💻 I want to develop and modify the code

Go to: [`../development/DEVELOPER_SETUP.md`](../development/DEVELOPER_SETUP.md)

### 🚀 I want to deploy to production

Go to: [`../deployment/PRODUCTION_SETUP.md`](../deployment/PRODUCTION_SETUP.md)

### ❓ I'm having issues

Browse: [`../troubleshooting/`](../troubleshooting/)

## 📋 System Requirements

### Minimum Requirements

- **Docker & Docker Compose** (recommended approach)
- **OR** for local development:
  - Python 3.10+
  - Node.js 18+
  - PostgreSQL 13+ (or SQLite for local dev)
  - Redis 6+

### Recommended Setup

- 8GB RAM minimum (16GB recommended)
- Visual Studio Code with recommended extensions
- Git for version control

## 🏗️ Project Architecture

```
fastapi_rbac/
├── backend/           # FastAPI application
│   ├── app/          # Main application code
│   ├── alembic/      # Database migrations
│   └── tests/        # Backend tests
├── react-frontend/   # React TypeScript application
│   ├── src/          # Frontend source code
│   └── public/       # Static assets
├── docs/             # All documentation
├── scripts/          # Utility scripts
├── docker-compose.dev.yml      # Development environment
├── docker-compose.test.yml     # Testing environment
└── docker-compose.prod-test.yml # Production testing environment
```

## 🔑 Key Features Overview

### Authentication & Security

- JWT-based authentication with access/refresh tokens
- Password hashing with bcrypt
- Token blacklisting and management
- Password reset functionality
- Account lockout protection

### Role-Based Access Control

- Flexible role and permission system
- Role groups for hierarchical management
- Permission groups for logical organization
- Fine-grained access control at API level

### User Management

- Complete user CRUD operations
- User profile management
- Email notifications
- Admin dashboard for user oversight

### Technical Features

- RESTful API with OpenAPI documentation
- Real-time updates with modern React patterns
- Background task processing with Celery
- Comprehensive error handling and logging
- Database migrations with Alembic

## 🎓 Learning Path

### 1. Understand the Basics (5 minutes)

- Read this document
- Check out the [Project Overview](./PROJECT_OVERVIEW.md)

### 2. Get It Running (10 minutes)

- Follow the Quick Start above
- Explore the running application
- Check API documentation at `/docs`

### 3. Development Setup (30 minutes)

- Follow [`DEVELOPER_SETUP.md`](../development/DEVELOPER_SETUP.md)
- Set up your IDE with recommended extensions
- Run tests to verify everything works

### 4. Explore the Code (1+ hours)

- Browse the backend API structure in `backend/app/`
- Explore the React components in `react-frontend/src/`
- Read the [API Documentation](../development/API_DOCUMENTATION.md)

### 5. Make Your First Change

- Pick a small feature or bug fix
- Follow the development workflow
- Submit a pull request

## 🆘 Need Help?

### Quick Solutions

- **App won't start?** Check [`troubleshooting/`](../troubleshooting/)
- **CORS errors?** See [`CORS_TROUBLESHOOTING.md`](../troubleshooting/CORS_TROUBLESHOOTING.md)
- **Docker issues?** Check [`DOCKER_ISSUES.md`](../troubleshooting/DOCKER_ISSUES.md)

### Getting Support

1. Check the troubleshooting guides first
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Join the team communication channels

## 📚 What's Next?

After getting started, you might want to:

- **Development**: [`DEVELOPER_SETUP.md`](../development/DEVELOPER_SETUP.md)
- **API Reference**: [`API_DOCUMENTATION.md`](../development/API_DOCUMENTATION.md)
- **Deployment**: [`PRODUCTION_SETUP.md`](../deployment/PRODUCTION_SETUP.md)
- **Testing**: [`TESTING.md`](../development/TESTING.md)

## 🎉 Welcome to the Team!

You're now ready to start working with FastAPI RBAC. The project uses modern best practices and tools to ensure a great developer experience. If you run into any issues or have suggestions for improving this guide, please let us know!

Happy coding! 🚀
