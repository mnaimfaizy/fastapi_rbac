import type { Role as HeldRole, User } from '@/models/user';
import type { Role } from '@/models/role';
import {
  groupPermissions,
  type PermissionGroupSection,
} from '@/features/user-home/summary';
import { parseApiTimestamp } from '@/features/account/parseApiTimestamp';

/**
 * Everything user detail says about one held role. The user read model
 * names a user's roles without their permissions, so they come from the
 * roles catalog (`GET /roles/list`, which needs role.read). Without it,
 * `permissionCount` is null and `sections` is empty.
 */
export interface HeldRoleSummary {
  id: string;
  name: string;
  groupName: string | null;
  permissionCount: number | null;
  sections: PermissionGroupSection[];
}

export function heldRoleSummaries(
  held: HeldRole[] | undefined,
  catalog: Role[],
  groupNames: Map<string, string>
): HeldRoleSummary[] {
  const byId = new Map(catalog.map((role) => [role.id, role]));
  return (held ?? []).map((role) => {
    const known = byId.get(role.id);
    const codes = known?.permissions?.map((permission) => permission.name);
    return {
      id: role.id,
      name: role.name,
      groupName: known?.role_group_id
        ? (groupNames.get(known.role_group_id) ?? null)
        : null,
      permissionCount: codes ? codes.length : null,
      sections: codes ? groupPermissions(codes) : [],
    };
  });
}

/** "grants 15 permissions", with the role group first when known. */
export function roleGrantLine(summary: HeldRoleSummary): string | null {
  const grants =
    summary.permissionCount === null
      ? null
      : `grants ${summary.permissionCount} ${
          summary.permissionCount === 1 ? 'permission' : 'permissions'
        }`;
  const parts = [summary.groupName, grants].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

interface NamedGroup {
  id: string;
  name: string;
  children?: NamedGroup[];
}

/** Group id to name, through every level of the role group tree. */
export function groupNameMap(groups: NamedGroup[]): Map<string, string> {
  const names = new Map<string, string>();
  const walk = (list: NamedGroup[] | undefined) =>
    (list ?? []).forEach((group) => {
      names.set(group.id, group.name);
      walk(group.children);
    });
  walk(groups);
  return names;
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/** "15 Nov 2026, 14:32 UTC", or null when there is no date. */
export function formatUtcDateTime(value: string | null | undefined) {
  const date = parseApiTimestamp(value);
  return date ? `${dateTime.format(date)} UTC` : null;
}

/**
 * An API timestamp with its zone made explicit, for the shared formatters:
 * the API sends naive UTC, which `new Date` would read as local time.
 */
export function apiInstant(value: string | null | undefined): string | null {
  return parseApiTimestamp(value)?.toISOString() ?? null;
}

/** The person's first name for sentences, falling back to their email. */
export function callName(user: User): string {
  return user.first_name?.trim() || user.email;
}
