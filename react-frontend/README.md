# React Frontend for FastAPI Auth Backend

This React application provides a secure frontend for the FastAPI authentication and authorization backend.

## Features

- **JWT Authentication**: Secure authentication using access tokens and refresh tokens
- **TypeScript**: Type-safe development
- **Redux Store**: State management with Redux Toolkit
- **ShadCN UI**: Modern UI components library with Tailwind CSS
- **Docker Support**: Containerized deployment with Nginx
- **Secure Token Management**: In-memory access tokens and secure refresh token handling

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
│   │   └── dashboard/  # Dashboard features
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions
│   ├── models/         # TypeScript interfaces
│   ├── services/       # API communication services
│   ├── store/          # Redux store configuration
│   │   ├── slices/     # Redux slices
│   │   └── hooks.ts    # Custom Redux hooks
│   ├── App.tsx         # Main application component
│   └── main.tsx        # Entry point
├── .env                # Environment variables
├── Dockerfile          # Docker configuration
├── nginx.conf          # Nginx configuration for Docker
└── vite.config.ts      # Vite configuration
```

## Getting Started

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```

### Docker Deployment

Run the entire stack with Docker Compose:

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

- Access tokens are stored in memory to prevent XSS attacks
- Refresh tokens are managed securely
- Automatic token refresh mechanism
- Role-based access control
- Request validation and sanitization

## Environment Variables

- `VITE_API_BASE_URL`: URL for the FastAPI backend API
- `VITE_AUTH_TOKEN_NAME`: Name of the auth token for storage

## Commands

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run lint`: Lint code
- `npm run preview`: Preview production build locally

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
      project: ["./tsconfig.node.json", "./tsconfig.app.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    "react-x": reactX,
    "react-dom": reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs["recommended-typescript"].rules,
    ...reactDom.configs.recommended.rules,
  },
});
```
