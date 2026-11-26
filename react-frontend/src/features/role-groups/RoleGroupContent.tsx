import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderTree, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  deleteRoleGroup,
  fetchRoleGroups,
} from '@/store/slices/roleGroupSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableSkeleton } from '@/components/common/Skeletons';
import type { RowAction } from '@/components/common/RowActionsMenu';
import { GroupTree } from '../groups/GroupTree';
import { buildGroupTree, type GroupNode } from '../groups/treeModel';
import { LoadError } from '../groups/LoadError';
import {
  fetchAllRoles,
  roleGroupsToFlat,
  type RoleWithCount,
} from './roleGroupTree';

/** Every role group, with up to the API's page limit in one request. */
const ALL = { page: 1, size: 100 };

const RoleGroupContent = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('role_group.create');
  const canUpdate = hasPermission('role_group.update');
  const canDelete = hasPermission('role_group.delete');
  const canReadRoles = hasPermission('role.read');

  const roleGroups = useAppSelector((state) => state.roleGroup.roleGroups);
  // Every role, or null while unknown (no role.read, or the load failed),
  // so the chips leave out a role count rather than show a wrong one.
  const [roles, setRoles] = useState<RoleWithCount[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The group stays set while the dialog fades out, so its title keeps the
  // name; only `confirming` closes it.
  const [toDelete, setToDelete] = useState<GroupNode | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [rolesFailed, setRolesFailed] = useState(false);
  const [rolesAttempt, setRolesAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    dispatch(fetchRoleGroups(ALL))
      .unwrap()
      .then(() => active && setLoadError(null))
      .catch(
        (err: unknown) =>
          active &&
          setLoadError(typeof err === 'string' ? err : 'Please try again.')
      )
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [dispatch, attempt]);

  // Roles load on their own, so a failure there leaves the tree usable and
  // says what is missing instead of showing every group as empty.
  useEffect(() => {
    if (!canReadRoles) {
      return;
    }
    let active = true;
    fetchAllRoles()
      .then((all) => {
        if (active) {
          setRoles(all);
          setRolesFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setRoles(null);
          setRolesFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [canReadRoles, rolesAttempt]);

  const retry = () => {
    setLoaded(false);
    setLoadError(null);
    setAttempt((n) => n + 1);
    if (rolesFailed) {
      retryRoles();
    }
  };

  function retryRoles() {
    setRolesFailed(false);
    setRolesAttempt((n) => n + 1);
  }

  const tree = useMemo(
    () => buildGroupTree(roleGroupsToFlat(roleGroups, roles)),
    [roleGroups, roles]
  );

  const actionsFor = (group: GroupNode): RowAction[] => {
    const actions: RowAction[] = [
      { label: 'View details', onSelect: () => navigate(group.href) },
    ];
    if (canUpdate) {
      actions.push({
        label: 'Edit',
        onSelect: () => navigate(`/dashboard/role-groups/edit/${group.id}`),
      });
    }
    if (canDelete) {
      actions.push({
        label: 'Delete',
        destructive: true,
        onSelect: () => {
          setToDelete(group);
          setConfirming(true);
        },
      });
    }
    return actions;
  };

  const confirmDelete = async () => {
    if (!toDelete) {
      return;
    }
    try {
      await dispatch(deleteRoleGroup(toDelete.id)).unwrap();
    } catch (err) {
      toast.error(
        typeof err === 'string' ? err : 'Couldn’t delete the role group'
      );
      throw err;
    }
    toast.success(`Role group ‘${toDelete.name}’ deleted`);
    void dispatch(fetchRoleGroups(ALL));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Role groups"
        description="Organise roles into groups. Groups can nest under a parent."
        action={
          canCreate ? (
            <Button asChild>
              <Link to="/dashboard/role-groups/new">
                <Plus aria-hidden="true" />
                Create role group
              </Link>
            </Button>
          ) : undefined
        }
      />

      {loadError ? (
        <LoadError
          title="Couldn’t load role groups"
          message={loadError}
          onRetry={retry}
        />
      ) : null}

      {rolesFailed && !loadError ? (
        <LoadError
          title="Couldn’t load roles"
          message="The groups are shown without their roles or role counts."
          onRetry={retryRoles}
        />
      ) : null}

      {loadError && roleGroups.length === 0 ? null : !loaded ? (
        <TableSkeleton label="Loading role groups" columns={5} />
      ) : (
        <GroupTree
          groups={tree}
          groupsLabel="role groups"
          memberNoun={{ one: 'role', other: 'roles' }}
          groupIcon={FolderTree}
          memberIcon={ShieldCheck}
          actionsFor={actionsFor}
          memberCounts={
            !canReadRoles || roles !== null
              ? 'ready'
              : rolesFailed
                ? 'unavailable'
                : 'loading'
          }
          emptyState={
            canCreate
              ? {
                  title: 'Create your first role group',
                  description:
                    'Groups keep related roles together as the list grows.',
                  action: {
                    label: 'Create role group',
                    href: '/dashboard/role-groups/new',
                  },
                }
              : {
                  title: 'No role groups yet',
                  description:
                    'An admin can create role groups. They’ll show up here.',
                }
          }
        />
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete role group ‘${toDelete?.name ?? ''}’?`}
        description="The group must have no child groups or roles. This can’t be undone."
        confirmLabel="Delete role group"
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default RoleGroupContent;
