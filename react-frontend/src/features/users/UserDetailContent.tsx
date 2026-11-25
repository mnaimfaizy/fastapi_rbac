import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, CircleAlert, Lock, Mail, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { AppDispatch, RootState } from '../../store';
import {
  clearUserErrors,
  deleteUser,
  fetchUserById,
} from '../../store/slices/userSlice';
import { fetchAllRoles } from '../../store/slices/roleSlice';
import { fetchRoleGroups } from '../../store/slices/roleGroupSlice';
import AuthService from '@/services/auth.service';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageCrumb } from '@/components/layout/pageCrumb';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import {
  RowActionsMenu,
  type RowAction,
} from '@/components/common/RowActionsMenu';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DetailSkeleton } from '@/components/common/Skeletons';
import { passwordAge } from '@/features/user-home/summary';
import { formatDay, fullName } from './users-list-model';
import { UserAvatar, UserStatusBadges } from './user-table-columns';
import { deleteCopyFor, NO_DELETE_COPY, type DeleteCopy } from './user-delete';
import {
  callName,
  formatUtcDateTime,
  groupNameMap,
  heldRoleSummaries,
  roleGrantLine,
} from './user-detail-model';

/** The uniform answer to a resend, whatever the account's state (#113). */
export const RESEND_TOAST =
  'If this account still needs verifying, an email is on its way.';

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="text-foreground-secondary mt-0.5 text-[13px]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {children}
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-foreground-secondary text-[13px]">{label}</dt>
      <dd className="text-foreground mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}

const DASH = '—';

const UserDetailContent = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission } = usePermissions();
  const { selectedUser, loading, error } = useSelector(
    (state: RootState) => state.user
  );
  const viewerId = useSelector((state: RootState) => state.auth.user?.id);
  const allRoles = useSelector((state: RootState) => state.role.allRoles);
  const roleGroups = useSelector(
    (state: RootState) => state.roleGroup.roleGroups
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The dialog's copy stays while it animates closed.
  const [deleteCopy, setDeleteCopy] = useState<DeleteCopy>(NO_DELETE_COPY);
  const [resending, setResending] = useState(false);

  const canUpdate = hasPermission('user.update');
  const canDelete = hasPermission('user.delete');
  const canReadRoles = hasPermission('role.read');
  const canReadRoleGroups = hasPermission('role_group.read');

  useEffect(() => {
    if (userId) dispatch(fetchUserById(userId));
  }, [dispatch, userId]);

  // What each held role grants comes from the roles catalog (role.read);
  // its group's name needs role_group.read.
  useEffect(() => {
    if (canReadRoles) dispatch(fetchAllRoles());
  }, [dispatch, canReadRoles]);
  useEffect(() => {
    if (canReadRoleGroups) dispatch(fetchRoleGroups({ page: 1, size: 100 }));
  }, [dispatch, canReadRoleGroups]);

  // A user left over from another page is not this one.
  const user = selectedUser?.id === userId ? selectedUser : null;
  usePageCrumb(user ? fullName(user) : null);

  const groupNames = useMemo(() => groupNameMap(roleGroups), [roleGroups]);
  const roles = useMemo(
    () => heldRoleSummaries(user?.roles, allRoles, groupNames),
    [user?.roles, allRoles, groupNames]
  );

  if (!user) {
    if (loading || (!error && userId)) {
      return <DetailSkeleton label="Loading user" sections={4} />;
    }
    return (
      <div className="rounded-xl border">
        <EmptyState
          icon={CircleAlert}
          title="This user didn’t load"
          description={error ?? undefined}
          action={{ label: 'Back to users', href: '/dashboard/users' }}
        />
      </div>
    );
  }

  const name = fullName(user);
  const holdsRoles = (user.roles ?? []).length > 0;
  // A role holder can only be deleted once their roles are removed on the
  // edit page, which needs user.update, and whose Roles field needs
  // role.read to list them. Without both the viewer can't act, so no Delete.
  // The API never lets anyone delete themselves.
  const canRemoveRoles = canUpdate && canReadRoles;
  const showDelete =
    canDelete && user.id !== viewerId && (!holdsRoles || canRemoveRoles);

  const openDelete = () => {
    setDeleteCopy(deleteCopyFor(user));
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteCopy.holdsRoles) {
      navigate(`/dashboard/users/${user.id}/edit`);
      return;
    }
    try {
      await dispatch(deleteUser(user.id)).unwrap();
    } catch (failure: unknown) {
      const message =
        typeof failure === 'string' && failure
          ? failure
          : 'Failed to delete user';
      toast.error(message);
      // The toast reports it; the page's error state is for load failures.
      dispatch(clearUserErrors());
      throw failure;
    }
    toast.success('User deleted');
    navigate('/dashboard/users');
  };

  const resend = async () => {
    setResending(true);
    try {
      // The public resend endpoint answers the same way for every account
      // state, so the toast does too and never reveals which one this is.
      await AuthService.resendVerificationEmail(user.email);
      toast.success(RESEND_TOAST);
    } catch {
      toast.error('Couldn’t send the email. Try again.');
    } finally {
      setResending(false);
    }
  };

  const menuActions: RowAction[] = showDelete
    ? [{ label: 'Delete user', destructive: true, onSelect: openDelete }]
    : [];

  const age = passwordAge(user.last_changed_password_date, new Date());
  const lockedAt = formatUtcDateTime(user.locked_until);
  const failed = user.number_of_failed_attempts ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          to="/dashboard/users"
          className="text-foreground-secondary hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px] font-medium"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Users
        </Link>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="[&>span]:size-14 [&>span]:text-lg">
              <UserAvatar user={user} size="md" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-foreground text-2xl leading-8 font-semibold">
                  {name}
                </h1>
                <UserStatusBadges user={user} />
              </div>
              <p className="text-foreground-secondary truncate text-sm">
                {user.email}
              </p>
            </div>
          </div>
          {canUpdate || menuActions.length > 0 ? (
            <div className="flex shrink-0 items-center gap-2">
              {canUpdate ? (
                <Button variant="outline" asChild>
                  <Link to={`/dashboard/users/${user.id}/edit`}>
                    <Pencil aria-hidden="true" />
                    Edit user
                  </Link>
                </Button>
              ) : null}
              <span className="[&_button]:border-input [&_button]:border">
                <RowActionsMenu
                  label={`More actions for ${name}`}
                  actions={menuActions}
                />
              </span>
            </div>
          ) : null}
        </header>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Basic information">
            <Facts>
              <Fact label="First name">{user.first_name || DASH}</Fact>
              <Fact label="Last name">{user.last_name || DASH}</Fact>
              <Fact label="Email">{user.email}</Fact>
              <Fact label="Phone">{user.contact_phone || DASH}</Fact>
              <Fact label="Created">{formatDay(user.created_at)}</Fact>
              <Fact label="Last updated">{formatDay(user.updated_at)}</Fact>
            </Facts>
          </Panel>

          <Panel title="Password and security">
            <Facts>
              <Fact label="Last changed">
                {formatDay(user.last_changed_password_date)}
              </Fact>
              <Fact label="Expires">{formatDay(user.password_expires_at)}</Fact>
              <Fact label="Password age">{age ?? DASH}</Fact>
              <Fact label="Change required at next sign-in">
                {user.needs_to_change_password ? 'Yes' : 'No'}
              </Fact>
              {/* The users API sends no sign-in time yet, as on the list. */}
              <Fact label="Last sign-in">{DASH}</Fact>
            </Facts>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title="Account status"
            action={
              !user.verified ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void resend()}
                  disabled={resending}
                  aria-busy={resending || undefined}
                >
                  <Mail aria-hidden="true" />
                  Resend verification email
                </Button>
              ) : undefined
            }
          >
            {user.is_locked ? (
              <div
                className="bg-status-danger text-status-danger-foreground flex gap-2.5 rounded-lg px-3.5 py-3 text-sm"
                role="note"
              >
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {lockedAt ? `Locked until ${lockedAt}` : 'Locked'}
                  </p>
                  <p>
                    After {failed} failed sign-in{' '}
                    {failed === 1 ? 'attempt' : 'attempts'}.
                  </p>
                </div>
              </div>
            ) : null}
            {!user.verified ? (
              <p className="text-foreground-secondary text-sm">
                {callName(user)} hasn’t confirmed their email address yet, so
                they can’t sign in.
              </p>
            ) : null}
            <Facts>
              <Fact label="Failed sign-in attempts">{failed}</Fact>
              <Fact label="Email">
                <StatusBadge status={user.verified ? 'verified' : 'pending'} />
              </Fact>
              <Fact label="Account">
                <StatusBadge status={user.is_active ? 'active' : 'disabled'} />
              </Fact>
              <Fact label="Superuser">{user.is_superuser ? 'Yes' : 'No'}</Fact>
            </Facts>
          </Panel>

          <RolesPanel roles={roles} canReadRoles={canReadRoles} />
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={deleteCopy.title}
        description={deleteCopy.description}
        confirmLabel={deleteCopy.confirmLabel}
        destructive={!deleteCopy.holdsRoles}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

