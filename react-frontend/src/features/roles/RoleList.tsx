import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchRoles, deleteRole } from '../../store/slices/roleSlice';
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
import { useNavigate } from 'react-router-dom';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Eye, Edit, Trash2, AlertCircle } from 'lucide-react';
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

  // Verify required permissions
  const canReadRoles = hasPermission('role.read');
  const canCreateRoles = hasPermission('role.create');
  const canUpdateRoles = hasPermission('role.update');
  const canDeleteRoles = hasPermission('role.delete');
  const canReadRoleGroups = hasPermission('role_group.read');

  // Only load roles if user has permission to read them
  useEffect(() => {
    if (canReadRoles) {
      dispatch(fetchRoles({ page: currentPage, size: pageSize }));
      // Fetch role groups only if user has permission to read them
      if (canReadRoleGroups) {
        dispatch(fetchRoleGroups({ page: 1, size: 100 })); // Get all groups for reference
      }
    }
  }, [dispatch, currentPage, pageSize, canReadRoles, canReadRoleGroups]);

  const handleView = (roleId: string) => {
    if (!canReadRoles) {
      toast.error('You do not have permission to view role details');
      return;
    }
    navigate(`/dashboard/roles/${roleId}`);
  };

  const handleEdit = (roleId: string) => {
    if (!canUpdateRoles) {
      toast.error('You do not have permission to edit roles');
      return;
    }
    navigate(`/dashboard/roles/edit/${roleId}`);
  };

  const handleCreate = () => {
    if (!canCreateRoles) {
      toast.error('You do not have permission to create roles');
      return;
    }
    navigate('/dashboard/roles/new');
  };

  const handleDelete = (roleId: string) => {
    if (!canDeleteRoles) {
      toast.error('You do not have permission to delete roles');
      return;
    }
    setDeleteRoleId(roleId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRoleId) return;

    try {
      await dispatch(deleteRole(deleteRoleId)).unwrap();
      toast.success('Role deleted successfully');
      dispatch(fetchRoles({ page: currentPage, size: pageSize }));
    } catch (error: unknown) {
      let errorMessage = 'Failed to delete role';
      if (error instanceof Error) {
        errorMessage = error.message;
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
    const group = roleGroups.find((g) => g.id === groupId);
    return group?.name;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return !isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';
  };

  // If user doesn't have read permission, show message
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

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Roles</h2>
        {canCreateRoles && <Button onClick={handleCreate}>Create Role</Button>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Role Group</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
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
                colSpan={6}
                className="text-center py-8 text-muted-foreground"
              >
                No roles found
              </TableCell>
            </TableRow>
          ) : (
            roles &&
            roles.map((role: Role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell>{role.description || '-'}</TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {role.permissions?.length || 0} permission
                    {role.permissions?.length === 1 ? '' : 's'}
                  </span>
                </TableCell>
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
                        ? getRoleGroupName(role.role_group_id)
                        : 'No group'}
                    </span>
                  )}
                </TableCell>
                <TableCell>{formatDate(role.created_at)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(role.id)}
                      title="View role details"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View role details</span>
                    </Button>

                    {canUpdateRoles && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(role.id)}
                        title="Edit role"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit role</span>
                      </Button>
                    )}

                    {canDeleteRoles && (
                      <AlertDialog
                        open={isDeleteDialogOpen && deleteRoleId === role.id}
                        onOpenChange={setIsDeleteDialogOpen}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(role.id)}
                            title="Delete role"
                            data-testid="delete-role-button"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete role</span>
                          </Button>
                        </AlertDialogTrigger>
                        {/* Delete Dialog Content */}
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Role</AlertDialogTitle>
                            <AlertDialogDescription>
                              <p>
                                Are you sure you want to delete the role &quot;
                                {role.name}
                                &quot;? This action cannot be undone.
                              </p>
                              {role.permissions &&
                                role.permissions.length > 0 && (
                                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-md">
                                    <p className="text-destructive font-medium">
                                      Warning: This role has{' '}
                                      {role.permissions.length} permission
                                      {role.permissions.length === 1
                                        ? ''
                                        : 's'}{' '}
                                      assigned. Deleting this role will remove
                                      these permissions from all users who have
                                      this role.
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
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
