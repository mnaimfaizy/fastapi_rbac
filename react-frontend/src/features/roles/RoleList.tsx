import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import {
  fetchRoles,
  deleteRole,
  clearRoleError,
} from '../../store/slices/roleSlice';
import { fetchRoleGroups } from '../../store/slices/roleGroupSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link, useNavigate } from 'react-router-dom';
import { Role } from '@/models/role';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { AlertCircle, MoreHorizontal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const RoleList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { roles, pagination, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const { roleGroups } = useSelector((state: RootState) => state.roleGroup);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canReadRoles = hasPermission('role.read');
  const canUpdateRoles = hasPermission('role.update');
  const canDeleteRoles = hasPermission('role.delete');
  const canReadRoleGroups = hasPermission('role_group.read');
  const showActions = canUpdateRoles || canDeleteRoles;
  const columnCount = showActions ? 6 : 5;

  useEffect(() => {
    if (canReadRoles) {
      dispatch(fetchRoles({ page: currentPage, size: pageSize }));
      if (canReadRoleGroups) {
        dispatch(fetchRoleGroups({ page: 1, size: 100 }));
      }
    }
  }, [dispatch, currentPage, pageSize, canReadRoles, canReadRoleGroups]);

  const handleEdit = (roleId: string) => {
    if (!canUpdateRoles) {
      toast.error('You do not have permission to edit roles');
      return;
    }
    navigate(`/dashboard/roles/edit/${roleId}`);
  };

  const handleDelete = (roleId: string) => {
    if (!canDeleteRoles) {
      toast.error('You do not have permission to delete roles');
      return;
    }
    setDeleteRoleId(roleId);
    setIsDeleteDialogOpen(true);
  };

  const handleRetry = () => {
    dispatch(clearRoleError());
    dispatch(fetchRoles({ page: currentPage, size: pageSize }));
  };

  const handleClearError = () => {
    dispatch(clearRoleError());
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRoleId) return;

    try {
      await dispatch(deleteRole(deleteRoleId)).unwrap();
      toast.success('Role deleted successfully');
      dispatch(fetchRoles({ page: currentPage, size: pageSize }));
    } catch (deleteError: unknown) {
      let errorMessage = 'Failed to delete role';
      if (deleteError instanceof Error) {
        errorMessage = deleteError.message;
      }
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteRoleId(null);
    }
  };

  const navigateToRoleGroup = (roleGroupId: string) => {
    if (!canReadRoleGroups) {
      toast.error('You do not have permission to view role groups');
      return;
    }
    navigate(`/dashboard/role-groups/${roleGroupId}`);
  };

  const getRoleGroupName = (groupId: string | undefined) => {
    if (!groupId) return null;
    const group = roleGroups.find((entry) => entry.id === groupId);
    return group?.name;
  };

  if (!canReadRoles) {
    return (
      <div className="p-4 text-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view roles.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const rolePendingDelete = roles?.find((role) => role.id === deleteRoleId);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <div className="flex gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={loading}
              >
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearError}>
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Role group</TableHead>
            <TableHead className="text-right">Permissions</TableHead>
            <TableHead className="text-right">Users</TableHead>
            {showActions && (
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="text-center py-8">
                <div
                  className="flex items-center justify-center space-x-2"
                  data-testid="loading-spinner"
                >
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Loading roles...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : !roles || roles.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="text-center py-8 text-muted-foreground"
              >
                No roles found
              </TableCell>
            </TableRow>
          ) : (
            roles.map((role: Role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/dashboard/roles/${role.id}`}
                    className="font-semibold hover:underline"
                  >
                    {role.name}
                  </Link>
                </TableCell>
                <TableCell>{role.description || '-'}</TableCell>
                <TableCell>
                  {role.role_group_id && canReadRoleGroups ? (
                    <button
                      onClick={() => navigateToRoleGroup(role.role_group_id!)}
                      className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
                    >
                      {getRoleGroupName(role.role_group_id) || 'View Group'}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">
                      {role.role_group_id
                        ? getRoleGroupName(role.role_group_id) || 'No group'
                        : 'No group'}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {role.permissions?.length || 0}
                </TableCell>
                <TableCell className="text-right">
                  {role.user_count ?? 0}
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Actions for ${role.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdateRoles && (
                          <DropdownMenuItem
                            onClick={() => handleEdit(role.id)}
                            title="Edit role"
                          >
                            Edit role
                          </DropdownMenuItem>
                        )}
                        {canDeleteRoles && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(role.id)}
                            title="Delete role"
                            data-testid="delete-role-button"
                          >
                            Delete role
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the role &quot;
                {rolePendingDelete?.name}
                &quot;? This action cannot be undone.
              </p>
              {rolePendingDelete?.permissions &&
                rolePendingDelete.permissions.length > 0 && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-md">
                    <p className="text-destructive font-medium">
                      Warning: This role has{' '}
                      {rolePendingDelete.permissions.length} permission
                      {rolePendingDelete.permissions.length === 1
                        ? ''
                        : 's'}{' '}
                      assigned. Deleting this role will remove these permissions
                      from all users who have this role.
                    </p>
                  </div>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {pagination.pages}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= (pagination?.pages || 1) || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleList;
