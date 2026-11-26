import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import {
  allNavItems,
  findActiveNavItem,
  HOME_PATH,
  type NavGroup,
} from '@/lib/navigation';

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

  // Signed-in routes; their titles come from the nav (see pageTitle below)
  '/dashboard': {
    title: 'Dashboard',
    description: 'Overview of your RBAC system',
    keywords: 'dashboard, overview, RBAC, management',
  },
  '/dashboard/account': {
    title: 'Account settings',
    description: 'Your profile, password and appearance',
  },
  '/dashboard/users': {
    title: 'Users',
    description: 'Manage users in the RBAC system',
    keywords: 'users, management, RBAC, admin',
  },
  '/dashboard/roles': {
    title: 'Roles',
    description: 'Manage roles in the RBAC system',
    keywords: 'roles, permissions, RBAC, admin',
  },
  '/dashboard/role-groups': {
    title: 'Role groups',
    description: 'Organize roles into groups',
    keywords: 'role groups, roles, RBAC, admin',
  },
  '/dashboard/permissions': {
    title: 'Permissions',
    description: 'Manage permissions in the RBAC system',
    keywords: 'permissions, RBAC, admin',
  },
  '/dashboard/permission-groups': {
    title: 'Permission groups',
    description: 'Organize permissions into groups',
    keywords: 'permission groups, permissions, RBAC, admin',
  },

  // Default
  '/404': {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist',
  },
};

/**
 * Pages under a nav item that have a fixed name of their own, with the
 * permission their route guard in `App.tsx` asks for. A page whose name is
 * data (a role, a user) names itself with `usePageCrumb` instead.
 */
const SUB_PAGE_TITLES: [pattern: string, title: string, permission: string][] =
  [
    ['/dashboard/users/new', 'Add user', 'user.create'],
    ['/dashboard/users/:userId/edit', 'Edit user', 'user.update'],
    ['/dashboard/roles/new', 'Create role', 'role.create'],
    ['/dashboard/roles/edit/:roleId', 'Edit role', 'role.update'],
    ['/dashboard/role-groups/new', 'Create role group', 'role_group.create'],
    [
      '/dashboard/role-groups/edit/:groupId',
      'Edit role group',
      'role_group.update',
    ],
    ['/dashboard/permissions/new', 'Create permission', 'permission.create'],
    [
      '/dashboard/permission-groups/new',
      'Create permission group',
      'permission_group.create',
    ],
    [
      '/dashboard/permission-groups/edit/:groupId',
      'Edit permission group',
      'permission_group.update',
    ],
  ];

/** Separates the parts of a page title, most specific first. */
const TITLE_SEPARATOR = ' · ';

/** The title of a page the viewer's route guard refuses. */
const UNAUTHORIZED_TITLE = 'Unauthorized';

export interface PageTitleParts {
  /** The page's own breadcrumb steps, as `usePageCrumb` named them. */
  crumbs?: readonly string[];
  /**
   * The nav as this viewer sees it (`buildNavGroups`). A page under a nav
   * item the viewer does not have is one the route guard refuses, so it is
   * titled Unauthorized rather than named, unless it is a fixed sub-page
   * whose own permission the viewer holds. Defaults to every item.
   */
  groups?: NavGroup[];
  /** Whether the viewer holds a permission; defaults to every one. */
  hasPermission?: (permission: string) => boolean;
}

/**
 * The title of a signed-in page: its own breadcrumb steps, most specific
 * first, then the nav item it sits under. `Manager · Roles` on a role's
 * detail page, `Profile · Account settings` on that tab. Without steps, a
 * fixed sub-page name stands in (`Create role · Roles`). The landing page
 * is titled with its nav label (Dashboard, or Home for a plain user). A
 * page the viewer cannot open is titled `Unauthorized`, never by name, as
 * the nav hides what the viewer cannot use. A path outside the nav is
 * titled by its steps alone (`Not found`), and gets undefined when it
 * names none.
 */
export function pageTitle(
  pathname: string,
  {
    crumbs = [],
    groups = [{ label: '', items: allNavItems() }],
    hasPermission = () => true,
  }: PageTitleParts = {}
): string | undefined {
  const known = findActiveNavItem(
    [{ label: '', items: allNavItems() }],
    pathname
  )?.item;
  if (!known) {
    // A page outside the nav (the in-app 404) is titled by its own steps.
    return crumbs.length > 0
      ? [...crumbs].reverse().join(TITLE_SEPARATOR)
      : undefined;
  }
  const section = findActiveNavItem(groups, pathname)?.item;
  const subPage = SUB_PAGE_TITLES.find(([pattern]) =>
    matchPath(pattern, pathname)
  );
  // A fixed sub-page answers to its own guard, which may pass without the
  // section's read permission; every other page needs the section.
  const refused = subPage ? !hasPermission(subPage[2]) : !section;
  if (refused) {
    return UNAUTHORIZED_TITLE;
  }
  const { to, label } = section ?? known;
  const homeLabel = groups[0]?.items[0]?.label ?? label;
  const sectionLabel = to === HOME_PATH ? homeLabel : label;
  const own =
    crumbs.length > 0 ? [...crumbs].reverse() : subPage ? [subPage[1]] : [];
  return [...own, sectionLabel].join(TITLE_SEPARATOR);
}

/**
 * Meta information for the current route, and the browser tab title.
 * The shell passes the page's breadcrumb steps and the viewer's nav so the
 * title names the page on screen.
 */
export const usePageMeta = (parts: PageTitleParts = {}): MetaInfo => {
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

  const title = pageTitle(path, parts) ?? metaInfo.title;

  // Update document title when the route changes
  useEffect(() => {
    document.title = `${title} | ${import.meta.env.VITE_APP_NAME || 'FastAPI RBAC'}`;
  }, [title]);

  return { ...metaInfo, title };
};
