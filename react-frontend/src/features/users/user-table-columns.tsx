import type { ReactNode } from 'react';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import type { User } from '@/models/user';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate } from '@/lib/utils';
import {
  formatDay,
  fullName,
  initials,
  userExceptions,
} from './users-list-model';

export function UserAvatar({
  user,
  size = 'sm',
}: {
  user: User;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      aria-hidden="true"
      className={
        size === 'sm'
          ? 'bg-muted text-foreground-secondary inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-[0.02em]'
          : 'bg-muted text-foreground-secondary inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold tracking-[0.02em]'
      }
    >
      {initials(user)}
    </span>
  );
}

export function RoleChips({ user }: { user: User }) {
  const roles = user.roles ?? [];
  if (roles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <span
          key={role.id}
          className="bg-muted text-foreground inline-flex h-[22px] items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap"
        >
          {role.name}
        </span>
      ))}
    </div>
  );
}

/** Exception badges only: a healthy user shows nothing. */
export function UserStatusBadges({ user }: { user: User }) {
  const exceptions = userExceptions(user);
  if (exceptions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {exceptions.map((exception) => (
        <StatusBadge
          key={exception}
          status={exception}
          description={
            exception === 'locked' && user.locked_until
              ? `Locked until ${formatDate(user.locked_until)}`
              : undefined
          }
        />
      ))}
    </div>
  );
}

/** Columns the viewer can add from the column picker, hidden by default. */
export const OPTIONAL_USER_COLUMNS = [
  { id: 'phone', label: 'Phone' },
  { id: 'failed_attempts', label: 'Failed attempts' },
  { id: 'created', label: 'Created' },
  { id: 'password_changed', label: 'Password changed' },
] as const;

export type OptionalUserColumnId = (typeof OPTIONAL_USER_COLUMNS)[number]['id'];

export const DEFAULT_USER_COLUMN_VISIBILITY: VisibilityState =
  Object.fromEntries(OPTIONAL_USER_COLUMNS.map(({ id }) => [id, false]));

/** Narrowest width of the default columns; each optional one adds to it. */
export const USERS_TABLE_MIN_WIDTH = 720;
export const OPTIONAL_COLUMN_WIDTH = 140;

const optionalCell = 'w-[140px] text-foreground-secondary';

/**
 * The users table: name with email, roles, status, last sign-in and the
 * "…" menu, plus the optional columns. `renderActions` draws the menu so
 * the page decides which actions the viewer gets.
 */
export function buildUserColumns(
  renderActions: (user: User) => ReactNode
): ColumnDef<User, unknown>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar user={user} />
            <div className="min-w-0">
              <Link
                to={`/dashboard/users/${user.id}`}
                className="text-foreground block truncate font-medium hover:underline"
              >
                {fullName(user)}
              </Link>
              <div className="text-muted-foreground truncate text-[13px]">
                {user.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'roles',
      header: 'Roles',
      meta: { className: 'w-[180px]' },
      cell: ({ row }) => <RoleChips user={row.original} />,
    },
    {
      id: 'status',
      header: 'Status',
      meta: { className: 'w-[140px]' },
      cell: ({ row }) => <UserStatusBadges user={row.original} />,
    },
    {
      id: 'last_sign_in',
      header: 'Last sign-in',
      meta: { className: 'w-[130px] text-foreground-secondary' },
      // The users API has no sign-in time yet; see the d417 report.
      cell: () => '—',
    },
    {
      id: 'phone',
      header: 'Phone',
      meta: { label: 'Phone', className: optionalCell },
      cell: ({ row }) => row.original.contact_phone || '—',
    },
    {
      id: 'failed_attempts',
      header: 'Failed attempts',
      meta: { label: 'Failed attempts', className: optionalCell },
      cell: ({ row }) => String(row.original.number_of_failed_attempts ?? 0),
    },
    {
      id: 'created',
      header: 'Created',
      meta: { label: 'Created', className: optionalCell },
      cell: ({ row }) => formatDay(row.original.created_at),
    },
    {
      id: 'password_changed',
      header: 'Password changed',
      meta: { label: 'Password changed', className: optionalCell },
      cell: ({ row }) => formatDay(row.original.last_changed_password_date),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { className: 'w-14 text-right' },
      cell: ({ row }) => renderActions(row.original),
    },
  ];
}
