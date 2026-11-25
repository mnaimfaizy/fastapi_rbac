import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '@/models/user';
import { fullName } from './users-list-model';
import { RoleChips, UserAvatar, UserStatusBadges } from './user-table-columns';

export interface UsersMobileListProps {
  users: User[];
  onOpen: (user: User) => void;
  renderActions: (user: User) => ReactNode;
}

function isInteractive(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('a, button, [role="menuitem"]') !== null
  );
}

/** The users list below the md breakpoint: one stacked row per user. */
export function UsersMobileList({
  users,
  onOpen,
  renderActions,
}: UsersMobileListProps) {
  const handleClick = (user: User) => (event: MouseEvent) => {
    if (!isInteractive(event.target)) onOpen(user);
  };

  return (
    <ul aria-label="Users" className="m-0 list-none p-0">
      {users.map((user) => (
        <li
          key={user.id}
          onClick={handleClick(user)}
          className="flex cursor-pointer items-center gap-3 border-b py-3 pr-1"
        >
          <UserAvatar user={user} size="md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Link
              to={`/dashboard/users/${user.id}`}
              className="text-foreground text-[15px] font-medium"
            >
              {fullName(user)}
            </Link>
            <span className="text-muted-foreground truncate text-[13px]">
              {user.email}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <RoleChips user={user} />
              <UserStatusBadges user={user} />
            </div>
          </div>
          {renderActions(user)}
        </li>
      ))}
    </ul>
  );
}
