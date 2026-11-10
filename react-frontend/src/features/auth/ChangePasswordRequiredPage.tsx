import { Navigate, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logoutUser } from '../../store/slices/authSlice';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * `/change-password-required`: standalone page for a user holding a temporary password. The API refuses
 * every other route for them, so this page offers only the change and a logout.
 */
const ChangePasswordRequiredPage = () => {
  const { isAuthenticated, user, isLoading } = useAppSelector(
    (state) => state.auth
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  if (isLoading && !user) {
    return null;
  }
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.needs_to_change_password) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Change your password</CardTitle>
        <CardDescription>
          An administrator set a temporary password for your account. Choose a
          new password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChangePasswordForm
          onSuccess={() => navigate('/dashboard', { replace: true })}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </CardContent>
    </Card>
  );
};

export default ChangePasswordRequiredPage;
