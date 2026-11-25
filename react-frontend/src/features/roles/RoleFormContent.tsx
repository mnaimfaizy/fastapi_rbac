import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppDispatch, RootState } from '../../store';
import {
  assignPermissionsToRole,
  createRole,
  fetchRoleById,
  removePermissionsFromRole,
  updateRole,
  clearRoleError,
  setCurrentRole,
} from '../../store/slices/roleSlice';
import { fetchRoleGroups } from '../../store/slices/roleGroupSlice';
import RoleForm, { RoleEditorSubmit } from './RoleForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeApiError } from '@/lib/apiError';
import { usePageCrumb } from '@/components/layout/pageCrumb';
import { Role } from '@/models/role';

function holderLine(count: number): string {
  if (count === 1) {
    return '1 user holds this role. Changes apply to them as soon as you save.';
  }
  if (count > 1) {
    return `${count} users hold this role. Changes apply to them as soon as you save.`;
  }
  return 'No users hold this role. Changes apply as soon as you save.';
}

const RoleFormContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { roleId } = useParams<{ roleId?: string }>();
  const { currentRole, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const { roleGroups } = useSelector((state: RootState) => state.roleGroup);
  const isEditMode = Boolean(roleId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  usePageCrumb(
    isEditMode
      ? currentRole?.id === roleId
        ? currentRole?.name
        : null
      : 'Create role'
  );

  useEffect(() => {
    dispatch(fetchRoleGroups({ page: 1, size: 100 }));

    if (isEditMode && roleId) {
      dispatch(fetchRoleById(roleId));
    } else {
      dispatch(setCurrentRole(null));
    }

    return () => {
      dispatch(clearRoleError());
      dispatch(setCurrentRole(null));
    };
  }, [dispatch, roleId, isEditMode]);

  const handleCancel = () => {
    navigate('/dashboard/roles');
  };

  const handleSubmit = async (data: RoleEditorSubmit): Promise<Role | void> => {
    setSubmitError(null);
    let saved: Role | undefined;
    try {
      if (isEditMode && roleId && currentRole) {
        const nameChanged = data.name !== currentRole.name;
        const descriptionChanged =
          (data.description ?? '') !== (currentRole.description ?? '');
        const groupChanged =
          (data.role_group_id ?? '') !== (currentRole.role_group_id ?? '');
        if (nameChanged || descriptionChanged || groupChanged) {
          saved = await dispatch(
            updateRole({
              roleId,
              roleData: {
                name: data.name,
                description: data.description ?? '',
                ...(data.role_group_id
                  ? { role_group_id: data.role_group_id }
                  : {}),
              },
            })
          ).unwrap();
        }
        if (data.addedPermissionIds.length > 0) {
          saved = await dispatch(
            assignPermissionsToRole({
              roleId,
              permissionIds: data.addedPermissionIds,
            })
          ).unwrap();
        }
        if (data.removedPermissionIds.length > 0) {
          saved = await dispatch(
            removePermissionsFromRole({
              roleId,
              permissionIds: data.removedPermissionIds,
            })
          ).unwrap();
        }
        toast.success('Role updated successfully.');
      } else {
        await dispatch(
          createRole({
            name: data.name,
            ...(data.description ? { description: data.description } : {}),
            ...(data.role_group_id
              ? { role_group_id: data.role_group_id }
              : {}),
            permission_ids: data.selectedPermissionIds,
          })
        ).unwrap();
        toast.success('Role created successfully.');
      }
      navigate('/dashboard/roles');
      return saved;
    } catch (err: unknown) {
      const message = normalizeApiError(
        err,
        `Failed to ${isEditMode ? 'update' : 'create'} role.`
      ).message;
      setSubmitError(message);
      toast.error(message);
      return saved;
    }
  };

  if (isEditMode && loading && !currentRole) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isEditMode && error && !currentRole && !submitError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Error loading role: {error}</AlertDescription>
      </Alert>
    );
  }

  if (isEditMode && !currentRole) {
    return <div>Role not found.</div>;
  }

  const holders = currentRole?.user_count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard/roles"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Roles
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isEditMode ? `Edit role ‘${currentRole?.name}’` : 'Create role'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isEditMode
            ? holderLine(holders)
            : 'Name the role, then choose what it can do.'}
        </p>
      </div>
      {submitError ? (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}
      <RoleForm
        mode={isEditMode ? 'edit' : 'create'}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialData={isEditMode ? currentRole : null}
        isLoading={loading}
        roleGroups={roleGroups || []}
      />
    </div>
  );
};

export default RoleFormContent;
