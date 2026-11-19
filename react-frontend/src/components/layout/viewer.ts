import type { User } from '@/models/user';

/** "QA Admin" from first and last name, or the email when both are empty. */
export function displayName(
  user: Pick<User, 'first_name' | 'last_name' | 'email'>
) {
  const name = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || user.email;
}

/** Up to two letters for the avatar: "QA" for QA Admin. */
export function initials(
  user: Pick<User, 'first_name' | 'last_name' | 'email'>
) {
  const first = user.first_name?.trim()?.[0] ?? '';
  const last = user.last_name?.trim()?.[0] ?? '';
  const letters = `${first}${last}` || user.email.slice(0, 2);
  return letters.toUpperCase();
}

/** The role chip: the first role held, or Superuser for a superuser with none. */
export function roleLabel(user: Pick<User, 'roles' | 'is_superuser'>) {
  const role = user.roles?.[0]?.name;
  if (role) {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
  return user.is_superuser ? 'Superuser' : undefined;
}
