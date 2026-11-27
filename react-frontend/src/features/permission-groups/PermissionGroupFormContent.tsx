import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearCurrentPermissionGroup,
  createPermissionGroup,
  fetchPermissionGroupById,
  fetchPermissionGroups,
  updatePermissionGroup,
} from '@/store/slices/permissionGroupSlice';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DetailSkeleton } from '@/components/common/Skeletons';
import { GroupForm, type GroupFormValues } from '../groups/GroupForm';
import { subtreeIds } from '../groups/treeModel';
import { permissionGroupsToFlat } from './permissionGroupTree';

const LIST = '/dashboard/permission-groups';

function message(err: unknown, fallback: string) {
  return typeof err === 'string' && err ? err : fallback;
}

/** Create or edit a permission group: name, parent group and description. */
export default function PermissionGroupFormContent() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const permissionGroups = useAppSelector(
    (state) => state.permissionGroup.permissionGroups
  );
  const current = useAppSelector(
    (state) => state.permissionGroup.currentPermissionGroup
  );
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The id whose fresh copy has arrived. A copy left in the store by the
  // detail page may be stale, so the form waits for this one.
  const [fetchedId, setFetchedId] = useState<string | null>(null);

  useEffect(() => {
    // Without the group list the parent select would be wrong, so a
    // failed load blocks the form.
    dispatch(fetchPermissionGroups({ page: 1, pageSize: 100 }))
      .unwrap()
      .then(() => setGroupsLoaded(true))
      .catch((err: unknown) =>
        setLoadError(message(err, 'The permission groups couldn’t be loaded.'))
      );
    if (groupId) {
      dispatch(fetchPermissionGroupById(groupId))
        .unwrap()
        .then(() => setFetchedId(groupId))
        .catch((err: unknown) =>
          setLoadError(message(err, 'The permission group couldn’t be loaded.'))
        );
    }
    return () => {
      dispatch(clearCurrentPermissionGroup());
    };
  }, [dispatch, groupId]);

  const parentOptions = useMemo(() => {
    const flat = permissionGroupsToFlat(permissionGroups);
    const excluded = groupId ? subtreeIds(flat, groupId) : new Set<string>();
    return flat
      .filter((group) => !excluded.has(group.id))
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [permissionGroups, groupId]);

  const save = async ({ name, parentId, description }: GroupFormValues) => {
    // An empty field means no description, which also clears a saved one.
    const groupData = {
      name,
      permission_group_id: parentId,
      description: description || null,
    };
    try {
      if (groupId) {
        await dispatch(
          updatePermissionGroup({ id: groupId, groupData })
        ).unwrap();
        toast.success(`Permission group ‘${name}’ saved`);
      } else {
        await dispatch(createPermissionGroup(groupData)).unwrap();
        toast.success(`Permission group ‘${name}’ created`);
      }
    } catch (err) {
      toast.error(message(err, 'Couldn’t save the permission group'));
      throw err;
    }
    navigate(LIST);
  };

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Couldn’t load the permission group</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  const editing = Boolean(groupId);
  const ready =
    groupsLoaded &&
    (!editing || (fetchedId === groupId && current?.id === groupId));
  if (!ready) {
    return <DetailSkeleton label="Loading permission group" sections={1} />;
  }

  return (
    <GroupForm
      key={current?.id ?? 'new'}
      title={editing ? 'Edit permission group' : 'Create permission group'}
      description="Group permissions by the thing they act on."
      backHref={LIST}
      backLabel="Permission groups"
      nameHelp="Shown in lists and on each permission in this group."
      parentOptions={parentOptions}
      initialValues={
        editing && current
          ? {
              name: current.name,
              parentId: current.permission_group_id ?? null,
              description: current.description ?? '',
            }
          : undefined
      }
      submitLabel={editing ? 'Save changes' : 'Create permission group'}
      onSubmit={save}
    />
  );
}
