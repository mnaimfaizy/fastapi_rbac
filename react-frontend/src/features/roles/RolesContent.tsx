import React from 'react';
import { Link } from 'react-router-dom';
import RoleList from './RoleList';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { Plus } from 'lucide-react';

const RolesContent: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('role.read');
  const canCreate = hasPermission('role.create');
  const canUpdate = hasPermission('role.update');
  const canDelete = hasPermission('role.delete');
  const readOnly = canRead && !canCreate && !canUpdate && !canDelete;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
            {readOnly && (
              <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Read only
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Each role bundles permissions. Users get access through their roles.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/dashboard/roles/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create role
            </Link>
          </Button>
        )}
      </div>
      <RoleList />
    </div>
  );
};

export default RolesContent;
