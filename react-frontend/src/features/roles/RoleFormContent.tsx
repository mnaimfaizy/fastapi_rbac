import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import {
  createRole,
  fetchRoleById,
  updateRole,
  clearRoleError,
  setCurrentRole,
} from '../../store/slices/roleSlice';
import { fetchRoleGroups } from '../../store/slices/roleGroupSlice';
import RoleForm, { RoleFormData } from './RoleForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const RoleFormContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { roleId } = useParams<{ roleId?: string }>();
  const { currentRole, loading, error } = useSelector(
    (state: RootState) => state.role
  );
  const { roleGroups } = useSelector((state: RootState) => state.roleGroup);
  const isEditMode = Boolean(roleId);

  useEffect(() => {
    // Fetch role groups for the dropdown
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

  const handleSubmit = async (data: RoleFormData) => {
    try {
      if (isEditMode && roleId) {
        await dispatch(updateRole({ roleId, roleData: data })).unwrap();
        toast('Role updated successfully.');
      } else {
        await dispatch(createRole(data)).unwrap();
        toast('Role created successfully.');
      }
      navigate('/dashboard/roles');
    } catch (err: any) {
      const actionType = isEditMode ? 'update' : 'create';
      toast.error(err || `Failed to ${actionType} role.`);
      console.error(`Failed to ${actionType} role:`, err);
    }
  };

  if (isEditMode && loading && !currentRole) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-1/4" />
        </CardContent>
      </Card>
    );
  }

  if (isEditMode && error && !currentRole) {
    return <div className="text-red-500">Error loading role: {error}</div>;
  }

  if (isEditMode && !currentRole) {
    return <div>Role not found.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? `Edit Role: ${currentRole?.name}` : 'Create New Role'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RoleForm
          onSubmit={handleSubmit}
          initialData={isEditMode ? currentRole : null}
          isLoading={loading}
          roleGroups={roleGroups || []}
        />
        {error && <p className="text-red-500 mt-4">Error: {error}</p>}
      </CardContent>
    </Card>
  );
};

export default RoleFormContent;
