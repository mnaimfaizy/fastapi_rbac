import type { Role } from '@/models/role';

/**
 * The roles a viewer may give or take away, mirroring the backend's
 * role-grant ceiling (`backend/app/utils/role_grants.py`): a superuser may
 * grant any role; anyone else only roles whose every permission they hold.
 */
export function grantableRoles(
  catalog: Role[],
  viewerPermissions: readonly string[],
  isSuperuser: boolean
): Role[] {
  if (isSuperuser) return catalog;
  const held = new Set(viewerPermissions);
  return catalog.filter((role) =>
    (role.permissions ?? []).every((permission) => held.has(permission.name))
  );
}

/**
 * The role ids to send on save. Held roles the viewer can't grant aren't
 * offered, so they are sent back unchanged: the API treats an unchanged
 * role as a no-op, where leaving it out would ask to remove it.
 */
export function roleIdsToSave(
  chosen: readonly string[],
  heldIds: readonly string[],
  grantableIds: ReadonlySet<string>
): string[] {
  const kept = heldIds.filter((id) => !grantableIds.has(id));
  return [
    ...new Set([...chosen.filter((id) => grantableIds.has(id)), ...kept]),
  ];
}

export function permissionCount(role: Role): string {
  const count = role.permissions?.length ?? 0;
  return count === 1 ? '1 permission' : `${count} permissions`;
}

/** Permission codes from `/users/me`, which may arrive as objects. */
export function permissionCodes(
  permissions: readonly (string | { name: string })[] | undefined
): string[] {
  return (permissions ?? []).map((permission) =>
    typeof permission === 'string' ? permission : permission.name
  );
}
