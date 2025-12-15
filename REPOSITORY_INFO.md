# GitHub Repository Information

This document contains the recommended repository description and topics/tags for the `fastapi_rbac` GitHub repository.

## Repository Description (About Section)

**Recommended Description:**

```
A production-ready Role-Based Access Control (RBAC) microservice with FastAPI backend and React TypeScript frontend. Features JWT authentication, CSRF protection, rate limiting, role hierarchies, permission groups, and comprehensive security. Includes Celery workers, Redis caching, Docker deployment, and 90+ backend + 354 frontend tests.
```

**Alternative Shorter Version (if character limit applies):**

```
Enterprise RBAC microservice with FastAPI + React. JWT auth, CSRF protection, role hierarchies, permission groups, Celery workers, Redis, Docker deployment. Production-ready with 400+ tests.
```

## Website URL

```
https://fastapi-rbac.mnfprofile.com/
```

## GitHub Topics/Tags

The following topics should be added to the repository to improve discoverability:

### Core Technologies
- `fastapi`
- `react`
- `typescript`
- `python`
- `sqlmodel`
- `sqlalchemy`
- `redux`
- `redux-toolkit`

### Authentication & Security
- `rbac`
- `role-based-access-control`
- `jwt`
- `jwt-authentication`
- `authentication`
- `authorization`
- `csrf-protection`
- `security`
- `rate-limiting`

### Features & Patterns
- `microservice`
- `user-management`
- `access-control`
- `permission-system`
- `rest-api`
- `api`

### Infrastructure & DevOps
- `docker`
- `docker-compose`
- `redis`
- `postgresql`
- `celery`
- `nginx`

### Frontend Technologies
- `vite`
- `react-router`
- `axios`
- `shadcn-ui`
- `tailwindcss`

### Testing & Quality
- `pytest`
- `vitest`
- `testing`
- `integration-tests`

### Additional Relevant Tags
- `enterprise`
- `production-ready`
- `async`
- `asyncio`
- `alembic`
- `pydantic`

## How to Apply These Settings

### Via GitHub Web Interface

1. **Add Description:**
   - Go to the repository on GitHub: https://github.com/mnaimfaizy/fastapi_rbac
   - Click the ⚙️ (gear/settings) icon next to "About" on the right sidebar
   - Paste the recommended description
   - Add the website URL: `https://fastapi-rbac.mnfprofile.com/`
   - Click "Save changes"

2. **Add Topics:**
   - In the same "About" settings dialog
   - Click in the "Topics" field
   - Start typing each topic from the list above
   - Select or create each topic
   - GitHub has a limit of 20 topics, so prioritize the most important ones

### Via GitHub API (Alternative Method)

If you prefer to use the GitHub API, you can use this curl command:

```bash
curl -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/repos/mnaimfaizy/fastapi_rbac \
  -d '{
    "description": "A production-ready Role-Based Access Control (RBAC) microservice with FastAPI backend and React TypeScript frontend. Features JWT authentication, CSRF protection, rate limiting, role hierarchies, permission groups, and comprehensive security. Includes Celery workers, Redis caching, Docker deployment, and 90+ backend + 354 frontend tests.",
    "homepage": "https://fastapi-rbac.mnfprofile.com/",
    "topics": [
      "fastapi",
      "react",
      "typescript",
      "python",
      "rbac",
      "role-based-access-control",
      "jwt",
      "authentication",
      "authorization",
      "microservice",
      "docker",
      "redis",
      "postgresql",
      "celery",
      "user-management",
      "security",
      "csrf-protection",
      "sqlmodel",
      "redux-toolkit",
      "production-ready"
    ]
  }'
```

Replace `YOUR_TOKEN` with your GitHub personal access token that has `repo` scope.

## Recommended Priority Topics (Maximum 20)

If you need to limit to 20 topics, use these in priority order:

1. `fastapi`
2. `react`
3. `typescript`
4. `python`
5. `rbac`
6. `role-based-access-control`
7. `jwt-authentication`
8. `authentication`
9. `authorization`
10. `microservice`
11. `user-management`
12. `security`
13. `csrf-protection`
14. `docker`
15. `redis`
16. `postgresql`
17. `celery`
18. `redux-toolkit`
19. `sqlmodel`
20. `production-ready`

## Why These Topics Matter

- **Discoverability**: These topics help developers find your repository when searching for:
  - Authentication/authorization solutions
  - FastAPI examples and templates
  - RBAC implementations
  - React + FastAPI full-stack applications
  - Microservice architectures
  - Security best practices

- **Relevance**: Each topic directly relates to core technologies or features in this repository

- **Community**: These are commonly searched terms in the developer community

## Notes

- GitHub allows a maximum of **20 topics** per repository
- Topics should be lowercase and use hyphens instead of spaces
- The description has a limit of **350 characters** (use the shorter version if needed)
- Topics help with GitHub's search algorithm and topic pages (e.g., https://github.com/topics/fastapi)
