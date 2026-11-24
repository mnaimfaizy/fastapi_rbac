import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { RowActionsMenu } from '@/components/common/RowActionsMenu';
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/models/permission';
import permissionService from '@/services/permission.service';

function formatCreated(value: string | undefined) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function PermissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('permission.read');
  const canDelete = hasPermission('permission.delete');
  const [permission, setPermission] = useState<Permission | null>(null);
  const [loading, setLoading] = useState(canRead);
  const [missing, setMissing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!canRead || !id) {
      return;
    }
    let active = true;
    setLoading(true);
    setMissing(false);
    permissionService
      .getPermissionById(id)
      .then((response) => {
        if (active) {
          setPermission(response.data);
        }
      })
      .catch(() => {
        if (active) {
          setPermission(null);
          setMissing(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [canRead, id]);

  if (!canRead) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view permissions.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div role="status" aria-label="Loading permission" aria-busy="true">
        <span className="sr-only">Loading permission</span>
      </div>
    );
  }

  if (!permission || missing) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-semibold">Permission not found</h2>
      </div>
    );
  }

  const roles = permission.roles ?? [];
  const userTotal = roles.reduce((sum, role) => sum + role.user_count, 0);

  async function confirmDelete() {
    if (!permission) {
      return;
    }
    try {
      await permissionService.deletePermission(permission.id);
      toast.success('Permission deleted');
      setConfirmingDelete(false);
      navigate('/dashboard/permissions');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete permission'
      );
      throw err;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-foreground font-mono text-2xl leading-8 font-semibold">
              {permission.name}
            </h1>
            {permission.group?.name ? (
              <Badge variant="outline">{permission.group.name}</Badge>
            ) : null}
          </div>
          {permission.description ? (
            <p className="text-foreground-secondary text-sm">
              {permission.description}
            </p>
          ) : null}
        </div>
        {canDelete ? (
          <RowActionsMenu
            label="More actions"
            actions={[
              {
                label: 'Delete',
                destructive: true,
                icon: <Trash2 aria-hidden="true" />,
                onSelect: () => setConfirmingDelete(true),
              },
            ]}
          />
        ) : null}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground text-lg font-semibold">Details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-foreground-secondary text-sm">Code</dt>
            <dd>
              <code>{permission.name}</code>
            </dd>
          </div>
          <div>
            <dt className="text-foreground-secondary text-sm">Description</dt>
            <dd>{permission.description || '—'}</dd>
          </div>
          <div>
            <dt className="text-foreground-secondary text-sm">Group</dt>
            <dd>{permission.group?.name ?? 'No group'}</dd>
          </div>
          <div>
            <dt className="text-foreground-secondary text-sm">Created</dt>
            <dd>{formatCreated(permission.created_at)}</dd>
          </div>
          <div>
            <dt className="text-foreground-secondary text-sm">ID</dt>
            <dd>
              <code>{permission.id}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-foreground text-lg font-semibold">
            Roles that grant this permission
          </h2>
          <p className="text-foreground-secondary text-sm">
            {countLabel(roles.length, 'role', 'roles')} ·{' '}
            {countLabel(userTotal, 'user', 'users')}
          </p>
        </div>
        {roles.length === 0 ? (
          <p className="text-foreground-secondary text-sm">
            No roles grant this permission.
          </p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Role group</TableHead>
                  <TableHead>Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>{role.role_group ?? 'No group'}</TableCell>
                    <TableCell>{role.user_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete permission ‘${permission.name}’?`}
        description="Roles that grant it will lose this action. This cannot be undone."
        confirmLabel="Delete permission"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
