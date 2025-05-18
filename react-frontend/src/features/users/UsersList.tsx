import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { deleteUser, fetchUsers } from '../../store/slices/userSlice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { DataTable } from '@/components/dashboard/users/data-table';
import { columns as baseColumns } from '@/features/users/user-table-columns';

const UsersList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users, loading, pagination, error } = useSelector(
    (state: RootState) => state.user
  );
  const [pageSize, setPageSize] = useState(10);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Fetch users when component mounts
  useEffect(() => {
    dispatch(fetchUsers({ page: 1, limit: pageSize }));
  }, [dispatch, pageSize]);

  const handlePageChange = (page: number) => {
    dispatch(fetchUsers({ page, limit: pageSize }));
  };

  const handleSearch = (value: string) => {
    dispatch(fetchUsers({ page: 1, limit: pageSize, search: value }));
  };

  const handleRowsPerPageChange = (value: number) => {
    setPageSize(value);
    dispatch(fetchUsers({ page: 1, limit: value }));
  };

  // Open delete dialog
  const handleDeleteClick = useCallback((userId: string) => {
    setDeleteUserId(userId);
    setIsDeleteDialogOpen(true);
  }, []);

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteUserId) return;

    try {
      await dispatch(deleteUser(deleteUserId)).unwrap();
      toast.success('User deleted successfully');
      dispatch(
        fetchUsers({
          page: pagination?.page || 1,
          limit: pageSize,
        })
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' &&
              error &&
              'response' in error &&
              typeof error.response === 'object' &&
              error.response &&
              'data' in error.response &&
              typeof error.response.data === 'object' &&
              error.response.data &&
              'detail' in error.response.data
            ? String(error.response.data.detail)
            : 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteUserId(null);
    }
  };

  // Create columns with delete handler
  const columns = useMemo(() => {
    return baseColumns.map((col) => {
      if (col.id === 'actions') {
        return {
          ...col,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cell: ({ row }: { row: any }) => {
            // Add explicit type for row
            const user = row.original;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/dashboard/users/${user.id}`}>View details</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/dashboard/users/${user.id}/edit`}>
                      Edit user
                    </Link>
                  </DropdownMenuItem>
                  {user.is_locked && (
                    <DropdownMenuItem className="text-green-600">
                      Unlock account
                    </DropdownMenuItem>
                  )}
                  {!user.verified && (
                    <DropdownMenuItem className="text-blue-600">
                      Resend verification
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDeleteClick(user.id)}
                  >
                    Delete user
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        };
      }
      return col;
    });
  }, [handleDeleteClick]);

  return (
    <div className="container space-y-6 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <Link to="/dashboard/users/new">
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Add New User
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manage Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !users?.length ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={users || []}
              onSearch={handleSearch}
              searchPlaceholder="Search users..."
              onRowsPerPageChange={handleRowsPerPageChange}
              pagination={
                pagination.total
                  ? {
                      pageIndex: pagination.page || 1,
                      pageSize: pageSize || 10,
                      pageCount: pagination.total,
                      onPageChange: handlePageChange || (() => {}),
                    }
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be
              undone. All associated data will be permanently removed.
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
    </div>
  );
};

export default UsersList;
