import React from 'react';
import { useNavigate } from 'react-router-dom';
import RoleList from './RoleList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';
import { Plus } from 'lucide-react';

// Renamed from RolesPage
const RolesContent: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const handleCreateRole = () => {
    navigate('/dashboard/roles/new'); // Updated navigation path
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Roles</CardTitle>
        {hasPermission('role.create') && (
          <Button
            onClick={handleCreateRole}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <RoleList />
      </CardContent>
    </Card>
  );
};

export default RolesContent;
