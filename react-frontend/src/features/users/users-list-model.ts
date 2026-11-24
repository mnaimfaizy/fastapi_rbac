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
