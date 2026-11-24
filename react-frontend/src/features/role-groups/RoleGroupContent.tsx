import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Plus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  deleteRoleGroup,
  fetchRoleGroups,
} from '@/store/slices/roleGroupSlice';
import { fetchRoles } from '@/store/slices/roleSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableSkeleton } from '@/components/common/Skeletons';
import type { RowAction } from '@/components/common/RowActionsMenu';
import { GroupTree } from '../groups/GroupTree';
import { buildGroupTree, type GroupNode } from '../groups/treeModel';
import { roleGroupsToFlat } from './roleGroupTree';

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
  const roles = useAppSelector((state) => state.role.roles);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<GroupNode | null>(null);

  useEffect(() => {
    dispatch(fetchRoleGroups(ALL))
      .unwrap()
      .then(() => setLoadError(null))
      .catch((err: unknown) =>
        setLoadError(typeof err === 'string' ? err : 'Please try again.')
      )
      .finally(() => setLoaded(true));
    if (canReadRoles) {
      void dispatch(fetchRoles(ALL));
    }
  }, [dispatch, canReadRoles]);

  const tree = useMemo(
    () =>
      buildGroupTree(roleGroupsToFlat(roleGroups, canReadRoles ? roles : null)),
    [roleGroups, roles, canReadRoles]
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
        onSelect: () => setToDelete(group),
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
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Couldn’t load role groups</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {!loaded && roleGroups.length === 0 ? (
        <TableSkeleton label="Loading role groups" columns={5} />
      ) : (
        <GroupTree
          groups={tree}
          groupsLabel="role groups"
          memberNoun={{ one: 'role', other: 'roles' }}
          memberIcon={Shield}
          actionsFor={actionsFor}
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
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToDelete(null);
          }
        }}
        title={`Delete role group ‘${toDelete?.name ?? ''}’?`}
        description="The group must have no child groups or roles. This can’t be undone."
        confirmLabel="Delete role group"
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default RoleGroupContent;
