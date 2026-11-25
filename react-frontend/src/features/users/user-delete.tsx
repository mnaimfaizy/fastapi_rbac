import type { ReactNode } from 'react';
import type { User } from '@/models/user';
import { fullName } from './users-list-model';

export interface DeleteCopy {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** The user holds a role, so the dialog offers the edit page instead. */
  holdsRoles: boolean;
}

export const NO_DELETE_COPY: DeleteCopy = {
  title: '',
  description: '',
  confirmLabel: 'Delete user',
  holdsRoles: false,
};

/**
 * What the delete dialog says, on the users list and on user detail
 * (`users-delete` artboard). The API deletes only a user who holds no role
 * (`remove_user` answers 409 otherwise), so for a role holder the dialog
 * says so and offers the edit page instead of a delete it would refuse.
 * Deleting ends the user's sessions; their audit history is kept, so the
 * dialog doesn't say it goes.
 */
export function deleteCopyFor(user: User): DeleteCopy {
  const name = fullName(user);
  const count = (user.roles ?? []).length;
  if (count > 0) {
    return {
      title: `Remove ${name}’s roles first`,
      description: `${name} holds ${count} ${count === 1 ? 'role' : 'roles'}. A user who holds a role can’t be deleted, so remove their roles on the edit page first.`,
      confirmLabel: 'Edit user',
      holdsRoles: true,
    };
  }
  const subject = user.first_name?.trim() || name;
  return {
    title: `Delete user ‘${name}’?`,
    description: (
      <>
        <span className="block">
          {subject} loses access straight away and is signed out everywhere.
        </span>
        <span className="text-foreground mt-2 block font-medium">
          This can’t be undone.
        </span>
      </>
    ),
    confirmLabel: 'Delete user',
    holdsRoles: false,
  };
}
