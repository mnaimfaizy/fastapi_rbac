import {
  CircleUser,
  createLucideIcon,
  FolderTree,
  House,
  Layers,
  LayoutGrid,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * The key the Web v1 artboards draw for Permissions: ring at the bottom
 * left, shaft and teeth to the top right. It is Lucide's earlier `key`;
 * the `Key` in the installed lucide-react draws it mirrored.
 */
const PermissionKey = createLucideIcon('permission-key', [
  ['circle', { cx: '7.5', cy: '15.5', r: '5.5', key: 'ring' }],
  ['path', { d: 'm21 2-9.6 9.6', key: 'shaft' }],
  ['path', { d: 'm15.5 7.5 3 3L22 7l-3-3', key: 'teeth' }],
]);

/** One link in the app shell's sidebar. */
export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /**
   * Permission the viewer needs to see the item. It matches the permission
   * the route guard in `App.tsx` checks, so a visible link never leads to a
   * refusal. Items without one are shown to every signed-in user.
   */
  permission?: string;
  /** The breadcrumb shows the page alone, without its group. */
  standalone?: boolean;
}

/** A titled section of the sidebar: Overview, Access or You. */
export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The home route every role lands on after signing in. */
export const HOME_PATH = '/dashboard';

/**
 * The Account settings page. It opens on its Profile tab; each tab has
 * its own URL under this one (`/dashboard/account/security`, ...).
 */
export const ACCOUNT_SETTINGS_PATH = '/dashboard/account';

const ACCESS_ITEMS: NavItem[] = [
  {
    label: 'Users',
    to: '/dashboard/users',
    icon: Users,
    permission: 'user.read',
  },
  {
    label: 'Roles',
    to: '/dashboard/roles',
    icon: ShieldCheck,
    permission: 'role.read',
  },
  {
    label: 'Role groups',
    to: '/dashboard/role-groups',
    icon: FolderTree,
    permission: 'role_group.read',
  },
  {
    label: 'Permissions',
    to: '/dashboard/permissions',
    icon: PermissionKey,
    permission: 'permission.read',
  },
  {
    label: 'Permission groups',
    to: '/dashboard/permission-groups',
    icon: Layers,
    permission: 'permission_group.read',
  },
];

const ACCOUNT_SETTINGS_ITEM: NavItem = {
  label: 'Account settings',
  to: ACCOUNT_SETTINGS_PATH,
  icon: CircleUser,
};

/**
 * The sidebar as this viewer sees it.
 *
 * Items the viewer can't open are left out, never shown disabled, and a
 * group with nothing left is dropped. A viewer with no Access items is a
 * plain user: their Overview item is Home rather than Dashboard.
 */
export function buildNavGroups(
  hasPermission: (permission: string) => boolean
): NavGroup[] {
  const access = ACCESS_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );
  const overviewItem: NavItem =
    access.length > 0
      ? { label: 'Dashboard', to: HOME_PATH, icon: LayoutGrid }
      : { label: 'Home', to: HOME_PATH, icon: House, standalone: true };

  const groups: NavGroup[] = [
    { label: 'Overview', items: [overviewItem] },
    { label: 'Access', items: access },
    { label: 'You', items: [ACCOUNT_SETTINGS_ITEM] },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/** Every link the shell can show, across all groups and viewers. */
export function allNavItems(): NavItem[] {
  return buildNavGroups(() => true).flatMap((group) => group.items);
}

/**
 * The item for the page on screen, with its group, for the highlight and
 * the header breadcrumb. A link also matches the pages under it, so
 * `/dashboard/users/42` selects Users; the home link matches only itself.
 */
export function findActiveNavItem(
  groups: NavGroup[],
  pathname: string
): { group: NavGroup; item: NavItem } | undefined {
  let best: { group: NavGroup; item: NavItem } | undefined;
  for (const group of groups) {
    for (const item of group.items) {
      const matches =
        pathname === item.to ||
        (item.to !== HOME_PATH && pathname.startsWith(`${item.to}/`));
      if (matches && (!best || item.to.length > best.item.to.length)) {
        best = { group, item };
      }
    }
  }
  return best;
}
