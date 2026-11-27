import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { VisibilityState } from '@tanstack/react-table';
import { CircleAlert, Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AppDispatch, RootState } from '../../store';
import {
  clearUserErrors,
  deleteUser,
  fetchUsers,
} from '../../store/slices/userSlice';
import type { User } from '@/models/user';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  RowActionsMenu,
  type RowAction,
} from '@/components/common/RowActionsMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { TableSkeleton } from '@/components/common/Skeletons';
import { EmptyState } from '@/components/common/EmptyState';
import { DataTable } from '@/components/dashboard/users/data-table';
import { usePermissions } from '@/hooks/usePermissions';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  buildUserColumns,
  DEFAULT_USER_COLUMN_VISIBILITY,
  OPTIONAL_COLUMN_WIDTH,
  OPTIONAL_USER_COLUMNS,
  USERS_TABLE_MIN_WIDTH,
} from './user-table-columns';
import { UsersColumnPicker } from './UsersColumnPicker';
import { UsersPagination } from './UsersPagination';
import { UsersToolbar } from './UsersToolbar';
import { UsersMobileList } from './UsersMobileList';
import {
  filterUsers,
  fullName,
  parseStatusFilter,
  roleNames,
  type StatusFilter,
} from './users-list-model';
import { deleteCopyFor, NO_DELETE_COPY, type DeleteCopy } from './user-delete';

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
  const { users, loading, error, pagination } = useSelector(
    (state: RootState) => state.user
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatusFilter(searchParams.get('status'));
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    DEFAULT_USER_COLUMN_VISIBILITY
  );
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  // The dialog's copy stays while it animates closed.
  const [deleteCopy, setDeleteCopy] = useState<DeleteCopy>(NO_DELETE_COPY);
  const isMobile = useMediaQuery('(max-width: 767px)');

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
  const canReadRoles = hasPermission('role.read');
  const viewerId = useSelector((state: RootState) => state.auth.user?.id);

  const confirmDelete = async () => {
    if (!userToDelete) return;
    if (deleteCopy.holdsRoles) {
      // The API refuses to delete a user who holds a role; send the viewer
      // to the edit page, where the roles are removed.
      navigateRef.current(`/dashboard/users/${userToDelete.id}/edit`);
      return;
    }
    try {
      await dispatch(deleteUser(userToDelete.id)).unwrap();
    } catch (error: unknown) {
      const message =
        typeof error === 'string' && error ? error : 'Failed to delete user';
      toast.error(message);
      // The toast reports it; the page banner is for load failures only.
      dispatch(clearUserErrors());
      // Keep the dialog open so the person can retry or cancel.
      throw error;
    }
    toast.success('User deleted');
    loadUsers();
  };

  // The columns, and so every open row menu, are rebuilt when this changes;
  // `navigate` can change identity on navigation, so read it through a ref.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Only the actions the viewer can use; the rest are left out.
  const renderActions = useCallback(
    (user: User) => {
      const actions: RowAction[] = [];
      if (canRead) {
        actions.push({
          label: 'View details',
          onSelect: () => navigateRef.current(`/dashboard/users/${user.id}`),
        });
      }
      if (canUpdate) {
        actions.push({
          label: 'Edit user',
          onSelect: () =>
            navigateRef.current(`/dashboard/users/${user.id}/edit`),
        });
      }
      // A user who holds a role can't be deleted until the roles are removed
      // on the edit page, which needs user.update, and whose Roles field
      // needs role.read to list them; without both, no Delete. The API never
      // lets anyone delete themselves. Same rule as user detail.
      const holdsRoles = (user.roles ?? []).length > 0;
      const canRemoveRoles = canUpdate && canReadRoles;
      if (
        canDelete &&
        user.id !== viewerId &&
        (!holdsRoles || canRemoveRoles)
      ) {
        actions.push({
          label: 'Delete user',
          destructive: true,
          onSelect: () => {
            setDeleteCopy(deleteCopyFor(user));
            setUserToDelete(user);
          },
        });
      }
      return (
        <RowActionsMenu
          label={`Actions for ${fullName(user)}`}
          actions={actions}
        />
      );
    },
    [canRead, canUpdate, canDelete, canReadRoles, viewerId]
  );

  const columns = useMemo(
    () => buildUserColumns(renderActions),
    [renderActions]
  );

  const allUsers = useMemo(() => users ?? [], [users]);
  const roles = useMemo(() => roleNames(allUsers), [allUsers]);
  // A role nobody on the list holds any more (its last holder was deleted)
  // stops filtering, so the trigger never says "All" while a role applies.
  const activeRole = role && roles.includes(role) ? role : null;
  const filtered = useMemo(
    () => filterUsers(allUsers, { search, role: activeRole, status }),
    [allUsers, search, activeRole, status]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageRows = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );
  const visibleOptional = OPTIONAL_USER_COLUMNS.filter(
    ({ id }) => columnVisibility[id] !== false
  ).length;

  const openUser = (user: User) => navigate(`/dashboard/users/${user.id}`);

  const changeSearch = (value: string) => {
    setSearch(value);
    setPageIndex(0);
  };
  const changeRole = (value: string | null) => {
    setRole(value);
    setPageIndex(0);
  };
  // The status filter lives in the URL, so `/dashboard/users?status=Locked`
  // opens the list already filtered.
  const changeStatus = (value: StatusFilter | null) => {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        if (value) next.set('status', value);
        else next.delete('status');
        return next;
      },
      { replace: true }
    );
    setPageIndex(0);
  };
  const clearSearch = () => changeSearch('');
  const clearFilters = () => {
    changeRole(null);
    changeStatus(null);
  };

  const isFirstLoad = loading && allUsers.length === 0;
  const loadFailed = !loading && !!error && allUsers.length === 0;
  const noUsers = !isFirstLoad && !error && allUsers.length === 0;
  const noMatch = allUsers.length > 0 && filtered.length === 0;
  // Compare with what the last fetch reported, not the local list, which
  // shrinks on delete while `pagination.total` stays as fetched.
  const truncated = pagination.total > USERS_FETCH_LIMIT;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        // The mobile artboard puts Add user on the title's line with no
        // description; on desktop it sits centred against the title block.
        className="flex-row items-center justify-between sm:items-center"
        description={
          isMobile ? undefined : 'Everyone who can sign in to FastAPI RBAC.'
        }
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

      {error && !loadFailed && (
        <div
          role="alert"
          className="border-destructive bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <UsersToolbar
          search={search}
          onSearchChange={changeSearch}
          roles={roles}
          role={activeRole}
          onRoleChange={changeRole}
          status={status}
          onStatusChange={changeStatus}
          compact={isMobile}
          columnPicker={
            <UsersColumnPicker
              visibility={columnVisibility}
              onChange={setColumnVisibility}
            />
          }
        />

        {truncated ? (
          <p className="text-foreground-secondary text-sm">
            Showing the first {USERS_FETCH_LIMIT} of {pagination.total} users.
            Search and filters cover these only.
          </p>
        ) : null}

        {isFirstLoad ? (
          <TableSkeleton label="Loading users" columns={4} />
        ) : loadFailed ? (
          <div className="rounded-xl border">
            <EmptyState
              icon={CircleAlert}
              title="Users didn’t load"
              description={error ?? undefined}
              action={{
                label: 'Try again',
                variant: 'secondary',
                onClick: () => {
                  loadUsers();
                },
              }}
            />
          </div>
        ) : noUsers ? (
          <div className="rounded-xl border">
            <EmptyState
              icon={Users}
              title="No users yet"
              description="Users you add can sign in with the roles you give them."
              action={
                canCreate
                  ? { label: 'Add user', href: '/dashboard/users/new' }
                  : undefined
              }
            />
          </div>
        ) : noMatch ? (
          <div className="rounded-xl border">
            {search.trim() ? (
              <EmptyState
                icon={Search}
                title={`No users match ‘${search.trim()}’`}
                description="Check the spelling, or search by email instead."
                action={{
                  label: 'Clear search',
                  variant: 'secondary',
                  onClick: clearSearch,
                }}
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No users match these filters"
                description="Try another role or status."
                action={{
                  label: 'Clear filters',
                  variant: 'secondary',
                  onClick: clearFilters,
                }}
              />
            )}
          </div>
        ) : isMobile ? (
          <div className="flex flex-col gap-4">
            <UsersMobileList
              users={pageRows}
              onOpen={openUser}
              renderActions={renderActions}
            />
            <UsersPagination
              compact
              total={filtered.length}
              pageIndex={currentPage}
              pageSize={pageSize}
              onPageChange={setPageIndex}
            />
          </div>
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
                total={filtered.length}
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

      <ConfirmDialog
        open={userToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
        title={deleteCopy.title}
        description={deleteCopy.description}
        confirmLabel={deleteCopy.confirmLabel}
        icon={deleteCopy.icon}
        destructive={!deleteCopy.holdsRoles}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default UsersList;
