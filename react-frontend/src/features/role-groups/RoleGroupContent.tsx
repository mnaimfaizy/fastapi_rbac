import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/redux';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RoleGroupList from './RoleGroupList';
import { fetchRoleGroups } from '@/store/slices/roleGroupSlice';

const RoleGroupContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { hasPermission } = usePermissions();

  const canCreateRoleGroups = hasPermission('role_group.create');
  const canReadRoleGroups = hasPermission('role_group.read');

  // Refetch role groups data whenever we navigate to this component
  useEffect(() => {
    if (canReadRoleGroups) {
      dispatch(fetchRoleGroups({}));
    }
  }, [dispatch, location.pathname, canReadRoleGroups]);

  const handleCreateRoleGroup = () => {
    navigate('/dashboard/role-groups/new');
  };

  if (!canReadRoleGroups) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-muted-foreground">
          You do not have permission to view role groups.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Role Groups</CardTitle>
        {canCreateRoleGroups && (
          <Button onClick={handleCreateRoleGroup}>Create Role Group</Button>
        )}
      </CardHeader>
      <CardContent>
        <RoleGroupList />
      </CardContent>
    </Card>
  );
};

export default RoleGroupContent;
