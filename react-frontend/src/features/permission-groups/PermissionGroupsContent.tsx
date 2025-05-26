import React from 'react';
import { useNavigate } from 'react-router-dom';
import PermissionGroupsDataTable from './PermissionGroupsDataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';

const PermissionGroupsContent: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreatePermissionGroup = hasPermission('permission_group.create');

  const handleCreatePermissionGroup = () => {
    navigate('/dashboard/permission-groups/new');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Permission Groups</CardTitle>
        {canCreatePermissionGroup && (
          <Button onClick={handleCreatePermissionGroup}>
            Create Permission Group
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <PermissionGroupsDataTable />
      </CardContent>
    </Card>
  );
};

export default PermissionGroupsContent;