function RolesPanel({
  roles,
  canReadRoles,
}: {
  roles: ReturnType<typeof heldRoleSummaries>;
  canReadRoles: boolean;
}) {
  return (
    <Panel title="Roles" description="Access comes from these roles.">
      {roles.length === 0 ? (
        <p className="text-foreground-secondary text-sm">
          No roles. This person can sign in but has no access.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {roles.map((role) => {
            const line = roleGrantLine(role);
            return (
              <li key={role.id} aria-label={role.name}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="bg-sidebar-accent text-sidebar-accent-foreground inline-flex h-[22px] items-center rounded-md px-2 text-xs font-medium">
                    {role.name}
                  </span>
                  {line ? (
                    <span className="text-foreground-secondary text-[13px]">
                      {line}
                    </span>
                  ) : null}
                  {canReadRoles ? (
                    <Link
                      to={`/dashboard/roles/${role.id}`}
                      className="text-primary ml-auto text-[13px] font-medium hover:underline"
                      aria-label={`View role ${role.name}`}
                    >
                      View role
                    </Link>
                  ) : null}
                </div>
                {role.sections.length > 0 ? (
                  <div className="mt-2">
                    {role.sections.map((section) => (
                      <div
                        key={section.name}
                        role="group"
                        aria-label={`${role.name}: ${section.name}`}
                        className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b py-2.5 last:border-b-0"
                      >
                        <span
                          aria-hidden="true"
                          className="text-foreground-secondary text-[13px]"
                        >
                          {section.name}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {section.codes.map((code) => (
                            <span
                              key={code}
                              className="text-foreground-secondary inline-flex h-[22px] items-center rounded-md border px-2 font-mono text-xs font-medium"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export default UserDetailContent;
