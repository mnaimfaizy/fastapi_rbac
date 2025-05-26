import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface MetaInfo {
  title: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
}

/**
 * A mapping of routes to their respective meta information
 */
const routeMetaMap: Record<string, MetaInfo> = {
  // Auth routes
  '/login': {
    title: 'Login',
    description: 'Sign in to your account to access the RBAC system',
    keywords: 'login, sign in, authentication, RBAC',
  },
  '/signup': {
    title: 'Sign Up',
    description: 'Create a new account to access the RBAC system',
    keywords: 'signup, register, create account, RBAC',
  },
  '/verify-email': {
    title: 'Verify Email',
    description: 'Verify your email address to activate your account',
  },
  '/registration-success': {
    title: 'Registration Successful',
    description: 'Your account has been successfully created',
  },
  '/resend-verification': {
    title: 'Resend Verification Email',
    description: 'Request a new verification email to activate your account',
  },
  '/reset-password': {
    title: 'Reset Password',
    description: 'Reset your password to regain access to your account',
  },
  '/reset-password-confirm': {
    title: 'Confirm Password Reset',
    description: 'Complete your password reset process',
  },

  // Dashboard routes
  '/dashboard': {
    title: 'Dashboard',
    description: 'Overview of your RBAC system',
    keywords: 'dashboard, overview, RBAC, management',
  },
  '/dashboard/profile': {
    title: 'User Profile',
    description: 'View and edit your user profile',
  },
  '/dashboard/users': {
    title: 'User Management',
    description: 'Manage users in the RBAC system',
    keywords: 'users, management, RBAC, admin',
  },
  '/dashboard/roles': {
    title: 'Role Management',
    description: 'Manage roles in the RBAC system',
    keywords: 'roles, permissions, RBAC, admin',
  },
  '/dashboard/permissions': {
    title: 'Permission Management',
    description: 'Manage permissions in the RBAC system',
    keywords: 'permissions, RBAC, admin',
  },

  // Default
  '/404': {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist',
  },
};

/**
 * Custom hook to manage meta information based on the current route
 * @returns The meta information for the current route
 */
export const usePageMeta = (): MetaInfo => {
  const location = useLocation();
  const path = location.pathname;

  // Find exact match first
  let metaInfo = routeMetaMap[path];

  // If no exact match, try to find a match for parent routes
  // For example, if the path is /dashboard/users/123, try to match /dashboard/users
  if (!metaInfo) {
    const pathSegments = path.split('/').filter(Boolean);

    while (pathSegments.length > 0) {
      const parentPath = '/' + pathSegments.join('/');
      metaInfo = routeMetaMap[parentPath];

      if (metaInfo) break;

      pathSegments.pop(); // Remove the last segment and try again
    }
  }

  // If no match is found, use default meta info
  if (!metaInfo) {
    metaInfo = {
      title: 'FastAPI RBAC',
      description:
        'A Role-Based Access Control system built with FastAPI and React',
      keywords: 'RBAC, authentication, authorization, user management',
    };
  }

  // Update document title when the route changes
  useEffect(() => {
    document.title = `${metaInfo.title} | ${import.meta.env.VITE_APP_NAME || 'FastAPI RBAC'}`;
  }, [path, metaInfo.title]);

  return metaInfo;
};
