import type { User } from '@/models/user';

/**
 * The account exceptions the users list shows. Healthy users show none.
 * Labels follow the CONTEXT.md glossary: Locked, Disabled, Pending.
 */
export type UserException = 'locked' | 'disabled' | 'pending';

export function userExceptions(user: User): UserException[] {
  const exceptions: UserException[] = [];
  if (user.is_locked) exceptions.push('locked');
  if (!user.is_active) exceptions.push('disabled');
  if (!user.verified) exceptions.push('pending');
  return exceptions;
}

export function fullName(user: User): string {
  const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return name || user.email;
}

export function initials(user: User): string {
  const value = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`;
  return (value || user.email[0] || '?').toUpperCase();
}

const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

/** "Mar 4, 2026", or an em dash when there is no date. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dayFormat.format(date);
}

/** Status filter values, as they appear in the menu and in `?status=`. */
export const STATUS_FILTERS = ['Locked', 'Pending', 'Disabled'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const EXCEPTION_FOR: Record<StatusFilter, UserException> = {
  Locked: 'locked',
  Pending: 'pending',
  Disabled: 'disabled',
};

/** What `GET /users/list?status=` takes for each status filter. */
export function statusQuery(
  status: StatusFilter | null
): UserException | undefined {
  return status ? EXCEPTION_FOR[status] : undefined;
}

/**
 * Locked as the dashboard counts it: `is_locked`, and a lockout window that
 * has not passed. A lock with no window, or an expired one, is not locked.
 */
export function isLockedNow(user: User, now: Date = new Date()): boolean {
  if (!user.is_locked || !user.locked_until) return false;
  // The API stores naive UTC and may send no offset; read that as UTC.
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(user.locked_until);
  const until = new Date(
    hasOffset ? user.locked_until : `${user.locked_until}Z`
  );
  return until > now;
}

/** `?status=locked` and `?status=Locked` both work; anything else is "All". */
export function parseStatusFilter(
  value: string | null | undefined
): StatusFilter | null {
  if (!value) return null;
  const wanted = value.trim().toLowerCase();
  return (
    STATUS_FILTERS.find((status) => status.toLowerCase() === wanted) ?? null
  );
}

export interface UserListFilters {
  search: string;
  role: string | null;
  status: StatusFilter | null;
}

/** Search (name or email), role and status narrow the list together. */
export function filterUsers(users: User[], filters: UserListFilters): User[] {
  const query = filters.search.trim().toLowerCase();
  return users.filter((user) => {
    if (query) {
      const haystack = `${fullName(user)} ${user.email}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (
      filters.role &&
      !(user.roles ?? []).some((role) => role.name === filters.role)
    ) {
      return false;
    }
    if (filters.status === 'Locked') {
      if (!isLockedNow(user)) return false;
    } else if (
      filters.status &&
      !userExceptions(user).includes(EXCEPTION_FOR[filters.status])
    ) {
      return false;
    }
    return true;
  });
}

/** Role names held by the loaded users, for the role filter. */
export function roleNames(users: User[]): string[] {
  const names = new Set<string>();
  users.forEach((user) =>
    (user.roles ?? []).forEach((role) => names.add(role.name))
  );
  return [...names].sort((a, b) => a.localeCompare(b));
}
