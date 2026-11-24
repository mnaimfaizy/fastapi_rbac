import type { PermissionGroup } from '@/models/permission';
import type { FlatGroup } from '../groups/treeModel';

/**
 * Permission groups (`GET /permission-groups` returns a flat page joined by
 * `permission_group_id`) as tree records, each with its permissions.
 */
export function permissionGroupsToFlat(groups: PermissionGroup[]): FlatGroup[] {
  return groups.map((group) => ({
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
