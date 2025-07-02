# Contributing to FastAPI RBAC

Thank you for your interest in contributing to the FastAPI RBAC project! We're excited to have you join our community and look forward to your contributions. This guide will help you get started and ensure your contributions align with our project standards.

## Table of Contents

- [Welcome](#welcome)
- [Project Overview](#project-overview)
- [How to Contribute](#how-to-contribute)
- [Getting Started](#getting-started)
- [Development Guidelines](#development-guidelines)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Submission Process](#submission-process)
- [Release Process](#release-process)
- [Community Guidelines](#community-guidelines)
- [Getting Help](#getting-help)
- [Recognition](#recognition)

## Welcome

FastAPI RBAC is a comprehensive Role-Based Access Control system with a FastAPI backend and React frontend, designed to handle authentication and authorization for microservices. Our mission is to provide a secure, scalable, and developer-friendly RBAC solution that follows enterprise security standards.

### What We Accept

We welcome the following types of contributions:

- **🐛 Bug Reports**: Issues with existing functionality
- **✨ Feature Requests**: New features and enhancements
- **🔧 Code Contributions**: Bug fixes, new features, performance improvements
- **📚 Documentation**: Improvements to guides, API docs, and tutorials
- **🧪 Tests**: Additional test coverage and test improvements
- **🔒 Security**: Security improvements and vulnerability reports
- **🎨 UI/UX**: Frontend improvements and accessibility enhancements
- **🌐 Frontend Development**: React/TypeScript contributions
- **⚙️ DevOps**: Docker, CI/CD, and deployment improvements

### What We Don't Accept

At this time, we do not accept the following:

- **Translations**: We currently support English only
- **Major architectural changes** without prior discussion
- **Breaking changes** to existing APIs without migration plans
- **Dependencies** that conflict with our security requirements

## Project Overview

### Technology Stack

**Backend (FastAPI)**:

- FastAPI with Python 3.10+
- PostgreSQL with SQLAlchemy/SQLModel
- Redis for caching and token management
- Celery for background tasks
- JWT authentication with bcrypt
- Comprehensive security features (CSRF, XSS protection, rate limiting)

**Frontend (React)**:

- React 18+ with TypeScript
- Redux Toolkit for state management
- ShadCN UI with Tailwind CSS
- Vite build system
- Comprehensive test suite with Vitest

### Project Structure

```
fastapi_rbac/
├── 📁 backend/              # FastAPI application
├── 📁 react-frontend/       # React TypeScript app
├── 📁 docs/                # Documentation
├── 📁 scripts/             # Utility scripts
└── 📄 docker-compose*.yml  # Container configurations
```

## How to Contribute

### 1. **Report Issues**

Found a bug or have a feature request? Please check our [issue tracker](../../issues) first to avoid duplicates.

**For Bug Reports**, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Docker version, etc.)
- Relevant logs or error messages

**For Feature Requests**, please include:

- Clear description of the proposed feature
- Use cases and benefits
- Potential implementation approach
- Consideration for backward compatibility

### 2. **Submit Code Changes**

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes following our [development guidelines](#development-guidelines)
4. **Test** your changes thoroughly
5. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
6. **Push** to your branch: `git push origin feature/amazing-feature`
7. **Submit** a Pull Request

### 3. **Improve Documentation**

Documentation improvements are always welcome! You can:

- Fix typos or unclear explanations
- Add missing documentation
- Update outdated information
- Create new guides or tutorials

## Getting Started

### Prerequisites

- **Git** for version control
- **Docker & Docker Compose** for containerized development
- **Node.js 18+** for frontend development
- **Python 3.10+** for backend development
- **VS Code** (recommended) with our workspace extensions

### Development Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-username/fastapi_rbac.git
   cd fastapi_rbac
   ```

2. **Follow our comprehensive setup guide**:
   📖 **[Complete Setup Guide](docs/development/DEVELOPER_SETUP.md)**

3. **Quick start with Docker**:

   ```bash
   docker-compose up -d
   # Frontend: http://localhost:80
   # Backend API: http://localhost:8000/docs
   ```

4. **Install VS Code extensions**:
   - Python, Black Formatter, isort, Flake8, Mypy
   - ESLint, Prettier
   - Docker, GitLens (recommended)

## Development Guidelines

### Project Organization

- **Feature-based development**: Each feature should include backend API, frontend UI, tests, and documentation
- **API-first approach**: Design API endpoints before implementing frontend
- **Documentation-driven**: Update docs alongside code changes
- **Test-driven development**: Write tests for new features

### Branch Naming

Use descriptive branch names with prefixes:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `test/` - Test improvements
- `refactor/` - Code refactoring
- `chore/` - Maintenance tasks

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(auth): add password strength validation
fix(user): resolve email validation issue
docs(api): update authentication endpoints
test(user): add integration tests for user creation
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Code Standards

### Backend (Python/FastAPI)

**Code Quality Tools**:

- **Black** for code formatting
- **isort** for import sorting
- **Flake8** for linting
- **Mypy** for type checking

**Run quality checks**:

```bash
cd backend
black .
isort .
flake8 .
mypy . --exclude alembic
```

**Key Conventions**:

- Use SQLModel's `.exec()` for all async DB queries (not `.execute()`)
- Follow PEP 8 style guidelines
- Add type hints to all functions
- Use Pydantic models for API schemas
- Implement proper error handling with custom exceptions

**Security Requirements**:

- Validate all input data
- Use parameterized queries
- Implement proper authentication checks
- Follow OWASP security guidelines

### Frontend (React/TypeScript)

**Code Quality Tools**:

- **Prettier** for code formatting
- **ESLint** for linting and import order

**Run quality checks**:

```bash
cd react-frontend
npx prettier --write .
npx eslint . --fix
```

**Key Conventions**:

- Use TypeScript interfaces for all data models
- Implement proper error handling
- Follow React hooks best practices
- Use Redux Toolkit for state management
- Implement responsive design with Tailwind CSS

## Testing Requirements

### Backend Testing

**Test Structure**:

- **Unit tests**: `backend/test/unit/` - Test individual components
- **Integration tests**: `backend/test/integration/` - Test complete workflows
- **Test utilities**: `backend/test/factories/` and `backend/test/fixtures/`

**Running Tests**:

```bash
# All tests
python backend/test_runner.py all

# Unit tests only
python backend/test_runner.py unit

# Integration tests only
python backend/test_runner.py integration

# Specific test file
python backend/test_runner.py specific --path backend/test/unit/test_crud_user.py
```

**Test Requirements**:

- All new features must include tests
- Use factories for test data creation
- Use API-driven flows for integration tests
- Mock external services (email, Redis, etc.)
- Achieve high test coverage (aim for 90%+)

### Frontend Testing

**Test Tools**:

- **Vitest** for unit testing
- **React Testing Library** for component testing
- **MSW** for API mocking

**Running Tests**:

```bash
cd react-frontend
npm test          # Run all tests
npm run test:ui   # Run with UI
npm run coverage  # Generate coverage report
```

**Test Requirements**:

- Test all public component interfaces
- Test user interactions and workflows
- Mock API calls and external services
- Test error states and edge cases

### Test Quality Standards

- **Write descriptive test names** that explain what is being tested
- **Use AAA pattern**: Arrange, Act, Assert
- **Test edge cases** and error conditions
- **Keep tests independent** and idempotent
- **Use appropriate test data** via factories
- **Document complex test scenarios**

## Submission Process

### Pull Request Guidelines

**Before Submitting**:

1. Ensure all tests pass
2. Run code quality checks
3. Update documentation if needed
4. Check for breaking changes
5. Rebase on latest main branch

**PR Description Template**:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing

- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or migration plan provided)
```

### Review Process

1. **Automated checks** must pass (CI/CD pipeline)
2. **Code review** by at least one maintainer
3. **Testing verification** in review environment
4. **Documentation review** if applicable
5. **Security review** for security-related changes

### Approval and Merge

- PRs require approval from at least one maintainer
- All conversations must be resolved
- CI/CD pipeline must pass
- Breaking changes require additional review and migration documentation

## Release Process

### Overview

This project follows a unified release notes and version tracking system. The `docs/release-notes.md` file serves as the single source of truth for all releases and major changes across the entire monorepo.

### Versioning

We follow [Semantic Versioning](https://semver.org/) for our releases:

- **Major Version (X.0.0)**: Incompatible API changes or significant new features
- **Minor Version (0.X.0)**: Backward-compatible new features and enhancements
- **Patch Version (0.0.X)**: Backward-compatible bug fixes and minor improvements
- **Pre-release Versions**: Suffixed with `-alpha.N`, `-beta.N`, or `-rc.N` (e.g., `v1.0.0-beta.1`)

### Creating a New Release

1. **Prepare the Release Notes**:

   - Update `docs/release-notes.md` with the new version
   - Include the release date and summary of changes
   - Categorize changes into "New Features", "Bug Fixes", and "Breaking Changes"
   - Ensure the content is clear and understandable for users

2. **Generate Draft Release Notes from Git History** (optional):

   - Use Git commands to extract commit messages since the last tagged release:
     ```bash
     git log <previous_tag>..<HEAD> --pretty=format:"- %s" > changelog.txt
     ```
   - Review, categorize, and edit the generated notes before adding to `docs/release-notes.md`

3. **Update Version References**:

   - Update any version references in the documentation
   - Ensure any version-specific instructions are updated

4. **Create Git Tag**:

   - Tag the release using the same version as in the release notes:
     ```bash
     git tag -a vX.Y.Z -m "Release version X.Y.Z"
     ```
   - Push the tag to trigger the release workflow:
     ```bash
     git push origin vX.Y.Z
     ```

5. **Post-Release Actions**:
   - Announce the release in appropriate channels
   - Monitor deployment and application health
   - Start planning for the next release cycle

### Detailed Release Process

For a detailed step-by-step guide on creating releases, including Docker image publishing, see the [Release Process Guide](../deployment/RELEASE_PROCESS.md).

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all community members to:

- **Be respectful** and considerate in communications
- **Be collaborative** and constructive in feedback
- **Be inclusive** and welcoming to contributors of all backgrounds
- **Focus on what's best** for the community and project
- **Show empathy** towards other community members

### Communication

- **GitHub Issues**: Bug reports, feature requests, and discussions
- **Pull Requests**: Code contributions and reviews
- **Documentation**: Project guides and API references
- **Email**: Security vulnerabilities should be reported privately

### Inclusive Language

- Use clear, descriptive language in code and documentation
- Avoid technical jargon when simpler terms work
- Be mindful of non-native English speakers
- Choose inclusive terminology in variable names and comments

## Getting Help

### Documentation Resources

- 📖 **[Getting Started Guide](docs/getting-started/GETTING_STARTED.md)** - New developer onboarding
- 💻 **[Developer Setup](docs/development/DEVELOPER_SETUP.md)** - Complete environment setup
- 🧪 **[Testing Guide](docs/development/TESTING.md)** - Testing workflows and standards
- 🔧 **[Troubleshooting](docs/troubleshooting/)** - Common issues and solutions
- 📋 **[API Reference](docs/reference/API_REFERENCE.md)** - Complete API documentation

### Getting Support

1. **Check existing documentation** first
2. **Search GitHub issues** for similar problems
3. **Create a detailed issue** if you can't find a solution
4. **Join discussions** on relevant GitHub issues
5. **Ask questions** in your pull request if you're unsure about implementation

### Asking Good Questions

When asking for help, please include:

- What you're trying to accomplish
- What you've already tried
- Relevant code snippets or error messages
- Your development environment details
- Steps to reproduce the issue

## Recognition

### Contributors

We believe in recognizing the valuable contributions of our community members:

- **Contributors** are listed in our project documentation
- **Significant contributions** are highlighted in release notes
- **Regular contributors** may be invited to become project maintainers
- **All contributions** are appreciated, from small typo fixes to major features

### Types of Recognition

- **GitHub contributions graph** shows your activity
- **Release notes** mention significant contributions
- **Documentation credits** for major doc improvements
- **Maintainer status** for consistent, high-quality contributors

## Additional Resources

### Related Projects

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [SQLModel Documentation](https://sqlmodel.tiangolo.com/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)

### Security

For security vulnerabilities, please email us privately rather than opening a public issue. We take security seriously and will respond promptly to verified vulnerabilities.

### License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

## Quick Reference

| Task                   | Command                             | Documentation                                              |
| ---------------------- | ----------------------------------- | ---------------------------------------------------------- |
| **Setup development**  | `docker-compose up -d`              | [Getting Started](docs/getting-started/GETTING_STARTED.md) |
| **Run backend tests**  | `python backend/test_runner.py all` | [Testing Guide](docs/development/TESTING.md)               |
| **Run frontend tests** | `cd react-frontend && npm test`     | [Frontend Testing](react-frontend/README.md#testing)       |
| **Format code**        | `black . && prettier --write .`     | [Code Standards](#code-standards)                          |
| **Check quality**      | `flake8 . && eslint .`              | [Development Guidelines](#development-guidelines)          |

---

**Ready to contribute?** 🚀 [Start with our Getting Started Guide](docs/getting-started/GETTING_STARTED.md)

Thank you for contributing to FastAPI RBAC! Your efforts help make this project better for everyone. 🙏
