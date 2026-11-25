import type { ReactElement } from 'react';
import type { User } from '../models/user';
import type { Role } from '../models/role';
import { mockUsers } from './test-utils';

/** Seeded permission codes per role, as `backend/app/db/init_db.py` seeds them. */
const SELF = [
  'self.read_profile',
  'self.read_roles',
  'self.read_permissions',
  'self.update_profile',
];
const CONTENT = [
  'content.create_article',
  'content.read_article',
  'content.update_article',
  'content.delete_article',
];

export const USER_PERMISSIONS = [...SELF, 'content.read_article'];

export const MANAGER_PERMISSIONS = [
  'user.create',
  'user.read',
  'user.update',
  'role.read',
  'permission.read',
  'role_group.read',
  'permission_group.read',
  ...SELF,
  ...CONTENT,
];

export const ADMIN_PERMISSIONS = [
  ...MANAGER_PERMISSIONS,
  'user.delete',
  'user.manage_roles',
  'role.create',
  'role.update',
  'role.delete',
  'permission.create',
  'permission.update',
  'permission.delete',
  'role_group.create',
  'role_group.update',
  'role_group.delete',
  'permission_group.create',
  'permission_group.update',
  'permission_group.delete',
];

function permissionsOf(codes: string[]) {
  return codes.map((name, index) => ({
    id: `perm-${index}-${name}`,
    name,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }));
}

function catalogRole(
  id: string,
  name: string,
  description: string,
  codes: string[],
  role_group_id?: string
): Role {
  return {
    id,
    name,
    description,
    role_group_id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    permissions: permissionsOf(codes),
  };
}

export const ADMIN_ROLE = catalogRole(
  'role-admin',
  'Admin',
  'Full access to users, roles and permissions',
  ADMIN_PERMISSIONS,
  'group-admin'
);
export const MANAGER_ROLE = catalogRole(
  'role-manager',
  'Manager',
  'Manager with user and content management permissions',
  MANAGER_PERMISSIONS,
  'group-ops'
);
export const USER_ROLE = catalogRole(
  'role-user',
  'User',
  'Standard access to own profile and content',
  USER_PERMISSIONS,
  'group-standard'
);

/** `GET /roles/list`, as the roles service returns it. */
export const ROLE_CATALOG = [ADMIN_ROLE, MANAGER_ROLE, USER_ROLE];

/** `GET /role-groups`, as the role group service returns it. */
export const ROLE_GROUPS_RESPONSE = {
  data: {
    items: [
      { id: 'group-admin', name: 'Administrative' },
      { id: 'group-ops', name: 'Operational' },
      { id: 'group-standard', name: 'StandardUser' },
    ].map((group) => ({
      ...group,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })),
    total: 3,
    page: 1,
    size: 100,
    pages: 1,
    next_page: null,
    previous_page: null,
  },
  message: 'ok',
  meta: {},
};

/** A held role as the user read model names it: no permissions. */
export function held(role: Role) {
  return { id: role.id, name: role.name, description: role.description };
}

export function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    ...(mockUsers[0] as unknown as User),
    roles: [],
    ...overrides,
  };
}

export const MARCUS = makeUser({
  id: 'u-marcus',
  first_name: 'Marcus',
  last_name: 'Webb',
  email: 'marcus.webb@example.com',
  contact_phone: '+61 412 555 018',
  roles: [held(MANAGER_ROLE)],
  is_locked: true,
  locked_until: '2026-11-15T14:32:00Z',
  number_of_failed_attempts: 5,
  created_at: '2026-03-03T09:00:00Z',
  updated_at: '2026-11-15T14:32:00Z',
  last_changed_password_date: '2026-09-02T10:00:00Z',
  password_expires_at: '2026-12-01T10:00:00Z',
});

export const HANNAH = makeUser({
  id: 'u-hannah',
  first_name: 'Hannah',
  last_name: 'Lindqvist',
  email: 'hannah.lindqvist@example.com',
  roles: [held(USER_ROLE)],
  verified: false,
  needs_to_change_password: true,
});

export const NORA = makeUser({
  id: 'u-nora',
  first_name: 'Nora',
  last_name: 'Free',
  email: 'nora@example.com',
  roles: [],
});

export type ViewerKind = 'superuser' | 'admin' | 'manager' | 'user';

const VIEWER_PERMISSIONS: Record<ViewerKind, string[]> = {
  superuser: ADMIN_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  user: USER_PERMISSIONS,
};

/** The signed-in viewer, as `/users/me` sends them. */
export function viewerState(kind: ViewerKind) {
  return {
    auth: {
      user: {
        id: `viewer-${kind}`,
        email: `${kind}@example.com`,
        first_name: 'QA',
        last_name: kind,
        is_superuser: kind === 'superuser',
        permissions: VIEWER_PERMISSIONS[kind],
        roles: [],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    },
  };
}

/** Puts the browser at `path` before a render under `BrowserRouter`. */
export function at(path: string, ui: ReactElement): ReactElement {
  window.history.pushState({}, '', path);
  return ui;
}
