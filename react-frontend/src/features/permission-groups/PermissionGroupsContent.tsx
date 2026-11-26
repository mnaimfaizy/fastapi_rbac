import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, Plus } from 'lucide-react';
import { PermissionKey } from '@/lib/navigation';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  deletePermissionGroup,
  fetchPermissionGroups,
} from '@/store/slices/permissionGroupSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableSkeleton } from '@/components/common/Skeletons';
import type { RowAction } from '@/components/common/RowActionsMenu';
import { GroupTree } from '../groups/GroupTree';
import { buildGroupTree, type GroupNode } from '../groups/treeModel';
import { LoadError } from '../groups/LoadError';
import { permissionGroupsToFlat } from './permissionGroupTree';

/** Every permission group, up to the API's page limit, in one request. */
const ALL = { page: 1, pageSize: 100 };

const PermissionGroupsContent = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('permission_group.create');
  const canUpdate = hasPermission('permission_group.update');
  const canDelete = hasPermission('permission_group.delete');

  const permissionGroups = useAppSelector(
    (state) => state.permissionGroup.permissionGroups
  );
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The group stays set while the dialog fades out, so its title keeps the
  // name; only `confirming` closes it.
  const [toDelete, setToDelete] = useState<GroupNode | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    dispatch(fetchPermissionGroups(ALL))
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

  const retry = () => {
    setLoaded(false);
    setLoadError(null);
    setAttempt((n) => n + 1);
  };

  const tree = useMemo(
    () => buildGroupTree(permissionGroupsToFlat(permissionGroups)),
    [permissionGroups]
  );

  const actionsFor = (group: GroupNode): RowAction[] => {
    const actions: RowAction[] = [
      { label: 'View details', onSelect: () => navigate(group.href) },
    ];
    if (canUpdate) {
      actions.push({
        label: 'Edit',
        onSelect: () =>
          navigate(`/dashboard/permission-groups/edit/${group.id}`),
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
      await dispatch(deletePermissionGroup(toDelete.id)).unwrap();
    } catch (err) {
      toast.error(
        typeof err === 'string' ? err : 'Couldn’t delete the permission group'
      );
      throw err;
    }
    toast.success(`Permission group ‘${toDelete.name}’ deleted`);
    void dispatch(fetchPermissionGroups(ALL));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Permission groups"
        description="Permissions are grouped by the thing they act on."
        action={
          canCreate ? (
            <Button asChild>
              <Link to="/dashboard/permission-groups/new">
                <Plus aria-hidden="true" />
                Create permission group
              </Link>
            </Button>
          ) : undefined
        }
      />

      {loadError ? (
        <LoadError
          title="Couldn’t load permission groups"
          message={loadError}
          onRetry={retry}
        />
      ) : null}

      {loadError && permissionGroups.length === 0 ? null : !loaded ? (
        <TableSkeleton label="Loading permission groups" columns={5} />
      ) : (
        <GroupTree
          groups={tree}
          groupsLabel="permission groups"
          memberNoun={{ one: 'permission', other: 'permissions' }}
          groupIcon={Layers}
          memberIcon={PermissionKey}
          monoMembers
          membersWidth={181}
          actionsFor={actionsFor}
          emptyState={
            canCreate
              ? {
                  title: 'Create your first permission group',
                  description: 'Group permissions by the thing they act on.',
                  action: {
                    label: 'Create permission group',
                    href: '/dashboard/permission-groups/new',
                  },
                }
              : {
                  title: 'No permission groups yet',
                  description:
                    'An admin can create permission groups. They’ll show up here.',
                }
          }
        />
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete permission group ‘${toDelete?.name ?? ''}’?`}
        description="The group must have no child groups or permissions. This can’t be undone."
        confirmLabel="Delete permission group"
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default PermissionGroupsContent;
