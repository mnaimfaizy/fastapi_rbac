import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { VisibilityState } from '@tanstack/react-table';
import { Plus, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { AppDispatch, RootState } from '../../store';
import { deleteUser, fetchUsers } from '../../store/slices/userSlice';
import type { User } from '@/models/user';
import { Button } from '@/components/ui/button';
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
import { PageHeader } from '@/components/common/PageHeader';
import { TableSkeleton } from '@/components/common/Skeletons';
import { DataTable } from '@/components/dashboard/users/data-table';
import { usePermissions } from '@/hooks/usePermissions';
import {
  buildUserColumns,
  DEFAULT_USER_COLUMN_VISIBILITY,
  OPTIONAL_COLUMN_WIDTH,
  OPTIONAL_USER_COLUMNS,
  USERS_TABLE_MIN_WIDTH,
} from './user-table-columns';
import { UsersColumnPicker } from './UsersColumnPicker';
import { UsersPagination } from './UsersPagination';

/**
 * The users API pages with at most 100 rows and has no search or filter
 * parameters, so the list loads one full page and searches, filters and
 * pages in the browser.
 */
const USERS_FETCH_LIMIT = 100;

const UsersList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { users, loading, error } = useSelector(
    (state: RootState) => state.user
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    DEFAULT_USER_COLUMN_VISIBILITY
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const loadUsers = useCallback(
    () => dispatch(fetchUsers({ page: 1, limit: USERS_FETCH_LIMIT })),
    [dispatch]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const canRead = hasPermission('user.read');
  const canUpdate = hasPermission('user.update');
  const canDelete = hasPermission('user.delete');
  const canCreate = hasPermission('user.create');

  const handleDeleteClick = useCallback((userId: string) => {
    setDeleteUserId(userId);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteUserId) return;

    try {
      await dispatch(deleteUser(deleteUserId)).unwrap();
      toast.success('User deleted successfully');
      loadUsers();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setIsDeleteDialogOpen(false);
      setDeleteUserId(null);
    }
  };

  const columns = useMemo(
    () =>
      buildUserColumns((user) => (
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
            {canRead && (
              <DropdownMenuItem asChild>
                <Link to={`/dashboard/users/${user.id}`}>View details</Link>
              </DropdownMenuItem>
            )}
            {canUpdate && (
              <DropdownMenuItem asChild>
                <Link to={`/dashboard/users/${user.id}/edit`}>Edit user</Link>
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                className="text-destructive"
                data-testid="delete-user-button"
                onClick={() => handleDeleteClick(user.id)}
              >
                Delete user
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )),
    [canRead, canUpdate, canDelete, handleDeleteClick]
  );

  const allUsers = users ?? [];
  const pageCount = Math.max(1, Math.ceil(allUsers.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageRows = allUsers.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );
  const visibleOptional = OPTIONAL_USER_COLUMNS.filter(
    ({ id }) => columnVisibility[id] !== false
  ).length;

  const openUser = (user: User) => navigate(`/dashboard/users/${user.id}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Everyone who can sign in to FastAPI RBAC."
        action={
          canCreate ? (
            <Button asChild>
              <Link to="/dashboard/users/new">
                <Plus aria-hidden="true" />
                Add user
              </Link>
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div
          role="alert"
          className="border-destructive bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex-1" />
          <UsersColumnPicker
            visibility={columnVisibility}
            onChange={setColumnVisibility}
          />
        </div>

        {loading && allUsers.length === 0 ? (
          <TableSkeleton label="Loading users" columns={4} />
        ) : (
          <DataTable
            columns={columns}
            data={pageRows}
            getRowId={(user) => user.id}
            columnVisibility={columnVisibility}
            onRowClick={openUser}
            minWidth={
              USERS_TABLE_MIN_WIDTH + visibleOptional * OPTIONAL_COLUMN_WIDTH
            }
            footer={
              <UsersPagination
                total={allUsers.length}
                pageIndex={currentPage}
                pageSize={pageSize}
                onPageChange={setPageIndex}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPageIndex(0);
                }}
              />
            }
          />
        )}
      </div>

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
              data-testid="confirm-delete-user"
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
