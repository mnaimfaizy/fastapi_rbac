import React from 'react';
import { useNavigate } from 'react-router-dom';
import PermissionsDataTable from './PermissionsDataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PermissionsContent: React.FC = () => {
  const navigate = useNavigate();

  const handleCreatePermission = () => {
    navigate('/dashboard/permissions/new');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Permissions</CardTitle>
        <Button onClick={handleCreatePermission}>Create Permission</Button>
      </CardHeader>
      <CardContent>
        <PermissionsDataTable />
      </CardContent>
    </Card>
  );
};

export default PermissionsContent;
