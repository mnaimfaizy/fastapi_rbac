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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { AlertCircle, MoreHorizontal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { normalizeApiError } from '@/lib/apiError';
import { RoleGroupChip } from './RoleGroupChip';
import { RoleDeleteDialog } from './RoleDeleteDialog';

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
      const errorMessage = normalizeApiError(
        deleteError,
        'Failed to delete role'
      ).message;
      toast.error(errorMessage, {
        duration: 5000,
      });
      throw deleteError instanceof Error
        ? deleteError
        : new Error(errorMessage);
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

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 px-4">Name</TableHead>
              <TableHead className="h-11 px-4">Description</TableHead>
              <TableHead className="h-11 px-4">Role group</TableHead>
              <TableHead className="h-11 px-4 text-right">
                Permissions
              </TableHead>
              <TableHead className="h-11 px-4 text-right">Users</TableHead>
              {showActions && (
                <TableHead className="h-11 px-4 text-right">
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
                  <TableCell className="h-16 px-4 font-medium">
                    <Link
                      to={`/dashboard/roles/${role.id}`}
                      className="font-semibold hover:underline"
                    >
                      {role.name}
                    </Link>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-foreground-secondary">
                    {role.description || '-'}
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    {role.role_group_id && canReadRoleGroups ? (
                      <RoleGroupChip
                        name={
                          getRoleGroupName(role.role_group_id) || 'View group'
                        }
                        onOpen={() => navigateToRoleGroup(role.role_group_id!)}
                      />
                    ) : role.role_group_id &&
                      getRoleGroupName(role.role_group_id) ? (
                      <RoleGroupChip
                        name={getRoleGroupName(role.role_group_id)!}
                      />
                    ) : (
                      <span className="text-muted-foreground">No group</span>
                    )}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-right">
                    {role.permissions?.length || 0}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-right">
                    {role.user_count ?? 0}
                  </TableCell>
                  {showActions && (
                    <TableCell className="h-16 px-4 text-right">
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
      </div>

      <RoleDeleteDialog
        role={rolePendingDelete ?? null}
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setDeleteRoleId(null);
        }}
        onConfirm={handleDeleteConfirm}
      />

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
