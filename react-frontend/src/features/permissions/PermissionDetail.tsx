import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchPermissionById,
  deletePermission,
} from '../../store/slices/permissionSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Trash2, ArrowLeft } from 'lucide-react';
import { RootState } from '../../store';
import { toast } from 'sonner';

export default function PermissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { hasPermission } = usePermissions();
  const canDeletePermission = hasPermission('permission.delete');

  const { currentPermission, isLoading } = useAppSelector(
    (state: RootState) => state.permission
  );

  // Get permission group name directly from the currentPermission object
  const permissionGroupName = currentPermission?.group?.name || 'N/A';

  useEffect(() => {
    if (id) {
      dispatch(fetchPermissionById(id));
    }
  }, [dispatch, id]);

  const handleDelete = async () => {
    if (!id) return;
    if (!canDeletePermission) {
      toast.error("You don't have permission to delete this permission.");
      return;
    }

    if (window.confirm('Are you sure you want to delete this permission?')) {
      try {
        await dispatch(deletePermission(id)).unwrap();
        navigate('/dashboard/permissions');
      } catch (error) {
        console.error('Error deleting permission:', error);
      }
    }
  };

  const handleBack = () => {
    navigate('/dashboard/permissions');
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading permission details...</div>;
  }

  if (!currentPermission) {
    return (
      <div className="text-center p-4">
        <h2 className="text-lg font-semibold">Permission not found</h2>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Permissions
        </Button>
      </div>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <Button
          variant="ghost"
          className="mb-2 p-0 h-8 w-8"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CardTitle className="text-2xl">{currentPermission.name}</CardTitle>
        {currentPermission.description && (
          <CardDescription>{currentPermission.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium text-sm text-gray-500">Permission ID</h3>
            <p className="truncate">{currentPermission.id}</p>
          </div>
          <div>
            <h3 className="font-medium text-sm text-gray-500">
              Permission Group
            </h3>
            <p>{permissionGroupName}</p>
          </div>
          <div>
            <h3 className="font-medium text-sm text-gray-500">Created At</h3>
            <p>{new Date(currentPermission.created_at).toLocaleString()}</p>
          </div>
          <div>
            <h3 className="font-medium text-sm text-gray-500">Updated At</h3>
            <p>{new Date(currentPermission.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 border-t p-4">
        {canDeletePermission && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="flex items-center"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
