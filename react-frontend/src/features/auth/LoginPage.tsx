import { Navigate, useLocation } from 'react-router-dom';
import { Info, UserLock } from 'lucide-react';

import { useAppSelector } from '../../store/hooks';
import { LoginForm } from '../../components/auth/LoginForm';
import { PageMeta } from '@/components/common/PageMeta';

export default function LoginPage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const location = useLocation();

  // Get the page user was trying to access before being redirected to login
  const from = location.state?.from?.pathname || '/dashboard';
  // Set by the user menu after Sign out everywhere.
  const signedOutEverywhere = location.state?.signedOutEverywhere === true;

  // If user is already authenticated, redirect
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // This component now only renders the content for the left panel of AuthLayout
  return (
    <>
      <PageMeta />
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
          {signedOutEverywhere && (
            <div
              role="status"
              className="mb-5 flex gap-2.5 rounded-lg bg-sidebar-accent px-3.5 py-3 text-sm leading-snug text-sidebar-accent-foreground"
            >
              <Info aria-hidden="true" className="mt-px size-[18px] shrink-0" />
              <div>
                <div className="font-medium">
                  You’ve been signed out everywhere.
                </div>
                <div className="mt-0.5">
                  Sign in again on any device you still use.
                </div>
              </div>
            </div>
          )}
          <LoginForm />
        </div>
      </div>
    </>
  );
}
