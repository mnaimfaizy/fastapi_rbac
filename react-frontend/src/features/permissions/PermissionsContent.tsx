import React from 'react';
import { useNavigate } from 'react-router-dom';
import PermissionsDataTable from './PermissionsDataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';

const PermissionsContent: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreatePermission = hasPermission('permission.create');

  const handleCreatePermission = () => {
    navigate('/dashboard/permissions/new');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Permissions</CardTitle>
        {canCreatePermission && (
          <Button onClick={handleCreatePermission}>Create Permission</Button>
        )}
      </CardHeader>
      <CardContent>
        <PermissionsDataTable />
      </CardContent>
    </Card>
  );
};

export default PermissionsContent;
