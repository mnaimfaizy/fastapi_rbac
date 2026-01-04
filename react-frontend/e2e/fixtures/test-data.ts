/**
 * Test fixtures for E2E tests
 * This file contains reusable test data for authentication and user management
 */

export const testUsers = {
  admin: {
    email: 'admin@example.com',
    password: 'AdminPass123!',
    firstName: 'Admin',
    lastName: 'User',
  },
  regularUser: {
    email: 'user@example.com',
    password: 'UserPass123!',
    firstName: 'Regular',
    lastName: 'User',
  },
  newUser: {
    email: 'newuser@example.com',
    password: 'NewUserPass123!',
    firstName: 'New',
    lastName: 'User',
  },
};

export const testRoles = {
  admin: {
    name: 'admin',
    description: 'Administrator role with full access',
  },
  user: {
    name: 'user',
    description: 'Standard user role',
  },
};

export const testPermissions = {
  userCreate: {
    name: 'user.create',
    description: 'Permission to create users',
  },
  userRead: {
    name: 'user.read',
    description: 'Permission to read users',
  },
  userUpdate: {
    name: 'user.update',
    description: 'Permission to update users',
  },
  userDelete: {
    name: 'user.delete',
    description: 'Permission to delete users',
  },
};

/**
 * API endpoints for testing
 */
export const apiEndpoints = {
  auth: {
    login: '/api/v1/auth/login',
    logout: '/api/v1/auth/logout',
    refresh: '/api/v1/auth/refresh',
  },
  users: {
    list: '/api/v1/users',
    create: '/api/v1/users',
    get: (id: string) => `/api/v1/users/${id}`,
    update: (id: string) => `/api/v1/users/${id}`,
    delete: (id: string) => `/api/v1/users/${id}`,
  },
  roles: {
    list: '/api/v1/roles',
    create: '/api/v1/roles',
    get: (id: string) => `/api/v1/roles/${id}`,
  },
  dashboard: '/api/v1/dashboard',
};

/**
 * Common test timeouts
 */
export const timeouts = {
  short: 5000,
  medium: 10000,
  long: 30000,
  navigation: 30000,
};

/**
 * Test routes
 */
export const routes = {
  home: '/',
  login: '/login',
  signup: '/signup',
  dashboard: '/dashboard',
  users: '/users',
  roles: '/roles',
  permissions: '/permissions',
  profile: '/profile',
  unauthorized: '/unauthorized',
};
