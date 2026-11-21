import React, { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { deleteRole, fetchRoleById } from '../../store/slices/roleSlice';
import { fetchPermissions } from '../../store/slices/permissionSlice';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/models/permission';
import { RoleHolder } from '@/models/role';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CRUD_VERBS = ['create', 'read', 'update', 'delete'] as const;
type Verb = (typeof CRUD_VERBS)[number];

function actionOf(name: string): string {
  const dot = name.indexOf('.');
  return dot === -1 ? name : name.slice(dot + 1);
}

function verbOf(action: string): Verb | null {
  if ((CRUD_VERBS as readonly string[]).includes(action)) {
    return action as Verb;
  }
  const head = action.split('_')[0];
  if (
    (CRUD_VERBS as readonly string[]).includes(head) &&
    action.startsWith(`${head}_`)
  ) {
    return head as Verb;
  }
  return null;
}

interface MatrixRow {
  group: string;
  granted: number;
  total: number;
  cells: Record<Verb, Permission | null>;
  other: Permission[];
}

function buildMatrix(catalog: Permission[], grantedIds: Set<string>) {
  const byGroup = new Map<string, Permission[]>();
  for (const permission of catalog) {
    const group = permission.group?.name || 'No group';
    const list = byGroup.get(group) ?? [];
    list.push(permission);
    byGroup.set(group, list);
  }

  const rows: MatrixRow[] = [];
  for (const [group, permissions] of byGroup) {
    const verbs = permissions.map((permission) =>
      verbOf(actionOf(permission.name))
    );
    const counts = new Map<string, number>();
    for (const verb of verbs) {
      if (verb) counts.set(verb, (counts.get(verb) ?? 0) + 1);
    }
    const clean = verbs.every(
      (verb) => verb !== null && counts.get(verb) === 1
    );
    const cells: Record<Verb, Permission | null> = {
      create: null,
      read: null,
      update: null,
      delete: null,
    };
    const other: Permission[] = [];
    for (const permission of permissions) {
      const action = actionOf(permission.name);
      const verb = verbOf(action);
      if (clean && verb) {
        cells[verb] = permission;
      } else if ((CRUD_VERBS as readonly string[]).includes(action)) {
        cells[action as Verb] = permission;
      } else {
        other.push(permission);
      }
    }
    rows.push({
      group,
      granted: permissions.filter((permission) => grantedIds.has(permission.id))
        .length,
      total: permissions.length,
      cells,
      other,
    });
  }

  const granted = catalog.filter((permission) =>
    grantedIds.has(permission.id)
  ).length;
  return { rows, granted, total: catalog.length };
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

  const { currentRole, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const { permissions, totalItems: permissionTotal } = useSelector(
    (state: RootState) => state.permission
  );

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
    }
  }, [dispatch, roleId, canReadRoles, canReadPermissions, navigate]);

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
        const errorMessage =
          deleteError instanceof Error
            ? deleteError.message
            : 'Failed to delete role';
        toast.error(errorMessage, { duration: 5000 });
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

  if (error) {
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
  const matrix = buildMatrix(catalog, grantedIds);
  // users is sent only to callers who also hold user.read.
  const canSeeHolders =
    currentRole.users !== undefined && currentRole.users !== null;
  const holders = currentRole.users ?? [];
  const userCount = currentRole.user_count ?? holders.length;

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
            <h1 className="text-2xl font-semibold tracking-tight">
              {currentRole.name}
            </h1>
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4" />
                    Delete role
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Role</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      this role from the system.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete role
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <section className="rounded-xl border p-6 space-y-4 min-w-0">
          <div>
            <h2 className="text-base font-semibold">Permissions</h2>
            <p className="text-sm text-muted-foreground">
              {catalogComplete
                ? `${matrix.granted} of ${matrix.total} granted, by permission group`
                : `${matrix.granted} ${matrix.granted === 1 ? 'permission' : 'permissions'} granted (partial list: the full catalog is not available to you)`}
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
                {matrix.rows.map((row) => {
                  const grantedOther = row.other.filter((permission) =>
                    grantedIds.has(permission.id)
                  );
                  return (
                    <TableRow key={row.group}>
                      <TableCell>
                        <span className="font-medium">{row.group}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          {row.granted}/{row.total}
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
            {canSeeHolders && userCount > 0 && (
              <Link
                to="/dashboard/users"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all {userCount}
              </Link>
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
    </div>
  );
};

export default RoleDetail;
