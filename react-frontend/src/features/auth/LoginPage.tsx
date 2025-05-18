import { Navigate, useLocation } from 'react-router-dom';
import { UserLock } from 'lucide-react';

import { useAppSelector } from '../../store/hooks';
import { LoginForm } from '../../components/auth/LoginForm';

export default function LoginPage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const location = useLocation();

  // Get the page user was trying to access before being redirected to login
  const from = location.state?.from?.pathname || '/dashboard';

  // If user is already authenticated, redirect
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // This component now only renders the content for the left panel of AuthLayout
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <div className="flex w-full max-w-xs justify-center gap-2 md:justify-start">
        <a href="#" className="flex items-center gap-2 font-medium">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UserLock className="size-4" />
          </div>
          FastApi RBAC
        </a>
      </div>
      <div className="w-full max-w-xs">
        <LoginForm />
      </div>
    </div>
  );
}
