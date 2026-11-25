import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { deleteRole, fetchRoleById } from '../../store/slices/roleSlice';
import { fetchPermissions } from '../../store/slices/permissionSlice';
import { fetchRoleGroups } from '../../store/slices/roleGroupSlice';
import { format, isValid, parseISO } from 'date-fns';
import { usePageCrumb } from '@/components/layout/pageCrumb';
import { RoleGroupChip } from './RoleGroupChip';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { RoleHolder } from '@/models/role';
import { normalizeApiError } from '@/lib/apiError';
import { RoleDeleteDialog } from './RoleDeleteDialog';
import {
  CRUD_VERBS,
  buildPermissionMatrix,
  idsInRow,
} from './permissionMatrix';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** "12 Jan 2026", or null when the API sent no usable timestamp. */
function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? format(date, 'd MMM yyyy') : null;
}

function holderName(user: RoleHolder): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return name || user.email;
}

function initials(user: RoleHolder): string {
  const letters = [user.first_name, user.last_name]
    .filter((part): part is string => Boolean(part))
    .map((part) => part[0]);
  return (letters.join('') || user.email.slice(0, 2)).toUpperCase();
}

const RoleDetail: React.FC = () => {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission } = usePermissions();

  const canReadRoles = hasPermission('role.read');
  const canUpdateRoles = hasPermission('role.update');
  const canDeleteRoles = hasPermission('role.delete');
  const canReadPermissions = hasPermission('permission.read');
  const canReadRoleGroups = hasPermission('role_group.read');

  const { currentRole, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const { permissions, totalItems: permissionTotal } = useSelector(
    (state: RootState) => state.permission
  );
  const { roleGroups } = useSelector((state: RootState) => state.roleGroup);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The header breadcrumb ends with this role's name (Access › Roles › Name).
  usePageCrumb(currentRole?.id === roleId ? currentRole?.name : null);

  useEffect(() => {
    if (!canReadRoles) {
      toast.error('You do not have permission to view role details');
      navigate('/dashboard');
      return;
    }

    if (roleId) {
      dispatch(fetchRoleById(roleId));
      // The catalog needs permission.read; without it the matrix is partial.
      if (canReadPermissions) {
        dispatch(fetchPermissions({ page: 1, pageSize: 100 }));
      }
      // The group chip needs the group's name, which needs role_group.read.
      if (canReadRoleGroups) {
        dispatch(fetchRoleGroups({ page: 1, size: 100 }));
      }
    }
  }, [
    dispatch,
    roleId,
    canReadRoles,
    canReadPermissions,
    canReadRoleGroups,
    navigate,
  ]);

  const handleDelete = async () => {
    if (!canDeleteRoles) {
      toast.error('You do not have permission to delete roles');
      return;
    }

    if (roleId) {
      try {
        await dispatch(deleteRole(roleId)).unwrap();
        toast.success('Role deleted successfully');
        navigate('/dashboard/roles');
      } catch (deleteError: unknown) {
        const errorMessage = normalizeApiError(
          deleteError,
          'Failed to delete role'
        ).message;
        toast.error(errorMessage, { duration: 5000 });
        throw deleteError instanceof Error
          ? deleteError
          : new Error(errorMessage);
      }
    }
  };

  if (!canReadRoles) {
    return null;
  }

  if (loading && !currentRole) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // A failed delete sets this error while the role is still loaded. Replacing
  // the page would unmount RoleDeleteDialog, so the error is a banner instead.
  if (error && !currentRole) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded">
        {error}
      </div>
    );
  }

  if (!currentRole) {
    return <div className="p-4 text-center">Role not found</div>;
  }

  const grantedIds = new Set(
    currentRole.permissions?.map((permission) => permission.id)
  );
  const catalogPermissions = canReadPermissions ? permissions : [];
  // The "of N" total is only true when every permission was fetched. One page
  // holds 100, so a bigger catalog is partial too.
  const catalogComplete =
    canReadPermissions &&
    permissionTotal > 0 &&
    catalogPermissions.length >= permissionTotal;
  const catalog = [
    ...catalogPermissions,
    ...(currentRole.permissions ?? []).filter(
      (permission) =>
        !catalogPermissions.some((item) => item.id === permission.id)
    ),
  ];
  const rows = buildPermissionMatrix(catalog);
  const granted = catalog.filter((permission) =>
    grantedIds.has(permission.id)
  ).length;
  const total = catalog.length;
  // users is sent only to callers who also hold user.read.
  const canSeeHolders =
    currentRole.users !== undefined && currentRole.users !== null;
  const holders = currentRole.users ?? [];
  const userCount = currentRole.user_count ?? holders.length;
  const groupName = currentRole.role_group_id
    ? roleGroups.find((group) => group.id === currentRole.role_group_id)?.name
    : undefined;
  const created = shortDate(currentRole.created_at);
  const updated = shortDate(currentRole.updated_at);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard/roles"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Roles
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                {currentRole.name}
              </h1>
              {groupName && <RoleGroupChip name={groupName} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentRole.description || 'No description'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canUpdateRoles && (
              <Button variant="outline" asChild>
                <Link to={`/dashboard/roles/edit/${roleId}`}>
                  <Pencil className="h-4 w-4" />
                  Edit role
                </Link>
              </Button>
            )}
            {canDeleteRoles && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete role
              </Button>
            )}
          </div>
        </div>
        {(created || updated) && (
          <div className="mt-1.5 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
            {created && <span>Created {created}</span>}
            {updated && <span>Updated {updated}</span>}
          </div>
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="p-4 bg-destructive/10 border border-destructive text-destructive rounded"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <section className="rounded-xl border p-6 space-y-4 min-w-0">
          <div>
            <h2 className="text-base font-semibold">Permissions</h2>
            <p className="text-sm text-muted-foreground">
              {catalogComplete
                ? `${granted} of ${total} granted, by permission group`
                : `${granted} ${granted === 1 ? 'permission' : 'permissions'} granted (partial list: the full catalog is not available to you)`}
            </p>
          </div>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission group</TableHead>
                  <TableHead className="text-center">Create</TableHead>
                  <TableHead className="text-center">Read</TableHead>
                  <TableHead className="text-center">Update</TableHead>
                  <TableHead className="text-center">Delete</TableHead>
                  <TableHead>Other</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const rowIds = idsInRow(row);
                  const rowGranted = rowIds.filter((id) =>
                    grantedIds.has(id)
                  ).length;
                  const grantedOther = row.other.filter((permission) =>
                    grantedIds.has(permission.id)
                  );
                  return (
                    <TableRow key={row.group}>
                      <TableCell>
                        <span className="font-medium">{row.group}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          {rowGranted}/{rowIds.length}
                        </span>
                      </TableCell>
                      {CRUD_VERBS.map((verb) => {
                        const permission = row.cells[verb];
                        if (!permission) {
                          return (
                            <TableCell
                              key={verb}
                              className="text-center text-muted-foreground"
                            >
                              <span aria-label="Not available">—</span>
                            </TableCell>
                          );
                        }
                        const granted = grantedIds.has(permission.id);
                        return (
                          <TableCell key={verb} className="text-center">
                            {granted ? (
                              <span
                                aria-label={`${permission.name} granted`}
                                title={permission.name}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-primary"
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              </span>
                            ) : (
                              <span
                                aria-label={`${permission.name} not granted`}
                                title={permission.name}
                                className="text-muted-foreground"
                              >
                                ·
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        {row.other.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : grantedOther.length === 0 ? (
                          <span className="text-muted-foreground">
                            None granted
                          </span>
                        ) : (
                          <span className="flex flex-wrap gap-1.5">
                            {grantedOther.map((permission) => (
                              <span
                                key={permission.id}
                                className="inline-flex rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary"
                              >
                                {permission.name}
                              </span>
                            ))}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="rounded-xl border p-6 space-y-4 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Users with this role</h2>
              <p className="text-sm text-muted-foreground">
                {userCount} {userCount === 1 ? 'user' : 'users'}
              </p>
            </div>
            {canSeeHolders && holders.length < userCount && (
              <p className="text-sm text-muted-foreground">
                Showing the first {holders.length} of {userCount}
              </p>
            )}
          </div>
          {!canSeeHolders ? (
            userCount > 0 ? (
              <p className="text-sm text-muted-foreground">
                Seeing who holds this role needs the user.read permission.
              </p>
            ) : null
          ) : holders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users hold this role
            </p>
          ) : (
            <ul className="divide-y">
              {holders.map((user) => (
                <li key={user.id} className="flex items-center gap-3 py-2.5">
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                  >
                    {initials(user)}
                  </span>
                  <div className="min-w-0">
                    <Link
                      to={`/dashboard/users/${user.id}`}
                      className="block font-medium hover:underline"
                    >
                      {holderName(user)}
                    </Link>
                    <div className="truncate text-sm text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <RoleDeleteDialog
        role={currentRole}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default RoleDetail;
