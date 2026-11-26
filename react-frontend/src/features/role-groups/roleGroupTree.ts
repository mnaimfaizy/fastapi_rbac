import type { Role } from '@/models/role';
import { roleService } from '@/services/role.service';
import type { RoleGroup } from '@/models/roleGroup';
import type { FlatGroup, GroupMember } from '../groups/treeModel';

/** A role as `GET /roles` returns it once it carries a holder count. */
export type RoleWithCount = Role & { user_count?: number };

function userCount(role: RoleWithCount) {
  if (typeof role.user_count !== 'number') {
    return undefined;
  }
  return `${role.user_count} ${role.user_count === 1 ? 'user' : 'users'}`;
}

/**
 * Flatten role groups (`GET /role-groups` nests children under their roots)
 * into records joined by parent id, each with the roles in it. Pass `null`
 * for `roles` when the viewer cannot read roles.
 */
export function roleGroupsToFlat(
  groups: RoleGroup[],
  roles: RoleWithCount[] | null
): FlatGroup[] {
  const seen = new Map<string, FlatGroup>();
  const visit = (group: RoleGroup) => {
    if (!seen.has(group.id)) {
      seen.set(group.id, {
        id: group.id,
        name: group.name,
        parentId: group.parent_id ?? null,
        createdAt: group.created_at,
        href: `/dashboard/role-groups/${group.id}`,
        members: roles
          ? roles
              .filter((role) => role.role_group_id === group.id)
              .map((role): GroupMember => ({
                id: role.id,
                name: role.name,
                detail: userCount(role),
                href: `/dashboard/roles/${role.id}`,
              }))
          : undefined,
      });
    }
    group.children?.forEach(visit);
  };
  groups.forEach(visit);
  return [...seen.values()];
}

/** The page size `GET /roles` allows at most. */
const ROLE_PAGE_SIZE = 100;

/** Every role, reading `GET /roles` page by page. */
export async function fetchAllRoles(): Promise<RoleWithCount[]> {
  const first = await roleService.getRoles({ page: 1, size: ROLE_PAGE_SIZE });
  const roles: RoleWithCount[] = [...first.data.items];
  for (let page = 2; page <= first.data.pages; page += 1) {
    const next = await roleService.getRoles({ page, size: ROLE_PAGE_SIZE });
    roles.push(...next.data.items);
  }
  return roles;
}
