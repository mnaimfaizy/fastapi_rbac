# React Frontend for FastAPI Auth Backend

This React application provides a secure frontend for the FastAPI authentication and authorization backend.

## Features

- **JWT Authentication**: Secure authentication using access tokens and refresh tokens
- **TypeScript**: Type-safe development
- **Redux Store**: State management with Redux Toolkit
- **ShadCN UI**: Modern UI components library with Tailwind CSS
- **Docker Support**: Containerized deployment with Nginx
- **Secure Token Management**: In-memory access tokens and secure refresh token handling
- **Comprehensive Testing**: 354 tests across 16 files with excellent coverage
- **CSRF Protection**: Integration with backend CSRF token system
- **Security Headers**: Enhanced browser-level protection

## Project Structure

```
react-frontend/
├── public/             # Static files
├── src/
│   ├── assets/         # Images and other static assets
│   ├── components/     # Reusable UI components
│   │   ├── layout/     # Layout components (MainLayout, ProtectedRoute)
│   │   └── ui/         # ShadCN UI components
│   ├── features/       # Feature-based modules
│   │   ├── auth/       # Authentication features (login)
│   │   ├── users/      # User management features
│   │   ├── roles/      # Role management features
│   │   ├── permissions/ # Permission management features
│   │   └── dashboard/  # Dashboard features
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions
│   ├── models/         # TypeScript interfaces
│   ├── services/       # API communication services
│   ├── store/          # Redux store configuration
│   │   ├── slices/     # Redux slices
│   │   └── hooks.ts    # Custom Redux hooks
│   ├── test/           # Comprehensive test suite (354 tests across 16 files)
│   │   ├── services/   # API service tests
│   │   └── *.test.tsx  # Component and feature tests
│   ├── App.tsx         # Main application component
│   └── main.tsx        # Entry point
├── docker-compose.dev.yml   # Development Docker configuration
├── docker-compose.test.yml  # Testing Docker configuration
├── docker-compose.prod.yml  # Production Docker configuration
├── Dockerfile          # Docker configuration
├── nginx.conf          # Nginx configuration for Docker
└── vite.config.ts      # Vite configuration
```

## Environment Files

The application uses different environment files for different deployment contexts:

- `.env.development`: Local development configuration
- `.env.test`: Testing environment configuration
- `.env.production`: Production environment configuration

These files can be created from the provided `.env.example` template.

## Getting Started

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create appropriate environment files

   ```bash
   # Copy the example environment file
   cp .env.example .env.development

   # Edit as needed
   ```

4. Start the development server:
   ```
   npm run dev
   ```

### Docker Deployment

The project uses a modular Docker Compose structure:

1. **Root environments**:
   - `docker-compose.dev.yml`: Development environment with shared services
   - `docker-compose.test.yml`: Testing environment
   - `docker-compose.prod-test.yml`: Production testing environment
2. **Frontend-specific services**:
   - `react-frontend/docker-compose.dev.yml`: Frontend development service
   - `react-frontend/docker-compose.test.yml`: Frontend testing service
   - `react-frontend/docker-compose.prod.yml`: Frontend production service

Run just the frontend with:

```
cd react-frontend
docker-compose up -d
```

Run the entire stack from the project root:

```
docker-compose up -d
```

## Authentication Flow

1. **Login**: User submits credentials, receives JWT tokens
2. **Token Storage**:
   - Access token is stored in memory (Redux state)
   - Refresh token is stored in localStorage
3. **Token Refresh**: Automatic refresh of access tokens using refresh tokens
4. **Protected Routes**: Routes requiring authentication redirect to login

## Security Considerations

- **Access Token Security**: Stored in memory (Redux state) to prevent XSS attacks
- **Refresh Token Management**: Secure localStorage handling with automatic cleanup
- **CSRF Protection**: Integration with backend CSRF token system
- **Security Headers**: Enhanced Content Security Policy and browser protections
- **Request Sanitization**: Client-side input validation and sanitization
- **Token Refresh**: Automatic and secure refresh mechanism
- **Role-based Access Control**: Component-level permission checking
- **Route Protection**: Authentication and authorization guards

## Testing

The frontend includes comprehensive testing infrastructure with **354 tests across 16 test files** plus **end-to-end tests with Playwright**.

### Test Categories

#### Unit & Integration Tests (Vitest)

- **Component Tests**: React component rendering and interaction
- **API Service Tests**: Complete API service layer with mocking
- **Authentication Flow Tests**: Login, logout, and token management
- **User Management Tests**: CRUD operations and permissions
- **Role & Permission Tests**: Access control and authorization
- **Integration Tests**: Redux store integration and state management
- **Security Tests**: CSRF protection and input validation

#### End-to-End Tests (Playwright)

- **Authentication E2E**: Complete login/logout flows in real browsers
- **Dashboard E2E**: Dashboard loading and navigation
- **Protected Routes E2E**: Route access control and redirects
- **Cross-browser Testing**: Chromium, Firefox, and WebKit support

### Test Coverage

- **App Component**: Basic application structure (3 tests)
- **Authentication Flows**: Login, signup, password reset (12 tests)
- **User Management**: Complete user CRUD operations (22 tests)
- **Role Management**: Role creation, editing, deletion (35 tests)
- **Permission Management**: Permission handling (40 tests)
- **Role Groups**: Hierarchical role organization (50 tests)
- **Permission Groups**: Permission organization (22 tests)
- **API Services**: Comprehensive service testing (170+ tests)
- **CSRF Service**: Security validation (17 tests)
- **E2E Tests**: 3 test suites with 20+ tests covering critical user flows

### Running Unit & Integration Tests

```bash
# Run all unit/integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- UsersList.test.tsx

# Run tests matching pattern
npm test -- --run --reporter=verbose
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI mode (recommended for development)
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug

# View E2E test report
npm run test:e2e:report

# Generate E2E test code
npm run test:e2e:codegen
```

For detailed E2E testing documentation, see [E2E_TESTING.md](./E2E_TESTING.md).

### Test Configuration

- **Framework**: Vitest with React Testing Library
- **Mocking**: MSW (Mock Service Worker) for API mocking
- **Coverage**: V8 coverage provider
- **Environment**: jsdom for browser environment simulation

## Environment Variables

- `VITE_API_BASE_URL`: URL for the FastAPI backend API
- `VITE_AUTH_TOKEN_NAME`: Name of the auth token for storage

## Commands

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run lint`: Lint code
- `npm run preview`: Preview production build locally
- `npm test`: Run test suite
- `npm run test:watch`: Run tests in watch mode
- `npm run test:ui`: Run tests with interactive UI
- `npm run test:coverage`: Generate coverage report

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x';
import reactDom from 'eslint-plugin-react-dom';

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
});
```
