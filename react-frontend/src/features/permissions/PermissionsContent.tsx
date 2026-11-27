import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader } from '@/components/common/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import PermissionsDataTable from './PermissionsDataTable';

const PermissionsContent = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('permission.read');
  const canCreate = hasPermission('permission.create');

  if (!canRead) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view permissions.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Permissions"
        description="The individual actions a role can grant."
        action={
          canCreate ? (
            <Button
              type="button"
              onClick={() => navigate('/dashboard/permissions/new')}
            >
              Create permission
            </Button>
          ) : undefined
        }
      />
      <PermissionsDataTable />
    </div>
  );
};

export default PermissionsContent;
