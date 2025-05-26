import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchUserById, deleteUser } from '../../store/slices/userSlice';
import { usePermissions } from '@/hooks/usePermissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const UserDetailContent = () => {
  const { hasPermission } = usePermissions();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedUser, loading, error } = useSelector(
    (state: RootState) => state.user
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      dispatch(fetchUserById(userId));
    }
  }, [dispatch, userId]);

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userId) return;

    try {
      await dispatch(deleteUser(userId)).unwrap();
      toast.success('User deleted successfully');
      navigate('/dashboard/users');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' &&
              error &&
              'response' in error &&
              typeof error.response === 'object' &&
              error.response &&
              'data' in error.response &&
              typeof error.response.data === 'object' &&
              error.response.data &&
              'detail' in error.response.data
            ? String(error.response.data.detail)
            : 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading user details...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        Error: {error}
      </div>
    );
  }

  if (!selectedUser) {
    return <div className="p-4">User not found</div>;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Details</h1>
        <div className="flex space-x-2">
          <Link
            to="/dashboard/users"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to List
          </Link>
          {hasPermission('user.update') && (
            <Link
              to={`/dashboard/users/${userId}/edit`}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Edit User
            </Link>
          )}
          {hasPermission('user.delete') && (
            <button
              onClick={handleDeleteClick}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete User
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Full Name</span>
              <span>
                {selectedUser.first_name} {selectedUser.last_name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Email</span>
              <span>{selectedUser.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Phone</span>
              <span>{selectedUser.contact_phone || 'Not provided'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Created At</span>
              <span>
                {selectedUser.created_at
                  ? format(new Date(selectedUser.created_at), 'PPpp')
                  : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Last Updated</span>
              <span>
                {selectedUser.updated_at
                  ? format(new Date(selectedUser.updated_at), 'PPpp')
                  : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Account Status</span>
              <Badge
                className={`${
                  selectedUser.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {selectedUser.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Account Type</span>
              <Badge
                className={`${
                  selectedUser.is_superuser
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {selectedUser.is_superuser ? 'Administrator' : 'Regular User'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Verification Status</span>
              <Badge
                className={`${
                  selectedUser.verified
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {selectedUser.verified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Account Lock Status</span>
              <div className="flex flex-col items-end">
                <Badge
                  className={`${
                    selectedUser.is_locked
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {selectedUser.is_locked ? 'Locked' : 'Unlocked'}
                </Badge>
                {selectedUser.is_locked && selectedUser.locked_until && (
                  <span className="text-sm text-gray-500 mt-1">
                    Until {format(new Date(selectedUser.locked_until), 'PPpp')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Failed Login Attempts</span>
              <Badge
                className={`${
                  (selectedUser.number_of_failed_attempts || 0) > 0
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {selectedUser.number_of_failed_attempts || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Password & Security */}
        <Card>
          <CardHeader>
            <CardTitle>Password & Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Password Status</span>
              <Badge
                className={`${
                  selectedUser.needs_to_change_password
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {selectedUser.needs_to_change_password
                  ? 'Change Required'
                  : 'Up to Date'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Last Password Change</span>
              <span>
                {selectedUser.last_changed_password_date
                  ? format(
                      new Date(selectedUser.last_changed_password_date),
                      'PPpp'
                    )
                  : 'Never'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Account Expiry</span>
              <span>
                {selectedUser.expiry_date
                  ? format(new Date(selectedUser.expiry_date), 'PPpp')
                  : 'No expiry'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Roles & Permissions */}
        <Card>
          <CardHeader>
            <CardTitle>Roles & Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Assigned Roles:</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.roles && selectedUser.roles.length > 0 ? (
                    selectedUser.roles.map((role) => (
                      <Badge
                        key={role.id}
                        className="bg-blue-100 text-blue-800 hover:bg-blue-200"
                      >
                        {role.name}
                        {role.description && (
                          <span className="ml-1 text-blue-600">
                            ({role.description})
                          </span>
                        )}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-gray-500">No roles assigned</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be
              undone. All associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserDetailContent;
