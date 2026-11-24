import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearCurrentRoleGroup,
  createRoleGroup,
  fetchRoleGroupById,
  fetchRoleGroups,
  updateRoleGroup,
} from '@/store/slices/roleGroupSlice';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DetailSkeleton } from '@/components/common/Skeletons';
import { GroupForm, type GroupFormValues } from '../groups/GroupForm';
import { subtreeIds } from '../groups/treeModel';
import { roleGroupsToFlat } from './roleGroupTree';

const LIST = '/dashboard/role-groups';

function message(err: unknown, fallback: string) {
  return typeof err === 'string' && err ? err : fallback;
}

/** Create or edit a role group: name and parent group. */
const RoleGroupFormContent = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const roleGroups = useAppSelector((state) => state.roleGroup.roleGroups);
  const current = useAppSelector((state) => state.roleGroup.currentRoleGroup);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The id whose fresh copy has arrived. A copy left in the store by the
  // detail page may be stale, so the form waits for this one.
  const [fetchedId, setFetchedId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchRoleGroups({ page: 1, size: 100 })).finally(() =>
      setGroupsLoaded(true)
    );
    if (groupId) {
      dispatch(fetchRoleGroupById(groupId))
        .unwrap()
        .then(() => setFetchedId(groupId))
        .catch((err: unknown) =>
          setLoadError(message(err, 'The role group couldn’t be loaded.'))
        );
    }
    return () => {
      dispatch(clearCurrentRoleGroup());
    };
  }, [dispatch, groupId]);

  const parentOptions = useMemo(() => {
    const flat = roleGroupsToFlat(roleGroups, null);
    const excluded = groupId ? subtreeIds(flat, groupId) : new Set<string>();
    return flat
      .filter((group) => !excluded.has(group.id))
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roleGroups, groupId]);

  const save = async ({ name, parentId }: GroupFormValues) => {
    try {
      if (groupId) {
        await dispatch(
          updateRoleGroup({
            groupId,
            roleGroupData: { name, parent_id: parentId },
          })
        ).unwrap();
        toast.success(`Role group ‘${name}’ saved`);
      } else {
        await dispatch(createRoleGroup({ name, parent_id: parentId })).unwrap();
        toast.success(`Role group ‘${name}’ created`);
      }
    } catch (err) {
      toast.error(message(err, 'Couldn’t save the role group'));
      throw err;
    }
    navigate(LIST);
  };

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Couldn’t load the role group</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  const editing = Boolean(groupId);
  const ready =
    groupsLoaded &&
    (!editing || (fetchedId === groupId && current?.id === groupId));
  if (!ready) {
    return <DetailSkeleton label="Loading role group" sections={1} />;
  }

  return (
    <GroupForm
      key={current?.id ?? 'new'}
      title={editing ? 'Edit role group' : 'Create role group'}
      description="Groups keep related roles together."
      backHref={LIST}
      backLabel="Role groups"
      nameHelp="Shown in lists and on each role in this group."
      parentOptions={parentOptions}
      initialValues={
        editing && current
          ? { name: current.name, parentId: current.parent_id ?? null }
          : undefined
      }
      submitLabel={editing ? 'Save changes' : 'Create role group'}
      onSubmit={save}
    />
  );
};

export default RoleGroupFormContent;
