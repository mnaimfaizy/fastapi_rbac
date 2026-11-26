import type { PermissionGroup } from '@/models/permission';
import type { FlatGroup } from '../groups/treeModel';

/**
 * Permission groups (`GET /permission-groups` returns a flat page joined by
 * `permission_group_id`) as tree records, each with its permissions.
 */
export function permissionGroupsToFlat(groups: PermissionGroup[]): FlatGroup[] {
  // The API returns no set order. The seed creates the groups in the order
  // the artboards draw them (User, Role, Permission, ...), so oldest first
  // keeps that order. The sort is stable for groups created together.
  const oldestFirst = [...groups].sort((a, b) => {
    const left = Date.parse(a.created_at);
    const right = Date.parse(b.created_at);
    return Number.isNaN(left) || Number.isNaN(right) ? 0 : left - right;
  });
  return oldestFirst.map((group) => ({
    id: group.id,
    name: group.name,
    parentId: group.permission_group_id ?? null,
    createdAt: group.created_at,
    href: `/dashboard/permission-groups/${group.id}`,
    members: (group.permissions ?? []).map((permission) => ({
      id: permission.id,
      name: permission.name,
      detail: permission.description,
      href: `/dashboard/permissions/${permission.id}`,
    })),
  }));
}
