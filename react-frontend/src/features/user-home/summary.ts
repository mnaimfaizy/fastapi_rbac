const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Seed permission-group order, so Self is listed before Content. */
const GROUP_ORDER = [
  'User',
  'Role',
  'Permission',
  'Role group',
  'Permission group',
  'Self',
  'Content',
];

export interface PermissionGroupSection {
  name: string;
  codes: string[];
}

/**
 * Permission codes from `/users/me` are `{group}.{action}`. The first
 * segment is the permission group slug (`role_group` → "Role group").
 */
export function permissionGroupName(code: string): string {
  const dot = code.indexOf('.');
  if (dot <= 0) {
    return 'No group';
  }
  return code
    .slice(0, dot)
    .split('_')
    .filter(Boolean)
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word.toLowerCase()
    )
    .join(' ');
}

export function groupPermissions(
  codes: readonly string[]
): PermissionGroupSection[] {
  const buckets = new Map<string, string[]>();
  for (const code of codes) {
    const name = permissionGroupName(code);
    const list = buckets.get(name);
    if (list) {
      list.push(code);
    } else {
      buckets.set(name, [code]);
    }
  }
  return [...buckets.entries()]
    .map(([name, grouped]) => ({
      name,
      codes: [...grouped].sort((a, b) => a.localeCompare(b)),
    }))
    .sort(
      (a, b) =>
        groupRank(a.name) - groupRank(b.name) || a.name.localeCompare(b.name)
    );
}

function groupRank(name: string): number {
  const index = GROUP_ORDER.indexOf(name);
  return index === -1 ? GROUP_ORDER.length : index;
}

export function roleNames(roles: { name: string }[] | undefined): string[] {
  return (roles ?? [])
    .map((role) => role.name.trim())
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase() + name.slice(1));
}

export function accountSummary(
  names: string[],
  permissionCount: number,
  expiry: string | null
): string {
  const permissions =
    permissionCount === 1 ? '1 permission' : `${permissionCount} permissions`;
  const hold = `You hold ${roleClause(names)} with ${permissions}.`;
  return expiry ? `${hold} ${expiry}` : hold;
}

function roleClause(names: string[]): string {
  if (names.length === 0) {
    return 'no roles';
  }
  if (names.length === 1) {
    return `the ${names[0]} role`;
  }
  if (names.length === 2) {
    return `the ${names[0]} and ${names[1]} roles`;
  }
  const head = names.slice(0, -1).join(', ');
  return `the ${head} and ${names[names.length - 1]} roles`;
}

export function greeting(firstName: string, now: Date): string {
  const hour = now.getHours();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const name = firstName.trim() || 'there';
  return `Good ${part}, ${name}`;
}

/** UTC calendar date, so the label does not shift with the viewer's zone. */
export function formatUtcDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daySpan(iso: string | null | undefined, now: Date): number | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return Math.round((utcDay(now) - utcDay(date)) / 86_400_000);
}

export function passwordAge(
  iso: string | null | undefined,
  now: Date
): string | null {
  const days = daySpan(iso, now);
  if (days === null) {
    return null;
  }
  const elapsed = Math.max(0, days);
  return elapsed === 1 ? '1 day' : `${elapsed} days`;
}

export interface ExpiryStatus {
  date: string;
  label: string;
  /** Amber only inside the 14-day window the design calls Expiring. */
  warn: boolean;
  sentence: string;
}

export function expiryStatus(
  iso: string | null | undefined,
  now: Date
): ExpiryStatus | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const days = Math.round((utcDay(date) - utcDay(now)) / 86_400_000);
  if (days < 0) {
    return {
      date: formatUtcDate(iso),
      label: 'Expired',
      warn: true,
      sentence: 'Your password has expired.',
    };
  }
  if (days === 0) {
    return {
      date: formatUtcDate(iso),
      label: 'Today',
      warn: true,
      sentence: 'Your password expires today.',
    };
  }
  const unit = days === 1 ? '1 day' : `${days} days`;
  return {
    date: formatUtcDate(iso),
    label: `In ${unit}`,
    warn: days <= 14,
    sentence:
      days === 1
        ? 'Your password expires in 1 day.'
        : `Your password expires in ${days} days.`,
  };
}
