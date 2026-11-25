import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

const BLOCKED =
  'This role cannot be deleted until its permissions are removed and its users are unassigned.';

/** A delete reaches the API only when the role has no holders and no permissions. */
function canDelete(role: RoleDeleteTarget): boolean {
  return (
    role.user_count === 0 &&
    Array.isArray(role.permissions) &&
    role.permissions.length === 0
  );
}

/** Plain confirm when the backend can delete the role; otherwise explain and dismiss. */
export function RoleDeleteDialog({
  role,
  open,
  onOpenChange,
  onConfirm,
}: RoleDeleteDialogProps) {
  if (!role) return null;
  const title = `Delete role ‘${role.name}’?`;

  if (!canDelete(role)) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground-secondary">
              {BLOCKED}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dismiss</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="No users hold this role. This cannot be undone."
      confirmLabel="Delete role"
      onConfirm={onConfirm}
    />
  );
}
