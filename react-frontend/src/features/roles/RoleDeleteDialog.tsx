import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export interface RoleDeleteTarget {
  name: string;
  user_count?: number;
  permissions?: ReadonlyArray<{ id: string }>;
}

interface RoleDeleteDialogProps {
  role: RoleDeleteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => unknown;
}

function descriptionFor(role: RoleDeleteTarget): string {
  const holders = role.user_count ?? 0;
  if (holders <= 0) {
    return 'No users hold this role. This cannot be undone.';
  }
  const people =
    holders === 1
      ? '1 user holds this role.'
      : `${holders} users hold this role.`;
  const permissions = role.permissions?.length ?? 0;
  const lose =
    permissions === 0
      ? ''
      : permissions === 1
        ? ' They’ll lose its 1 permission.'
        : ` They’ll lose its ${permissions} permissions.`;
  return `${people}${lose} Anyone without another role can only sign in and see their own profile.`;
}

/** Typed role name when someone still holds the role; plain confirm otherwise. */
export function RoleDeleteDialog({
  role,
  open,
  onOpenChange,
  onConfirm,
}: RoleDeleteDialogProps) {
  if (!role) return null;
  const holders = role.user_count ?? 0;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete role ‘${role.name}’?`}
      description={descriptionFor(role)}
      confirmLabel="Delete role"
      confirmText={holders > 0 ? role.name : undefined}
      onConfirm={onConfirm}
    />
  );
}
